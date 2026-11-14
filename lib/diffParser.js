// src/client/review/diffParser.ts
const MAX_INLINE_CHARS = 300;
const MAX_INLINE_RUN = 10;
const MAX_INLINE_PAIRS = 200;
function spansOf(match) {
	const spans = [];
	let start = -1;
	for (let i = 0; i < match.length; i++) if (!match[i] && start < 0) start = i;
	else if (match[i] && start >= 0) {
		spans.push({
			start,
			end: i
		});
		start = -1;
	}
	if (start >= 0) spans.push({
		start,
		end: match.length
	});
	return spans;
}
/** Bounded LCS; returns changed char ranges for both lines, or null when pairing is pointless. */
function changedRanges(a, b) {
	const n = a.length;
	const m = b.length;
	if (n === 0 || m === 0 || n > MAX_INLINE_CHARS || m > MAX_INLINE_CHARS || a === b) return null;
	const stride = m + 1;
	const dp = new Uint16Array((n + 1) * stride);
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * stride + j] = a[i] === b[j] ? dp[(i + 1) * stride + j + 1] + 1 : Math.max(dp[(i + 1) * stride + j], dp[i * stride + j + 1]);
	const matchA = new Array(n).fill(false);
	const matchB = new Array(m).fill(false);
	let i = 0;
	let j = 0;
	while (i < n && j < m) if (a[i] === b[j]) {
		matchA[i] = true;
		matchB[j] = true;
		i++;
		j++;
	} else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) i++;
	else j++;
	const spansA = spansOf(matchA);
	const spansB = spansOf(matchB);
	if (spansA.length === 0 && spansB.length === 0) return null;
	return [spansA, spansB];
}
/** Pair equal-count del/add runs and tag changed character ranges on both sides. */
function markInlinePairs(rows) {
	let budget = MAX_INLINE_PAIRS;
	for (let i = 0; i < rows.length;) {
		if (rows[i].kind !== "del") {
			i++;
			continue;
		}
		const dels = [];
		while (i < rows.length && rows[i].kind === "del") dels.push(rows[i++]);
		const adds = [];
		while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++]);
		if (dels.length === 0 || dels.length !== adds.length || dels.length > MAX_INLINE_RUN) continue;
		for (let k = 0; k < dels.length && budget > 0; k++) {
			const delRow = dels[k];
			const addRow = adds[k];
			const spans = changedRanges(delRow.code, addRow.code);
			if (spans === null) continue;
			delRow.spans = spans[0];
			addRow.spans = spans[1];
			budget--;
		}
	}
}
/** Parse combined `git diff` text into structured per-file hunks & numbered lines. */
function parseStructuredDiff(raw) {
	const result = /* @__PURE__ */ new Map();
	if (!raw) return result;
	const lines = raw.split("\n");
	let currentFile = null;
	let add = 0;
	let del = 0;
	let binary = false;
	let rows = [];
	let headerLines = [];
	let hunks = [];
	let hunkStart = -1;
	let oldLine = 0;
	let newLine = 0;
	let inHunk = false;
	const flush = () => {
		if (currentFile !== null) {
			if (hunkStart >= 0) hunks.push({
				bannerIdx: hunkStart,
				endIdx: rows.length
			});
			markInlinePairs(rows);
			result.set(currentFile, {
				file: currentFile,
				add,
				del,
				rows,
				binary,
				headerLines,
				hunks
			});
		}
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith("diff --git ")) {
			flush();
			const m = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
			currentFile = m !== null ? m[2] : line.slice(11);
			add = 0;
			del = 0;
			binary = false;
			rows = [];
			headerLines = [];
			hunks = [];
			hunkStart = -1;
			inHunk = false;
			headerLines.push(line);
			continue;
		}
		if (currentFile === null) continue;
		if (line.startsWith("@@ ")) {
			const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
			if (m !== null) {
				if (hunkStart >= 0) hunks.push({
					bannerIdx: hunkStart,
					endIdx: rows.length
				});
				hunkStart = rows.length;
				oldLine = Number.parseInt(m[1], 10);
				newLine = Number.parseInt(m[2], 10);
				const endIdx = line.indexOf("@@", 2);
				const header = endIdx >= 0 ? line.slice(0, endIdx + 2) : line;
				const ctxText = (m[3] ?? "").trim();
				rows.push({
					kind: "hunk",
					sign: "@@",
					code: line,
					hunkHeader: header,
					hunkContext: ctxText
				});
				inHunk = true;
				continue;
			}
		}
		if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) binary = true;
		if (!inHunk) {
			headerLines.push(line);
			continue;
		}
		if (line.startsWith("\\ No newline at end of file")) {
			const last = rows[rows.length - 1];
			if (last !== void 0 && last.kind !== "hunk") last.noNewlineAfter = true;
			continue;
		}
		const prefix = line[0];
		if (prefix === "+") {
			add++;
			rows.push({
				kind: "add",
				newNo: newLine++,
				sign: "+",
				code: line.slice(1)
			});
		} else if (prefix === "-") {
			del++;
			rows.push({
				kind: "del",
				oldNo: oldLine++,
				sign: "-",
				code: line.slice(1)
			});
		} else if (prefix === " " || line === "") {
			if (line === "" && i === lines.length - 1) continue;
			rows.push({
				kind: "ctx",
				oldNo: oldLine++,
				newNo: newLine++,
				sign: " ",
				code: line.length > 0 ? line.slice(1) : ""
			});
		}
	}
	flush();
	return result;
}
/** Single status letter shown on a change row (`??` reads as A like VS Code). */
function changeLetter(change) {
	if (change.untracked) return "A";
	const ch = change.status.trim()[0];
	if (ch === "A") return "A";
	if (ch === "D") return "D";
	if (ch === "R" || ch === "C") return "R";
	return "M";
}
/**
* Rebuild a valid unified patch from the file header plus the selected hunk
* blocks (each block keeps its own context lines). Selection granularity is
* the whole hunk; line-level selection is intentionally not supported — it
* would require re-counting every `@@` header. For untracked files the
* resulting patch may be rejected by `git apply`; callers fall back to a
* whole-file commit for those.
*/
function assemblePatch(parsed, hunkRowIdx) {
	const wanted = new Set(hunkRowIdx);
	const spans = parsed.hunks.filter((h) => wanted.has(h.bannerIdx));
	if (spans.length === 0) return "";
	const out = [...parsed.headerLines];
	for (const span of spans) for (let i = span.bannerIdx; i < span.endIdx; i++) {
		const row = parsed.rows[i];
		if (row === void 0) continue;
		out.push(row.kind === "hunk" ? row.code : `${row.sign}${row.code}`);
		if (row.noNewlineAfter === true) out.push("\\ No newline at end of file");
	}
	return `${out.join("\n")}\n`;
}
/** Case-insensitive substring filter over subject / author / shortHash (client-side log search). */
function filterCommits(commits, query) {
	const q = query.trim().toLowerCase();
	if (q.length === 0) return commits;
	return commits.filter((c) => c.subject.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || c.shortHash.toLowerCase().includes(q));
}
export { assemblePatch, changeLetter, filterCommits, parseStructuredDiff };
