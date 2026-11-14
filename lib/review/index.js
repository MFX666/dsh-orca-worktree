import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
// .tsc-out/review/index.js
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
function randomHex6() {
	const bytes = /* @__PURE__ */ new Uint8Array(3);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const COMMAND_TIMEOUT_MS = 12e4;
const COMMAND_GRACE_MS = 5e3;
const MAX_OUTPUT_BYTES = 1 << 20;
const MAX_DIFF_STDOUT_BYTES = 4 << 20;
const MAX_DIFF_CHARS = 768e3;
const PER_FILE_DIFF_CHARS = 96e3;
const SUGGEST_DIFF_CHARS = 48e3;
const SUGGEST_TIMEOUT_MS = 6e4;
const NOISY_DIFF_PATHSPECS = [
	":(exclude)*.map",
	":(exclude)*.min.js",
	":(exclude)*.min.css",
	":(exclude)pnpm-lock.yaml",
	":(exclude)package-lock.json",
	":(exclude)yarn.lock"
];
const LOG_FORMAT = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1f%d%x1f%P%x1e";
const DEFAULT_LOG_LIMIT = 200;
const MAX_LOG_LIMIT = 1e3;
const MAX_BLAME_LINES = 5e3;
const FS_COPY_SCRIPT = "import fs from 'node:fs/promises'; const [src, dst] = process.argv.slice(1); await fs.copyFile(src, dst);\n";
const FS_WRITE_SCRIPT = "import fs from 'node:fs/promises'; const [dst, text] = process.argv.slice(1); await fs.writeFile(dst, text, 'utf8');\n";
const FS_UNLINK_SCRIPT = "import fs from 'node:fs/promises'; await Promise.all(process.argv.slice(1).map(p => fs.rm(p, { force: true })));\n";
const GIT_ENV = Object.fromEntries([
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_COMMON_DIR",
	"GIT_INDEX_FILE",
	"GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_CONFIG",
	"GIT_CONFIG_PARAMETERS",
	"GIT_CONFIG_COUNT",
	"GIT_CEILING_DIRECTORIES",
	"GIT_PREFIX",
	"GIT_SHALLOW_FILE",
	"GIT_GRAFT_FILE",
	"GIT_REPLACE_REF_BASE",
	"GIT_ATTR_SOURCE"
].map((key) => [key, void 0]));
var GitError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
function fail(error) {
	if (error instanceof GitError) return {
		ok: false,
		code: error.code,
		message: error.message
	};
	return {
		ok: false,
		code: "RPC_ERROR",
		message: error instanceof Error ? error.message : String(error)
	};
}
function ok(value) {
	return {
		ok: true,
		value: JSON.parse(JSON.stringify(value))
	};
}
/** Convert blame's raw `author-time` + `author-tz` into an ISO-8601 string. */
function isoFromEpoch(ts, tz) {
	const seconds = Number.parseInt(ts, 10);
	if (!Number.isFinite(seconds) || seconds < 0) return "";
	const match = /^([+-])(\d{2})(\d{2})$/.exec(tz.trim());
	const offsetMinutes = match ? (match[1] === "-" ? -1 : 1) * (Number.parseInt(match[2], 10) * 60 + Number.parseInt(match[3], 10)) : 0;
	const shifted = /* @__PURE__ */ new Date((seconds + offsetMinutes * 60) * 1e3);
	const sign = offsetMinutes < 0 ? "-" : "+";
	const abs = Math.abs(offsetMinutes);
	const hh = String(Math.trunc(abs / 60)).padStart(2, "0");
	const mm = String(abs % 60).padStart(2, "0");
	return `${shifted.toISOString().slice(0, 19)}${offsetMinutes === 0 ? "Z" : `${sign}${hh}:${mm}`}`;
}
/** C-quoted git path (e.g. `"spa ce\ttab"`) -> raw path; plain paths pass through. */
function unquoteGitPath(value) {
	if (!value.startsWith("\"") || value.length < 2) return value;
	let out = "";
	for (let i = 1; i < value.length; i++) {
		const ch = value[i];
		if (ch === "\"") break;
		if (ch !== "\\") {
			out += ch;
			continue;
		}
		const next = value[++i];
		if (next === void 0) break;
		const simple = {
			a: "\x07",
			b: "\b",
			f: "\f",
			n: "\n",
			r: "\r",
			t: "	",
			v: "\v",
			"\"": "\"",
			"\\": "\\"
		};
		if (simple[next] !== void 0) {
			out += simple[next];
			continue;
		}
		const octal = /^([0-7]{1,3})/.exec(value.slice(i));
		if (octal) {
			out += String.fromCharCode(Number.parseInt(octal[1], 8));
			i += octal[1].length - 1;
			continue;
		}
		out += next;
	}
	return out;
}
/** Validate one patch-side path: repo-relative, no `..` escape, no absolute/drive forms. */
function safePatchRelPath(rawPath) {
	let p = unquoteGitPath(rawPath).trim();
	if (p.length === 0 || p === "/dev/null" || p.startsWith("-")) return void 0;
	p = p.replace(/\\/g, "/");
	if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return void 0;
	const segments = [];
	for (const segment of p.split("/")) {
		if (segment.length === 0 || segment === ".") continue;
		if (segment === "..") {
			if (segments.length === 0) return void 0;
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	if (segments.length === 0) return void 0;
	return segments.join("/");
}
/** Repo-relative paths a patch touches; throws GIT_APPLY_FAILED on any escape attempt. */
function patchPathsOf(patch) {
	const found = /* @__PURE__ */ new Set();
	const require = (rawPath) => {
		const rel = safePatchRelPath(/^[ab]\//.test(rawPath) ? rawPath.slice(2) : rawPath);
		if (rel === void 0) throw new GitError("GIT_APPLY_FAILED", `patch path escapes the worktree: ${JSON.stringify(rawPath)}`);
		found.add(rel);
	};
	for (const rawLine of patch.split("\n")) {
		const line = rawLine.replace(/\r$/, "");
		if (line.startsWith("--- ") || line.startsWith("+++ ")) {
			const p = line.slice(4).split("	")[0] ?? "";
			if (p === "/dev/null") continue;
			require(p);
			continue;
		}
		if (line.startsWith("rename from ") || line.startsWith("copy from ")) {
			require(line.slice(12));
			continue;
		}
		if (line.startsWith("rename to ")) {
			require(line.slice(10));
			continue;
		}
		if (line.startsWith("copy to ")) {
			require(line.slice(8));
			continue;
		}
		if (line.startsWith("diff --git ")) {
			const parts = /^(?:"([^"]*)"|(\S+)) (?:"([^"]*)"|(\S+))$/.exec(line.slice(11));
			if (parts) for (const raw of [parts[1] ?? parts[2], parts[3] ?? parts[4]]) {
				const rawPath = raw ?? "";
				if (rawPath.length > 0 && rawPath !== "/dev/null") {
					const rel = safePatchRelPath(rawPath);
					if (rel !== void 0) found.add(rel);
				}
			}
		}
	}
	return [...found];
}
/** Truncate to a character budget on a line boundary. */
function truncateChars(text, maxChars) {
	if (text.length <= maxChars) return {
		text,
		truncated: false
	};
	const nl = text.lastIndexOf("\n", maxChars);
	return {
		text: nl > 0 ? text.slice(0, nl + 1) : text.slice(0, maxChars),
		truncated: true
	};
}
/** Unified multi-file diff text with diffTextOf-style budget + per-file sectioning. */
function sectionedDiffText(raw, wasLossy, maxChars) {
	let total = 0;
	let truncated = wasLossy;
	const parts = [];
	const perFileCap = Math.min(PER_FILE_DIFF_CHARS, maxChars);
	const appendSection = (section) => {
		if (total >= maxChars) {
			truncated = true;
			return false;
		}
		let text = section;
		if (total + text.length > maxChars) {
			const cut = Math.max(0, maxChars - total);
			const nl = text.lastIndexOf("\n", cut - 1);
			text = nl > 0 ? text.slice(0, nl + 1) : text.slice(0, cut);
			truncated = true;
		}
		if (text.length > perFileCap) {
			const nl = text.lastIndexOf("\n", perFileCap - 1);
			text = nl > 0 ? text.slice(0, nl + 1) : text.slice(0, perFileCap);
			truncated = true;
		}
		if (text.length > 0) {
			parts.push(text);
			total += text.length;
		}
		return total < maxChars;
	};
	let start = 0;
	while (start < raw.length) {
		const next = raw.indexOf("\ndiff --git ", start);
		if (!appendSection(next >= 0 ? raw.slice(start, next + 1) : raw.slice(start))) break;
		if (next < 0) break;
		start = next + 1;
	}
	return {
		diff: parts.join(""),
		truncated
	};
}
/** Parse `git log --pretty=format:${LOG_FORMAT}` output into contract rows. */
function parseCommitLogRows(stdout) {
	const rows = [];
	for (const segment of stdout.split("")) {
		const record = segment.replace(/^\n/, "");
		if (record.trim().length === 0) continue;
		const fields = record.split("");
		if (fields.length < 6) continue;
		const body = (fields[6] ?? "").replace(/\n+$/, "");
		const decorationsRaw = (fields[7] ?? "").trim();
		const refs = decorationsRaw.startsWith("(") && decorationsRaw.endsWith(")") ? decorationsRaw.slice(1, -1).split(",").map((item) => item.trim()).filter((item) => item.length > 0) : [];
		const parents = (fields[8] ?? "").split(" ").filter((hash) => hash.length > 0);
		rows.push({
			hash: fields[0],
			shortHash: fields[1],
			author: fields[2],
			email: fields[3],
			date: fields[4],
			subject: fields[5],
			...body.length > 0 ? { body } : {},
			parents,
			refs
		});
	}
	return rows;
}
/** Parse `git diff-tree --name-status` TSV (`old\tnew`, old first). */
function parseNameStatusText(stdout) {
	const rows = [];
	for (const line of stdout.split("\n")) {
		if (line.length === 0) continue;
		const [status = "", oldPath = "", newPath = ""] = line.split("	");
		if (status.length === 0) continue;
		const renameOrCopy = status.startsWith("R") || status.startsWith("C");
		const file = renameOrCopy ? newPath : oldPath;
		if (file.length === 0) continue;
		rows.push({
			file,
			status,
			staged: true,
			untracked: false,
			...renameOrCopy && oldPath.length > 0 ? { oldFile: oldPath } : {}
		});
	}
	return rows;
}
/** Parse `git diff --name-status -z` NUL stream (`status\0old\0new`, old first). */
function parseNameStatusZ(stdout) {
	const rows = [];
	const tokens = stdout.split("\0");
	for (let i = 0; i < tokens.length; i++) {
		const status = tokens[i];
		if (status.length === 0) continue;
		const renameOrCopy = status.startsWith("R") || status.startsWith("C");
		const oldFile = tokens[i + 1] ?? "";
		const file = renameOrCopy ? tokens[i + 2] ?? "" : oldFile;
		if (file.length === 0) continue;
		i += renameOrCopy ? 2 : 1;
		rows.push({
			file,
			status,
			staged: true,
			untracked: false,
			...renameOrCopy && oldFile.length > 0 ? { oldFile } : {}
		});
	}
	return rows;
}
/** Parse `git blame --porcelain` into deduped commits + per-line entries. */
function parseBlamePorcelain(stdout) {
	const commits = [];
	const indexByHash = /* @__PURE__ */ new Map();
	const lines = [];
	let truncated = false;
	let pending;
	let meta = {
		author: "",
		time: "",
		tz: "",
		subject: ""
	};
	const emit = (code) => {
		if (pending === void 0) return;
		let idx = indexByHash.get(pending.hash);
		if (idx === void 0) {
			idx = commits.length;
			indexByHash.set(pending.hash, idx);
			commits.push({
				hash: pending.hash,
				author: meta.author,
				date: isoFromEpoch(meta.time, meta.tz),
				subject: meta.subject
			});
		}
		if (lines.length < MAX_BLAME_LINES) lines.push({
			commit: idx,
			oldNo: pending.oldNo,
			newNo: pending.newNo,
			code
		});
		else truncated = true;
		pending = void 0;
	};
	for (const raw of stdout.split("\n")) {
		const header = /^([0-9a-f]{40,64}) (\d+) (\d+)(?: \d+)?$/.exec(raw);
		if (header) {
			emit("");
			pending = {
				hash: header[1],
				oldNo: Number.parseInt(header[2], 10),
				newNo: Number.parseInt(header[3], 10)
			};
			meta = {
				author: "",
				time: "",
				tz: "",
				subject: ""
			};
			continue;
		}
		if (raw.startsWith("	")) {
			emit(raw.slice(1));
			continue;
		}
		if (raw.startsWith("author ")) meta.author = raw.slice(7);
		else if (raw.startsWith("author-time ")) meta.time = raw.slice(12);
		else if (raw.startsWith("author-tz ")) meta.tz = raw.slice(10);
		else if (raw.startsWith("summary ")) meta.subject = raw.slice(8);
	}
	return {
		commits,
		lines,
		truncated
	};
}
let GitReviewService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _branches_decorators;
	let _status_decorators;
	let _diff_decorators;
	let _commit_decorators;
	let _push_decorators;
	let _log_decorators;
	let _showCommit_decorators;
	let _compare_decorators;
	let _blame_decorators;
	let _applyPatch_decorators;
	let _suggestCommitMessage_decorators;
	return class GitReviewService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_branches_decorators = [Remote("branches")];
			_status_decorators = [Remote("status")];
			_diff_decorators = [Remote("diff")];
			_commit_decorators = [Remote("commit")];
			_push_decorators = [Remote("push")];
			_log_decorators = [Remote("log")];
			_showCommit_decorators = [Remote("showCommit")];
			_compare_decorators = [Remote("compare")];
			_blame_decorators = [Remote("blame")];
			_applyPatch_decorators = [Remote("applyPatch")];
			_suggestCommitMessage_decorators = [Remote("suggestCommitMessage")];
			__esDecorate(this, null, _branches_decorators, {
				kind: "method",
				name: "branches",
				static: false,
				private: false,
				access: {
					has: (obj) => "branches" in obj,
					get: (obj) => obj.branches
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _diff_decorators, {
				kind: "method",
				name: "diff",
				static: false,
				private: false,
				access: {
					has: (obj) => "diff" in obj,
					get: (obj) => obj.diff
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _commit_decorators, {
				kind: "method",
				name: "commit",
				static: false,
				private: false,
				access: {
					has: (obj) => "commit" in obj,
					get: (obj) => obj.commit
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _push_decorators, {
				kind: "method",
				name: "push",
				static: false,
				private: false,
				access: {
					has: (obj) => "push" in obj,
					get: (obj) => obj.push
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _log_decorators, {
				kind: "method",
				name: "log",
				static: false,
				private: false,
				access: {
					has: (obj) => "log" in obj,
					get: (obj) => obj.log
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _showCommit_decorators, {
				kind: "method",
				name: "showCommit",
				static: false,
				private: false,
				access: {
					has: (obj) => "showCommit" in obj,
					get: (obj) => obj.showCommit
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _compare_decorators, {
				kind: "method",
				name: "compare",
				static: false,
				private: false,
				access: {
					has: (obj) => "compare" in obj,
					get: (obj) => obj.compare
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _blame_decorators, {
				kind: "method",
				name: "blame",
				static: false,
				private: false,
				access: {
					has: (obj) => "blame" in obj,
					get: (obj) => obj.blame
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _applyPatch_decorators, {
				kind: "method",
				name: "applyPatch",
				static: false,
				private: false,
				access: {
					has: (obj) => "applyPatch" in obj,
					get: (obj) => obj.applyPatch
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _suggestCommitMessage_decorators, {
				kind: "method",
				name: "suggestCommitMessage",
				static: false,
				private: false,
				access: {
					has: (obj) => "suggestCommitMessage" in obj,
					get: (obj) => obj.suggestCommitMessage
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = [
			"fs",
			"subprocess",
			"tools"
		];
		constructor(ctx) {
			super(ctx, "rGitReview");
			__runInitializers(this, _instanceExtraInitializers);
			this.registerTools();
		}
		fs() {
			return this.ctx.fs;
		}
		getService(key) {
			const getter = this.ctx.get;
			if (typeof getter === "function") return getter.call(this.ctx, key);
			return this.ctx[key];
		}
		host() {
			return {
				subprocess: this.getService("subprocess"),
				tools: this.getService("tools"),
				sandbox: this.getService("sandbox"),
				sandboxPolicy: this.getService("sandboxPolicy"),
				llm: this.getService("llm")
			};
		}
		/** List remote & local branches (newest commit first) and default base ref for worktree creation. */
		async branches(repositoryRoot, refresh, signal) {
			try {
				const policy = { mode: "danger-full-access" };
				const root = await this.repositoryRootOf(policy, repositoryRoot, signal);
				const run = this.gitRunner(policy, signal);
				if (refresh === true) await run(root, [
					"fetch",
					"--all",
					"--prune",
					"--quiet"
				], [
					0,
					1,
					128
				]).catch(() => {});
				const listed = await run(root, [
					"for-each-ref",
					"--sort=-committerdate",
					"--format=%(refname)	%(symref)",
					"refs/remotes",
					"refs/heads"
				], [0, 128]);
				const remoteBranches = [];
				const localBranches = [];
				let originHead;
				for (const rawLine of listed.stdout.split("\n")) {
					if (rawLine.length === 0) continue;
					const [refname = "", symref = ""] = rawLine.split("	");
					if (refname === "refs/remotes/origin/HEAD" && symref.startsWith("refs/remotes/")) {
						originHead = symref.slice(13);
						continue;
					}
					if (symref.length > 0) continue;
					if (refname.startsWith("refs/remotes/")) {
						const short = refname.slice(13);
						if (short.includes("/") && !short.endsWith("/HEAD")) remoteBranches.push(short);
					} else if (refname.startsWith("refs/heads/")) {
						const short = refname.slice(11);
						if (short.length > 0) localBranches.push(short);
					}
				}
				if (originHead !== void 0) {
					const idx = remoteBranches.indexOf(originHead);
					if (idx > 0) {
						remoteBranches.splice(idx, 1);
						remoteBranches.unshift(originHead);
					}
				}
				const currentBranch = await this.branchOf(policy, root, signal);
				return ok({
					remoteBranches,
					localBranches,
					defaultBase: originHead ?? remoteBranches.find((b) => b === "origin/main" || b === "origin/master" || b === "origin/develop") ?? remoteBranches[0] ?? (currentBranch !== void 0 && localBranches.includes(currentBranch) ? currentBranch : void 0) ?? localBranches[0] ?? "HEAD"
				});
			} catch (error) {
				return fail(error);
			}
		}
		/**
		/** Branch / dirty / ahead-behind report for one checkout. */
		async status(path, signal) {
			try {
				return ok(await this.statusInternal({ mode: "danger-full-access" }, path, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Working-tree changes + combined (or single-file) diff text. */
		async diff(path, file, ignoreWhitespace, signal) {
			try {
				return ok(await this.diffInternal({ mode: "danger-full-access" }, path, signal, file, ignoreWhitespace === true));
			} catch (error) {
				return fail(error);
			}
		}
		/** Commit the working tree with `message`, staging exactly `files`, or only the selected `hunks` via a throwaway temp index (the user's real index and worktree stay untouched). */
		async commit(path, message, files, hunks, signal) {
			try {
				return ok(await this.commitInternal({ mode: "danger-full-access" }, path, message, files, hunks, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Push the current branch to its upstream, establishing one via `-u` when missing; `forceWithLease` performs a safe force push. */
		async push(path, forceWithLease, signal) {
			try {
				return ok(await this.pushInternal({ mode: "danger-full-access" }, path, forceWithLease === true, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Commit history for the branch range or a single file, newest first, ISO dates. */
		async log(path, refRange, file, limit, signal) {
			try {
				return ok(await this.logInternal({ mode: "danger-full-access" }, path, refRange, file, limit, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** One commit's changed files (changesOf semantics) plus its unified diff. */
		async showCommit(path, hash, signal) {
			try {
				return ok(await this.showCommitInternal({ mode: "danger-full-access" }, path, hash, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Commits, changes and diff between `ref` (inclusive) and HEAD (three-dot). */
		async compare(path, ref, signal) {
			try {
				return ok(await this.compareInternal({ mode: "danger-full-access" }, path, ref, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Line-by-line attribution of one file via `git blame --porcelain`. */
		async blame(path, file, signal) {
			try {
				return ok(await this.blameInternal({ mode: "danger-full-access" }, path, file, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Apply a unified patch to the worktree, the index (--cached), or reversed. */
		async applyPatch(path, patch, cached, reverse, signal) {
			try {
				return ok(await this.applyPatchInternal({ mode: "danger-full-access" }, path, patch, cached, reverse, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Draft one commit message from the working-tree diff via the mounted LLM provider. */
		async suggestCommitMessage(path, signal) {
			try {
				return ok(await this.suggestCommitMessageInternal({ mode: "danger-full-access" }, path, signal));
			} catch (error) {
				return fail(error);
			}
		}
		async statusInternal(policy, path, signal) {
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const branch = await this.branchOf(policy, canonical, signal);
			const dirtyCount = await this.dirtyCountOf(policy, canonical, signal);
			const run = this.gitRunner(policy, signal);
			const counts = await run(canonical, [
				"rev-list",
				"--left-right",
				"--count",
				"HEAD...@{upstream}"
			], [
				0,
				1,
				128
			]);
			let ahead;
			let behind;
			if (counts.exitCode === 0) {
				const [aheadText, behindText] = counts.stdout.trim().split(/\s+/);
				ahead = Number.parseInt(aheadText ?? "0", 10);
				behind = Number.parseInt(behindText ?? "0", 10);
			}
			const up = await run(canonical, [
				"rev-parse",
				"--abbrev-ref",
				"--symbolic-full-name",
				"@{upstream}"
			], [
				0,
				1,
				128
			]);
			const upstream = up.exitCode === 0 ? up.stdout.trim() || void 0 : void 0;
			return {
				path: canonical,
				branch: branch ?? "detached",
				dirtyCount,
				ahead,
				behind,
				upstream
			};
		}
		/** Parse `git status --porcelain -z` (with `--untracked-files=all`) + `--numstat` into change rows. */
		async changesOf(run, canonical, signal) {
			const [st, numstat] = await Promise.all([run(canonical, [
				"status",
				"--porcelain",
				"-z",
				"--untracked-files=all"
			], [0, 128], true), run(canonical, [
				"diff",
				"--numstat",
				"-z",
				"HEAD"
			], [0, 128], true).catch(() => ({
				stdout: "",
				exitCode: 128
			}))]);
			const statsByFile = /* @__PURE__ */ new Map();
			if (numstat.exitCode === 0 && numstat.stdout.length > 0) {
				const parts = numstat.stdout.split("\0");
				for (let i = 0; i < parts.length; i++) {
					const seg = parts[i];
					if (seg.length === 0) continue;
					const t1 = seg.indexOf("	");
					const t2 = t1 >= 0 ? seg.indexOf("	", t1 + 1) : -1;
					if (t1 < 0 || t2 < 0) continue;
					const addRaw = seg.slice(0, t1);
					const delRaw = seg.slice(t1 + 1, t2);
					let filePath = seg.slice(t2 + 1);
					if (filePath.length === 0) {
						filePath = parts[i + 2] ?? parts[i + 1] ?? "";
						i += 2;
					}
					if (filePath.length > 0 && addRaw !== "-" && delRaw !== "-") statsByFile.set(filePath, {
						add: Number.parseInt(addRaw, 10) || 0,
						del: Number.parseInt(delRaw, 10) || 0
					});
				}
			}
			const changes = [];
			const tokens = st.stdout.split("\0");
			for (let i = 0; i < tokens.length; i++) {
				const token = tokens[i];
				if (token.length < 4) continue;
				const x = token[0];
				const y = token[1];
				if (x === " " && y === " ") continue;
				const file = token.slice(3);
				const stat = statsByFile.get(file);
				const row = {
					file,
					status: token.slice(0, 2),
					staged: x !== " " && x !== "?",
					untracked: x === "?" && y === "?"
				};
				if (stat !== void 0) {
					row.add = stat.add;
					row.del = stat.del;
				}
				if (x === "R" || x === "C") {
					const oldFile = tokens[i + 1] ?? "";
					i++;
					if (oldFile.length > 0) row.oldFile = oldFile;
				}
				changes.push(row);
			}
			return changes;
		}
		/**
		* Combined (or single-file) working-tree diff text:
		* - Single-file mode (`onlyFile` set): fetches just that file up to `maxChars`, even `.map` / lockfiles.
		* - Overview mode: excludes noisy build maps/lockfiles in the first pass and caps each file at
		*   `PER_FILE_DIFF_CHARS` so one large bundle never starves source files alphabetically after it!
		*/
		async diffTextOf(run, canonical, changes, maxChars, signal, onlyFile, ignoreWhitespace) {
			const wsFlag = ignoreWhitespace === true ? ["--ignore-all-space"] : [];
			if (onlyFile !== void 0 && onlyFile.length > 0) {
				if (onlyFile.startsWith("-")) throw new GitError("GIT_DIFF_FAILED", "invalid file path");
				const res = changes.find((c) => c.file === onlyFile)?.untracked ? await run(canonical, [
					"diff",
					"--no-color",
					"--no-index",
					"--",
					"/dev/null",
					onlyFile
				], [0, 1], true).catch(() => ({
					stdout: "",
					exitCode: 0,
					lossy: false
				})) : await run(canonical, [
					"diff",
					"--no-color",
					"--no-ext-diff",
					...wsFlag,
					"HEAD",
					"--",
					onlyFile
				], [0, 128], true).catch(() => ({
					stdout: "",
					exitCode: 128,
					lossy: false
				}));
				const truncated = Boolean(res.lossy) || res.stdout.length > maxChars;
				return {
					diff: truncated ? res.stdout.slice(0, maxChars) : res.stdout,
					truncated
				};
			}
			const parts = [];
			let total = 0;
			let truncated = false;
			const perFileCap = Math.min(PER_FILE_DIFF_CHARS, maxChars);
			const appendSection = (section) => {
				if (total >= maxChars) {
					truncated = true;
					return false;
				}
				let chunk = section;
				if (chunk.length > perFileCap) {
					const nl = chunk.lastIndexOf("\n", perFileCap);
					chunk = nl > 0 ? `${chunk.slice(0, nl + 1)}` : chunk.slice(0, perFileCap);
					truncated = true;
				}
				if (chunk.length > maxChars - total) {
					const nl = chunk.lastIndexOf("\n", maxChars - total);
					chunk = nl > 0 ? chunk.slice(0, nl + 1) : chunk.slice(0, maxChars - total);
					truncated = true;
				}
				parts.push(chunk);
				total += chunk.length;
				return total < maxChars;
			};
			const appendMultiFileDiff = (raw, wasLossy) => {
				if (wasLossy) truncated = true;
				if (raw.length === 0) return;
				let start = 0;
				while (start < raw.length) {
					const next = raw.indexOf("\ndiff --git ", start);
					const section = next >= 0 ? raw.slice(start, next + 1) : raw.slice(start);
					if (!appendSection(section)) break;
					if (next < 0) break;
					start = next + 1;
				}
			};
			const isNoisy = (file) => /\.(map|lock)$|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$|\.min\.(js|css)$/.test(file);
			const trackedMain = await run(canonical, [
				"diff",
				"--no-color",
				"--no-ext-diff",
				...wsFlag,
				"HEAD",
				"--",
				".",
				...NOISY_DIFF_PATHSPECS
			], [0, 128], true).catch(() => ({
				stdout: "",
				exitCode: 128,
				lossy: false
			}));
			if (trackedMain.exitCode === 128) {
				const stagedOnly = await run(canonical, [
					"diff",
					"--no-color",
					"--no-ext-diff",
					...wsFlag,
					"--cached",
					"--",
					".",
					...NOISY_DIFF_PATHSPECS
				], [0, 128], true).catch(() => ({
					stdout: "",
					exitCode: 128,
					lossy: false
				}));
				appendMultiFileDiff(stagedOnly.stdout, Boolean(stagedOnly.lossy));
			} else appendMultiFileDiff(trackedMain.stdout, Boolean(trackedMain.lossy));
			const untrackedChanges = [...changes.filter((c) => c.untracked && !isNoisy(c.file)), ...changes.filter((c) => c.untracked && isNoisy(c.file))];
			for (const change of untrackedChanges) {
				if (total >= maxChars) {
					truncated = true;
					break;
				}
				const one = await run(canonical, [
					"diff",
					"--no-color",
					"--no-index",
					"--",
					"/dev/null",
					change.file
				], [0, 1], true).catch(() => ({
					stdout: "",
					exitCode: 0,
					lossy: false
				}));
				if (one.lossy) truncated = true;
				if (one.stdout.length > 0 && !appendSection(one.stdout)) break;
			}
			if (changes.some((c) => !c.untracked && isNoisy(c.file))) for (const noisy of changes.filter((c) => !c.untracked && isNoisy(c.file))) {
				if (total >= maxChars) {
					truncated = true;
					break;
				}
				const one = await run(canonical, [
					"diff",
					"--no-color",
					"--no-ext-diff",
					...wsFlag,
					"HEAD",
					"--",
					noisy.file
				], [0, 128], true).catch(() => ({
					stdout: "",
					exitCode: 128,
					lossy: false
				}));
				if (one.lossy) truncated = true;
				if (one.stdout.length > 0 && !appendSection(one.stdout)) break;
			}
			return {
				diff: parts.join(""),
				truncated
			};
		}
		async diffInternal(policy, path, signal, onlyFile, ignoreWhitespace) {
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			const changes = await this.changesOf(run, canonical, signal);
			const { diff, truncated } = await this.diffTextOf(run, canonical, changes, MAX_DIFF_CHARS, signal, onlyFile, ignoreWhitespace);
			return {
				path: canonical,
				branch,
				changes,
				diff,
				truncated
			};
		}
		async commitInternal(policy, path, message, files, hunks, signal) {
			const trimmed = message.replace(/^\s+|\s+$/g, "");
			if (trimmed.length === 0) throw new GitError("GIT_COMMIT_FAILED", "commit message is empty");
			if (files !== void 0 && (files.length === 0 || files.some((f) => typeof f !== "string" || f.length === 0 || f.startsWith("-")))) throw new GitError("GIT_COMMIT_FAILED", "invalid file list");
			const hunkList = [];
			if (hunks !== void 0) {
				if (!Array.isArray(hunks)) throw new GitError("GIT_COMMIT_FAILED", "invalid hunk list");
				for (const rawHunk of hunks) {
					const hunk = rawHunk;
					if (hunk === null || typeof hunk !== "object" || typeof hunk.file !== "string" || hunk.file.length === 0 || hunk.file.startsWith("-") || typeof hunk.patch !== "string" || hunk.patch.trim().length === 0) throw new GitError("GIT_COMMIT_FAILED", "invalid hunk patch");
					hunkList.push({
						file: hunk.file,
						patch: hunk.patch
					});
				}
			}
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			if (hunkList.length === 0) {
				if (files !== void 0) await run(canonical, [
					"add",
					"--",
					...files
				]).catch((error) => {
					throw new GitError("GIT_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
				});
				try {
					await run(canonical, [
						"commit",
						"-m",
						trimmed,
						...files !== void 0 ? [
							"--only",
							"--",
							...files
						] : []
					]);
				} catch (error) {
					throw new GitError("GIT_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
				}
				const short = await run(canonical, [
					"rev-parse",
					"--short=7",
					"HEAD"
				], [0, 128]);
				const summary = await run(canonical, [
					"log",
					"-1",
					"--pretty=%s"
				], [0, 128]);
				const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
				return {
					path: canonical,
					commit: short.stdout.trim(),
					summary: summary.stdout.trim(),
					branch
				};
			}
			const realIndex = await this.gitPathOf(run, canonical, "index");
			const tmpIndex = await this.gitPathOf(run, canonical, `owt-commit-${randomHex6()}.index`);
			const runIdx = this.gitRunner(policy, signal, COMMAND_TIMEOUT_MS, { GIT_INDEX_FILE: tmpIndex });
			const patchFiles = [];
			try {
				try {
					await this.runFsScript(policy, canonical, FS_COPY_SCRIPT, [realIndex, tmpIndex], signal);
				} catch {
					await runIdx(canonical, ["read-tree", "--empty"]).catch((error) => {
						throw new GitError("GIT_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
					});
				}
				if (files !== void 0) await runIdx(canonical, [
					"add",
					"--",
					...files
				]).catch((error) => {
					throw new GitError("GIT_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
				});
				const wholeFileAdded = new Set(files ?? []);
				const untracked = new Set((await runIdx(canonical, [
					"ls-files",
					"--others",
					"--exclude-standard",
					"-z"
				], [0], true)).stdout.split("\0").filter(Boolean));
				for (const hunk of hunkList) {
					if (wholeFileAdded.has(hunk.file)) continue;
					if (untracked.has(hunk.file)) try {
						await runIdx(canonical, [
							"add",
							"--intent-to-add",
							"--",
							hunk.file
						]);
					} catch {
						await runIdx(canonical, [
							"add",
							"--",
							hunk.file
						]).catch((error) => {
							throw new GitError("GIT_APPLY_FAILED", error instanceof Error ? error.message : String(error));
						});
						wholeFileAdded.add(hunk.file);
						continue;
					}
					const normalizedPatch = hunk.patch.endsWith("\n") ? hunk.patch : `${hunk.patch}\n`;
					patchPathsOf(normalizedPatch);
					const tmpPatch = await this.gitPathOf(runIdx, canonical, `owt-hunk-${randomHex6()}.diff`);
					patchFiles.push(tmpPatch);
					await this.runFsScript(policy, canonical, FS_WRITE_SCRIPT, [tmpPatch, normalizedPatch], signal);
					await runIdx(canonical, [
						"apply",
						"--cached",
						"--whitespace=nowarn",
						tmpPatch
					]).catch((error) => {
						throw new GitError("GIT_APPLY_FAILED", error instanceof Error ? error.message : String(error));
					});
				}
				try {
					await runIdx(canonical, [
						"commit",
						"-m",
						trimmed
					]);
				} catch (error) {
					throw new GitError("GIT_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
				}
			} finally {
				await this.runFsScript(policy, canonical, FS_UNLINK_SCRIPT, [tmpIndex, ...patchFiles], void 0).catch(() => {});
			}
			const short = await run(canonical, [
				"rev-parse",
				"--short=7",
				"HEAD"
			], [0, 128]);
			const summary = await run(canonical, [
				"log",
				"-1",
				"--pretty=%s"
			], [0, 128]);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			return {
				path: canonical,
				commit: short.stdout.trim(),
				summary: summary.stdout.trim(),
				branch
			};
		}
		async pushInternal(policy, path, forceWithLease, signal) {
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			const upstreamRes = await run(canonical, [
				"rev-parse",
				"--abbrev-ref",
				"--symbolic-full-name",
				"@{upstream}"
			], [
				0,
				1,
				128
			]);
			const existingUpstream = upstreamRes.exitCode === 0 ? upstreamRes.stdout.trim() : "";
			if (existingUpstream.length > 0) {
				await run(canonical, ["push", ...forceWithLease === true ? ["--force-with-lease"] : []]).catch((error) => {
					throw new GitError("GIT_PUSH_FAILED", error instanceof Error ? error.message : String(error));
				});
				return {
					path: canonical,
					branch,
					upstream: existingUpstream
				};
			}
			const remote = (await run(canonical, ["remote"], [0, 128]).catch(() => ({
				stdout: "",
				exitCode: 128
			}))).stdout.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
			if (remote === void 0) throw new GitError("GIT_PUSH_FAILED", "no remote configured for this checkout");
			await run(canonical, [
				"push",
				"-u",
				remote,
				branch
			]).catch((error) => {
				throw new GitError("GIT_PUSH_FAILED", error instanceof Error ? error.message : String(error));
			});
			return {
				path: canonical,
				branch,
				upstream: `${remote}/${branch}`
			};
		}
		async suggestCommitMessageInternal(policy, path, signal) {
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			const changes = await this.changesOf(run, canonical, signal);
			if (changes.length === 0) throw new GitError("GIT_COMMIT_FAILED", "no working-tree changes to describe");
			const { diff } = await this.diffTextOf(run, canonical, changes, SUGGEST_DIFF_CHARS, signal);
			const log = await run(canonical, [
				"log",
				"--oneline",
				"-8"
			], [0, 128]).catch(() => ({
				stdout: "",
				exitCode: 128
			}));
			const llm = this.host().llm;
			if (llm === void 0) throw new GitError("GIT_LLM_UNAVAILABLE", "llm service is not mounted in this DSH profile");
			const provider = llm.listProviders()[0]?.id;
			if (provider === void 0) throw new GitError("GIT_LLM_UNAVAILABLE", "no LLM provider adapter is registered");
			const model = (await llm.listModels(provider).catch(() => []))[0]?.id;
			if (model === void 0) throw new GitError("GIT_LLM_UNAVAILABLE", `provider ${provider} advertises no models`);
			const signals = [AbortSignal.timeout(SUGGEST_TIMEOUT_MS)];
			if (signal !== void 0) signals.push(signal);
			const llmSignal = AbortSignal.any(signals);
			const recent = log.stdout.trim();
			const prompt = [
				`Branch: ${branch}`,
				recent.length > 0 ? `Recent commit subjects (match their style/language):\n${recent}` : "No commit history yet.",
				"Write one git commit message for the staged-and-unstaged diff below.",
				"Rules: first line = imperative subject <= 72 chars, no trailing period; then one blank line;",
				"body <= 5 bullet lines explaining the why; reply with the raw message only, no quotes, no fences, no explanations.",
				"--- DIFF ---",
				diff
			].join("\n");
			let text = "";
			try {
				for await (const chunk of llm.stream({
					provider,
					model,
					system: "You are a precise git commit-message writer. Output only the commit message text.",
					messages: [{
						role: "user",
						content: [{
							type: "text",
							text: prompt
						}]
					}],
					maxTokens: 512,
					signal: llmSignal
				})) {
					if (chunk.type === "text-delta" && typeof chunk.text === "string") text += chunk.text;
					if (llmSignal.aborted) break;
				}
			} catch (error) {
				throw new GitError("GIT_LLM_UNAVAILABLE", `commit message generation failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			const cleaned = text.trim().replace(/^```[a-z]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
			if (cleaned.length === 0) throw new GitError("GIT_LLM_UNAVAILABLE", "model returned an empty commit message");
			return {
				path: canonical,
				message: cleaned,
				provider,
				model
			};
		}
		/** Resolve a git-dir-relative path (e.g. `index`, temp patch) to an absolute path. */
		async gitPathOf(run, canonical, name) {
			const p = (await run(canonical, [
				"rev-parse",
				"--git-path",
				name
			])).stdout.trim();
			return p.startsWith("/") ? p : `${canonical}/${p}`;
		}
		/** Run a tiny node script for file ops fs() cannot express (git prefix `${run.prefix}`). */
		async runFsScript(policy, cwd, script, args, signal) {
			await this.runArgv(policy, cwd, [
				"node",
				"--input-type=module",
				"-e",
				script,
				...args
			], COMMAND_TIMEOUT_MS, signal, [0]);
		}
		async commitRowsOf(run, canonical, extraArgs, limit) {
			const res = await run(canonical, [
				"log",
				`--pretty=format:${LOG_FORMAT}`,
				"--date=iso-strict",
				`--max-count=${limit + 1}`,
				...extraArgs
			], [0], true).catch((error) => {
				throw new GitError("GIT_LOG_FAILED", error instanceof Error ? error.message : String(error));
			});
			const rows = parseCommitLogRows(res.stdout);
			return {
				commits: rows.slice(0, limit),
				truncated: res.lossy || rows.length > limit
			};
		}
		async logInternal(policy, path, refRange, file, limit, signal) {
			for (const rev of [refRange, file]) if (rev !== void 0 && (rev.length === 0 || rev.startsWith("-") || rev.length > 512)) throw new GitError("GIT_LOG_FAILED", `invalid argument: ${JSON.stringify(rev)}`);
			const requested = Math.trunc(Number(limit ?? DEFAULT_LOG_LIMIT));
			const bounded = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_LOG_LIMIT) : DEFAULT_LOG_LIMIT;
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const args = [
				"log",
				`--pretty=format:${LOG_FORMAT}`,
				"--date=iso-strict",
				`--max-count=${bounded + 1}`
			];
			if (refRange !== void 0) args.push(refRange);
			if (file !== void 0) args.push("--follow", "--", file);
			const res = await run(canonical, args, refRange === void 0 && file === void 0 ? [0, 128] : [0], true).catch((error) => {
				throw new GitError("GIT_LOG_FAILED", error instanceof Error ? error.message : String(error));
			});
			if (res.exitCode === 128) return {
				path: canonical,
				commits: []
			};
			const rows = parseCommitLogRows(res.stdout);
			const truncated = res.lossy || rows.length > bounded;
			return {
				path: canonical,
				commits: rows.slice(0, bounded),
				...truncated ? { truncated: true } : {}
			};
		}
		async showCommitInternal(policy, path, hash, signal) {
			if (!/^[0-9a-f]{7,64}$/i.test(hash)) throw new GitError("GIT_DIFF_FAILED", `invalid commit hash: ${JSON.stringify(hash)}`);
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			const changes = parseNameStatusText((await run(canonical, [
				"diff-tree",
				"--no-commit-id",
				"--name-status",
				"-r",
				"-M",
				"--root",
				hash
			], [0], true).catch((error) => {
				throw new GitError("GIT_DIFF_FAILED", error instanceof Error ? error.message : String(error));
			})).stdout);
			const shown = await run(canonical, [
				"show",
				"--format=",
				"--no-color",
				"--no-ext-diff",
				"--diff-merges=off",
				hash,
				"--",
				".",
				...NOISY_DIFF_PATHSPECS
			], [0], true).catch((error) => {
				throw new GitError("GIT_DIFF_FAILED", error instanceof Error ? error.message : String(error));
			});
			const { text, truncated } = truncateChars(shown.stdout, MAX_DIFF_CHARS);
			return {
				path: canonical,
				hash,
				branch,
				changes,
				diff: text,
				...truncated || shown.lossy ? { truncated: true } : {}
			};
		}
		async compareInternal(policy, path, ref, signal) {
			if (ref.length === 0 || ref.startsWith("-") || /\s/.test(ref) || ref.length > 256) throw new GitError("GIT_DIFF_FAILED", `invalid ref: ${JSON.stringify(ref)}`);
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			if ((await run(canonical, [
				"rev-parse",
				"--verify",
				"--quiet",
				`${ref}^{commit}`
			], [0, 1])).exitCode !== 0) throw new GitError("GIT_DIFF_FAILED", `unknown ref: ${ref}`);
			const { commits, truncated: commitsTruncated } = await this.commitRowsOf(run, canonical, [`${ref}..HEAD`], DEFAULT_LOG_LIMIT);
			const changes = parseNameStatusZ((await run(canonical, [
				"diff",
				"--name-status",
				"-z",
				"-M",
				`${ref}...HEAD`
			], [0], true).catch((error) => {
				throw new GitError("GIT_DIFF_FAILED", error instanceof Error ? error.message : String(error));
			})).stdout);
			const ranged = await run(canonical, [
				"diff",
				"--no-color",
				"--no-ext-diff",
				`${ref}...HEAD`,
				"--",
				".",
				...NOISY_DIFF_PATHSPECS
			], [0], true).catch((error) => {
				throw new GitError("GIT_DIFF_FAILED", error instanceof Error ? error.message : String(error));
			});
			const { diff, truncated: diffTruncated } = sectionedDiffText(ranged.stdout, ranged.lossy, MAX_DIFF_CHARS);
			return {
				path: canonical,
				branch,
				ref,
				commits,
				changes,
				diff,
				...commitsTruncated || diffTruncated ? { truncated: true } : {}
			};
		}
		async blameInternal(policy, path, file, signal) {
			if (file.length === 0 || file.startsWith("-")) throw new GitError("GIT_BLAME_FAILED", `invalid file path: ${JSON.stringify(file)}`);
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const blamed = await this.gitRunner(policy, signal)(canonical, [
				"blame",
				"--porcelain",
				"--",
				file
			], [0], true).catch((error) => {
				throw new GitError("GIT_BLAME_FAILED", error instanceof Error ? error.message : String(error));
			});
			const parsed = parseBlamePorcelain(blamed.stdout);
			return {
				path: canonical,
				file,
				commits: parsed.commits,
				lines: parsed.lines,
				...parsed.truncated || blamed.lossy ? { truncated: true } : {}
			};
		}
		async applyPatchInternal(policy, path, patch, cached, reverse, signal) {
			if (typeof patch !== "string" || patch.trim().length === 0) throw new GitError("GIT_APPLY_FAILED", "patch is empty");
			const normalizedPatch = patch.endsWith("\n") ? patch : `${patch}\n`;
			const touched = patchPathsOf(normalizedPatch);
			const canonical = await this.canonicalGitPath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const tmpPatch = await this.gitPathOf(run, canonical, `owt-patch-${randomHex6()}.diff`);
			try {
				await this.runFsScript(policy, canonical, FS_WRITE_SCRIPT, [tmpPatch, normalizedPatch], signal);
				if (cached === true && reverse !== true) {
					const untracked = new Set((await run(canonical, [
						"ls-files",
						"--others",
						"--exclude-standard",
						"-z"
					], [0], true)).stdout.split("\0").filter(Boolean));
					for (const rel of touched) {
						if (!untracked.has(rel)) continue;
						await run(canonical, [
							"add",
							"--intent-to-add",
							"--",
							rel
						]).catch((error) => {
							throw new GitError("GIT_APPLY_FAILED", error instanceof Error ? error.message : String(error));
						});
					}
				}
				const args = ["apply", "--whitespace=nowarn"];
				if (reverse === true) args.push("--reverse");
				if (cached === true) args.push("--cached");
				args.push(tmpPatch);
				await run(canonical, args).catch((error) => {
					throw new GitError("GIT_APPLY_FAILED", error instanceof Error ? error.message : String(error));
				});
				return { path: canonical };
			} finally {
				await this.runFsScript(policy, canonical, FS_UNLINK_SCRIPT, [tmpPatch], void 0).catch(() => {});
			}
		}
		policy(agent) {
			const sandboxPolicy = this.host().sandboxPolicy;
			return sandboxPolicy !== void 0 ? sandboxPolicy.resolve({ session: agent.session }) : { mode: "danger-full-access" };
		}
		async runArgv(policy, cwd, argv, timeoutMs, signal, allowedExitCodes = [0], allowLossy = false, extraEnv = {}) {
			const signals = [AbortSignal.timeout(timeoutMs)];
			if (signal !== void 0) signals.push(signal);
			const timeoutSignal = AbortSignal.any(signals);
			timeoutSignal.throwIfAborted();
			const host = this.host();
			let command = argv;
			if (host.sandbox !== void 0 && policy.mode !== "danger-full-access") command = (await host.sandbox.confine(command, policy, timeoutSignal)).argv;
			command = [await host.subprocess.resolveExecutable(command[0], void 0, timeoutSignal), ...command.slice(1)];
			timeoutSignal.throwIfAborted();
			const stdoutCap = allowLossy ? MAX_DIFF_STDOUT_BYTES : MAX_OUTPUT_BYTES;
			const child = host.subprocess.spawn({
				argv: command,
				cwd,
				env: {
					...GIT_ENV,
					GIT_TERMINAL_PROMPT: "0",
					GIT_LFS_SKIP_SMUDGE: "1",
					GIT_NO_LAZY_FETCH: "1",
					...extraEnv
				},
				signal: timeoutSignal,
				graceMs: COMMAND_GRACE_MS,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: stdoutCap },
					stderr: { maxBytes: MAX_OUTPUT_BYTES }
				}
			});
			try {
				const outcome = await child.done;
				timeoutSignal.throwIfAborted();
				const stdout = child.collected.stdout.readFrom(0);
				const stderr = child.collected.stderr.readFrom(0);
				if (outcome.exitCode === null || !allowedExitCodes.includes(outcome.exitCode)) {
					if (timeoutSignal.aborted) throw new GitError("GIT_TIMEOUT", "command timed out");
					throw new Error(`${argv.slice(0, 3).join(" ")} failed (${outcome.signal ?? outcome.exitCode}): ${stderr.text.trim()}`);
				}
				if (stdout.lossy && !allowLossy) throw new Error(`command output exceeds ${stdoutCap} bytes`);
				return {
					stdout: stdout.text,
					exitCode: outcome.exitCode,
					lossy: stdout.lossy
				};
			} finally {
				child.terminate();
				await child.waitForExit();
			}
		}
		gitRunner(policy, signal, timeoutMs = COMMAND_TIMEOUT_MS, extraEnv = {}) {
			return (cwd, args, allowedExitCodes = [0], allowLossy = false) => this.runArgv(policy, cwd, [
				"git",
				"-c",
				"core.hooksPath=/dev/null",
				"-c",
				"core.fsmonitor=false",
				"-c",
				"gc.auto=0",
				...args
			], timeoutMs, signal, allowedExitCodes, allowLossy, extraEnv);
		}
		async repositoryRootOf(policy, from, signal) {
			const run = this.gitRunner(policy, signal);
			const out = await run(from, [
				"rev-parse",
				"--path-format=absolute",
				"--git-common-dir"
			], [0, 128]);
			if (out.exitCode !== 0) throw new GitError("GIT_NOT_A_REPO", `${from} is not a git repository`);
			const commonDir = out.stdout.trim();
			const rawRoot = commonDir.endsWith("/.git") ? commonDir.slice(0, -5) : (await run(from, [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel"
			])).stdout.trim();
			const resolved = await this.fs().resolve(rawRoot, { signal });
			return this.fs().processPath(resolved);
		}
		async canonicalGitPath(policy, path, signal) {
			if (await this.fs().lstat(path, void 0, signal) === void 0) throw new GitError("GIT_NOT_FOUND", `no such directory: ${path}`);
			const top = await this.gitRunner(policy, signal)(path, [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel"
			], [0, 128]);
			if (top.exitCode !== 0) throw new GitError("GIT_NOT_A_WORKTREE", `${path} is not inside a git work tree`);
			const resolved = await this.fs().resolve(top.stdout.trim(), { signal });
			return this.fs().processPath(resolved);
		}
		/**
		* Resolve the remote-tracking counterpart of a local branch, preferring its
		* configured upstream and falling back to `<remote>/<branch>` for every known
		* remote. `verifyTip` additionally requires the remote-tracking ref to exist,
		* i.e. the branch was actually pushed at some point. Returns `undefined` when
		* the branch has never been pushed.
		*/
		async resolvePushedRemoteBranch(policy, root, branch, verifyTip, signal) {
			const run = this.gitRunner(policy, signal);
			const candidates = [];
			const up = await run(root, [
				"rev-parse",
				"--abbrev-ref",
				"--quiet",
				`${branch}@{upstream}`
			], [
				0,
				1,
				128
			]);
			if (up.exitCode === 0 && up.stdout.trim().length > 0) candidates.push(up.stdout.trim());
			try {
				const remotes = await run(root, ["remote"], [0, 128]);
				for (const remote of remotes.stdout.split("\n").map((line) => line.trim()).filter(Boolean)) {
					const candidate = `${remote}/${branch}`;
					if (!candidates.includes(candidate)) candidates.push(candidate);
				}
			} catch {}
			for (const ref of candidates) {
				const sep = ref.indexOf("/");
				if (sep <= 0) continue;
				if (verifyTip) {
					if ((await run(root, [
						"rev-parse",
						"--verify",
						"--quiet",
						`refs/remotes/${ref}`
					], [
						0,
						1,
						128
					])).exitCode !== 0) continue;
				}
				return {
					remote: ref.slice(0, sep),
					remoteBranch: ref.slice(sep + 1),
					displayRef: ref
				};
			}
		}
		async branchOf(policy, path, signal) {
			const run = this.gitRunner(policy, signal);
			const out = await run(path, [
				"symbolic-ref",
				"--quiet",
				"--short",
				"HEAD"
			], [0, 1]);
			if (out.exitCode !== 0) {
				const head = await run(path, [
					"rev-parse",
					"--short=7",
					"HEAD"
				], [0, 128]);
				return head.exitCode === 0 ? `detached at ${head.stdout.trim()}` : "HEAD";
			}
			return out.stdout.trim();
		}
		async dirtyCountOf(policy, path, signal) {
			try {
				const out = await this.gitRunner(policy, signal)(path, [
					"status",
					"--porcelain",
					"--untracked-files=normal"
				], [0, 128]);
				if (out.exitCode !== 0) return 0;
				return out.stdout.split("\n").filter((line) => line.length > 0).length;
			} catch {
				return 0;
			}
		}
		registerTools() {
			const disposers = [];
			const self = this;
			const definitions = [{
				name: "git_diff",
				description: "Show uncommitted changes of a git checkout: per-file status rows (staged / unstaged / untracked) plus the combined or single-file diff text.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Checkout path."
						},
						file: {
							type: "string",
							description: "Optional relative file path to fetch only that file diff."
						}
					},
					required: ["path"]
				},
				async execute(args, exec) {
					if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
					const file = typeof args.file === "string" && args.file.length > 0 ? args.file : void 0;
					return JSON.parse(JSON.stringify(await self.diffInternal(self.policy(exec.agent), args.path, exec.signal, file)));
				}
			}, {
				name: "git_commit",
				description: "Commit changes in a git checkout. Stages exactly `files` (may include untracked paths) and commits them with `message`; omit `files` to commit the index as-is.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Checkout path."
						},
						message: {
							type: "string",
							description: "Commit message (first line is the subject)."
						},
						files: {
							type: "array",
							items: { type: "string" },
							description: "Paths (relative to the checkout) to stage and commit; omitted commits the whole index."
						}
					},
					required: ["path", "message"]
				},
				async execute(args, exec) {
					if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
					if (typeof args.message !== "string" || args.message.trim().length === 0) throw new Error("message is required");
					const files = Array.isArray(args.files) ? args.files.filter((f) => typeof f === "string") : void 0;
					return JSON.parse(JSON.stringify(await self.commitInternal(self.policy(exec.agent), args.path, args.message, files, void 0, exec.signal)));
				}
			}];
			for (const definition of definitions) disposers.push(this.host().tools.register({
				...definition,
				output: {
					schema: { type: "object" },
					render: (_args, value) => [{
						type: "text",
						text: JSON.stringify(value, null, 2)
					}]
				},
				async execute(args, exec) {
					if (!exec?.agent || typeof exec.agent !== "object") throw new Error("no calling agent context for git tool");
					return definition.execute(args ?? {}, exec);
				}
			}));
		}
	};
})();
export { GitReviewService as default };
