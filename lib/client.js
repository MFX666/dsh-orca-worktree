window.__ModuleLoader__.load({
	id: "dsh-worktree-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		// src/client/api.ts
		const NAMESPACE = "rWorktreeManager";
		function createWorktreeApi(ctx) {
			const rpc = ctx.connection?.rpc;
			const call = async (method, args, signal) => {
				if (rpc === void 0) throw new Error("connection service unavailable");
				const result = await rpc.call("/api", `${NAMESPACE}/${method}`, { args }, signal);
				if (!result.ok) throw new Error(typeof result.error?.message === "string" ? result.error.message : `${NAMESPACE}/${method} failed`);
				if (!result.value.ok) throw new Error(result.value.message);
				return result.value.value;
			};
			return {
				overview: (includeDirty = false, signal) => call("overview", { includeDirty }, signal),
				archivedMeta: (signal) => call("archivedMeta", {}, signal),
				branches: (repositoryRoot, refresh = false, signal) => call("branches", {
					repositoryRoot,
					refresh
				}, signal),
				create: ({ repositoryRoot, name, from, parentPath }, signal) => call("create", {
					repositoryRoot,
					name,
					from,
					parentPath
				}, signal),
				ensureWorkspace: (path, title, signal) => call("ensureWorkspace", {
					path,
					title
				}, signal),
				setPinned: (path, pinned, signal) => call("setPinned", {
					path,
					pinned
				}, signal),
				remove: (path, force, deleteRemote, signal) => call("remove", {
					path,
					force,
					deleteRemote
				}, signal),
				status: (path, signal) => call("status", { path }, signal),
				diff: (path, signal, file) => call("diff", file !== void 0 ? {
					path,
					file
				} : { path }, signal),
				commit: (path, message, files, signal) => call("commit", {
					path,
					message,
					files
				}, signal),
				suggestCommitMessage: (path, signal) => call("suggestCommitMessage", { path }, signal)
			};
		}
		// src/client/icons.tsx
		/** VS Code Explorer twistie chevron (`>` collapsed, `v` expanded). */
		function IconChevron({ open, size = 13 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.45,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: {
					transform: open ? "rotate(0deg)" : "rotate(-90deg)",
					transition: "transform 120ms ease"
				},
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 6.25 8 9.75l3.5-3.5" })
			});
		}
		/** Classic VS Code `codicon-git-branch` / `codicon-source-control` glyph. */
		function IconGitBranch({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.35,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 4.5,
						cy: 3.5,
						r: 1.75
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 4.5,
						cy: 12.5,
						r: 1.75
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 11.5,
						cy: 5.5,
						r: 1.75
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 5.25v5.5" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M11.5 7.25c0 2.1-1.4 3.15-3.8 3.15H4.5" })
				]
			});
		}
		/** Subtree / derived worktree glyph (`⑂`). */
		function IconLineage({ size = 11.5 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size });
		}
		function IconPlus({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 3.25v9.5M3.25 8h9.5" })
			});
		}
		function IconClose({ size = 12 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.45,
				strokeLinecap: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4.5 4.5 7 7M11.5 4.5l-7 7" })
			});
		}
		function IconDots({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "currentColor",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 3.6,
						cy: 8,
						r: 1.05
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 8,
						cy: 8,
						r: 1.05
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: 12.4,
						cy: 8,
						r: 1.05
					})
				]
			});
		}
		function IconStar({ filled, size = 12 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: filled ? "currentColor" : "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m8 2.15 1.72 3.49 3.85.56-2.78 2.71.66 3.84L8 10.94l-3.45 1.81.66-3.84L2.43 6.2l3.85-.56L8 2.15Z" })
			});
		}
		function IconSearch({ size = 13.5 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: 7.1,
					cy: 7.1,
					r: 4.3
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m10.35 10.35 3 3" })]
			});
		}
		function IconChat({ size = 11.5 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.35,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.1 3.5h9.8a1.1 1.1 0 0 1 1.1 1.1v5.8a1.1 1.1 0 0 1-1.1 1.1H6.3L3.1 13.9v-2.4A1.1 1.1 0 0 1 2 10.4V4.6a1.1 1.1 0 0 1 1.1-1.1Z" })
			});
		}
		function IconCreate() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 14 });
		}
		function IconRemove() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: 14,
				height: 14,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.35,
				strokeLinecap: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4.5h10M6.2 4.5V3.2h3.6v1.3M4.5 4.5l.6 8.3h5.8l.6-8.3" })
			});
		}
		function IconRefresh({ size = 13, spinning = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				style: spinning ? { animation: "owt-spin 0.8s linear infinite" } : void 0,
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.25 8a5.25 5.25 0 1 1-1.35-3.52M13.25 2.75v2.5h-2.5" })
			});
		}
		/** AI sparkle glyph for the commit-message generator button. */
		function IconSparkle({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "currentColor",
				stroke: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 1.6c.5 2.6 1.6 3.7 4.2 4.2-2.6.5-3.7 1.6-4.2 4.2-.5-2.6-1.6-3.7-4.2-4.2C6.4 5.3 7.5 4.2 8 1.6z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M12.6 9.4c.3 1.5.9 2.1 2.4 2.4-1.5.3-2.1.9-2.4 2.4-.3-1.5-.9-2.1-2.4-2.4 1.5-.3 2.1-.9 2.4-2.4z",
					opacity: .75
				})]
			});
		}
		function IconFolder({ size = 13 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M1.75 4.25a1.25 1.25 0 0 1 1.25-1.25h3.1l1.35 1.5H13a1.25 1.25 0 0 1 1.25 1.25v6a1.25 1.25 0 0 1-1.25 1.25H3a1.25 1.25 0 0 1-1.25-1.25v-7.5Z" })
			});
		}
		function IconFile({ size = 13 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 2.25h5.2L12.5 5.5v8.25a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V3.25a1 1 0 0 1 1-1Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 2.25v3.25h3.5" })]
			});
		}
		function IconCheck({ size = 13 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.65,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m3.25 8.25 3.1 3.1 6.4-6.5" })
			});
		}
		// src/client/ArchivedSessionsSection.tsx
		/**
		* Settings -> Archived Sessions section (`id: "archived-sessions"`),
		* organizing DSH's official `archivedSessionIds` by Git Repository -> Git Branch -> Session.
		*
		* Uses 100% official DSH archive state (`useWorkspaces(s => s.archivedSessionIds)`
		* and `workspaces.unarchiveSession`) so sidebar context-menu Archive/Unarchive
		* and worktree-removal auto-archive stay in complete sync without conflict.
		* @module dsh-worktree-plugin/client/ArchivedSessionsSection
		*/
		function normalizePath$1(p) {
			return p.length > 1 ? p.replace(/\/+$/, "") : p;
		}
		function pathBasename(p) {
			const norm = normalizePath$1(p);
			const idx = norm.lastIndexOf("/");
			return idx >= 0 ? norm.slice(idx + 1) : norm;
		}
		function formatShortTime(ts) {
			if (ts === void 0 || !Number.isFinite(ts) || ts <= 0) return "";
			try {
				const d = new Date(ts);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				return `${d.getFullYear() === now.getFullYear() ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
			} catch {
				return "";
			}
		}
		function sessionDisplayTitle(s, t) {
			const raw = (s.displayTitle ?? s.title ?? "").trim();
			if (raw.length > 0) return raw;
			return s.blank ? t("wt.unnamedChat") : t("wt.untitledChat");
		}
		function ArchivedSessionsSection(props) {
			const { t, api } = props;
			const sessionList = props.useSessions((s) => s);
			const workspaceSnap = props.useWorkspaces((s) => s);
			const [meta, setMeta] = (0, react.useState)(null);
			const [overview, setOverview] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [collapsedGroups, setCollapsedGroups] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [busyIds, setBusyIds] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [errorText, setErrorText] = (0, react.useState)(null);
			const reloadMeta = (0, react.useCallback)(async (signal) => {
				setLoading(true);
				setErrorText(null);
				try {
					const [ov, am] = await Promise.all([api.overview(false, signal).catch(() => null), api.archivedMeta(signal).catch(() => ({
						branches: [],
						repos: []
					}))]);
					if (signal?.aborted) return;
					if (ov !== null) setOverview(ov);
					setMeta(am);
				} catch (error) {
					if (!signal?.aborted) setErrorText(error instanceof Error ? error.message : String(error));
				} finally {
					if (!signal?.aborted) setLoading(false);
				}
			}, [api]);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				reloadMeta(controller.signal);
				return () => {
					controller.abort();
				};
			}, [reloadMeta]);
			const repoGroups = (0, react.useMemo)(() => {
				const archivedIds = workspaceSnap.archivedSessionIds;
				if (archivedIds.length === 0) return [];
				const repoNameByRoot = /* @__PURE__ */ new Map();
				const poolToRepoRoot = /* @__PURE__ */ new Map();
				const activeWorktrees = [];
				const activeWorktreePaths = /* @__PURE__ */ new Set();
				for (const r of meta?.repos ?? []) {
					const root = normalizePath$1(r.repositoryRoot);
					repoNameByRoot.set(root, r.name);
					poolToRepoRoot.set(normalizePath$1(r.poolPath), root);
				}
				for (const repo of overview?.repos ?? []) {
					const root = normalizePath$1(repo.repositoryRoot);
					repoNameByRoot.set(root, repo.name);
					poolToRepoRoot.set(normalizePath$1(repo.poolPath), root);
					for (const row of repo.rows) {
						const normRowPath = normalizePath$1(row.path);
						activeWorktreePaths.add(normRowPath);
						activeWorktrees.push({
							path: normRowPath,
							repoRoot: root,
							branch: row.branch,
							isMain: row.kind === "main"
						});
					}
				}
				activeWorktrees.sort((a, b) => b.path.length - a.path.length);
				const archivedByPath = /* @__PURE__ */ new Map();
				const archivedBySession = /* @__PURE__ */ new Map();
				for (const rec of meta?.branches ?? []) {
					const norm = normalizePath$1(rec.path);
					if (!archivedByPath.has(norm)) archivedByPath.set(norm, rec);
					for (const sid of rec.sessionIds ?? []) if (!archivedBySession.has(sid)) archivedBySession.set(sid, rec);
				}
				const archivedPathsDesc = [...archivedByPath.keys()].sort((a, b) => b.length - a.length);
				const wsBySessionId = /* @__PURE__ */ new Map();
				const wsByPath = /* @__PURE__ */ new Map();
				for (const ws of workspaceSnap.items) {
					const norm = normalizePath$1(ws.path);
					wsByPath.set(norm, {
						path: norm,
						title: ws.title
					});
					for (const sid of ws.sessionIds) wsBySessionId.set(sid, {
						path: norm,
						title: ws.title
					});
				}
				const inferFromCwd = (cwdNorm) => {
					const recPath = archivedPathsDesc.find((p) => cwdNorm === p || cwdNorm.startsWith(`${p}/`));
					if (recPath !== void 0) {
						const rec = archivedByPath.get(recPath);
						const root = rec.repositoryRoot ? normalizePath$1(rec.repositoryRoot) : void 0;
						return {
							repoKey: root ?? `repo:${rec.repositoryName}`,
							repoName: (root ? repoNameByRoot.get(root) : void 0) ?? rec.repositoryName,
							repositoryRoot: root,
							branchName: rec.branch,
							isGitRepo: true,
							isWorktreeBranch: true,
							isRemovedCheckout: !activeWorktreePaths.has(recPath)
						};
					}
					const activeWt = activeWorktrees.find((w) => cwdNorm === w.path || cwdNorm.startsWith(`${w.path}/`));
					if (activeWt !== void 0 && !activeWt.isMain) return {
						repoKey: activeWt.repoRoot,
						repoName: repoNameByRoot.get(activeWt.repoRoot) ?? pathBasename(activeWt.repoRoot),
						repositoryRoot: activeWt.repoRoot,
						branchName: activeWt.branch,
						isGitRepo: true,
						isWorktreeBranch: true,
						isRemovedCheckout: false
					};
					const poolMatch = /^(.*\/(?:dsh-orca-worktrees|worktrees)\/([^/]+))\/([^/]+)(?:\/|$)/.exec(cwdNorm);
					if (poolMatch !== null) {
						const poolDir = poolMatch[1];
						const repoSlug = poolMatch[2];
						const branchSeg = poolMatch[3];
						const checkoutRoot = `${poolDir}/${branchSeg}`;
						const knownRoot = poolToRepoRoot.get(poolDir);
						const strippedSlug = repoSlug.replace(/-[0-9a-f]{8}$/i, "");
						let matchedRoot = knownRoot;
						if (matchedRoot === void 0) {
							for (const [root, name] of repoNameByRoot.entries()) if (name === strippedSlug || pathBasename(root) === strippedSlug) {
								matchedRoot = root;
								break;
							}
						}
						return {
							repoKey: matchedRoot ?? `pool:${strippedSlug}`,
							repoName: (matchedRoot ? repoNameByRoot.get(matchedRoot) : void 0) ?? strippedSlug,
							repositoryRoot: matchedRoot,
							branchName: branchSeg,
							isGitRepo: true,
							isWorktreeBranch: true,
							isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot)
						};
					}
					const agentsMatch = /^(.*)\/\.agents\/worktrees\/([^/]+)(?:\/|$)/.exec(cwdNorm);
					if (agentsMatch !== null) {
						const repoRoot = agentsMatch[1];
						const branchSeg = agentsMatch[2];
						const checkoutRoot = `${repoRoot}/.agents/worktrees/${branchSeg}`;
						return {
							repoKey: repoRoot,
							repoName: repoNameByRoot.get(repoRoot) ?? wsByPath.get(repoRoot)?.title ?? pathBasename(repoRoot),
							repositoryRoot: repoRoot,
							branchName: branchSeg,
							isGitRepo: true,
							isWorktreeBranch: true,
							isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot)
						};
					}
					const orcaMatch = /^(.*\/orca\/workspaces\/([^/]+)\/([^/]+))(?:\/|$)/.exec(cwdNorm);
					if (orcaMatch !== null) {
						const checkoutRoot = orcaMatch[1];
						const repoSlug = orcaMatch[2];
						const branchSeg = orcaMatch[3];
						let matchedRoot;
						for (const [root, name] of repoNameByRoot.entries()) if (name === repoSlug || pathBasename(root) === repoSlug) {
							matchedRoot = root;
							break;
						}
						return {
							repoKey: matchedRoot ?? `orca:${repoSlug}`,
							repoName: (matchedRoot ? repoNameByRoot.get(matchedRoot) : void 0) ?? repoSlug,
							repositoryRoot: matchedRoot,
							branchName: branchSeg,
							isGitRepo: true,
							isWorktreeBranch: true,
							isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot)
						};
					}
					if (activeWt !== void 0 && activeWt.isMain) return {
						repoKey: activeWt.repoRoot,
						repoName: repoNameByRoot.get(activeWt.repoRoot) ?? pathBasename(activeWt.repoRoot),
						repositoryRoot: activeWt.repoRoot,
						branchName: activeWt.branch,
						isGitRepo: true,
						isWorktreeBranch: false,
						isRemovedCheckout: false
					};
					for (const [wsPath, wsInfo] of wsByPath.entries()) if (cwdNorm === wsPath || cwdNorm.startsWith(`${wsPath}/`)) return {
						repoKey: `ws:${wsPath}`,
						repoName: wsInfo.title === "default-workspace" ? t("archive.defaultWorkspace") : wsInfo.title,
						branchName: t("archive.folderDirect"),
						isGitRepo: false,
						isWorktreeBranch: false,
						isRemovedCheckout: false
					};
					return {
						repoKey: `dir:${cwdNorm}`,
						repoName: pathBasename(cwdNorm) || cwdNorm,
						branchName: t("archive.folderDirect"),
						isGitRepo: false,
						isWorktreeBranch: false,
						isRemovedCheckout: false
					};
				};
				const repoMap = /* @__PURE__ */ new Map();
				for (const sid of archivedIds) {
					const summary = sessionList.byId[sid] ?? { id: sid };
					if (summary.origin === "subagent") continue;
					let resolved;
					const explicitRec = archivedBySession.get(sid);
					if (explicitRec !== void 0) {
						const root = explicitRec.repositoryRoot ? normalizePath$1(explicitRec.repositoryRoot) : void 0;
						const normRecPath = normalizePath$1(explicitRec.path);
						resolved = {
							repoKey: root ?? `repo:${explicitRec.repositoryName}`,
							repoName: (root ? repoNameByRoot.get(root) : void 0) ?? explicitRec.repositoryName,
							repositoryRoot: root,
							branchName: explicitRec.branch,
							path: explicitRec.path,
							removedAt: explicitRec.removedAt,
							isGitRepo: true,
							isWorktreeBranch: true,
							isRemovedCheckout: !activeWorktreePaths.has(normRecPath)
						};
					} else {
						const cwdRaw = summary.cwd ?? wsBySessionId.get(sid)?.path;
						if (cwdRaw !== void 0 && cwdRaw.length > 0) resolved = {
							...inferFromCwd(normalizePath$1(cwdRaw)),
							path: normalizePath$1(cwdRaw)
						};
						else resolved = {
							repoKey: "ungrouped",
							repoName: t("folder.ungrouped"),
							branchName: t("archive.folderDirect"),
							isGitRepo: false,
							isWorktreeBranch: false,
							isRemovedCheckout: false
						};
					}
					let repoEntry = repoMap.get(resolved.repoKey);
					if (repoEntry === void 0) {
						repoEntry = {
							repoKey: resolved.repoKey,
							repoName: resolved.repoName,
							repositoryRoot: resolved.repositoryRoot,
							isGitRepo: resolved.isGitRepo,
							branches: /* @__PURE__ */ new Map()
						};
						repoMap.set(resolved.repoKey, repoEntry);
					}
					const bKey = `${resolved.repoKey}::${resolved.branchName}`;
					let branchEntry = repoEntry.branches.get(bKey);
					if (branchEntry === void 0) {
						branchEntry = {
							branchKey: bKey,
							branchName: resolved.branchName,
							path: resolved.path,
							removedAt: resolved.removedAt,
							isWorktreeBranch: resolved.isWorktreeBranch,
							isRemovedCheckout: resolved.isRemovedCheckout,
							sessions: []
						};
						repoEntry.branches.set(bKey, branchEntry);
					}
					branchEntry.sessions.push(summary);
				}
				const result = [];
				for (const repoEntry of repoMap.values()) {
					const branches = [...repoEntry.branches.values()].map((b) => ({
						...b,
						sessions: [...b.sessions].sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0))
					}));
					branches.sort((a, b) => {
						const aTop = a.sessions[0]?.updatedAt ?? 0;
						return (b.sessions[0]?.updatedAt ?? 0) - aTop || a.branchName.localeCompare(b.branchName);
					});
					const totalSessions = branches.reduce((acc, b) => acc + b.sessions.length, 0);
					result.push({
						repoKey: repoEntry.repoKey,
						repoName: repoEntry.repoName,
						repositoryRoot: repoEntry.repositoryRoot,
						isGitRepo: repoEntry.isGitRepo,
						branches,
						totalSessions
					});
				}
				result.sort((a, b) => {
					if (a.isGitRepo !== b.isGitRepo) return a.isGitRepo ? -1 : 1;
					const aTop = a.branches[0]?.sessions[0]?.updatedAt ?? 0;
					return (b.branches[0]?.sessions[0]?.updatedAt ?? 0) - aTop || a.repoName.localeCompare(b.repoName);
				});
				return result;
			}, [
				workspaceSnap.archivedSessionIds,
				workspaceSnap.items,
				meta,
				overview,
				sessionList.byId,
				t
			]);
			const normalizedQuery = query.trim().toLowerCase();
			const filteredGroups = (0, react.useMemo)(() => {
				if (normalizedQuery === "") return repoGroups;
				const out = [];
				for (const repo of repoGroups) {
					const repoMatches = repo.repoName.toLowerCase().includes(normalizedQuery);
					const matchedBranches = [];
					for (const b of repo.branches) {
						if (repoMatches || b.branchName.toLowerCase().includes(normalizedQuery)) {
							matchedBranches.push(b);
							continue;
						}
						const matchedSessions = b.sessions.filter((s) => sessionDisplayTitle(s, t).toLowerCase().includes(normalizedQuery));
						if (matchedSessions.length > 0) matchedBranches.push({
							...b,
							sessions: matchedSessions
						});
					}
					if (matchedBranches.length > 0) out.push({
						...repo,
						branches: matchedBranches,
						totalSessions: matchedBranches.reduce((sum, item) => sum + item.sessions.length, 0)
					});
				}
				return out;
			}, [
				normalizedQuery,
				repoGroups,
				t
			]);
			const toggleGroup = (key) => {
				setCollapsedGroups((prev) => {
					const next = new Set(prev);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
			};
			const handleUnarchive = async (sessionId, openAfter) => {
				setBusyIds((prev) => /* @__PURE__ */ new Set([...prev, sessionId]));
				setErrorText(null);
				try {
					await props.unarchiveSession(sessionId);
					if (openAfter) {
						props.close?.();
						props.openSession(sessionId);
					}
				} catch (error) {
					setErrorText(error instanceof Error ? error.message : String(error));
				} finally {
					setBusyIds((prev) => {
						const next = new Set(prev);
						next.delete(sessionId);
						return next;
					});
				}
			};
			const handleUnarchiveBranch = async (branch) => {
				const ids = branch.sessions.map((s) => s.id);
				setBusyIds((prev) => /* @__PURE__ */ new Set([...prev, ...ids]));
				setErrorText(null);
				try {
					for (const id of ids) await props.unarchiveSession(id);
				} catch (error) {
					setErrorText(error instanceof Error ? error.message : String(error));
				} finally {
					setBusyIds((prev) => {
						const next = new Set(prev);
						for (const id of ids) next.delete(id);
						return next;
					});
				}
			};
			const totalCount = workspaceSnap.archivedSessionIds.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "owt-arch-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-arch-header",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-arch-title-wrap",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-arch-title",
								children: [t("archive.title"), totalCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "owt-arch-count",
									children: totalCount
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "owt-arch-desc",
								children: t("archive.desc")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "owt-btn",
							disabled: loading,
							onClick: () => {
								reloadMeta();
							},
							"aria-label": t("archive.refreshAria"),
							title: t("archive.refreshAria"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {
								size: 12.5,
								spinning: loading
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("archive.refresh") })]
						})]
					}),
					totalCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-arch-search",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, { size: 13.5 }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: query,
								placeholder: t("archive.searchPlaceholder"),
								"aria-label": t("archive.searchPlaceholder"),
								onChange: (event) => {
									setQuery(event.target.value);
								}
							}),
							query !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "owt-clear-btn",
								"aria-label": t("header.clearSearch"),
								onClick: () => {
									setQuery("");
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, { size: 11 })
							})
						]
					}),
					errorText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-toast",
						"data-kind": "error",
						role: "alert",
						children: errorText
					}),
					totalCount === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-arch-empty",
						children: t("archive.empty")
					}) : filteredGroups.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-arch-empty",
						children: t("empty.search")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-arch-list",
						children: filteredGroups.map((repo) => {
							const repoCollapsed = normalizedQuery === "" && collapsedGroups.has(repo.repoKey);
							const summaryText = repo.isGitRepo ? t("archive.repoSummary", {
								branches: repo.branches.length,
								chats: repo.totalSessions
							}) : t("archive.chatsOnlySummary", { chats: repo.totalSessions });
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-arch-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-arch-repo-head",
									role: "button",
									tabIndex: 0,
									"aria-expanded": !repoCollapsed,
									onClick: () => {
										toggleGroup(repo.repoKey);
									},
									onKeyDown: (event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											toggleGroup(repo.repoKey);
										}
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
											open: !repoCollapsed,
											size: 12
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-arch-repo-name",
											children: repo.repoName
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-arch-repo-meta",
											children: summaryText
										})
									]
								}), !repoCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-arch-branches",
									children: repo.branches.map((branch) => {
										const bCollapsed = normalizedQuery === "" && collapsedGroups.has(branch.branchKey);
										const showBranchHeader = repo.isGitRepo || repo.branches.length > 1;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "owt-arch-branch-group",
											children: [showBranchHeader && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "owt-arch-branch-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "owt-arch-branch-toggle",
													role: "button",
													tabIndex: 0,
													"aria-expanded": !bCollapsed,
													title: branch.path,
													onClick: () => {
														toggleGroup(branch.branchKey);
													},
													onKeyDown: (event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															toggleGroup(branch.branchKey);
														}
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
															open: !bCollapsed,
															size: 11
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "owt-arch-branch-icon",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 12.5 })
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "owt-arch-branch-name",
															children: branch.branchName
														}),
														branch.isRemovedCheckout && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "owt-arch-removed-tag",
															children: t("archive.removedTag")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "owt-count-pill",
															children: branch.sessions.length
														})
													]
												}), branch.sessions.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "owt-arch-link-btn",
													disabled: branch.sessions.some((s) => busyIds.has(s.id)),
													onClick: () => {
														handleUnarchiveBranch(branch);
													},
													children: t("archive.restoreBranch")
												})]
											}), (!showBranchHeader || !bCollapsed) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "owt-arch-sessions",
												"data-indented": showBranchHeader ? "true" : "false",
												children: branch.sessions.map((session) => {
													const isBusy = busyIds.has(session.id);
													const label = sessionDisplayTitle(session, t);
													const timeText = formatShortTime(session.updatedAt);
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "owt-arch-session-row",
														"data-busy": isBusy ? "true" : "false",
														tabIndex: 0,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "owt-git-icon",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChat, { size: 12 })
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "owt-arch-session-main",
																title: `${label}\n${session.cwd ?? ""}`,
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "owt-arch-session-title",
																	children: label
																}), timeText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "owt-arch-session-time",
																	children: timeText
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "owt-arch-session-actions",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "owt-btn owt-btn-xs",
																	disabled: isBusy,
																	onClick: () => {
																		handleUnarchive(session.id, false);
																	},
																	children: t("archive.unarchive")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	className: "owt-btn owt-btn-xs",
																	"data-kind": "primary",
																	disabled: isBusy,
																	onClick: () => {
																		handleUnarchive(session.id, true);
																	},
																	children: t("archive.unarchiveAndOpen")
																})]
															})
														]
													}, session.id);
												})
											})]
										}, branch.branchKey);
									})
								})]
							}, repo.repoKey);
						})
					})
				]
			});
		}
		// src/client/diffParser.ts
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
			let oldLine = 0;
			let newLine = 0;
			let inHunk = false;
			const flush = () => {
				if (currentFile !== null) result.set(currentFile, {
					file: currentFile,
					add,
					del,
					rows,
					binary
				});
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
					inHunk = false;
					continue;
				}
				if (currentFile === null) continue;
				if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
					binary = true;
					continue;
				}
				if (line.startsWith("@@ ")) {
					const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
					if (m !== null) {
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
				if (!inHunk) continue;
				if (line.startsWith("\\ No newline at end of file")) continue;
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
		// src/client/GitPanel.tsx
		/**
		* Git Source-Control & Diff Review Workbench mounted in the conversation view
		* tab strip (`conversation.view`), next to 对话 / 轨迹 / AOCI.
		*
		* Layout: IDE two-pane split workbench
		* - Left pane (320px): branch & upstream bar, commit composer with inline AI
		*   writer, and directory-grouped file tree with per-file staging checkboxes.
		* - Right pane (flex 1): GitHub/Cursor-grade structured unified diff viewer
		*   with sticky file headers, hunk banners, dual old/new line-number gutters,
		*   and instant single-file / all-files mode switching.
		* @module dsh-worktree-plugin/client/GitPanel
		*/
		const MAX_FILE_RENDER_LINES = 2500;
		const MAX_ALL_RENDER_LINES = 4500;
		function buildGroups(changes, parsedMap) {
			const map = /* @__PURE__ */ new Map();
			for (const change of changes) {
				const sep = change.file.lastIndexOf("/");
				const dir = sep > 0 ? change.file.slice(0, sep) : "";
				const baseName = sep >= 0 ? change.file.slice(sep + 1) : change.file;
				const parsed = parsedMap.get(change.file);
				const entry = {
					change,
					baseName,
					add: change.add ?? parsed?.add ?? 0,
					del: change.del ?? parsed?.del ?? 0,
					letter: changeLetter(change)
				};
				const bucket = map.get(dir);
				if (bucket !== void 0) bucket.push(entry);
				else map.set(dir, [entry]);
			}
			return [...map.entries()].sort(([a], [b]) => a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)).map(([dir, files]) => ({
				dir,
				files
			}));
		}
		/** 5-block visual diffstat bar like GitHub PR file headers. */
		function DiffStatBlocks({ add, del }) {
			const total = add + del;
			if (total === 0) return null;
			const blocks = 5;
			const addBlocks = Math.round(add / total * blocks);
			const delBlocks = Math.min(blocks - addBlocks, del > 0 ? Math.max(1, blocks - addBlocks) : 0);
			const neutral = Math.max(0, blocks - addBlocks - delBlocks);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "owt-gp-blocks",
				"aria-hidden": true,
				children: [
					Array.from({ length: addBlocks }).map((_, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "owt-gp-block",
						"data-kind": "add"
					}, `a${idx}`)),
					Array.from({ length: delBlocks }).map((_, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "owt-gp-block",
						"data-kind": "del"
					}, `d${idx}`)),
					Array.from({ length: neutral }).map((_, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "owt-gp-block" }, `n${idx}`))
				]
			});
		}
		function CommitPanel(props) {
			const { api, t, sessionId, useSessions } = props;
			const sessions = useSessions((s) => s);
			const path = (0, react.useMemo)(() => sessions.byId[sessionId]?.cwd, [sessions, sessionId]);
			const [diff, setDiff] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [msg, setMsg] = (0, react.useState)("");
			const [suggesting, setSuggesting] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			const [banner, setBanner] = (0, react.useState)(void 0);
			const [selectedFiles, setSelectedFiles] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [activeFile, setActiveFile] = (0, react.useState)(null);
			const [viewMode, setViewMode] = (0, react.useState)("single");
			const [collapsedDirs, setCollapsedDirs] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [collapsedCards, setCollapsedCards] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [extraParsed, setExtraParsed] = (0, react.useState)(() => /* @__PURE__ */ new Map());
			const [loadingFile, setLoadingFile] = (0, react.useState)(null);
			const diffScrollRef = (0, react.useRef)(null);
			const cardRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const attemptedFilesRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			const loadCtrlRef = (0, react.useRef)(null);
			const loadWorkspaceDiff = (0, react.useCallback)(async (targetPath, isInitial) => {
				loadCtrlRef.current?.abort();
				const controller = new AbortController();
				loadCtrlRef.current = controller;
				const signal = controller.signal;
				if (isInitial) setLoading(true);
				else setRefreshing(true);
				setError(void 0);
				try {
					const [nextDiff, nextStatus] = await Promise.all([api.diff(targetPath, signal), api.status(targetPath, signal).catch(() => null)]);
					if (signal.aborted) return;
					attemptedFilesRef.current.clear();
					setExtraParsed(/* @__PURE__ */ new Map());
					setDiff(nextDiff);
					setStatus(nextStatus);
					const allPaths = nextDiff.changes.map((c) => c.file);
					setSelectedFiles((prev) => {
						if (isInitial || prev.size === 0) return new Set(allPaths);
						const kept = allPaths.filter((f) => prev.has(f));
						return kept.length > 0 ? new Set(kept) : new Set(allPaths);
					});
					setActiveFile((prev) => prev !== null && allPaths.includes(prev) ? prev : allPaths[0] ?? null);
				} catch (err) {
					if (signal.aborted) return;
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					if (!signal.aborted) {
						setLoading(false);
						setRefreshing(false);
					}
				}
			}, [api]);
			(0, react.useEffect)(() => {
				if (path === void 0) {
					setDiff(null);
					setStatus(null);
					return;
				}
				setDiff(null);
				setStatus(null);
				setMsg("");
				setBanner(void 0);
				setCollapsedDirs(/* @__PURE__ */ new Set());
				setCollapsedCards(/* @__PURE__ */ new Set());
				loadWorkspaceDiff(path, true);
				return () => loadCtrlRef.current?.abort();
			}, [loadWorkspaceDiff, path]);
			(0, react.useEffect)(() => {
				if (banner === void 0) return;
				const timer = window.setTimeout(() => setBanner(void 0), 4e3);
				return () => window.clearTimeout(timer);
			}, [banner]);
			const baseParsedMap = (0, react.useMemo)(() => diff !== null ? parseStructuredDiff(diff.diff) : /* @__PURE__ */ new Map(), [diff]);
			const parsedMap = (0, react.useMemo)(() => {
				if (extraParsed.size === 0) return baseParsedMap;
				const merged = new Map(baseParsedMap);
				for (const [k, v] of extraParsed) merged.set(k, v);
				return merged;
			}, [baseParsedMap, extraParsed]);
			(0, react.useEffect)(() => {
				if (path === void 0 || diff === null || activeFile === null) return;
				if (parsedMap.has(activeFile) || attemptedFilesRef.current.has(activeFile)) return;
				if (!diff.changes.some((c) => c.file === activeFile)) return;
				attemptedFilesRef.current.add(activeFile);
				const controller = new AbortController();
				setLoadingFile(activeFile);
				api.diff(path, controller.signal, activeFile).then((single) => {
					if (controller.signal.aborted) return;
					const hit = parseStructuredDiff(single.diff).get(activeFile);
					if (hit !== void 0) setExtraParsed((prev) => {
						const next = new Map(prev);
						next.set(activeFile, hit);
						return next;
					});
				}).catch(() => {}).finally(() => {
					if (!controller.signal.aborted) setLoadingFile((curr) => curr === activeFile ? null : curr);
				});
				return () => controller.abort();
			}, [
				activeFile,
				api,
				diff,
				parsedMap,
				path
			]);
			const groups = (0, react.useMemo)(() => diff !== null ? buildGroups(diff.changes, parsedMap) : [], [diff, parsedMap]);
			const totals = (0, react.useMemo)(() => {
				let add = 0;
				let del = 0;
				for (const group of groups) for (const f of group.files) {
					add += f.add;
					del += f.del;
				}
				return {
					add,
					del
				};
			}, [groups]);
			const toggleSelectAll = (0, react.useCallback)(() => {
				if (diff === null) return;
				const all = diff.changes.map((c) => c.file);
				setSelectedFiles((prev) => prev.size === all.length ? /* @__PURE__ */ new Set() : new Set(all));
			}, [diff]);
			const toggleCheckFile = (0, react.useCallback)((file) => {
				setSelectedFiles((prev) => {
					const next = new Set(prev);
					if (next.has(file)) next.delete(file);
					else next.add(file);
					return next;
				});
			}, []);
			const toggleDir = (0, react.useCallback)((dir) => {
				setCollapsedDirs((prev) => {
					const next = new Set(prev);
					if (next.has(dir)) next.delete(dir);
					else next.add(dir);
					return next;
				});
			}, []);
			const toggleCard = (0, react.useCallback)((file) => {
				setCollapsedCards((prev) => {
					const next = new Set(prev);
					if (next.has(file)) next.delete(file);
					else next.add(file);
					return next;
				});
			}, []);
			const handleSelectFileRow = (0, react.useCallback)((file) => {
				setActiveFile(file);
				if (viewMode === "all") cardRefs.current.get(file)?.scrollIntoView({
					behavior: "smooth",
					block: "start"
				});
				else if (diffScrollRef.current !== null) diffScrollRef.current.scrollTop = 0;
			}, [viewMode]);
			const handleSuggest = (0, react.useCallback)(async () => {
				if (path === void 0 || suggesting || busy) return;
				setSuggesting(true);
				setError(void 0);
				try {
					const res = await api.suggestCommitMessage(path);
					setMsg(res.message);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSuggesting(false);
				}
			}, [
				api,
				busy,
				path,
				suggesting
			]);
			const submit = (0, react.useCallback)(async () => {
				if (path === void 0 || busy || suggesting || diff === null) return;
				if (msg.trim().length === 0 || selectedFiles.size === 0) return;
				setBusy(true);
				setError(void 0);
				try {
					const filesToCommit = diff.changes.map((c) => c.file).filter((f) => selectedFiles.has(f));
					const committed = await api.commit(path, msg, filesToCommit);
					setMsg("");
					setBanner(t("notice.committed", {
						commit: committed.commit,
						summary: committed.summary
					}));
					window.dispatchEvent(new CustomEvent("dsh-worktree:refresh"));
					await loadWorkspaceDiff(path, false);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				busy,
				diff,
				loadWorkspaceDiff,
				msg,
				path,
				selectedFiles,
				suggesting,
				t
			]);
			const renderedChanges = (0, react.useMemo)(() => {
				if (diff === null || diff.changes.length === 0) return [];
				if (viewMode === "all") return diff.changes;
				const found = diff.changes.find((c) => c.file === activeFile) ?? diff.changes[0];
				return found !== void 0 ? [found] : [];
			}, [
				activeFile,
				diff,
				viewMode
			]);
			if (path === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "owt-gp-root",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "owt-gp-empty-full",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-gp-empty-icon",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 22 })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-gp-empty-title",
						children: t("dialog.commit.noTarget")
					})]
				})
			});
			const branch = diff?.branch || status?.branch || "HEAD";
			const upstream = status?.upstream;
			const ahead = status?.ahead ?? 0;
			const behind = status?.behind ?? 0;
			const totalChanges = diff?.changes.length ?? 0;
			const hasChanges = totalChanges > 0;
			const allChecked = hasChanges && selectedFiles.size === totalChanges;
			const someChecked = selectedFiles.size > 0 && !allChecked;
			const canCommit = !busy && !suggesting && selectedFiles.size > 0 && msg.trim().length > 0;
			const renderDiffCard = (change, lineLimit) => {
				const parsed = parsedMap.get(change.file);
				const letter = changeLetter(change);
				const sep = change.file.lastIndexOf("/");
				const dirPrefix = sep > 0 ? `${change.file.slice(0, sep + 1)}` : "";
				const baseName = sep >= 0 ? change.file.slice(sep + 1) : change.file;
				const add = change.add ?? parsed?.add ?? 0;
				const del = change.del ?? parsed?.del ?? 0;
				const rows = parsed?.rows ?? [];
				const isCollapsed = collapsedCards.has(change.file);
				const slicedRows = rows.length > lineLimit ? rows.slice(0, lineLimit) : rows;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					ref: (el) => {
						if (el !== null) cardRefs.current.set(change.file, el);
						else cardRefs.current.delete(change.file);
					},
					className: "owt-gp-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "owt-gp-card-head",
						onClick: () => toggleCard(change.file),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-gp-chevron",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
									open: !isCollapsed,
									size: 12
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-gp-badge",
								"data-kind": letter,
								children: letter
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "owt-gp-card-path",
								title: change.oldFile !== void 0 ? `${change.oldFile} → ${change.file}` : change.file,
								children: [
									dirPrefix !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-gp-card-dir",
										children: dirPrefix
									}),
									change.oldFile !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "owt-gp-oldname",
										children: [change.oldFile.slice(change.oldFile.lastIndexOf("/") + 1), " → "]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-gp-card-name",
										children: baseName
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "owt-gp-card-stats",
								children: [
									add > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "owt-gp-add",
										children: ["+", add]
									}),
									del > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "owt-gp-del",
										children: ["−", del]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffStatBlocks, {
										add,
										del
									})
								]
							})
						]
					}), !isCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-gp-card-body",
						children: rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "owt-gp-card-empty",
							children: loadingFile === change.file ? t("dialog.commit.loading") : t("dialog.commit.noDiffText")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-table-wrap",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("table", {
								className: "owt-gp-table",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: slicedRows.map((row, idx) => {
									if (row.kind === "hunk") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
										className: "owt-gp-tr-hunk",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "owt-gp-td-num owt-gp-td-hunk-gutter",
											colSpan: 2,
											children: "⋯"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
											className: "owt-gp-td-hunk",
											colSpan: 2,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-gp-hunk-range",
												children: row.hunkHeader
											}), row.hunkContext && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-gp-hunk-ctx",
												children: row.hunkContext
											})]
										})]
									}, idx);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
										className: `owt-gp-tr owt-gp-tr--${row.kind}`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "owt-gp-td-num",
												children: row.oldNo ?? ""
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "owt-gp-td-num",
												children: row.newNo ?? ""
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "owt-gp-td-sign",
												children: row.sign
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "owt-gp-td-code",
												children: row.code || " "
											})
										]
									}, idx);
								}) })
							}), rows.length > lineLimit && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "owt-gp-truncated",
								children: t("dialog.commit.truncated", { count: lineLimit })
							})]
						})
					})]
				}, change.file);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "owt-gp-root",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: "owt-gp-sidebar",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-branchbar",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-gp-branch-left",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "owt-gp-branch-pill",
									title: path,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 13 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: branch })]
								}), upstream !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "owt-gp-upstream",
									title: upstream,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["→ ", upstream] }),
										ahead > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "owt-gp-ahead",
											children: ["↑", ahead]
										}),
										behind > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "owt-gp-behind",
											children: ["↓", behind]
										})
									]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "owt-gp-iconbtn",
								title: t("dialog.commit.refresh"),
								"aria-label": t("dialog.commit.refresh"),
								disabled: loading || refreshing || busy,
								onClick: () => {
									loadWorkspaceDiff(path, false);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {
									size: 13.5,
									spinning: loading || refreshing
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-composer",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-gp-textarea-box",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "owt-gp-textarea",
										placeholder: t("dialog.commit.msgPlaceholder"),
										disabled: busy || suggesting || !hasChanges,
										rows: 3,
										value: msg,
										onChange: (event) => {
											setMsg(event.target.value);
										},
										onKeyDown: (event) => {
											if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canCommit) {
												event.preventDefault();
												submit();
											}
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-gp-textarea-foot",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-gp-subject-len",
											"data-warn": (msg.split("\n")[0]?.length ?? 0) > 72,
											children: msg.length > 0 ? `${msg.split("\n")[0]?.length ?? 0} / 72` : ""
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "owt-gp-aibtn",
											disabled: busy || suggesting || !hasChanges,
											onClick: () => {
												handleSuggest();
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSparkle, { size: 12.5 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: suggesting ? t("dialog.commit.aiDoing") : t("dialog.commit.ai") })]
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "owt-gp-submit",
									disabled: !canCommit,
									onClick: () => {
										submit();
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 13.5 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: busy ? t("dialog.commit.submitting") : t("dialog.commit.submit", { count: selectedFiles.size }) })]
								}),
								error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-alert",
									"data-kind": "error",
									children: t("notice.error", { message: error })
								}),
								banner !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-alert",
									"data-kind": "ok",
									children: banner
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-tree-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "owt-gp-checkall",
								title: t("dialog.commit.selectAll"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										disabled: !hasChanges || busy,
										checked: allChecked,
										ref: (el) => {
											if (el !== null) el.indeterminate = someChecked;
										},
										onChange: toggleSelectAll
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-gp-tree-title",
										children: t("dialog.commit.changes")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-gp-count-pill",
										children: totalChanges
									})
								]
							}), (totals.add > 0 || totals.del > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "owt-gp-tree-totals",
								children: [totals.add > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "owt-gp-add",
									children: ["+", totals.add]
								}), totals.del > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "owt-gp-del",
									children: ["−", totals.del]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-tree-scroll",
							children: [
								loading && diff === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-side-hint",
									children: t("dialog.commit.loading")
								}),
								!loading && !hasChanges && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-side-hint",
									children: t("dialog.commit.clean")
								}),
								hasChanges && groups.map((group) => {
									const dirCollapsed = group.dir !== "" && collapsedDirs.has(group.dir);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-gp-group",
										children: [group.dir !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "owt-gp-dir-row",
											onClick: () => toggleDir(group.dir),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "owt-gp-chevron",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
														open: !dirCollapsed,
														size: 11
													})
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "owt-gp-dir-icon",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolder, { size: 13 })
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "owt-gp-dir-name",
													title: group.dir,
													children: group.dir
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "owt-gp-dir-count",
													children: group.files.length
												})
											]
										}), !dirCollapsed && group.files.map(({ change, baseName, add, del, letter }) => {
											const isSelected = activeFile === change.file;
											const isChecked = selectedFiles.has(change.file);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "owt-gp-file-row",
												role: "button",
												tabIndex: 0,
												"data-active": isSelected,
												"data-nested": group.dir !== "",
												title: change.oldFile !== void 0 ? `${change.oldFile} → ${change.file}` : change.file,
												onClick: () => handleSelectFileRow(change.file),
												onKeyDown: (event) => {
													if (event.target !== event.currentTarget) return;
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														handleSelectFileRow(change.file);
													}
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														className: "owt-gp-file-check",
														checked: isChecked,
														disabled: busy,
														onClick: (event) => event.stopPropagation(),
														onChange: () => toggleCheckFile(change.file)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-gp-file-icon",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFile, { size: 13 })
													}),
													change.oldFile !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "owt-gp-oldname",
														children: [change.oldFile.slice(change.oldFile.lastIndexOf("/") + 1), " →"]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-gp-file-name",
														title: change.file,
														children: baseName
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "owt-gp-file-stats",
														children: [add > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "owt-gp-add",
															children: ["+", add]
														}), del > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "owt-gp-del",
															children: ["−", del]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-gp-badge",
														"data-kind": letter,
														children: letter
													})
												]
											}, change.file);
										})]
									}, group.dir || "/");
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
					className: "owt-gp-main",
					children: [hasChanges && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-gp-main-bar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "owt-gp-main-crumb",
							children: viewMode === "single" && activeFile !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFile, { size: 13.5 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-gp-crumb-text",
								title: activeFile,
								children: activeFile
							})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "owt-gp-crumb-text",
								children: [
									t("dialog.commit.changes"),
									" · ",
									totalChanges
								]
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-gp-seg",
							role: "tablist",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": viewMode === "single",
								className: "owt-gp-seg-btn",
								"data-active": viewMode === "single",
								onClick: () => setViewMode("single"),
								children: t("dialog.commit.modeSingle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": viewMode === "all",
								className: "owt-gp-seg-btn",
								"data-active": viewMode === "all",
								onClick: () => setViewMode("all"),
								children: t("dialog.commit.modeAll")
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-gp-diff-scroll",
						ref: diffScrollRef,
						children: [
							loading && diff === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "owt-gp-empty-full",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-empty-sub",
									children: t("dialog.commit.loading")
								})
							}),
							!loading && !hasChanges && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-gp-empty-full",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "owt-gp-empty-icon",
										"data-clean": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 22 })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "owt-gp-empty-title",
										children: t("dialog.commit.clean")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "owt-gp-empty-sub",
										children: t("dialog.commit.cleanSub")
									})
								]
							}),
							hasChanges && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-gp-cards",
								children: [renderedChanges.map((change) => renderDiffCard(change, viewMode === "single" ? MAX_FILE_RENDER_LINES : Math.ceil(MAX_ALL_RENDER_LINES / Math.max(1, renderedChanges.length)))), diff?.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-gp-truncated",
									children: t("dialog.commit.truncated", { count: MAX_ALL_RENDER_LINES })
								})]
							})
						]
					})]
				})]
			});
		}
		// src/client/OrcaSidebar.tsx
		/**
		* VS Code Minimalist Explorer-style left sidebar tree overriding `sidebar.workspaces`.
		*
		* Hierarchy:
		* 1. Workspace / Repository Header (`▾ repo-name` — clean chevron + title, NO folder icon)
		*    └── Git Branch Row (`⑂ branch-name` + minimal status/chat/star)
		*          ├── Conversation sub-rows (clean 1px VS Code indent guide)
		*          └── Child Worktree Subtree (clean 1px VS Code indent guide)
		* 2. Non-Git Folder Workspaces (`▾ workspace-name` — NO folder icon)
		* 3. Ungrouped Sessions (`▾ 未分组对话`)
		* @module dsh-worktree-plugin/client/OrcaSidebar
		*/
		const STORAGE_COLLAPSED_REPOS = "dsh.orcaWorktree.collapsedRepos.v1";
		const STORAGE_COLLAPSED_LINEAGE = "dsh.orcaWorktree.collapsedLineage.v1";
		const STORAGE_EXPANDED_CHATS = "dsh.orcaWorktree.expandedChats.v1";
		/** Chat sub-lists longer than this collapse to the first rows; a toggle reveals the rest. */
		const CHAT_PREVIEW_LIMIT = 5;
		function loadStoredSet(key) {
			try {
				const raw = window.localStorage.getItem(key);
				if (raw === null) return /* @__PURE__ */ new Set();
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
			} catch {}
			return /* @__PURE__ */ new Set();
		}
		function saveStoredSet(key, values) {
			try {
				window.localStorage.setItem(key, JSON.stringify([...values]));
			} catch {}
		}
		function normalizePath(p) {
			return p.length > 1 ? p.replace(/\/+$/, "") : p;
		}
		function sessionLabel(s, t) {
			if (s.blank) return t("wt.unnamedChat");
			const text = (s.displayTitle ?? s.title ?? "").trim();
			return text.length > 0 ? text : t("wt.untitledChat");
		}
		function formatCompactAge(updatedAt, nowMs, t) {
			if (updatedAt === void 0 || !Number.isFinite(updatedAt) || updatedAt <= 0) return "";
			const diffSec = Math.max(0, Math.floor((nowMs - updatedAt) / 1e3));
			if (diffSec < 60) return t("time.now");
			const mins = Math.floor(diffSec / 60);
			if (mins < 60) return t("time.min", { n: mins });
			const hours = Math.floor(mins / 60);
			if (hours < 24) return t("time.hour", { n: hours });
			return t("time.day", { n: Math.floor(hours / 24) });
		}
		function isMacPlatform() {
			if (typeof navigator === "undefined") return true;
			return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
		}
		/** Conversation rows keep the stock DSH idle look (no marker): spinner while running, warn dot while awaiting the user. */
		function ChatMarker({ state }) {
			if (state === "running") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "owt-loading",
				"aria-hidden": true
			});
			if (state === "pending") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "owt-mini-dot",
				"data-tone": "warn",
				"aria-hidden": true
			});
			return null;
		}
		function OrcaSidebar(props) {
			const { wide = true, t, api } = props;
			const sessionList = props.useSessions((s) => s);
			const sessionStatuses = props.useSessionStatus((s) => s);
			const workspaceSnap = props.useWorkspaces((s) => s);
			const panelActive = props.usePanelInfo !== void 0 ? props.usePanelInfo((i) => i.activePanelId !== null) : false;
			const [overview, setOverview] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [nowMs, setNowMs] = (0, react.useState)(() => Date.now());
			const [collapsedRepos, setCollapsedRepos] = (0, react.useState)(() => loadStoredSet(STORAGE_COLLAPSED_REPOS));
			const [collapsedLineage, setCollapsedLineage] = (0, react.useState)(() => loadStoredSet(STORAGE_COLLAPSED_LINEAGE));
			const [expandedChats, setExpandedChats] = (0, react.useState)(() => loadStoredSet(STORAGE_EXPANDED_CHATS));
			const [expandedChatLists, setExpandedChatLists] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [createDialog, setCreateDialog] = (0, react.useState)(null);
			const [branchDraft, setBranchDraft] = (0, react.useState)("");
			const [fromDraft, setFromDraft] = (0, react.useState)("");
			const [branchOptions, setBranchOptions] = (0, react.useState)(null);
			const [loadingBranches, setLoadingBranches] = (0, react.useState)(false);
			const [fetchingBranches, setFetchingBranches] = (0, react.useState)(false);
			const [staleHostHint, setStaleHostHint] = (0, react.useState)(false);
			const [removeDialog, setRemoveDialog] = (0, react.useState)(null);
			const [forceRemove, setForceRemove] = (0, react.useState)(false);
			const [removeRemote, setRemoveRemote] = (0, react.useState)(false);
			const [wsRenameDialog, setWsRenameDialog] = (0, react.useState)(null);
			const [wsRenameDraft, setWsRenameDraft] = (0, react.useState)("");
			const [wsDeleteDialog, setWsDeleteDialog] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(null);
			const [pendingStartWsId, setPendingStartWsId] = (0, react.useState)(null);
			const workspaceIdSetRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			workspaceIdSetRef.current = (0, react.useMemo)(() => new Set(workspaceSnap.items.map((item) => item.workspaceId)), [workspaceSnap.items]);
			const startSessionRef = (0, react.useRef)(props.startSession);
			startSessionRef.current = props.startSession;
			const startSessionWhenReady = (0, react.useCallback)((workspaceId) => {
				if (workspaceId === void 0) return;
				if (workspaceIdSetRef.current.has(workspaceId)) {
					startSessionRef.current(workspaceId);
					return;
				}
				setPendingStartWsId(workspaceId);
			}, []);
			(0, react.useEffect)(() => {
				if (pendingStartWsId === null) return;
				const requestedAt = Date.now();
				const timer = window.setInterval(() => {
					if (workspaceIdSetRef.current.has(pendingStartWsId)) {
						window.clearInterval(timer);
						setPendingStartWsId(null);
						startSessionRef.current(pendingStartWsId);
					} else if (Date.now() - requestedAt > 1e4) {
						window.clearInterval(timer);
						setPendingStartWsId(null);
					}
				}, 200);
				return () => {
					window.clearInterval(timer);
				};
			}, [pendingStartWsId]);
			const rootRef = (0, react.useRef)(null);
			const searchInputRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			const userPickedFromRef = (0, react.useRef)(false);
			const overviewRef = (0, react.useRef)(null);
			overviewRef.current = overview;
			const shortcutBadge = (0, react.useMemo)(() => isMacPlatform() ? "⌘F" : "Ctrl+F", []);
			const showToast = (0, react.useCallback)((kind, text) => {
				setToast({
					kind,
					text
				});
			}, []);
			(0, react.useEffect)(() => {
				if (toast === null) return;
				const timer = window.setTimeout(() => {
					setToast(null);
				}, 3500);
				return () => {
					window.clearTimeout(timer);
				};
			}, [toast]);
			(0, react.useEffect)(() => {
				const timer = window.setInterval(() => {
					setNowMs(Date.now());
				}, 6e4);
				return () => {
					window.clearInterval(timer);
				};
			}, []);
			const workspaceSignature = (0, react.useMemo)(() => workspaceSnap.items.map((item) => `${item.workspaceId}:${item.path}:${item.title}`).join("|"), [workspaceSnap.items]);
			const refreshOverview = (0, react.useCallback)(async (includeDirty = false, signal) => {
				try {
					const next = await api.overview(includeDirty, signal);
					if (!signal?.aborted) setOverview(next);
				} catch (error) {
					if (!signal?.aborted) showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				}
			}, [
				api,
				showToast,
				t
			]);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				refreshOverview(false, controller.signal).then(() => {
					if (!controller.signal.aborted) refreshOverview(true, controller.signal);
				});
				const timer = window.setInterval(() => {
					refreshOverview(true, controller.signal);
				}, 12e3);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [refreshOverview, workspaceSignature]);
			(0, react.useEffect)(() => {
				if (createDialog === null) {
					setBranchOptions(null);
					setLoadingBranches(false);
					setFetchingBranches(false);
					setStaleHostHint(false);
					return;
				}
				userPickedFromRef.current = false;
				setStaleHostHint(false);
				const childSeed = createDialog.parentBranch !== void 0 ? createDialog.parentBranch.startsWith("detached") ? "HEAD" : createDialog.parentBranch : "";
				setFromDraft(childSeed);
				const controller = new AbortController();
				setLoadingBranches(true);
				api.branches(createDialog.repositoryRoot, false, controller.signal).then((res) => {
					if (controller.signal.aborted) return;
					setStaleHostHint(false);
					setBranchOptions(res);
					if (!userPickedFromRef.current) {
						if (childSeed !== "" && childSeed !== "HEAD" && res.remoteBranches.includes(`origin/${childSeed}`)) setFromDraft(`origin/${childSeed}`);
						else if (childSeed !== "" && (childSeed === "HEAD" || res.localBranches.includes(childSeed) || res.remoteBranches.includes(childSeed))) setFromDraft(childSeed);
						else setFromDraft(res.defaultBase);
					}
				}).catch((error) => {
					if (controller.signal.aborted) return;
					const msg = error instanceof Error ? error.message : String(error);
					const isStaleHost = msg.includes("no active Remote method");
					const repo = overviewRef.current?.repos.find((r) => r.repositoryRoot === createDialog.repositoryRoot);
					const fallbackLocals = Array.from(new Set((repo?.rows ?? []).map((r) => r.branch).filter((b) => b.length > 0 && !b.startsWith("detached"))));
					const fallbackBase = childSeed || fallbackLocals[0] || "HEAD";
					setBranchOptions({
						remoteBranches: [],
						localBranches: fallbackLocals,
						defaultBase: fallbackBase
					});
					if (!userPickedFromRef.current) setFromDraft(fallbackBase);
					if (isStaleHost) setStaleHostHint(true);
					else showToast("error", t("notice.error", { message: msg }));
				}).finally(() => {
					if (!controller.signal.aborted) setLoadingBranches(false);
				});
				return () => {
					controller.abort();
				};
			}, [
				api,
				createDialog,
				showToast,
				t
			]);
			const handleFetchBranches = (0, react.useCallback)(async () => {
				if (createDialog === null || fetchingBranches || busy) return;
				setFetchingBranches(true);
				try {
					const res = await api.branches(createDialog.repositoryRoot, true);
					setStaleHostHint(false);
					setBranchOptions(res);
					setFromDraft((prev) => prev !== "" && (prev === "HEAD" || res.remoteBranches.includes(prev) || res.localBranches.includes(prev)) ? prev : res.defaultBase);
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					if (msg.includes("no active Remote method")) {
						setStaleHostHint(true);
						showToast("error", t("dialog.create.restartHint"));
					} else showToast("error", t("notice.error", { message: msg }));
				} finally {
					setFetchingBranches(false);
				}
			}, [
				api,
				busy,
				createDialog,
				fetchingBranches,
				showToast,
				t
			]);
			(0, react.useEffect)(() => {
				if (createDialog === null && removeDialog === null && wsRenameDialog === null && wsDeleteDialog === null) return;
				const onKey = (event) => {
					if (event.key === "Escape" && !busy) {
						setCreateDialog(null);
						setRemoveDialog(null);
						setWsRenameDialog(null);
						setWsDeleteDialog(null);
					}
				};
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("keydown", onKey);
				};
			}, [
				createDialog,
				removeDialog,
				wsRenameDialog,
				wsDeleteDialog,
				busy
			]);
			(0, react.useEffect)(() => {
				if (!wide) return;
				const onKeyDown = (event) => {
					if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "f") {
						const active = document.activeElement;
						if (active !== null && rootRef.current?.contains(active)) {
							event.preventDefault();
							searchInputRef.current?.focus();
							searchInputRef.current?.select();
						}
					}
				};
				window.addEventListener("keydown", onKeyDown);
				return () => {
					window.removeEventListener("keydown", onKeyDown);
				};
			}, [wide]);
			const activeSessionId = (0, react.useMemo)(() => {
				if (panelActive) return void 0;
				for (const id of sessionList.ids) {
					const s = sessionList.byId[id];
					if (s !== void 0 && (s.retainedBy?.mainView ?? 0) > 0) return s.id;
				}
			}, [panelActive, sessionList]);
			const archivedSet = (0, react.useMemo)(() => new Set(workspaceSnap.archivedSessionIds), [workspaceSnap.archivedSessionIds]);
			const pinnedSessionSet = (0, react.useMemo)(() => new Set(workspaceSnap.pinnedSessionIds), [workspaceSnap.pinnedSessionIds]);
			/**
			* Long chat lists preview only the top rows (pinned chats sort first) until the
			* user expands; pinned chats beyond the slice always stay visible.
			*/
			const previewChats = (0, react.useCallback)((chats, key) => {
				if (chats.length <= CHAT_PREVIEW_LIMIT || expandedChatLists.has(key)) return chats;
				const top = chats.slice(0, CHAT_PREVIEW_LIMIT);
				const topIds = new Set(top.map((c) => c.id));
				for (const chat of chats) if (pinnedSessionSet.has(chat.id) && !topIds.has(chat.id)) top.push(chat);
				return top;
			}, [expandedChatLists, pinnedSessionSet]);
			const toggleChatList = (0, react.useCallback)((key) => {
				setExpandedChatLists((prev) => {
					const next = new Set(prev);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
			}, []);
			const visibleSessions = (0, react.useMemo)(() => {
				const list = [];
				for (const id of sessionList.ids) {
					const s = sessionList.byId[id];
					if (s === void 0) continue;
					if (s.origin === "subagent") continue;
					if (archivedSet.has(s.id)) continue;
					if (s.blank && s.id !== activeSessionId) continue;
					list.push(s);
				}
				list.sort((a, b) => {
					if (a.blank && !b.blank) return -1;
					if (!a.blank && b.blank) return 1;
					const aPin = pinnedSessionSet.has(a.id);
					if (aPin !== pinnedSessionSet.has(b.id)) return aPin ? -1 : 1;
					return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
				});
				return list;
			}, [
				sessionList,
				archivedSet,
				activeSessionId,
				pinnedSessionSet
			]);
			const { sessionsByPath, ungroupedSessions } = (0, react.useMemo)(() => {
				const allKnownPaths = [];
				const seen = /* @__PURE__ */ new Set();
				for (const repo of overview?.repos ?? []) for (const row of repo.rows) {
					const p = normalizePath(row.path);
					if (!seen.has(p)) {
						seen.add(p);
						allKnownPaths.push(p);
					}
				}
				for (const ws of workspaceSnap.items) {
					const p = normalizePath(ws.path);
					if (!seen.has(p)) {
						seen.add(p);
						allKnownPaths.push(p);
					}
				}
				allKnownPaths.sort((a, b) => b.length - a.length);
				const sessionExplicitWsPath = /* @__PURE__ */ new Map();
				for (const ws of workspaceSnap.items) {
					const wsPath = normalizePath(ws.path);
					for (const sid of ws.sessionIds) sessionExplicitWsPath.set(sid, wsPath);
				}
				const bucket = /* @__PURE__ */ new Map();
				const loose = [];
				for (const s of visibleSessions) {
					const cwdNorm = s.cwd !== void 0 && s.cwd.length > 0 ? normalizePath(s.cwd) : void 0;
					let matchedPath;
					if (cwdNorm !== void 0) matchedPath = allKnownPaths.find((candidate) => cwdNorm === candidate || cwdNorm.startsWith(`${candidate}/`));
					if (matchedPath === void 0) matchedPath = sessionExplicitWsPath.get(s.id);
					if (matchedPath !== void 0 && seen.has(matchedPath)) {
						const arr = bucket.get(matchedPath) ?? [];
						arr.push(s);
						bucket.set(matchedPath, arr);
					} else loose.push(s);
				}
				return {
					sessionsByPath: bucket,
					ungroupedSessions: loose
				};
			}, [
				overview,
				workspaceSnap.items,
				visibleSessions
			]);
			const nonGitWorkspaces = (0, react.useMemo)(() => {
				const claimed = new Set((overview?.claimedPaths ?? []).map(normalizePath));
				for (const repo of overview?.repos ?? []) {
					claimed.add(normalizePath(repo.repositoryRoot));
					for (const row of repo.rows) claimed.add(normalizePath(row.path));
				}
				return workspaceSnap.items.filter((ws) => !claimed.has(normalizePath(ws.path)));
			}, [overview, workspaceSnap.items]);
			const missingPathSet = (0, react.useMemo)(() => new Set((overview?.missingPaths ?? []).map(normalizePath)), [overview?.missingPaths]);
			const toggleSetItem = (setter, storageKey, itemKey) => {
				setter((prev) => {
					const next = new Set(prev);
					if (next.has(itemKey)) next.delete(itemKey);
					else next.add(itemKey);
					saveStoredSet(storageKey, next);
					return next;
				});
			};
			/** Click a worktree branch row: open its active/latest conversation, or start one inside it. */
			const activateWorktreeChat = (0, react.useCallback)(async (row) => {
				const norm = normalizePath(row.path);
				const chats = sessionsByPath.get(norm) ?? [];
				if (chats.find((c) => c.id === activeSessionId) !== void 0) {
					if (chats.length > 1) toggleSetItem(setExpandedChats, STORAGE_EXPANDED_CHATS, norm);
					return;
				}
				if (chats.length > 0) {
					props.openSession(chats[0].id);
					return;
				}
				try {
					const wsId = row.workspaceId ?? (await api.ensureWorkspace(row.path, row.displayName ?? row.branch)).workspaceId;
					startSessionWhenReady(wsId);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				}
			}, [
				activeSessionId,
				api,
				props,
				sessionsByPath,
				showToast,
				startSessionWhenReady,
				t
			]);
			/** Start a brand-new conversation inside `row.path`. */
			const startNewChatInWorktree = (0, react.useCallback)(async (row, event) => {
				event?.stopPropagation();
				const norm = normalizePath(row.path);
				try {
					const wsId = row.workspaceId ?? (await api.ensureWorkspace(row.path, row.displayName ?? row.branch)).workspaceId;
					setExpandedChats((prev) => {
						const next = new Set(prev);
						next.add(norm);
						saveStoredSet(STORAGE_EXPANDED_CHATS, next);
						return next;
					});
					startSessionWhenReady(wsId);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				}
			}, [
				api,
				showToast,
				startSessionWhenReady,
				t
			]);
			const handleTogglePin = (0, react.useCallback)(async (row, event) => {
				event.stopPropagation();
				try {
					await api.setPinned(row.path, !row.pinned);
					await refreshOverview(true);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				}
			}, [
				api,
				refreshOverview,
				showToast,
				t
			]);
			const submitCreateWorktree = (0, react.useCallback)(async () => {
				if (createDialog === null || busy) return;
				setBusy(true);
				try {
					const created = await api.create({
						repositoryRoot: createDialog.repositoryRoot,
						name: branchDraft.trim() || void 0,
						from: fromDraft.trim() || void 0,
						parentPath: createDialog.parentPath
					});
					setCreateDialog(null);
					setBranchDraft("");
					setFromDraft("");
					showToast("info", t("notice.created", { branch: created.branch }));
					await refreshOverview(true);
					const wsId = created.workspaceId ?? (await api.ensureWorkspace(created.path, created.branch)).workspaceId;
					startSessionWhenReady(wsId);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				branchDraft,
				busy,
				createDialog,
				fromDraft,
				refreshOverview,
				showToast,
				startSessionWhenReady,
				t
			]);
			const submitRemoveWorktree = (0, react.useCallback)(async () => {
				if (removeDialog === null || busy) return;
				const { row, childCount } = removeDialog;
				const needsForce = row.dirtyCount > 0 || childCount > 0;
				if (needsForce && !forceRemove) return;
				setBusy(true);
				try {
					const removed = await api.remove(row.path, forceRemove || !needsForce ? forceRemove : false, removeRemote);
					setRemoveDialog(null);
					setForceRemove(false);
					setRemoveRemote(false);
					const msg = `${t("notice.removed", { path: row.branch })}${removed.archivedCount && removed.archivedCount > 0 ? ` ${t("notice.archivedCount", { count: removed.archivedCount })}` : ""}${removed.branchHadUnmerged ? ` ${t("notice.forceDeleted")}` : !removed.branchDeleted ? ` ${t("notice.preserved")}` : ""}${removed.remoteDeleted ? ` ${t("notice.remoteDeleted")}` : ""}`;
					if (removed.remoteError !== void 0) showToast("error", `${msg} ${t("notice.remoteFailed", { message: removed.remoteError })}`);
					else showToast(removed.branchHadUnmerged ? "error" : "info", msg);
					await refreshOverview(true);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				busy,
				forceRemove,
				refreshOverview,
				removeDialog,
				removeRemote,
				showToast,
				t
			]);
			const submitWorkspaceRename = (0, react.useCallback)(async () => {
				if (wsRenameDialog === null || busy || props.renameWorkspace === void 0) return;
				const nextTitle = wsRenameDraft.trim();
				if (nextTitle === "" || nextTitle === wsRenameDialog.title) return;
				if (workspaceSnap.items.some((w) => w.workspaceId !== wsRenameDialog.workspaceId && w.title === nextTitle)) return;
				setBusy(true);
				try {
					await props.renameWorkspace(wsRenameDialog.workspaceId, nextTitle);
					setWsRenameDialog(null);
					setWsRenameDraft("");
					showToast("info", t("notice.wsRenamed", { name: nextTitle }));
					await refreshOverview(true);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					setBusy(false);
				}
			}, [
				busy,
				props,
				refreshOverview,
				showToast,
				t,
				workspaceSnap.items,
				wsRenameDialog,
				wsRenameDraft
			]);
			const submitWorkspaceDelete = (0, react.useCallback)(async () => {
				if (wsDeleteDialog === null || busy || props.deleteWorkspace === void 0) return;
				setBusy(true);
				try {
					await props.deleteWorkspace(wsDeleteDialog.workspaceId);
					const deletedName = wsDeleteDialog.title;
					setWsDeleteDialog(null);
					showToast("info", t("notice.wsDeleted", { name: deletedName }));
					await refreshOverview(true);
				} catch (error) {
					showToast("error", t("notice.error", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					setBusy(false);
				}
			}, [
				busy,
				props,
				refreshOverview,
				showToast,
				t,
				wsDeleteDialog
			]);
			const sessionStateKind = (0, react.useCallback)((s) => {
				const live = sessionStatuses.get(s.id);
				if (live?.pendingInteraction?.kind !== void 0) return "pending";
				if ((live?.running ?? s.running) === true) return "running";
				return "idle";
			}, [sessionStatuses]);
			const worktreeStateKind = (0, react.useCallback)((path) => {
				const chats = sessionsByPath.get(normalizePath(path)) ?? [];
				let hasRunning = false;
				for (const c of chats) {
					const kind = sessionStateKind(c);
					if (kind === "pending") return "pending";
					if (kind === "running") hasRunning = true;
				}
				return hasRunning ? "running" : "idle";
			}, [sessionStateKind, sessionsByPath]);
			const normalizedQuery = query.trim().toLowerCase();
			if (!wide) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "owt-rail",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "owt-icon-btn",
					"aria-label": t("header.search"),
					title: t("header.search"),
					onClick: () => {
						props.expandSidebar?.();
						window.setTimeout(() => {
							searchInputRef.current?.focus();
						}, 180);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, { size: 15 })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "owt-icon-btn",
					"aria-label": t("header.addRepo"),
					title: t("header.addRepo"),
					onClick: () => {
						props.pickAndAddWorkspace();
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 15 })
				})]
			});
			const renderRepo = (repo) => {
				const byPath = /* @__PURE__ */ new Map();
				for (const row of repo.rows) byPath.set(normalizePath(row.path), row);
				const matchesRow = (row) => {
					if (normalizedQuery === "") return true;
					if ((row.displayName ?? row.branch).toLowerCase().includes(normalizedQuery)) return true;
					if (repo.name.toLowerCase().includes(normalizedQuery)) return true;
					return (sessionsByPath.get(normalizePath(row.path)) ?? []).some((c) => sessionLabel(c, t).toLowerCase().includes(normalizedQuery));
				};
				const childrenMap = /* @__PURE__ */ new Map();
				for (const row of repo.rows) {
					const parentNorm = row.parentPath !== void 0 ? normalizePath(row.parentPath) : void 0;
					if (parentNorm !== void 0 && parentNorm !== normalizePath(row.path) && byPath.has(parentNorm)) {
						const list = childrenMap.get(parentNorm) ?? [];
						list.push(row);
						childrenMap.set(parentNorm, list);
					}
				}
				const subtreeVisible = (row) => {
					if (matchesRow(row)) return true;
					return (childrenMap.get(normalizePath(row.path)) ?? []).some(subtreeVisible);
				};
				const roots = repo.rows.filter((row) => {
					const parentNorm = row.parentPath !== void 0 ? normalizePath(row.parentPath) : void 0;
					return (parentNorm === void 0 || parentNorm === normalizePath(row.path) || !byPath.has(parentNorm)) && subtreeVisible(row);
				});
				if (normalizedQuery !== "" && roots.length === 0) return null;
				const repoCollapsed = normalizedQuery === "" && collapsedRepos.has(repo.repositoryRoot);
				const repoContainsActive = repo.rows.some((r) => (sessionsByPath.get(normalizePath(r.path)) ?? []).some((c) => c.id === activeSessionId));
				const renderWorktreeTree = (row) => {
					const rowNorm = normalizePath(row.path);
					const kids = (childrenMap.get(rowNorm) ?? []).filter(subtreeVisible);
					const lineageCollapsed = normalizedQuery === "" && collapsedLineage.has(rowNorm);
					const chats = sessionsByPath.get(rowNorm) ?? [];
					const hasActiveChat = chats.some((c) => c.id === activeSessionId);
					const chatsOpen = normalizedQuery !== "" ? chats.some((c) => sessionLabel(c, t).toLowerCase().includes(normalizedQuery)) : expandedChats.has(rowNorm);
					const status = worktreeStateKind(row.path);
					const chatPreview = previewChats(chats, `wt:${rowNorm}`);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-wt-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-wt-row",
								role: "treeitem",
								tabIndex: 0,
								"aria-selected": hasActiveChat,
								"data-active": hasActiveChat ? "true" : "false",
								title: `${row.branch}\n${row.path}`,
								onClick: (event) => {
									event.stopPropagation();
									activateWorktreeChat(row);
								},
								onKeyDown: (event) => {
									if (event.target !== event.currentTarget) return;
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										activateWorktreeChat(row);
									}
								},
								onContextMenu: (event) => {
									event.preventDefault();
									event.stopPropagation();
									props.openWorkspaceMenu(row.workspaceId, row.path, row.displayName ?? row.branch, {
										x: event.clientX,
										y: event.clientY
									});
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-git-icon",
										"data-status": status,
										"aria-hidden": true,
										children: status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "owt-loading" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 13.5 })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-wt-branch-wrap",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-wt-branch",
											children: row.displayName ?? row.branch
										})
									}),
									row.dirtyCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-dirty-pill",
										title: t("wt.dirtyHint", { count: row.dirtyCount }),
										children: row.dirtyCount
									}),
									chats.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "owt-chat-pill",
										"aria-expanded": chatsOpen,
										title: t("wt.chatsCount", { count: chats.length }),
										onClick: (event) => {
											event.stopPropagation();
											toggleSetItem(setExpandedChats, STORAGE_EXPANDED_CHATS, rowNorm);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChat, { size: 10.5 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: chats.length })]
									}),
									kids.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "owt-lineage-toggle",
										"aria-expanded": !lineageCollapsed,
										title: t("wt.childrenBadge", { count: kids.length }),
										onClick: (event) => {
											event.stopPropagation();
											toggleSetItem(setCollapsedLineage, STORAGE_COLLAPSED_LINEAGE, rowNorm);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
											open: !lineageCollapsed,
											size: 10
										}), lineageCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: kids.length })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "owt-hover-actions",
										onClick: (event) => {
											event.stopPropagation();
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "owt-icon-btn",
											title: t("wt.newChat"),
											"aria-label": t("wt.newChat"),
											onClick: (event) => {
												startNewChatInWorktree(row, event);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 12.5 })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "owt-icon-btn",
											title: t("wt.more"),
											"aria-label": t("wt.more"),
											onClick: (event) => {
												event.stopPropagation();
												const rect = event.currentTarget.getBoundingClientRect();
												props.openWorkspaceMenu(row.workspaceId, row.path, row.displayName ?? row.branch, {
													x: rect.left,
													y: rect.bottom
												});
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDots, { size: 12.5 })
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-star-btn",
										"data-pinned": row.pinned ? "true" : "false",
										"aria-label": row.pinned ? t("wt.unpin") : t("wt.pin"),
										title: row.pinned ? t("wt.unpin") : t("wt.pin"),
										onClick: (event) => {
											handleTogglePin(row, event);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStar, {
											filled: row.pinned,
											size: 12.5
										})
									})
								]
							}),
							chatsOpen && chats.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-chats",
								role: "group",
								children: [chatPreview.map((chat) => {
									const selected = chat.id === activeSessionId;
									const label = sessionLabel(chat, t);
									const chatSt = sessionStateKind(chat);
									const ageText = chat.blank ? "" : formatCompactAge(chat.updatedAt, nowMs, t);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-chat-row",
										role: "treeitem",
										tabIndex: 0,
										"data-selected": selected ? "true" : "false",
										"aria-selected": selected,
										title: label,
										onClick: (event) => {
											event.stopPropagation();
											props.openSession(chat.id);
										},
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												event.stopPropagation();
												props.openSession(chat.id);
											}
										},
										onContextMenu: (event) => {
											if (chat.blank) return;
											event.preventDefault();
											event.stopPropagation();
											props.openSessionMenu(chat.id, label, {
												x: event.clientX,
												y: event.clientY
											});
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChatMarker, { state: chatSt }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-chat-title",
												children: label
											}),
											ageText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-chat-time",
												children: ageText
											}),
											!chat.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-hover-actions",
												onClick: (event) => {
													event.stopPropagation();
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "owt-icon-btn",
													onClick: (event) => {
														event.stopPropagation();
														const rect = event.currentTarget.getBoundingClientRect();
														props.openSessionMenu(chat.id, label, {
															x: rect.left,
															y: rect.bottom
														});
													},
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDots, { size: 12 })
												})
											})
										]
									}, chat.id);
								}), chats.length > CHAT_PREVIEW_LIMIT && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "owt-chats-more",
									"aria-expanded": expandedChatLists.has(`wt:${rowNorm}`),
									onClick: (event) => {
										event.stopPropagation();
										toggleChatList(`wt:${rowNorm}`);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
										open: expandedChatLists.has(`wt:${rowNorm}`),
										size: 10
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: expandedChatLists.has(`wt:${rowNorm}`) ? t("wt.chatsLess") : t("wt.chatsMore", { count: chats.length - chatPreview.length }) })]
								})]
							}),
							kids.length > 0 && !lineageCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "owt-lineage-rail",
								role: "group",
								"data-worktree-lineage-children": true,
								children: kids.map((kid) => renderWorktreeTree(kid))
							})
						]
					}, row.path);
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "owt-group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-repo-row",
						role: "treeitem",
						"aria-expanded": !repoCollapsed,
						"data-has-active": repoContainsActive ? "true" : "false",
						title: repo.repositoryRoot,
						onClick: () => {
							toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, repo.repositoryRoot);
						},
						onContextMenu: (event) => {
							event.preventDefault();
							props.openWorkspaceMenu(repo.rootWorkspaceId, repo.repositoryRoot, repo.name, {
								x: event.clientX,
								y: event.clientY
							});
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-repo-chevron",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
									open: !repoCollapsed,
									size: 12
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-repo-name",
								children: repo.name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "owt-repo-count",
								children: repo.rows.length
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "owt-hover-actions",
								onClick: (event) => {
									event.stopPropagation();
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "owt-icon-btn",
									title: t("repo.more"),
									"aria-label": t("repo.more"),
									onClick: (event) => {
										const rect = event.currentTarget.getBoundingClientRect();
										props.openWorkspaceMenu(repo.rootWorkspaceId, repo.repositoryRoot, repo.name, {
											x: rect.left,
											y: rect.bottom
										});
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDots, { size: 13.5 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "owt-icon-btn",
									title: t("repo.newWorktree"),
									"aria-label": t("repo.newWorktree"),
									onClick: () => {
										setBranchDraft("");
										setFromDraft("");
										setCreateDialog({ repositoryRoot: repo.repositoryRoot });
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 13.5 })
								})]
							})
						]
					}), !repoCollapsed && roots.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-repo-children",
						role: "group",
						children: roots.map((row) => renderWorktreeTree(row))
					})]
				}, repo.repositoryRoot);
			};
			(0, react.useEffect)(() => {
				const onRequestCreate = (event) => {
					const detail = event.detail;
					if (!detail?.repositoryRoot) return;
					setBranchDraft("");
					setFromDraft("");
					setCreateDialog(detail);
				};
				const onRequestRemove = (event) => {
					const detail = event.detail;
					if (!detail?.row) return;
					setForceRemove(false);
					setRemoveRemote(false);
					setRemoveDialog(detail);
				};
				const onRequestNewChat = (event) => {
					const detail = event.detail;
					if (!detail?.row) return;
					startNewChatInWorktree(detail.row);
				};
				const onRequestRefresh = () => {
					refreshOverview(true);
				};
				const onRequestWsRename = (event) => {
					const detail = event.detail;
					if (!detail?.workspaceId) return;
					setWsRenameDraft(detail.title);
					setWsRenameDialog(detail);
				};
				const onRequestWsDelete = (event) => {
					const detail = event.detail;
					if (!detail?.workspaceId) return;
					setWsDeleteDialog(detail);
				};
				window.addEventListener("dsh-worktree:open-create", onRequestCreate);
				window.addEventListener("dsh-worktree:open-remove", onRequestRemove);
				window.addEventListener("dsh-worktree:new-chat", onRequestNewChat);
				window.addEventListener("dsh-worktree:refresh", onRequestRefresh);
				window.addEventListener("dsh-worktree:open-ws-rename", onRequestWsRename);
				window.addEventListener("dsh-worktree:open-ws-delete", onRequestWsDelete);
				return () => {
					window.removeEventListener("dsh-worktree:open-create", onRequestCreate);
					window.removeEventListener("dsh-worktree:open-remove", onRequestRemove);
					window.removeEventListener("dsh-worktree:new-chat", onRequestNewChat);
					window.removeEventListener("dsh-worktree:refresh", onRequestRefresh);
					window.removeEventListener("dsh-worktree:open-ws-rename", onRequestWsRename);
					window.removeEventListener("dsh-worktree:open-ws-delete", onRequestWsDelete);
				};
			}, [refreshOverview, startNewChatInWorktree]);
			const renderedRepos = (overview?.repos ?? []).map(renderRepo).filter((node) => node !== null);
			const filteredNonGit = nonGitWorkspaces.filter((ws) => {
				if (normalizedQuery === "") return true;
				if (ws.title.toLowerCase().includes(normalizedQuery)) return true;
				return (sessionsByPath.get(normalizePath(ws.path)) ?? []).some((c) => sessionLabel(c, t).toLowerCase().includes(normalizedQuery));
			});
			const filteredUngrouped = ungroupedSessions.filter((s) => normalizedQuery === "" || sessionLabel(s, t).toLowerCase().includes(normalizedQuery));
			const nothingShown = renderedRepos.length === 0 && filteredNonGit.length === 0 && filteredUngrouped.length === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "owt-root",
				ref: rootRef,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-search-wrap",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "owt-search-icon",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, { size: 13 })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: searchInputRef,
									type: "text",
									placeholder: t("header.search"),
									"aria-label": t("header.search"),
									value: query,
									onChange: (event) => {
										setQuery(event.target.value);
									},
									onKeyDown: (event) => {
										if (event.key === "Escape") {
											setQuery("");
											event.currentTarget.blur();
										}
									}
								}),
								query !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "owt-clear-btn",
									"aria-label": t("header.clearSearch"),
									title: t("header.clearSearch"),
									onClick: () => {
										setQuery("");
										searchInputRef.current?.focus();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, { size: 11 })
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "owt-kbd-hint",
									"aria-hidden": true,
									children: shortcutBadge
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "owt-add-btn",
							title: t("header.addRepo"),
							"aria-label": t("header.addRepo"),
							onClick: () => {
								props.pickAndAddWorkspace();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 14 })
						})]
					}),
					toast !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-toast",
						"data-kind": toast.kind,
						role: "status",
						children: toast.text
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "owt-scroll",
						role: "tree",
						"aria-label": t("header.title"),
						children: [
							renderedRepos,
							filteredNonGit.map((ws) => {
								const norm = normalizePath(ws.path);
								const isMissing = missingPathSet.has(norm);
								const collapsed = normalizedQuery === "" && collapsedRepos.has(norm);
								const chats = sessionsByPath.get(norm) ?? [];
								const folderHasActive = chats.some((c) => c.id === activeSessionId);
								const chatPreview = previewChats(chats, `ws:${norm}`);
								const chatsExpanded = expandedChatLists.has(`ws:${norm}`);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-group",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-repo-row",
										role: "treeitem",
										"aria-expanded": !collapsed,
										"data-missing": isMissing ? "true" : "false",
										"data-has-active": folderHasActive ? "true" : "false",
										title: isMissing ? t("dialog.wsDelete.missingHint", { path: ws.path }) : ws.path,
										onClick: () => {
											toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, norm);
										},
										onContextMenu: (event) => {
											event.preventDefault();
											props.openWorkspaceMenu(ws.workspaceId, ws.path, ws.title, {
												x: event.clientX,
												y: event.clientY
											});
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-repo-chevron",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
													open: !collapsed,
													size: 12
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-repo-name",
												children: ws.title
											}),
											isMissing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-missing-pill",
												children: t("wt.missingBadge")
											}) : chats.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-repo-count",
												children: chats.length
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "owt-hover-actions",
												onClick: (event) => {
													event.stopPropagation();
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "owt-icon-btn",
													onClick: (event) => {
														const rect = event.currentTarget.getBoundingClientRect();
														props.openWorkspaceMenu(ws.workspaceId, ws.path, ws.title, {
															x: rect.left,
															y: rect.bottom
														});
													},
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDots, { size: 13.5 })
												}), !isMissing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "owt-icon-btn",
													title: t("wt.newChat"),
													onClick: () => {
														props.startSession(ws.workspaceId);
													},
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlus, { size: 13.5 })
												})]
											})
										]
									}), !collapsed && chats.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-repo-children",
										role: "group",
										children: [chatPreview.map((chat) => {
											const selected = chat.id === activeSessionId;
											const label = sessionLabel(chat, t);
											const st = sessionStateKind(chat);
											const ageText = chat.blank ? "" : formatCompactAge(chat.updatedAt, nowMs, t);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "owt-wt-row",
												role: "treeitem",
												"data-active": selected ? "true" : "false",
												onClick: () => {
													props.openSession(chat.id);
												},
												onContextMenu: (event) => {
													if (chat.blank) return;
													event.preventDefault();
													props.openSessionMenu(chat.id, label, {
														x: event.clientX,
														y: event.clientY
													});
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChatMarker, { state: st }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-wt-plain-label",
														children: label
													}),
													ageText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-chat-time",
														children: ageText
													})
												]
											}, chat.id);
										}), chats.length > CHAT_PREVIEW_LIMIT && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "owt-chats-more",
											"aria-expanded": chatsExpanded,
											onClick: (event) => {
												event.stopPropagation();
												toggleChatList(`ws:${norm}`);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
												open: chatsExpanded,
												size: 10
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: chatsExpanded ? t("wt.chatsLess") : t("wt.chatsMore", { count: chats.length - chatPreview.length }) })]
										})]
									})]
								}, ws.workspaceId);
							}),
							filteredUngrouped.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-repo-row",
									role: "treeitem",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-repo-chevron",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
												open: true,
												size: 12
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-repo-name",
											children: t("folder.ungrouped")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-repo-count",
											children: filteredUngrouped.length
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-repo-children",
									role: "group",
									children: (() => {
										const ungroupedPreview = previewChats(filteredUngrouped, "ungrouped");
										const ungroupedExpanded = expandedChatLists.has("ungrouped");
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [ungroupedPreview.map((chat) => {
											const selected = chat.id === activeSessionId;
											const label = sessionLabel(chat, t);
											const st = sessionStateKind(chat);
											const ageText = chat.blank ? "" : formatCompactAge(chat.updatedAt, nowMs, t);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "owt-wt-row",
												role: "treeitem",
												"data-active": selected ? "true" : "false",
												onClick: () => {
													props.openSession(chat.id);
												},
												onContextMenu: (event) => {
													if (chat.blank) return;
													event.preventDefault();
													props.openSessionMenu(chat.id, label, {
														x: event.clientX,
														y: event.clientY
													});
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChatMarker, { state: st }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-wt-plain-label",
														children: label
													}),
													ageText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "owt-chat-time",
														children: ageText
													})
												]
											}, chat.id);
										}), filteredUngrouped.length > CHAT_PREVIEW_LIMIT && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "owt-chats-more",
											"aria-expanded": ungroupedExpanded,
											onClick: () => {
												toggleChatList("ungrouped");
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, {
												open: ungroupedExpanded,
												size: 10
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: ungroupedExpanded ? t("wt.chatsLess") : t("wt.chatsMore", { count: filteredUngrouped.length - ungroupedPreview.length }) })]
										})] });
									})()
								})]
							}),
							nothingShown && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "owt-empty",
								children: normalizedQuery !== "" ? t("empty.search") : t("empty.repos")
							})
						]
					}),
					createDialog !== null && typeof document !== "undefined" && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-modal-backdrop",
						onClick: () => {
							if (!busy) setCreateDialog(null);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-modal",
							role: "dialog",
							"aria-modal": "true",
							onClick: (event) => {
								event.stopPropagation();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-modal-head",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-modal-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-modal-title-icon",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconLineage, { size: 14.5 })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: createDialog.parentBranch !== void 0 ? t("dialog.create.childHeading") : t("dialog.create.title") })]
									}), createDialog.parentBranch !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-modal-sub",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.create.childSub") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "owt-code-chip",
												children: createDialog.parentBranch
											}),
											t("dialog.create.childSubTail") !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.create.childSubTail") })
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "owt-field-label",
										children: t("dialog.create.branchLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-input-shell",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "owt-input",
											"data-mono": "true",
											type: "text",
											autoFocus: true,
											disabled: busy,
											placeholder: t("dialog.create.branchPlaceholder"),
											value: branchDraft,
											onChange: (event) => {
												setBranchDraft(event.target.value);
											},
											onCompositionStart: () => {
												composingRef.current = true;
											},
											onCompositionEnd: () => {
												composingRef.current = false;
											},
											onKeyDown: (event) => {
												if (event.key === "Enter" && !composingRef.current) {
													event.preventDefault();
													submitCreateWorktree();
												}
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-input-enter-hint",
											"aria-hidden": true,
											children: t("dialog.create.enterHint")
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-field-label",
											children: t("dialog.create.fromLabel")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "owt-select-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "owt-select",
												"aria-label": t("dialog.create.fromLabel"),
												disabled: busy || loadingBranches,
												value: fromDraft || branchOptions?.defaultBase || "HEAD",
												onChange: (event) => {
													userPickedFromRef.current = true;
													setFromDraft(event.target.value);
												},
												children: [
													loadingBranches && branchOptions === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: fromDraft || "HEAD",
														children: t("dialog.create.loadingBranches")
													}),
													(branchOptions?.remoteBranches.length ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
														label: t("dialog.create.remoteGroup"),
														children: branchOptions.remoteBranches.map((b) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: b,
															children: b
														}, `remote:${b}`))
													}),
													(branchOptions?.localBranches.length ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
														label: t("dialog.create.localGroup"),
														children: branchOptions.localBranches.map((b) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: b,
															children: b
														}, `local:${b}`))
													}),
													branchOptions !== null && (branchOptions.remoteBranches.length === 0 && branchOptions.localBranches.length === 0 || fromDraft === "HEAD") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "HEAD",
														children: "HEAD"
													})
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "owt-fetch-btn",
												title: t("dialog.create.fetchBranches"),
												"aria-label": t("dialog.create.fetchBranches"),
												disabled: busy || loadingBranches || fetchingBranches,
												onClick: () => {
													handleFetchBranches();
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {
													size: 13,
													spinning: fetchingBranches
												})
											})]
										}),
										staleHostHint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "owt-field-hint",
											children: t("dialog.create.restartHint")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-modal-foot",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										disabled: busy,
										onClick: () => {
											setCreateDialog(null);
										},
										children: t("dialog.create.cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										"data-kind": "primary",
										disabled: busy,
										onClick: () => {
											submitCreateWorktree();
										},
										children: t("dialog.create.submit")
									})]
								})
							]
						})
					}), document.body),
					removeDialog !== null && typeof document !== "undefined" && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-modal-backdrop",
						onClick: () => {
							if (!busy) setRemoveDialog(null);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-modal",
							role: "dialog",
							"aria-modal": "true",
							onClick: (event) => {
								event.stopPropagation();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-title",
									children: t("dialog.remove.title", { branch: removeDialog.row.branch })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									children: t("dialog.remove.desc")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									"data-kind": "danger",
									children: t("dialog.remove.branch", { branch: removeDialog.row.branch })
								}),
								removeDialog.row.upstream !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "owt-modal-check",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: removeRemote,
										disabled: busy,
										onChange: (event) => {
											setRemoveRemote(event.target.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.remove.remote", { upstream: removeDialog.row.upstream }) })]
								}),
								removeDialog.row.dirtyCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									children: t("dialog.remove.dirty", { count: removeDialog.row.dirtyCount })
								}),
								removeDialog.childCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									children: t("dialog.remove.children", { count: removeDialog.childCount })
								}),
								(removeDialog.row.dirtyCount > 0 || removeDialog.childCount > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "owt-modal-check",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: forceRemove,
										disabled: busy,
										onChange: (event) => {
											setForceRemove(event.target.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.remove.force") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-modal-foot",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										disabled: busy,
										onClick: () => {
											setRemoveDialog(null);
										},
										children: t("dialog.create.cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										"data-kind": "danger",
										disabled: busy || (removeDialog.row.dirtyCount > 0 || removeDialog.childCount > 0) && !forceRemove,
										onClick: () => {
											submitRemoveWorktree();
										},
										children: t("dialog.remove.confirm")
									})]
								})
							]
						})
					}), document.body),
					wsRenameDialog !== null && typeof document !== "undefined" && (() => {
						const trimmed = wsRenameDraft.trim();
						const conflict = trimmed !== "" && workspaceSnap.items.some((w) => w.workspaceId !== wsRenameDialog.workspaceId && w.title === trimmed);
						const blocked = busy || trimmed === "" || trimmed === wsRenameDialog.title || conflict;
						return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "owt-modal-backdrop",
							onClick: () => {
								if (!busy) setWsRenameDialog(null);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "owt-modal",
								role: "dialog",
								"aria-modal": "true",
								onClick: (event) => {
									event.stopPropagation();
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "owt-modal-title",
										children: t("dialog.wsRename.title")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "owt-input",
										type: "text",
										autoFocus: true,
										disabled: busy,
										placeholder: t("dialog.wsRename.placeholder"),
										value: wsRenameDraft,
										onFocus: (event) => {
											event.target.select();
										},
										onChange: (event) => {
											setWsRenameDraft(event.target.value);
										},
										onCompositionStart: () => {
											composingRef.current = true;
										},
										onCompositionEnd: () => {
											composingRef.current = false;
										},
										onKeyDown: (event) => {
											if (event.key === "Enter" && !composingRef.current && !blocked) {
												event.preventDefault();
												submitWorkspaceRename();
											}
										}
									}),
									conflict && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "owt-modal-desc",
										"data-kind": "danger",
										children: t("dialog.wsRename.conflict", { name: trimmed })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "owt-modal-foot",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "owt-btn",
											disabled: busy,
											onClick: () => {
												setWsRenameDialog(null);
											},
											children: t("dialog.create.cancel")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "owt-btn",
											"data-kind": "primary",
											disabled: blocked,
											onClick: () => {
												submitWorkspaceRename();
											},
											children: t("dialog.wsRename.submit")
										})]
									})
								]
							})
						}), document.body);
					})(),
					wsDeleteDialog !== null && typeof document !== "undefined" && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "owt-modal-backdrop",
						onClick: () => {
							if (!busy) setWsDeleteDialog(null);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "owt-modal",
							role: "dialog",
							"aria-modal": "true",
							onClick: (event) => {
								event.stopPropagation();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-title",
									children: t("dialog.wsDelete.title", { name: wsDeleteDialog.title })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									children: t("dialog.wsDelete.desc")
								}),
								wsDeleteDialog.missing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "owt-modal-desc",
									"data-kind": "danger",
									children: t("dialog.wsDelete.missingHint", { path: wsDeleteDialog.path })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "owt-modal-foot",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										disabled: busy,
										onClick: () => {
											setWsDeleteDialog(null);
										},
										children: t("dialog.create.cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "owt-btn",
										"data-kind": "danger",
										disabled: busy,
										onClick: () => {
											submitWorkspaceDelete();
										},
										children: t("dialog.wsDelete.confirm")
									})]
								})
							]
						})
					}), document.body)
				]
			});
		}
		// src/client/styles.ts
		/**
		* VS Code Explorer / Source Control Minimalist Tree Styles (Light-First).
		*
		* Design rules:
		* - Workspace / Repo header: `[chevron] repo-name` (no folder icon, crisp section header).
		* - Git branch row: `[git-branch-icon] branch-name` (clean Codicon glyph, subtle status tint).
		* - Tree hierarchy: single clean 1px vertical indent guide per level (VS Code indent rail),
		*   zero dashed lines, zero heavy capsule shadows, flat 4px-radius row selection.
		* @module dsh-worktree-plugin/client/styles
		*/
		const STYLE_ID = "dsh-worktree-plugin-styles";
		const CSS = `
.owt-root {
  --owt-hairline: var(--dsh-hairline-width, 0.5px);
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  --owt-hover-bg: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  --owt-active-bg: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
  --owt-indent-guide: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  --owt-indent-guide-active: color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
  --owt-muted: color-mix(in srgb, var(--dsw-alias-label-secondary) 78%, transparent);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-font-smoothing: antialiased;
}

/* Collapsed 56px sidebar rail */
.owt-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
}

/* VS Code-style flat filter input + "+" action */
.owt-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 6px 6px;
  flex: none;
}

.owt-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px 0 8px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  transition: border-color 100ms ease;
}

.owt-search-wrap:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}

.owt-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--owt-muted);
  flex: none;
}

.owt-search-wrap input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.owt-search-wrap input::placeholder {
  color: var(--owt-muted);
}

.owt-kbd-hint {
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 10px;
  line-height: 15px;
  padding: 0 3px;
  color: var(--owt-muted);
  opacity: 0.75;
  pointer-events: none;
}

.owt-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-clear-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--owt-hover-bg);
}

.owt-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-add-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--owt-hover-bg);
}

.owt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 4px 16px 4px;
}

.owt-group {
  margin-bottom: 4px;
}

/* ============================================================================
   VS Code Section / Workspace Header Row:  ▾ workspace-name (NO folder icon)
   ============================================================================ */
.owt-repo-row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 4px 0 4px;
  border-radius: 5px;
  cursor: pointer;
}

.owt-repo-row:hover {
  background: var(--owt-hover-bg);
}

.owt-repo-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-secondary);
  flex: none;
}

.owt-repo-name {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-repo-row[data-missing="true"] .owt-repo-name {
  opacity: 0.55;
}

.owt-repo-count {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
  color: var(--owt-muted);
}

.owt-repo-row:hover .owt-repo-count,
.owt-repo-row:focus-within .owt-repo-count {
  display: none;
}

.owt-hover-actions {
  display: none;
  align-items: center;
  gap: 1px;
  flex: none;
}

.owt-repo-row:hover .owt-hover-actions,
.owt-repo-row:focus-within .owt-hover-actions,
.owt-wt-row:hover .owt-hover-actions,
.owt-wt-row:focus-within .owt-hover-actions,
.owt-chat-row:hover .owt-hover-actions,
.owt-chat-row:focus-within .owt-hover-actions {
  display: inline-flex;
}

@media (hover: none) {
  .owt-hover-actions {
    display: inline-flex;
  }
  .owt-repo-count {
    display: none;
  }
}

.owt-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-icon-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
}

/* ============================================================================
   VS Code Indent Guide Containers (1px crisp vertical line aligned to chevron)
   ============================================================================ */
.owt-repo-children {
  display: flex;
  flex-direction: column;
  margin-left: 11.5px;
  padding-left: 7px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-group:hover > .owt-repo-children {
  border-left-color: var(--owt-indent-guide-active);
}

.owt-wt-block {
  display: flex;
  flex-direction: column;
}

/* ============================================================================
   Git Worktree Branch Row:  [git-branch-icon] branch-name
   ============================================================================ */
.owt-wt-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 5px 0 6px;
  border-radius: 5px;
  cursor: pointer;
}

.owt-wt-row:hover {
  background: var(--owt-hover-bg);
}

.owt-wt-row[data-active="true"] {
  background: var(--owt-active-bg);
  color: var(--dsw-alias-brand-primary);
}

/* Leading 16px icon slot: Git branch icon (idle / active / warn / running) */
.owt-git-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}

.owt-wt-row[data-active="true"] .owt-git-icon {
  color: var(--dsw-alias-brand-primary);
}

.owt-git-icon[data-status="running"] {
  color: var(--dsw-alias-brand-primary);
}

.owt-git-icon[data-status="pending"] {
  color: var(--dsw-alias-state-warn-primary);
}

@keyframes owt-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .owt-loading {
    animation: none;
  }
}

/* Compact spinner used when a branch or chat is actively running */
.owt-loading {
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border-radius: 999px;
  flex: none;
  border: 1.4px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: owt-spin 0.8s linear infinite;
}

.owt-wt-branch-wrap {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
}

.owt-wt-branch {
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-wt-row[data-active="true"] .owt-wt-branch {
  font-weight: 500;
}

.owt-wt-plain-label {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 19px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-wt-row[data-active="true"] .owt-wt-plain-label {
  font-weight: 500;
}

/* VS Code SCM-style plain text status count (no heavy pill border) */
.owt-dirty-pill {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  padding: 0 3px;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-missing-pill {
  flex: none;
  font-size: 10.5px;
  line-height: 15px;
  padding: 0 4px;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-count-pill {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--owt-muted);
}

/* Minimal chat counter trigger */
.owt-chat-pill {
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
  height: 18px;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}

.owt-chat-pill:hover,
.owt-chat-pill[aria-expanded="true"] {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

/* Star button: quiet at rest unless pinned */
.owt-star-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  cursor: pointer;
  flex: none;
}

.owt-star-btn[data-pinned="true"] {
  display: inline-flex;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-wt-row:hover .owt-star-btn,
.owt-wt-row:focus-within .owt-star-btn {
  display: inline-flex;
}

.owt-star-btn:hover {
  color: var(--dsw-alias-state-warn-primary);
}

/* ============================================================================
   Conversation Sub-Rows & Child Worktree Subtree (VS Code 1px Indent Guides)
   ============================================================================ */
.owt-chats {
  display: flex;
  flex-direction: column;
  margin-left: 13px;
  padding-left: 8px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-chat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 25px;
  padding: 0 5px 0 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.owt-chat-row:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

.owt-chat-row[data-selected="true"] {
  background: var(--owt-active-bg);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

.owt-chat-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-chat-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
  color: var(--owt-muted);
}

.owt-chat-row:hover .owt-chat-time,
.owt-chat-row:focus-within .owt-chat-time {
  display: none;
}

/* Collapsed-chat-list expander row ("Show N more chats" / "Collapse chats") */
.owt-chats-more {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  margin-top: 1px;
  padding: 0 5px 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--owt-muted);
}

.owt-chats-more:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

/* Child-worktree lineage nested directly on the VS Code indent guide */
.owt-lineage-rail {
  display: flex;
  flex-direction: column;
  margin-left: 13px;
  padding-left: 8px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-wt-block:hover > .owt-lineage-rail {
  border-left-color: var(--owt-indent-guide-active);
}

/* Minimal inline tree toggle for derived worktrees (only needed when user wants to collapse/expand) */
.owt-lineage-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 5px;
  margin: 1px 0;
  width: fit-content;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.owt-lineage-toggle:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-secondary);
}

.owt-lineage-children {
  display: flex;
  flex-direction: column;
}

.owt-mini-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  flex: none;
}

.owt-mini-dot[data-tone="warn"] {
  background: var(--dsw-alias-state-warn-primary);
}

.owt-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.owt-toast {
  margin: 2px 6px 6px;
  padding: 5px 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
}

.owt-toast[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}

/* ============================================================================
   Minimalist Modals (VS Code Quick-Input / Clean Dialog Style)
   ============================================================================ */
.owt-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #0f172a 20%, transparent);
}

.owt-modal {
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  width: min(380px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-prominent, 0 10px 30px rgba(15, 23, 42, 0.12));
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owt-modal-head {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.owt-modal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.owt-modal-title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
}

.owt-modal-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.owt-code-chip {
  font-family: var(--owt-font-code);
  font-size: 11px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.owt-modal-desc {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  line-height: 1.5;
}

.owt-modal-desc[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-input-shell {
  position: relative;
  display: flex;
  align-items: center;
}

.owt-input {
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}

.owt-input[data-mono="true"] {
  padding-right: 60px;
}

.owt-input-enter-hint {
  position: absolute;
  right: 8px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.65;
  pointer-events: none;
}

.owt-input:focus,
.owt-select:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}

.owt-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.owt-field-label {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}

.owt-field-hint {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.owt-select {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.owt-fetch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-fetch-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.owt-fetch-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owt-modal-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

.owt-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.owt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.owt-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owt-btn[data-kind="primary"] {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: #ffffff;
}

.owt-btn[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-btn-xs {
  height: 23px;
  padding: 0 8px;
  font-size: 11.5px;
  border-radius: 4px;
}

/* ============================================================================
   Settings -> Archived Sessions (Minimalist VS Code Tree List, NO Folder Icon)
   ============================================================================ */
.owt-arch-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}

.owt-arch-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.owt-arch-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.owt-arch-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.owt-arch-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-search:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}

.owt-arch-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}

.owt-arch-empty {
  padding: 32px 16px;
  text-align: center;
  border-radius: 8px;
  border: 1px dashed var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
}

.owt-arch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owt-arch-card {
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}

.owt-arch-repo-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.owt-arch-repo-head:hover {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-repo-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-repo-meta {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-branches {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 4px 8px 8px;
  gap: 4px;
}

.owt-arch-branch-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.owt-arch-branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 5px;
}

.owt-arch-branch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
}

.owt-arch-branch-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-branch-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-removed-tag {
  flex: none;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.75;
}

.owt-arch-link-btn {
  border: 0;
  background: transparent;
  padding: 2px 6px;
  border-radius: 4px;
  font: inherit;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-arch-link-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-sessions {
  display: flex;
  flex-direction: column;
}

.owt-arch-sessions[data-indented="true"] {
  margin-left: 13px;
  padding-left: 10px;
  border-left: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}

.owt-arch-session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 2px 8px;
  border-radius: 5px;
}

.owt-arch-session-row:hover,
.owt-arch-session-row:focus-within {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-session-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.owt-arch-session-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-session-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-session-actions {
  display: none;
  align-items: center;
  gap: 6px;
  flex: none;
}

.owt-arch-session-row:hover .owt-arch-session-actions,
.owt-arch-session-row:focus-within .owt-arch-session-actions,
.owt-arch-session-row[data-busy="true"] .owt-arch-session-actions {
  display: inline-flex;
}

@media (hover: none) {
  .owt-arch-session-actions {
    display: inline-flex;
  }
}

/* =====================================================================
 * Git Source-Control & Diff Review Split Workbench (.owt-gp-*)
 * Self-contained tokens (not inside .owt-root!)
 * ===================================================================== */
.owt-gp-root {
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  --owt-gp-hover: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  --owt-gp-active: color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent);
  --owt-gp-green: var(--dsw-alias-state-success-primary, #16a34a);
  --owt-gp-red: var(--dsw-alias-state-error-primary, #dc2626);
  --owt-gp-amber: var(--dsw-alias-state-warn-primary, #d97706);
  --owt-gp-blue: var(--dsw-alias-brand-primary, #2563eb);

  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* ---------- Left Source-Control Sidebar ---------- */
.owt-gp-sidebar {
  width: 316px;
  min-width: 280px;
  max-width: 360px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base)) 65%, var(--dsw-alias-bg-base));
  user-select: none;
}

.owt-gp-branchbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.owt-gp-branch-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
}

.owt-gp-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 170px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--owt-gp-blue) 22%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--owt-gp-blue) 8%, var(--dsw-alias-bg-base));
  color: var(--dsw-alias-label-primary);
  font-family: var(--owt-font-code);
  font-size: 12px;
  font-weight: 600;
}

.owt-gp-branch-pill > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-gp-upstream {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-family: var(--owt-font-code);
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-gp-ahead {
  color: var(--owt-gp-green);
  font-weight: 600;
}

.owt-gp-behind {
  color: var(--owt-gp-red);
  font-weight: 600;
}

.owt-gp-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
  transition: background 120ms ease, color 120ms ease;
}

.owt-gp-iconbtn:hover:not(:disabled) {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-primary);
}

.owt-gp-iconbtn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* ---------- Commit Composer ---------- */
.owt-gp-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.owt-gp-textarea-box {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: 9px;
  background: var(--dsw-alias-bg-base);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.owt-gp-textarea-box:focus-within {
  border-color: var(--owt-gp-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--owt-gp-blue) 14%, transparent);
}

.owt-gp-textarea {
  width: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.55;
  padding: 9px 11px 4px;
  resize: vertical;
  min-height: 68px;
  max-height: 200px;
}

.owt-gp-textarea::placeholder {
  color: var(--dsw-alias-label-placeholder, var(--dsw-alias-label-tertiary));
}

.owt-gp-textarea:disabled {
  opacity: 0.55;
}

.owt-gp-textarea-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px 6px 10px;
}

.owt-gp-subject-len {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font-variant-numeric: tabular-nums;
}

.owt-gp-subject-len[data-warn="true"] {
  color: var(--owt-gp-amber);
}

.owt-gp-aibtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 23px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--owt-gp-blue) 22%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--owt-gp-blue) 7%, transparent);
  color: var(--owt-gp-blue);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.owt-gp-aibtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--owt-gp-blue) 14%, transparent);
  border-color: color-mix(in srgb, var(--owt-gp-blue) 42%, transparent);
}

.owt-gp-aibtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.owt-gp-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 31px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--owt-gp-blue);
  background: var(--owt-gp-blue);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 120ms ease, opacity 120ms ease;
}

.owt-gp-submit:hover:not(:disabled) {
  filter: brightness(1.06);
}

.owt-gp-submit:disabled {
  border-color: var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  cursor: default;
}

.owt-gp-alert {
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 11.5px;
  line-height: 1.45;
  word-break: break-word;
}

.owt-gp-alert[data-kind="error"] {
  background: color-mix(in srgb, var(--owt-gp-red) 10%, transparent);
  color: var(--owt-gp-red);
  border: 1px solid color-mix(in srgb, var(--owt-gp-red) 24%, transparent);
}

.owt-gp-alert[data-kind="ok"] {
  background: color-mix(in srgb, var(--owt-gp-green) 10%, transparent);
  color: var(--owt-gp-green);
  border: 1px solid color-mix(in srgb, var(--owt-gp-green) 24%, transparent);
}

/* ---------- File Tree ---------- */
.owt-gp-tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px 6px;
  flex: none;
}

.owt-gp-checkall {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}

.owt-gp-checkall input[type="checkbox"],
.owt-gp-file-check {
  width: 13.5px;
  height: 13.5px;
  margin: 0;
  accent-color: var(--owt-gp-blue);
  cursor: pointer;
  flex: none;
}

.owt-gp-tree-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: 0.01em;
}

.owt-gp-count-pill {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-secondary);
}

.owt-gp-tree-totals {
  display: inline-flex;
  gap: 6px;
  font-family: var(--owt-font-code);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 6px 14px;
}

.owt-gp-side-hint {
  padding: 16px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 2px;
}

.owt-gp-dir-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  height: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.owt-gp-dir-row:hover {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-primary);
}

.owt-gp-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  flex: none;
}

.owt-gp-dir-icon,
.owt-gp-file-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  flex: none;
}

.owt-gp-dir-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
}

.owt-gp-dir-count {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 7px 0 8px;
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
}

.owt-gp-file-row[data-nested="true"] {
  padding-left: 18px;
}

.owt-gp-file-row:hover {
  background: var(--owt-gp-hover);
}

.owt-gp-file-row[data-active="true"] {
  background: var(--owt-gp-active);
}

.owt-gp-file-row[data-active="true"] .owt-gp-file-name {
  color: var(--owt-gp-blue);
  font-weight: 600;
}

.owt-gp-file-row:focus-visible {
  outline: 1.5px solid var(--owt-gp-blue);
  outline-offset: -1.5px;
}

.owt-gp-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 12px;
}

/* Rename source half (old → new), muted so the destination stays primary. */
.owt-gp-oldname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-file-stats {
  display: inline-flex;
  gap: 4px;
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-add {
  color: var(--owt-gp-green);
  font-weight: 500;
}

.owt-gp-del {
  color: var(--owt-gp-red);
  font-weight: 500;
}

.owt-gp-badge {
  flex: none;
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-weight: 700;
  background: color-mix(in srgb, var(--owt-gp-amber) 14%, transparent);
  color: var(--owt-gp-amber);
}

.owt-gp-badge[data-kind="A"] {
  background: color-mix(in srgb, var(--owt-gp-green) 15%, transparent);
  color: var(--owt-gp-green);
}

.owt-gp-badge[data-kind="D"] {
  background: color-mix(in srgb, var(--owt-gp-red) 15%, transparent);
  color: var(--owt-gp-red);
}

.owt-gp-badge[data-kind="R"] {
  background: color-mix(in srgb, var(--owt-gp-blue) 15%, transparent);
  color: var(--owt-gp-blue);
}

/* ---------- Right Diff Viewer Area ---------- */
.owt-gp-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base);
}

.owt-gp-main-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 44px;
  padding: 0 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.owt-gp-main-crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
}

.owt-gp-crumb-text {
  font-family: var(--owt-font-code);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-gp-seg {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  flex: none;
}

.owt-gp-seg-btn {
  height: 23px;
  padding: 0 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.owt-gp-seg-btn[data-active="true"] {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.owt-gp-diff-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 32px;
  box-sizing: border-box;
}

.owt-gp-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owt-gp-card {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.owt-gp-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-base));
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  cursor: pointer;
  user-select: none;
}

.owt-gp-card-head:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-alias-bg-base));
}

.owt-gp-card-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 12.5px;
}

.owt-gp-card-dir {
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-card-name {
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.owt-gp-card-stats {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-blocks {
  display: inline-flex;
  gap: 2px;
  margin-left: 2px;
}

.owt-gp-block {
  width: 6px;
  height: 6px;
  border-radius: 1.5px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
}

.owt-gp-block[data-kind="add"] {
  background: var(--owt-gp-green);
}

.owt-gp-block[data-kind="del"] {
  background: var(--owt-gp-red);
}

.owt-gp-card-body {
  overflow-x: auto;
}

.owt-gp-card-empty {
  padding: 20px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

/* ---------- Numbered Unified Diff Table ---------- */
.owt-gp-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.owt-gp-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--owt-font-code);
  font-size: 12px;
  line-height: 20px;
  tab-size: 2;
}

.owt-gp-tr-hunk {
  background: color-mix(in srgb, var(--owt-gp-blue) 7%, var(--dsw-alias-bg-base));
}

.owt-gp-td-hunk-gutter {
  text-align: center !important;
  color: color-mix(in srgb, var(--owt-gp-blue) 65%, var(--dsw-alias-label-secondary)) !important;
  background: color-mix(in srgb, var(--owt-gp-blue) 11%, var(--dsw-alias-bg-base)) !important;
  padding: 3px 6px !important;
}

.owt-gp-td-hunk {
  padding: 3px 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  white-space: pre;
}

.owt-gp-hunk-range {
  color: var(--owt-gp-blue);
  font-weight: 500;
}

.owt-gp-hunk-ctx {
  margin-left: 8px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-td-num {
  width: 42px;
  min-width: 42px;
  padding: 0 8px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 60%, transparent);
  border-right: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 65%, transparent);
  user-select: none;
  -webkit-user-select: none;
  vertical-align: top;
}

.owt-gp-td-sign {
  width: 20px;
  min-width: 20px;
  padding: 0 2px 0 8px;
  text-align: center;
  user-select: none;
  -webkit-user-select: none;
  vertical-align: top;
}

.owt-gp-td-code {
  padding: 0 14px 0 4px;
  white-space: pre;
  user-select: text;
  -webkit-user-select: text;
  vertical-align: top;
}

.owt-gp-tr--add {
  background: color-mix(in srgb, var(--owt-gp-green) 10%, transparent);
}

.owt-gp-tr--add .owt-gp-td-num {
  background: color-mix(in srgb, var(--owt-gp-green) 16%, transparent);
  color: color-mix(in srgb, var(--owt-gp-green) 85%, var(--dsw-alias-label-primary));
}

.owt-gp-tr--add .owt-gp-td-sign {
  color: var(--owt-gp-green);
  font-weight: 600;
}

.owt-gp-tr--del {
  background: color-mix(in srgb, var(--owt-gp-red) 10%, transparent);
}

.owt-gp-tr--del .owt-gp-td-num {
  background: color-mix(in srgb, var(--owt-gp-red) 16%, transparent);
  color: color-mix(in srgb, var(--owt-gp-red) 85%, var(--dsw-alias-label-primary));
}

.owt-gp-tr--del .owt-gp-td-sign {
  color: var(--owt-gp-red);
  font-weight: 600;
}

.owt-gp-truncated {
  padding: 8px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  text-align: center;
}

/* ---------- Empty / Clean States ---------- */
.owt-gp-empty-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 260px;
  padding: 32px;
  text-align: center;
}

.owt-gp-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  color: var(--dsw-alias-label-secondary);
  margin-bottom: 4px;
}

.owt-gp-empty-icon[data-clean="true"] {
  background: color-mix(in srgb, var(--owt-gp-green) 12%, transparent);
  color: var(--owt-gp-green);
}

.owt-gp-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.owt-gp-empty-sub {
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  max-width: 340px;
  line-height: 1.5;
}

/* Responsive fallback for narrow panes */
@media (max-width: 800px) {
  .owt-gp-root {
    flex-direction: column;
    overflow-y: auto;
  }
  .owt-gp-sidebar {
    width: 100%;
    max-width: none;
    border-right: none;
    border-bottom: 1px solid var(--dsw-alias-border-l1);
    max-height: 46vh;
  }
  .owt-gp-main {
    min-height: 54vh;
  }
}
`;
		function injectStyles() {
			const existing = document.getElementById(STYLE_ID);
			if (existing !== null) {
				existing.textContent = CSS;
				return;
			}
			const element = document.createElement("style");
			element.id = STYLE_ID;
			element.textContent = CSS;
			document.head.append(element);
		}
		function removeStyles() {
			document.getElementById(STYLE_ID)?.remove();
		}
		// src/client/locales.ts
		/**
		* Locale dictionaries for `worktreeManager` namespace (zh + en).
		* @module dsh-worktree-plugin/client/locales
		*/
		const NS = "worktreeManager";
		const zh = {
			"header.title": "工作区",
			"header.search": "搜索分支或对话…",
			"header.clearSearch": "清空搜索",
			"header.addRepo": "添加项目文件夹",
			"header.refresh": "刷新工作树",
			"repo.collapse": "折叠项目",
			"repo.expand": "展开项目",
			"repo.newWorktree": "新建工作树",
			"repo.more": "项目操作",
			"wt.mainTag": "主检出",
			"wt.pin": "设为星标分支",
			"wt.unpin": "取消星标",
			"wt.newChat": "在此工作树新建对话",
			"wt.newChild": "派生子工作树",
			"wt.more": "工作树操作",
			"wt.chatsCount": "{count} 个对话",
			"wt.chatsMore": "展开其余 {count} 条对话",
			"wt.chatsLess": "收起对话",
			"wt.dirtyHint": "{count} 处未提交改动",
			"wt.childrenBadge": "{count} 个子工作树",
			"wt.capsuleDerived": "{count} 派生",
			"wt.capsuleActive": "{count} 活跃",
			"wt.capsulePending": "{count} 待确认",
			"wt.unnamedChat": "新对话",
			"wt.untitledChat": "未命名对话",
			"time.now": "刚刚",
			"time.min": "{n}m",
			"time.hour": "{n}h",
			"time.day": "{n}d",
			"folder.ungrouped": "未分组对话",
			"empty.repos": "点击右上角 + 添加 Git 仓库或文件夹",
			"empty.search": "无匹配分支或对话",
			"dialog.create.title": "新建工作树",
			"dialog.create.childHeading": "派生子工作树",
			"dialog.create.childSub": "自父分支",
			"dialog.create.childSubTail": "检出独立目录",
			"dialog.create.childTitle": "从 {parent} 派生子工作树",
			"dialog.create.branchLabel": "新分支名称",
			"dialog.create.branchPlaceholder": "如 feat/ui-polish（留空自动生成）",
			"dialog.create.enterHint": "Enter 创建",
			"dialog.create.fromLabel": "基于分支 (Base Ref)",
			"dialog.create.remoteGroup": "远程分支",
			"dialog.create.localGroup": "本地分支",
			"dialog.create.fetchBranches": "拉取最新远程分支 (git fetch)",
			"dialog.create.loadingBranches": "加载分支中…",
			"dialog.create.restartHint": "服务端插件尚未重载：请重启 DSH 桌面端以加载全部远程分支",
			"dialog.create.submit": "创建并开始对话",
			"dialog.create.cancel": "取消",
			"dialog.remove.title": "删除工作树 {branch}？",
			"dialog.remove.desc": "将删除池内检出目录，并将此分支下的对话自动归档（可在“设置 → 已归档会话”按分支查看与恢复）。",
			"dialog.remove.dirty": "检测到 {count} 处未提交更改，勾选强制将直接丢弃。",
			"dialog.remove.children": "包含 {count} 个子工作树，勾选强制将解除父子关联。",
			"dialog.remove.force": "强制删除",
			"dialog.remove.confirm": "确认删除",
			"dialog.wsRename.title": "重命名工作区",
			"dialog.wsRename.placeholder": "工作区名称",
			"dialog.wsRename.conflict": "已存在名为“{name}”的工作区",
			"dialog.wsRename.submit": "保存",
			"dialog.wsDelete.title": "删除工作区“{name}”？",
			"dialog.wsDelete.desc": "将从侧边栏移除此工作区注册项。本地文件夹（若存在）与已有对话历史将被保留，对话会归入未分组。",
			"dialog.wsDelete.missingHint": "本地文件夹已不存在：{path}",
			"dialog.wsDelete.confirm": "移除工作区",
			"wt.missingBadge": "目录已丢失",
			"menu.create": "新建工作树…",
			"menu.createChild": "派生子工作树…",
			"menu.newChat": "新建对话",
			"menu.pin": "星标置顶",
			"menu.unpin": "取消星标",
			"menu.copyPath": "复制路径",
			"menu.remove": "删除工作树…",
			"menu.renameWorkspace": "重命名工作区…",
			"menu.deleteWorkspace": "移除工作区…",
			"notice.created": "已创建工作树 {branch}",
			"notice.removed": "已删除 {path}",
			"notice.wsRenamed": "已重命名工作区为 {name}",
			"notice.wsDeleted": "已移除工作区 {name}",
			"notice.forceDeleted": "（分支含未合并提交，已强制删除；短期可经 git reflog 找回）",
			"notice.remoteDeleted": "（远程分支已删除）",
			"notice.remoteFailed": "（远程分支删除失败：{message}）",
			"notice.preserved": "（分支未能删除，通常是被其他工作树占用）",
			"notice.copied": "已复制路径",
			"notice.error": "操作失败：{message}",
			"dialog.remove.branch": "⚠ 分支 {branch} 也将一并删除；若含未合并提交将被强制丢弃",
			"dialog.remove.remote": "同时删除远程分支 {upstream}",
			"view.gitTab": "Git 改动",
			"dialog.commit.loading": "正在读取改动…",
			"dialog.commit.clean": "工作区干净，暂无未提交改动",
			"dialog.commit.cleanSub": "修改代码后，可在此审阅差异并使用 AI 生成提交说明",
			"dialog.commit.msgPlaceholder": "输入提交说明（首行标题，Cmd/Ctrl+Enter 快速提交）…",
			"dialog.commit.ai": "AI 生成",
			"dialog.commit.aiDoing": "生成中…",
			"dialog.commit.submit": "提交更改 ({count})",
			"dialog.commit.submitting": "提交中…",
			"dialog.commit.changes": "更改",
			"dialog.commit.selectAll": "全选 / 取消全选",
			"dialog.commit.refresh": "刷新状态",
			"dialog.commit.modeSingle": "单文件",
			"dialog.commit.modeAll": "全部差异",
			"dialog.commit.noTarget": "请先打开一个对话，再查看其工作树改动",
			"dialog.commit.truncated": "差异内容较大，仅展示前 {count} 行",
			"dialog.commit.noDiffText": "二进制文件或空文件变更，无可展示文本差异",
			"dialog.commit.fileHint": "点击文件查看代码改动",
			"notice.committed": "已提交 {commit} · {summary}",
			"notice.archivedCount": "（已归档 {count} 个对话）",
			"archive.nav": "已归档会话",
			"archive.title": "已归档会话",
			"archive.desc": "与 DSH 官方归档完全互通，按所属 Git 仓库与分支集中归类展示。取消归档后可直接在主界面继续查看。",
			"archive.searchPlaceholder": "搜索仓库、分支或对话标题…",
			"archive.empty": "暂无已归档会话",
			"archive.refresh": "刷新",
			"archive.refreshAria": "刷新分支归属元数据",
			"archive.removedTag": "已删除检出",
			"archive.repoSummary": "{branches} 分支 · {chats} 会话",
			"archive.chatsOnlySummary": "{chats} 会话",
			"archive.unarchive": "取消归档",
			"archive.unarchiveAndOpen": "恢复并打开",
			"archive.restoreBranch": "全部恢复",
			"archive.defaultWorkspace": "默认工作区",
			"archive.folderDirect": "文件夹会话"
		};
		const en = {
			"header.title": "Workspaces",
			"header.search": "Filter branches or chats…",
			"header.clearSearch": "Clear search",
			"header.addRepo": "Add project folder",
			"header.refresh": "Refresh worktrees",
			"repo.collapse": "Collapse project",
			"repo.expand": "Expand project",
			"repo.newWorktree": "New worktree",
			"repo.more": "Project actions",
			"wt.mainTag": "main",
			"wt.pin": "Star branch",
			"wt.unpin": "Unstar branch",
			"wt.newChat": "New conversation in worktree",
			"wt.newChild": "Create child worktree",
			"wt.more": "Worktree actions",
			"wt.chatsCount": "{count} chats",
			"wt.chatsMore": "Show {count} more chats",
			"wt.chatsLess": "Collapse chats",
			"wt.dirtyHint": "{count} uncommitted change(s)",
			"wt.childrenBadge": "{count} child worktrees",
			"wt.capsuleDerived": "{count} derived",
			"wt.capsuleActive": "{count} active",
			"wt.capsulePending": "{count} waiting",
			"wt.unnamedChat": "New session",
			"wt.untitledChat": "Untitled",
			"time.now": "now",
			"time.min": "{n}m",
			"time.hour": "{n}h",
			"time.day": "{n}d",
			"folder.ungrouped": "Ungrouped",
			"empty.repos": "Click + above to add a Git repository or folder",
			"empty.search": "No matching branches or conversations",
			"dialog.create.title": "New worktree",
			"dialog.create.childHeading": "Derive child worktree",
			"dialog.create.childSub": "Checkout isolated directory from",
			"dialog.create.childSubTail": "",
			"dialog.create.childTitle": "Create child worktree from {parent}",
			"dialog.create.branchLabel": "New branch name",
			"dialog.create.branchPlaceholder": "e.g. feat/ui-polish (leave blank to auto-name)",
			"dialog.create.enterHint": "Enter",
			"dialog.create.fromLabel": "Base branch (Base Ref)",
			"dialog.create.remoteGroup": "Remote branches",
			"dialog.create.localGroup": "Local branches",
			"dialog.create.fetchBranches": "Fetch remote branches (git fetch)",
			"dialog.create.loadingBranches": "Loading branches…",
			"dialog.create.restartHint": "Host plugin not reloaded yet: restart DSH to load remote branches",
			"dialog.create.submit": "Create & chat",
			"dialog.create.cancel": "Cancel",
			"dialog.remove.title": "Remove worktree {branch}?",
			"dialog.remove.desc": "Removes the checkout directory and archives its sessions (viewable by branch in Settings → Archived Sessions).",
			"dialog.remove.dirty": "{count} uncommitted change(s) will be discarded.",
			"dialog.remove.children": "{count} child worktree(s) will be detached.",
			"dialog.remove.force": "Force remove",
			"dialog.remove.confirm": "Remove",
			"dialog.wsRename.title": "Rename workspace",
			"dialog.wsRename.placeholder": "Workspace name",
			"dialog.wsRename.conflict": "A workspace named \"{name}\" already exists",
			"dialog.wsRename.submit": "Save",
			"dialog.wsDelete.title": "Remove workspace \"{name}\"?",
			"dialog.wsDelete.desc": "Removes this workspace from the sidebar. Local files (if any) and session logs are kept; sessions move to Ungrouped.",
			"dialog.wsDelete.missingHint": "Local directory no longer exists: {path}",
			"dialog.wsDelete.confirm": "Remove workspace",
			"wt.missingBadge": "Missing",
			"menu.create": "New worktree…",
			"menu.createChild": "New child worktree…",
			"menu.newChat": "New conversation",
			"menu.pin": "Star branch",
			"menu.unpin": "Unstar branch",
			"menu.copyPath": "Copy path",
			"menu.remove": "Remove worktree…",
			"menu.renameWorkspace": "Rename workspace…",
			"menu.deleteWorkspace": "Remove workspace…",
			"notice.created": "Created worktree {branch}",
			"notice.removed": "Removed {path}",
			"notice.wsRenamed": "Renamed workspace to {name}",
			"notice.wsDeleted": "Removed workspace {name}",
			"notice.forceDeleted": "(branch had unmerged commits, force-deleted; recoverable via git reflog for a limited time)",
			"notice.remoteDeleted": "(remote branch deleted)",
			"notice.remoteFailed": "(failed to delete remote branch: {message})",
			"notice.preserved": "(branch could not be deleted, usually checked out in another worktree)",
			"notice.copied": "Path copied",
			"notice.error": "Action failed: {message}",
			"dialog.remove.branch": "⚠ Branch {branch} will also be deleted; unmerged commits will be force-discarded",
			"dialog.remove.remote": "Also delete remote branch {upstream}",
			"view.gitTab": "Git changes",
			"dialog.commit.loading": "Loading changes…",
			"dialog.commit.clean": "Working tree clean",
			"dialog.commit.cleanSub": "Edit files to inspect diffs and generate commit messages with AI",
			"dialog.commit.msgPlaceholder": "Commit message (first line subject, Cmd/Ctrl+Enter to commit)…",
			"dialog.commit.ai": "AI Write",
			"dialog.commit.aiDoing": "Writing…",
			"dialog.commit.submit": "Commit ({count})",
			"dialog.commit.submitting": "Committing…",
			"dialog.commit.changes": "Changes",
			"dialog.commit.selectAll": "Toggle select all",
			"dialog.commit.refresh": "Refresh status",
			"dialog.commit.modeSingle": "Selected file",
			"dialog.commit.modeAll": "All diffs",
			"dialog.commit.noTarget": "Open a conversation first to review its checkout",
			"dialog.commit.truncated": "Large diff — showing first {count} lines",
			"dialog.commit.noDiffText": "Binary or empty file change — no text diff",
			"dialog.commit.fileHint": "Click a file to view its code changes",
			"notice.committed": "Committed {commit} · {summary}",
			"notice.archivedCount": "({count} session(s) archived)",
			"archive.nav": "Archived Sessions",
			"archive.title": "Archived Sessions",
			"archive.desc": "Synced with DSH official session archive, grouped by Git repository and branch. Unarchive any session to view it again.",
			"archive.searchPlaceholder": "Search repositories, branches, or chat titles…",
			"archive.empty": "No archived sessions",
			"archive.refresh": "Refresh",
			"archive.refreshAria": "Refresh branch metadata",
			"archive.removedTag": "Removed checkout",
			"archive.repoSummary": "{branches} branches · {chats} chats",
			"archive.chatsOnlySummary": "{chats} chats",
			"archive.unarchive": "Unarchive",
			"archive.unarchiveAndOpen": "Restore & Open",
			"archive.restoreBranch": "Restore all",
			"archive.defaultWorkspace": "Default Workspace",
			"archive.folderDirect": "Folder Sessions"
		};
		// src/client/index.ts
		const inject = [
			"slots",
			"connection",
			"locale",
			"uiWorkspace",
			"workspaces",
			"contextMenus"
		];
		const ICON_CREATE = "worktreeManager.create";
		const ICON_REMOVE = "worktreeManager.remove";
		const MENU_TARGET_WORKSPACE = "worktreeManager.workspace";
		function apply(ctx) {
			injectStyles();
			ctx.effect(() => () => {
				removeStyles();
			}, "worktree-manager: styles");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "worktree-manager: dictionaries");
			const api = createWorktreeApi(ctx);
			const t = ctx.locale.bind(NS);
			const slots = ctx.slots;
			const uiWorkspace = ctx.uiWorkspace;
			const workspaces = ctx.workspaces;
			slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "worktree-git",
				order: 40,
				label: () => t("view.gitTab"),
				locale: NS,
				inject: (sessionId) => ({
					api,
					t,
					sessionId
				})
			}, CommitPanel));
			let cachedOverview = null;
			const getFastOverview = async (signal) => {
				try {
					cachedOverview = await api.overview(false, signal);
					return cachedOverview;
				} catch {
					return cachedOverview;
				}
			};
			const getMenus = () => {
				const getter = ctx.get;
				if (typeof getter === "function") return getter.call(ctx, "contextMenus");
				return ctx.contextMenus;
			};
			const pickAndAddWorkspace = async () => {
				const picked = await uiWorkspace.pickDirectory();
				if (picked === null) return;
				const ws = await workspaces.create({ path: picked });
				const list = workspaces.list;
				const listed = () => {
					const items = list?.getSnapshot?.().items;
					return items === void 0 || items.some((item) => item.workspaceId === ws.workspaceId);
				};
				for (let waited = 0; !listed() && waited < 1e4; waited += 200) await new Promise((resolve) => window.setTimeout(resolve, 200));
				uiWorkspace.startSession(ws.workspaceId);
			};
			slots.inject("sidebar.workspaces", () => slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				locale: NS,
				inject: () => ({
					api,
					openSession: (sessionId) => {
						uiWorkspace.openSession(sessionId);
					},
					startSession: (workspaceId) => {
						uiWorkspace.startSession(workspaceId);
					},
					pickAndAddWorkspace,
					renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
					deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
					openWorkspaceMenu: (workspaceId, path, displayTitle, point) => {
						getMenus()?.open({
							kind: MENU_TARGET_WORKSPACE,
							value: {
								...workspaceId !== void 0 ? { workspaceId } : {},
								path,
								displayTitle
							}
						}, point);
					},
					openSessionMenu: (sessionId, displayTitle, point) => {
						getMenus()?.open({
							kind: "session",
							value: {
								sessionId,
								displayTitle
							}
						}, point);
					}
				})
			}, OrcaSidebar));
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "archived-sessions",
				order: 25,
				label: () => t("archive.nav"),
				locale: NS,
				inject: () => ({
					api,
					unarchiveSession: async (sessionId) => {
						if (typeof uiWorkspace.unarchiveSession === "function") await uiWorkspace.unarchiveSession(sessionId);
						else if (typeof workspaces.unarchiveSession === "function") await workspaces.unarchiveSession(sessionId);
					},
					openSession: (sessionId) => {
						uiWorkspace.openSession(sessionId);
					}
				})
			}, ArchivedSessionsSection));
			for (const [key, icon] of [[ICON_CREATE, IconCreate], [ICON_REMOVE, IconRemove]]) slots.inject("contextMenu.icon", () => slots.register({
				name: "contextMenu.icon",
				key
			}, icon));
			const registerMenu = (menus) => {
				const buildActions = async ({ workspaceId, path, displayTitle, includeWorkspaceCrud }, signal) => {
					if (path === void 0 || path.length === 0) return [];
					const data = await getFastOverview(signal);
					const norm = path.length > 1 ? path.replace(/\/+$/, "") : path;
					let matchedRepoRoot;
					let matchedRow;
					if (data !== null) for (const repo of data.repos) for (const item of repo.rows) {
						const itemNorm = item.path.length > 1 ? item.path.replace(/\/+$/, "") : item.path;
						if (norm !== itemNorm && !norm.startsWith(`${itemNorm}/`)) continue;
						if (matchedRow === void 0 || itemNorm.length > matchedRow.path.length) {
							matchedRow = item;
							matchedRepoRoot = repo.repositoryRoot;
						}
					}
					const isMissing = new Set((data?.missingPaths ?? []).map((p) => p.length > 1 ? p.replace(/\/+$/, "") : p)).has(norm);
					const actions = [];
					if (matchedRow !== void 0 && matchedRepoRoot !== void 0) {
						const row = matchedRow;
						const repoRoot = matchedRepoRoot;
						const childCount = (data?.repos.find((r) => r.repositoryRoot === repoRoot)?.rows ?? []).filter((item) => item.parentPath === row.path).length;
						actions.push({
							id: "newChat",
							label: t("menu.newChat"),
							icon: { key: ICON_CREATE },
							separatorBefore: !includeWorkspaceCrud,
							run: () => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:new-chat", { detail: { row } }));
							}
						}, {
							id: "create",
							label: t("menu.create"),
							icon: { key: ICON_CREATE },
							run: () => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:open-create", { detail: { repositoryRoot: repoRoot } }));
							}
						}, {
							id: "createChild",
							label: t("menu.createChild"),
							icon: { key: ICON_CREATE },
							run: () => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:open-create", { detail: {
									repositoryRoot: repoRoot,
									parentPath: row.path,
									parentBranch: row.branch
								} }));
							}
						}, {
							id: "pin",
							label: row.pinned ? t("menu.unpin") : t("menu.pin"),
							run: () => api.setPinned(row.path, !row.pinned).then(() => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:refresh"));
							})
						}, {
							id: "copyPath",
							label: t("menu.copyPath"),
							run: () => navigator.clipboard?.writeText(row.path).then(() => {
								menus.notify(t("notice.copied"), true);
							})
						});
						if (row.kind !== "main") actions.push({
							id: "remove",
							label: t("menu.remove"),
							icon: { key: ICON_REMOVE },
							danger: true,
							separatorBefore: true,
							run: async () => {
								let freshRow = row;
								try {
									const st = await api.status(row.path);
									freshRow = {
										...row,
										dirtyCount: st.dirtyCount
									};
								} catch {}
								window.dispatchEvent(new CustomEvent("dsh-worktree:open-remove", { detail: {
									row: freshRow,
									childCount
								} }));
							}
						});
					} else if (includeWorkspaceCrud) {
						if (!isMissing && workspaceId) actions.push({
							id: "newChatFolder",
							label: t("menu.newChat"),
							icon: { key: ICON_CREATE },
							run: () => {
								uiWorkspace.startSession(workspaceId);
							}
						});
						actions.push({
							id: "copyPath",
							label: t("menu.copyPath"),
							icon: { key: "workspace.copy" },
							run: () => navigator.clipboard?.writeText(path).then(() => {
								menus.notify(t("notice.copied"), true);
							})
						});
					}
					const hasWsId = typeof workspaceId === "string" && workspaceId.length > 0;
					const isSecondaryCheckout = matchedRow !== void 0 && matchedRow.kind !== "main";
					if (includeWorkspaceCrud && hasWsId && !isSecondaryCheckout) {
						const labelTitle = (displayTitle ?? "").trim() || path;
						actions.push({
							id: "wsRename",
							label: t("menu.renameWorkspace"),
							icon: { key: "workspace.rename" },
							separatorBefore: actions.length > 0,
							run: () => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:open-ws-rename", { detail: {
									workspaceId,
									path,
									title: labelTitle
								} }));
							}
						});
						actions.push({
							id: "wsDelete",
							label: t("menu.deleteWorkspace"),
							icon: { key: "workspace.delete" },
							danger: true,
							separatorBefore: true,
							run: () => {
								window.dispatchEvent(new CustomEvent("dsh-worktree:open-ws-delete", { detail: {
									workspaceId,
									path,
									title: labelTitle,
									missing: isMissing
								} }));
							}
						});
					}
					return actions;
				};
				ctx.effect(() => {
					const offSidebarMenu = menus.register({
						id: "worktree-manager.sidebar-workspace",
						target: MENU_TARGET_WORKSPACE,
						order: 100,
						resolve: (val, signal) => buildActions({
							...val,
							includeWorkspaceCrud: true
						}, signal)
					});
					const offSharedMenu = menus.register({
						id: "worktree-manager.workspace",
						target: "workspace",
						order: 400,
						resolve: (val, signal) => buildActions({
							...val,
							includeWorkspaceCrud: false
						}, signal)
					});
					return () => {
						offSidebarMenu();
						offSharedMenu();
					};
				}, "worktree-manager: workspace context menu");
			};
			const initialMenus = getMenus();
			if (initialMenus !== void 0) {
				registerMenu(initialMenus);
				return;
			}
			const host = ctx;
			if (typeof host.on !== "function") return;
			const off = host.on("internal/service", (name) => {
				if (name !== "contextMenus") return;
				const menus = getMenus();
				if (menus === void 0) return;
				off();
				registerMenu(menus);
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map