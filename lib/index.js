import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
// .tsc-out/index.js
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
function pathBasename(p) {
	const trimmed = p.replace(/[/\\]+$/, "");
	const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}
function pathDirname(p) {
	const trimmed = p.replace(/[/\\]+$/, "");
	const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return idx > 0 ? trimmed.slice(0, idx) : "/";
}
function randomHex6() {
	const bytes = /* @__PURE__ */ new Uint8Array(3);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function poolRoot() {
	const env = globalThis.process?.env;
	const override = env?.DSH_WORKTREE_POOL?.trim();
	if (override) return override.replace(/[/\\]+$/, "");
	const dshHome = env?.DSH_HOME?.trim();
	if (dshHome) return `${dshHome.replace(/[/\\]+$/, "")}/dsh-orca-worktrees`;
	const home = (env?.HOME ?? env?.USERPROFILE)?.trim();
	if (home) return `${home.replace(/[/\\]+$/, "")}/.dsh/dsh-orca-worktrees`;
	return `${decodeURIComponent(new URL(".", import.meta.url).pathname.replace(/\/+$/, ""))}/worktrees`;
}
const REGISTRY_FILE = "worktree-manager.json";
const REGISTRY_VERSION = 2;
const COMMAND_TIMEOUT_MS = 12e4;
const REMOVE_TIMEOUT_MS = 6e5;
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
const PREPARE_POOL_SCRIPT = `
import fs from 'node:fs/promises';
import path from 'node:path';
const [pool, dest, content] = process.argv.slice(1);
await fs.mkdir(path.dirname(pool), { recursive: true });
let created = false;
try { await fs.mkdir(pool); created = true; }
catch (e) { if (e.code !== 'EEXIST' || !(await fs.stat(pool)).isDirectory()) throw e; }
if (created) await fs.writeFile(path.join(pool, '.gitignore'), '*\\n', { flag: 'wx' }).catch(() => {});
if (content !== undefined) {
  // Atomic tmp+rename so a crash never leaves a torn registry JSON behind.
  const tmp = dest + '.tmp';
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, dest);
}
`;
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
var WorktreeError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
function fail(error) {
	if (error instanceof WorktreeError) return {
		ok: false,
		code: error.code,
		message: error.message
	};
	return {
		ok: false,
		code: "WORKTREE_REMOVE_FAILED",
		message: error instanceof Error ? error.message : String(error)
	};
}
function ok(value) {
	return {
		ok: true,
		value: JSON.parse(JSON.stringify(value))
	};
}
let WorktreeManagerService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _overview_decorators;
	let _branches_decorators;
	let _create_decorators;
	let _ensureWorkspace_decorators;
	let _setPinned_decorators;
	let _remove_decorators;
	let _status_decorators;
	let _diff_decorators;
	let _commit_decorators;
	let _push_decorators;
	let _suggestCommitMessage_decorators;
	let _archivedMeta_decorators;
	return class WorktreeManagerService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_overview_decorators = [Remote("overview")];
			_branches_decorators = [Remote("branches")];
			_create_decorators = [Remote("create")];
			_ensureWorkspace_decorators = [Remote("ensureWorkspace")];
			_setPinned_decorators = [Remote("setPinned")];
			_remove_decorators = [Remote("remove")];
			_status_decorators = [Remote("status")];
			_diff_decorators = [Remote("diff")];
			_commit_decorators = [Remote("commit")];
			_push_decorators = [Remote("push")];
			_suggestCommitMessage_decorators = [Remote("suggestCommitMessage")];
			_archivedMeta_decorators = [Remote("archivedMeta")];
			__esDecorate(this, null, _overview_decorators, {
				kind: "method",
				name: "overview",
				static: false,
				private: false,
				access: {
					has: (obj) => "overview" in obj,
					get: (obj) => obj.overview
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
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
			__esDecorate(this, null, _create_decorators, {
				kind: "method",
				name: "create",
				static: false,
				private: false,
				access: {
					has: (obj) => "create" in obj,
					get: (obj) => obj.create
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _ensureWorkspace_decorators, {
				kind: "method",
				name: "ensureWorkspace",
				static: false,
				private: false,
				access: {
					has: (obj) => "ensureWorkspace" in obj,
					get: (obj) => obj.ensureWorkspace
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setPinned_decorators, {
				kind: "method",
				name: "setPinned",
				static: false,
				private: false,
				access: {
					has: (obj) => "setPinned" in obj,
					get: (obj) => obj.setPinned
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _remove_decorators, {
				kind: "method",
				name: "remove",
				static: false,
				private: false,
				access: {
					has: (obj) => "remove" in obj,
					get: (obj) => obj.remove
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
			__esDecorate(this, null, _archivedMeta_decorators, {
				kind: "method",
				name: "archivedMeta",
				static: false,
				private: false,
				access: {
					has: (obj) => "archivedMeta" in obj,
					get: (obj) => obj.archivedMeta
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
			"workingDirectory",
			"workspaceRegistry",
			"tools"
		];
		orcaLineageCache = (__runInitializers(this, _instanceExtraInitializers), null);
		constructor(ctx) {
			super(ctx, "rWorktreeManager");
			this.registerTools();
		}
		/** Scan all registered DSH Workspaces and return grouped Git repositories + worktrees. */
		async overview(includeDirty, signal) {
			try {
				const wsRegistry = this.host().workspaceRegistry;
				const workspaces = wsRegistry !== void 0 ? wsRegistry.list() : [];
				const wsByPath = /* @__PURE__ */ new Map();
				for (const ws of workspaces) wsByPath.set(ws.path, ws);
				const repoOrder = [];
				const seenRoots = /* @__PURE__ */ new Set();
				const claimedPaths = /* @__PURE__ */ new Set();
				const missingPaths = /* @__PURE__ */ new Set();
				const hostPolicy = { mode: "danger-full-access" };
				await Promise.all(workspaces.map(async (ws) => {
					if (await this.fs().lstat(ws.path, void 0, signal).catch(() => void 0) === void 0) {
						if (ws.path.includes("/.orca-preparing/") || ws.path.includes("\\.orca-preparing\\")) claimedPaths.add(ws.path);
						else missingPaths.add(ws.path);
						return;
					}
					const root = await this.tryRepositoryRootOf(hostPolicy, ws.path, signal);
					if (root !== void 0) {
						claimedPaths.add(ws.path);
						return {
							wsPath: ws.path,
							root
						};
					}
				})).then((resolved) => {
					for (const item of resolved) {
						if (item === void 0 || seenRoots.has(item.root)) continue;
						seenRoots.add(item.root);
						repoOrder.push(item.root);
					}
				});
				return ok({
					repos: await Promise.all(repoOrder.map(async (root) => {
						const rows = await this.worktreeRows(root, hostPolicy, wsByPath, void 0, includeDirty === true, signal);
						for (const row of rows) if (wsByPath.has(row.path)) claimedPaths.add(row.path);
						const rootWs = wsByPath.get(root);
						return {
							repositoryRoot: root,
							name: rootWs?.title && rootWs.title !== "default-workspace" ? rootWs.title : pathBasename(root) || root,
							poolPath: await this.poolPath(root),
							rootWorkspaceId: rootWs?.id,
							rows
						};
					})),
					claimedPaths: [...claimedPaths],
					missingPaths: [...missingPaths]
				});
			} catch (error) {
				return fail(error);
			}
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
		* Create a new pool worktree in `repositoryRoot`, record optional `parentPath`
		* lineage, persist `branch.<name>.base`, and register it as a DSH Workspace
		* so conversations can immediately start inside it without mutating other chats.
		*/
		async create(repositoryRoot, name, from, parentPath, signal) {
			try {
				return ok(await this.createInternal({ mode: "danger-full-access" }, repositoryRoot, name, from, parentPath, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Ensure a checkout directory is registered in DSH `workspaceRegistry` and return its `workspaceId`. */
		async ensureWorkspace(path, title, signal) {
			try {
				const canonical = await this.canonicalWorktreePath({ mode: "danger-full-access" }, path, signal);
				const wsRegistry = this.host().workspaceRegistry;
				if (wsRegistry === void 0) throw new WorktreeError("WORKTREE_CREATE_FAILED", "workspaceRegistry service is unavailable");
				const existing = await wsRegistry.resolveByPath(canonical);
				if (existing !== void 0) return ok({
					workspaceId: existing.id,
					path: existing.path
				});
				const branch = await this.branchOf({ mode: "danger-full-access" }, canonical, signal);
				const created = await wsRegistry.create(canonical, title?.trim() || branch || pathBasename(canonical));
				return ok({
					workspaceId: created.id,
					path: created.path
				});
			} catch (error) {
				return fail(error);
			}
		}
		/** Toggle yellow star (pinned) state on one worktree row. */
		async setPinned(path, pinned, signal) {
			try {
				const policy = { mode: "danger-full-access" };
				const canonical = await this.canonicalWorktreePath(policy, path, signal);
				const root = await this.repositoryRootOf(policy, canonical, signal);
				const branch = await this.branchOf(policy, canonical, signal) ?? pathBasename(canonical);
				await this.registryMutateFile((file) => {
					const unpinned = new Set(file.unpinnedPaths ?? []);
					if (pinned) unpinned.delete(canonical);
					else unpinned.add(canonical);
					const existing = file.worktrees.find((item) => item.path === canonical);
					if (existing !== void 0) existing.pinned = pinned;
					else file.worktrees.push({
						path: canonical,
						branch,
						repositoryRoot: root,
						pinned
					});
					return {
						...file,
						unpinnedPaths: [...unpinned]
					};
				});
				return ok({
					path: canonical,
					pinned
				});
			} catch (error) {
				return fail(error);
			}
		}
		/** Remove a pool-managed worktree and unregister its DSH Workspace (retaining session history). */
		async remove(path, force, deleteRemote, signal) {
			try {
				return ok(await this.removeInternal({ mode: "danger-full-access" }, void 0, path, force === true, signal, deleteRemote === true));
			} catch (error) {
				return fail(error);
			}
		}
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
		/** Commit the working tree with `message`, staging exactly `files` when provided. */
		async commit(path, message, files, signal) {
			try {
				return ok(await this.commitInternal({ mode: "danger-full-access" }, path, message, files, signal));
			} catch (error) {
				return fail(error);
			}
		}
		/** Push the current branch to its upstream, establishing one via `-u` when missing. */
		async push(path, signal) {
			try {
				return ok(await this.pushInternal({ mode: "danger-full-access" }, path, signal));
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
		/** Historical branch & repository metadata for Settings -> Archived Sessions grouping. */
		async archivedMeta(signal) {
			try {
				const reg = await this.registry();
				const wsRegistry = this.host().workspaceRegistry;
				const workspaces = wsRegistry !== void 0 ? wsRegistry.list() : [];
				const wsByPath = /* @__PURE__ */ new Map();
				for (const ws of workspaces) wsByPath.set(ws.path, ws);
				const hostPolicy = { mode: "danger-full-access" };
				const seenRoots = /* @__PURE__ */ new Set();
				const repos = [];
				const resolved = await Promise.all(workspaces.map(async (ws) => this.tryRepositoryRootOf(hostPolicy, ws.path, signal)));
				for (const root of resolved) {
					if (root === void 0 || seenRoots.has(root)) continue;
					seenRoots.add(root);
					const rootWs = wsByPath.get(root);
					repos.push({
						repositoryRoot: root,
						name: rootWs?.title && rootWs.title !== "default-workspace" ? rootWs.title : pathBasename(root) || root,
						poolPath: await this.poolPath(root)
					});
				}
				for (const item of reg.archivedBranches ?? []) if (item.repositoryRoot && !seenRoots.has(item.repositoryRoot)) {
					seenRoots.add(item.repositoryRoot);
					repos.push({
						repositoryRoot: item.repositoryRoot,
						name: item.repositoryName || pathBasename(item.repositoryRoot) || item.repositoryRoot,
						poolPath: await this.poolPath(item.repositoryRoot)
					});
				}
				return ok({
					branches: reg.archivedBranches ?? [],
					repos
				});
			} catch (error) {
				return fail(error);
			}
		}
		async listForAgent(agent, signal) {
			const policy = this.policy(agent);
			const cwd = await this.workingDirectory().ensure(agent, signal);
			const root = await this.repositoryRootOf(policy, cwd, signal);
			const wsByPath = /* @__PURE__ */ new Map();
			for (const ws of this.host().workspaceRegistry?.list() ?? []) wsByPath.set(ws.path, ws);
			const rows = await this.worktreeRows(root, policy, wsByPath, cwd, true, signal);
			return {
				repositoryRoot: root,
				poolPath: await this.poolPath(root),
				rows
			};
		}
		async createInternal(policy, fromDirectory, name, from, parentPath, signal) {
			const root = await this.repositoryRootOf(policy, fromDirectory, signal);
			const run = this.gitRunner(policy, signal);
			const branch = (name?.trim() || `wt-${randomHex6()}`).replace(/^\/*|\/*$/g, "");
			if (branch.length === 0 || branch.startsWith("-") || branch.includes("..") || branch.includes("\\")) throw new WorktreeError("WORKTREE_CREATE_FAILED", `invalid branch name: ${branch}`);
			if ((await run(root, ["check-ref-format", `refs/heads/${branch}`], [
				0,
				1,
				128
			])).exitCode !== 0) throw new WorktreeError("WORKTREE_CREATE_FAILED", `invalid git branch name: ${branch}`);
			const baseSourceDir = parentPath !== void 0 ? await this.canonicalWorktreePath(policy, parentPath, signal) : root;
			const revision = from?.trim() || "HEAD";
			const verified = await run(baseSourceDir, [
				"rev-parse",
				"--verify",
				"--end-of-options",
				`${revision}^{commit}`
			], [
				0,
				1,
				128
			]);
			if (verified.exitCode !== 0) throw new WorktreeError("WORKTREE_CREATE_FAILED", `revision not found: ${revision}`);
			const baseCommit = verified.stdout.trim();
			if ((await run(root, [
				"show-ref",
				"--verify",
				"--quiet",
				`refs/heads/${branch}`
			], [0, 1])).exitCode === 0) throw new WorktreeError("WORKTREE_BRANCH_EXISTS", `branch already exists: ${branch}`);
			const poolTarget = await this.fs().resolve(await this.poolPath(root), { signal });
			const poolPath = this.fs().processPath(poolTarget);
			const destTarget = await this.fs().resolve(branch, {
				cwd: poolPath,
				signal
			});
			const destPath = this.fs().processPath(destTarget);
			if (!this.fs().contains(poolTarget, destTarget) || poolTarget.targetKey === destTarget.targetKey) throw new WorktreeError("WORKTREE_CREATE_FAILED", `worktree destination escapes pool: ${destPath}`);
			if (await this.fs().lstat(destPath, void 0, signal) !== void 0) throw new WorktreeError("WORKTREE_PATH_EXISTS", `worktree path already exists: ${destPath}`);
			await this.runArgv(policy, root, [
				"node",
				"--input-type=module",
				"-e",
				PREPARE_POOL_SCRIPT,
				poolPath,
				destPath
			], COMMAND_TIMEOUT_MS, signal);
			await run(root, [
				"--work-tree",
				root,
				"worktree",
				"add",
				"--no-track",
				"-b",
				branch,
				"--",
				destPath,
				baseCommit
			]);
			const canonicalDest = await this.canonicalWorktreePath(policy, destPath, signal);
			const canonicalParent = parentPath !== void 0 ? await this.canonicalWorktreePath(policy, parentPath, signal) : void 0;
			await this.registryMutateFile((file) => {
				const rest = file.worktrees.filter((item) => item.path !== canonicalDest);
				rest.push({
					path: canonicalDest,
					branch,
					baseCommit,
					repositoryRoot: root,
					parentPath: canonicalParent !== void 0 && canonicalParent !== canonicalDest ? canonicalParent : void 0,
					createdAt: (/* @__PURE__ */ new Date()).toISOString()
				});
				return {
					...file,
					worktrees: rest
				};
			});
			try {
				await run(root, [
					"config",
					"--local",
					"--replace-all",
					`branch.${branch}.base`,
					baseCommit
				]);
			} catch {
				await run(root, [
					"config",
					"--local",
					"--unset-all",
					`branch.${branch}.base`
				], [
					0,
					1,
					5
				]).catch(() => {});
			}
			let workspaceId;
			const wsRegistry = this.host().workspaceRegistry;
			if (wsRegistry !== void 0) workspaceId = (await wsRegistry.create(canonicalDest, branch)).id;
			return {
				path: canonicalDest,
				branch,
				baseCommit,
				repositoryRoot: root,
				parentPath: canonicalParent !== void 0 && canonicalParent !== canonicalDest ? canonicalParent : void 0,
				workspaceId
			};
		}
		async removeInternal(policy, callingAgent, path, force, signal, deleteRemote = false) {
			if (await this.fs().lstat(path, void 0, signal) === void 0) {
				const resolvedMissing = await this.fs().resolve(path, { signal });
				const missingCanonical = this.fs().processPath(resolvedMissing);
				const staleEntry = (await this.registry()).worktrees.find((item) => item.path === missingCanonical || item.path === path);
				if (staleEntry?.repositoryRoot) await this.gitRunner(policy, signal)(staleEntry.repositoryRoot, ["worktree", "prune"], [
					0,
					1,
					128
				]).catch(() => {});
				const wsRegistry = this.host().workspaceRegistry;
				const matchedWs = wsRegistry?.list().find((ws) => ws.path === missingCanonical || ws.path === path);
				const archivedIds = await this.archiveSessionsInCheckout(missingCanonical, path, matchedWs?.sessionIds, callingAgent?.session.id);
				const repoRoot = staleEntry?.repositoryRoot;
				const rootWs = repoRoot ? wsRegistry?.list().find((ws) => ws.path === repoRoot) : void 0;
				const repoName = rootWs?.title && rootWs.title !== "default-workspace" ? rootWs.title : repoRoot ? pathBasename(repoRoot) || repoRoot : matchedWs?.title || pathBasename(missingCanonical);
				const branchLabel = staleEntry?.branch || matchedWs?.title || pathBasename(missingCanonical);
				await this.registryMutateFile((file) => {
					const archivedBranches = [...file.archivedBranches ?? []].filter((item) => item.path !== missingCanonical && item.path !== path);
					if (archivedIds.length > 0 || staleEntry !== void 0 || matchedWs !== void 0) archivedBranches.unshift({
						path: missingCanonical,
						branch: branchLabel,
						...repoRoot !== void 0 ? { repositoryRoot: repoRoot } : {},
						repositoryName: repoName,
						removedAt: (/* @__PURE__ */ new Date()).toISOString(),
						...archivedIds.length > 0 ? { sessionIds: archivedIds } : {}
					});
					return {
						...file,
						unpinnedPaths: (file.unpinnedPaths ?? []).filter((p) => p !== missingCanonical && p !== path),
						worktrees: file.worktrees.filter((item) => item.path !== missingCanonical && item.path !== path),
						archivedBranches
					};
				});
				let wsDeleted = false;
				if (wsRegistry !== void 0 && matchedWs !== void 0) wsDeleted = await wsRegistry.delete(matchedWs.id).catch(() => false);
				if (staleEntry !== void 0 || wsDeleted || archivedIds.length > 0) return {
					path: missingCanonical,
					branchDeleted: false,
					branchHadUnmerged: false,
					...archivedIds.length > 0 ? { archivedCount: archivedIds.length } : {}
				};
				throw new WorktreeError("WORKTREE_NOT_FOUND", `no such directory: ${path}`);
			}
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
			const root = await this.repositoryRootOf(policy, canonical, signal);
			const pathTarget = await this.fs().resolve(canonical, { signal });
			const rootTarget = await this.fs().resolve(root, { signal });
			if (this.fs().processPath(pathTarget) === this.fs().processPath(rootTarget)) throw new WorktreeError("WORKTREE_MAIN_CHECKOUT", "refusing to remove the repository main checkout");
			const branch = await this.branchOf(policy, canonical, signal);
			const children = (await this.registry()).worktrees.filter((item) => item.parentPath === canonical);
			const listedAll = await this.gitRunner(policy, signal, COMMAND_TIMEOUT_MS)(root, [
				"worktree",
				"list",
				"--porcelain",
				"-z"
			], [0, 128]);
			for (const block of listedAll.stdout.split("\0\0")) {
				const raw = block.split("\0").find((field) => field.startsWith("worktree "))?.slice(9);
				if (raw === void 0 || raw.length === 0) continue;
				let target;
				try {
					target = await this.fs().resolve(raw, { signal });
				} catch {
					continue;
				}
				const nested = this.fs().processPath(target);
				if (nested !== canonical && nested.startsWith(`${canonical}/`)) children.push({
					path: nested,
					branch: ""
				});
			}
			if (children.length > 0 && !force) throw new WorktreeError("WORKTREE_HAS_CHILDREN", `${canonical} has ${children.length} child worktree(s); pass force to detach them`);
			const dirty = await this.dirtyCountOf(policy, canonical, signal);
			if (dirty > 0 && !force) throw new WorktreeError("WORKTREE_DIRTY", `${canonical} has ${dirty} uncommitted change(s); pass force to discard them`);
			await this.gitRunner(policy, signal, REMOVE_TIMEOUT_MS)(root, [
				"worktree",
				"remove",
				...force ? ["--force"] : [],
				"--",
				canonical
			]);
			const run = this.gitRunner(policy, signal);
			let branchDeleted = false;
			let branchHadUnmerged = false;
			let pushedTarget;
			if (branch !== void 0 && !branch.startsWith("detached")) {
				pushedTarget = await this.resolvePushedRemoteBranch(policy, root, branch, true, signal);
				if ((await run(root, [
					"branch",
					"-d",
					branch
				], [0, 1])).exitCode === 0) branchDeleted = true;
				else {
					branchDeleted = (await run(root, [
						"branch",
						"-D",
						branch
					], [0, 1])).exitCode === 0;
					branchHadUnmerged = branchDeleted;
				}
			}
			let remoteDeleted;
			let remoteError;
			if (deleteRemote && pushedTarget !== void 0) {
				remoteDeleted = (await run(root, [
					"push",
					"--delete",
					pushedTarget.remote,
					pushedTarget.remoteBranch
				], [
					0,
					1,
					128
				])).exitCode === 0;
				if (!remoteDeleted) remoteError = `failed to delete remote branch ${pushedTarget.displayRef}`;
			}
			await run(root, ["worktree", "prune"], [0, 1]);
			const wsRegistry = this.host().workspaceRegistry;
			const matched = wsRegistry?.list().find((ws) => ws.path === canonical);
			const rootWs = wsRegistry?.list().find((ws) => ws.path === root);
			const repoName = rootWs?.title && rootWs.title !== "default-workspace" ? rootWs.title : pathBasename(root) || root;
			const branchLabel = branch ?? matched?.title ?? pathBasename(canonical);
			const archivedIds = await this.archiveSessionsInCheckout(canonical, path, matched?.sessionIds, callingAgent?.session.id);
			await this.registryMutateFile((file) => {
				const unpinned = (file.unpinnedPaths ?? []).filter((p) => p !== canonical);
				const next = file.worktrees.filter((item) => item.path !== canonical);
				if (force) {
					for (const item of next) if (item.parentPath === canonical) item.parentPath = void 0;
				}
				const prevArchived = file.archivedBranches ?? [];
				const existingRecord = prevArchived.find((item) => item.path === canonical);
				const mergedSessionIds = Array.from(/* @__PURE__ */ new Set([...existingRecord?.sessionIds ?? [], ...archivedIds]));
				const archivedBranches = prevArchived.filter((item) => item.path !== canonical);
				archivedBranches.unshift({
					path: canonical,
					branch: branchLabel,
					repositoryRoot: root,
					repositoryName: repoName,
					removedAt: (/* @__PURE__ */ new Date()).toISOString(),
					...mergedSessionIds.length > 0 ? { sessionIds: mergedSessionIds } : {}
				});
				return {
					...file,
					unpinnedPaths: unpinned,
					worktrees: next,
					archivedBranches
				};
			});
			if (wsRegistry !== void 0 && matched !== void 0) await wsRegistry.delete(matched.id).catch(() => {});
			let resetCwdTo;
			if (callingAgent !== void 0) {
				const cwd = this.workingDirectory().get(callingAgent.session);
				if (cwd === canonical || cwd.startsWith(`${canonical}/`)) resetCwdTo = await this.workingDirectory().set(callingAgent, root, signal);
			}
			return {
				path: canonical,
				branchDeleted,
				branchHadUnmerged,
				...archivedIds.length > 0 ? { archivedCount: archivedIds.length } : {},
				remoteDeleted,
				remoteError,
				resetCwdTo
			};
		}
		async statusInternal(policy, path, signal) {
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
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
				if (onlyFile.startsWith("-")) throw new WorktreeError("WORKTREE_DIFF_FAILED", "invalid file path");
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
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
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
		async commitInternal(policy, path, message, files, signal) {
			const trimmed = message.replace(/^\s+|\s+$/g, "");
			if (trimmed.length === 0) throw new WorktreeError("WORKTREE_COMMIT_FAILED", "commit message is empty");
			if (files !== void 0 && (files.length === 0 || files.some((f) => typeof f !== "string" || f.length === 0 || f.startsWith("-")))) throw new WorktreeError("WORKTREE_COMMIT_FAILED", "invalid file list");
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			if (files !== void 0) await run(canonical, [
				"add",
				"--",
				...files
			]).catch((error) => {
				throw new WorktreeError("WORKTREE_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
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
				throw new WorktreeError("WORKTREE_COMMIT_FAILED", error instanceof Error ? error.message : String(error));
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
		async pushInternal(policy, path, signal) {
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
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
				await run(canonical, ["push"]).catch((error) => {
					throw new WorktreeError("WORKTREE_PUSH_FAILED", error instanceof Error ? error.message : String(error));
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
			if (remote === void 0) throw new WorktreeError("WORKTREE_PUSH_FAILED", "no remote configured for this checkout");
			await run(canonical, [
				"push",
				"-u",
				remote,
				branch
			]).catch((error) => {
				throw new WorktreeError("WORKTREE_PUSH_FAILED", error instanceof Error ? error.message : String(error));
			});
			return {
				path: canonical,
				branch,
				upstream: `${remote}/${branch}`
			};
		}
		async suggestCommitMessageInternal(policy, path, signal) {
			const canonical = await this.canonicalWorktreePath(policy, path, signal);
			const run = this.gitRunner(policy, signal);
			const branch = await this.branchOf(policy, canonical, signal) ?? "detached";
			const changes = await this.changesOf(run, canonical, signal);
			if (changes.length === 0) throw new WorktreeError("WORKTREE_COMMIT_FAILED", "no working-tree changes to describe");
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
			if (llm === void 0) throw new WorktreeError("WORKTREE_LLM_UNAVAILABLE", "llm service is not mounted in this DSH profile");
			const provider = llm.listProviders()[0]?.id;
			if (provider === void 0) throw new WorktreeError("WORKTREE_LLM_UNAVAILABLE", "no LLM provider adapter is registered");
			const model = (await llm.listModels(provider).catch(() => []))[0]?.id;
			if (model === void 0) throw new WorktreeError("WORKTREE_LLM_UNAVAILABLE", `provider ${provider} advertises no models`);
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
				throw new WorktreeError("WORKTREE_LLM_UNAVAILABLE", `commit message generation failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			const cleaned = text.trim().replace(/^```[a-z]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
			if (cleaned.length === 0) throw new WorktreeError("WORKTREE_LLM_UNAVAILABLE", "model returned an empty commit message");
			return {
				path: canonical,
				message: cleaned,
				provider,
				model
			};
		}
		registerTools() {
			const disposers = [];
			const self = this;
			const definitions = [
				{
					name: "worktree_list",
					description: "List git worktrees of the repository containing this session's working directory, including branch, dirty count, pin status, parent lineage, and linked workspaceId.",
					parameters: {
						type: "object",
						properties: {},
						required: []
					},
					async execute(_args, exec) {
						return JSON.parse(JSON.stringify(await self.listForAgent(exec.agent, exec.signal)));
					}
				},
				{
					name: "worktree_create",
					description: "Create a new managed git worktree under the shared plugin pool directory and register it as a DSH Workspace without leaving the current checkout unless enter is true.",
					parameters: {
						type: "object",
						properties: {
							name: {
								type: "string",
								description: "Branch name to create (optional; generated when omitted)."
							},
							from: {
								type: "string",
								description: "Base revision/branch (defaults to HEAD)."
							},
							parentPath: {
								type: "string",
								description: "Optional parent worktree path for sidebar lineage nesting."
							},
							enter: {
								type: "boolean",
								description: "Switch this session working directory into the new worktree."
							}
						},
						required: []
					},
					async execute(args, exec) {
						const cwd = await self.workingDirectory().ensure(exec.agent, exec.signal);
						const created = await self.createInternal(self.policy(exec.agent), cwd, typeof args.name === "string" ? args.name : void 0, typeof args.from === "string" ? args.from : void 0, typeof args.parentPath === "string" ? args.parentPath : void 0, exec.signal);
						if (args.enter === true) await self.workingDirectory().set(exec.agent, created.path, exec.signal);
						return JSON.parse(JSON.stringify(created));
					}
				},
				{
					name: "worktree_enter",
					description: "Switch this session's working directory into an existing git worktree checkout.",
					parameters: {
						type: "object",
						properties: { path: {
							type: "string",
							description: "Checkout path to enter."
						} },
						required: ["path"]
					},
					async execute(args, exec) {
						if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
						const canonical = await self.canonicalWorktreePath(self.policy(exec.agent), args.path, exec.signal);
						return { path: await self.workingDirectory().set(exec.agent, canonical, exec.signal) };
					}
				},
				{
					name: "worktree_status",
					description: "Report branch, uncommitted-change count, and ahead/behind counts for a git checkout.",
					parameters: {
						type: "object",
						properties: { path: {
							type: "string",
							description: "Checkout path."
						} },
						required: ["path"]
					},
					async execute(args, exec) {
						if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
						return JSON.parse(JSON.stringify(await self.statusInternal(self.policy(exec.agent), args.path, exec.signal)));
					}
				},
				{
					name: "worktree_diff",
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
				},
				{
					name: "worktree_commit",
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
						return JSON.parse(JSON.stringify(await self.commitInternal(self.policy(exec.agent), args.path, args.message, files, exec.signal)));
					}
				},
				{
					name: "worktree_pin",
					description: "Pin or unpin a git worktree row (yellow star marker) in the sidebar.",
					parameters: {
						type: "object",
						properties: {
							path: {
								type: "string",
								description: "Worktree checkout path."
							},
							pinned: {
								type: "boolean",
								description: "True to pin (star), false to unpin."
							}
						},
						required: ["path", "pinned"]
					},
					async execute(args, exec) {
						if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
						const env = await self.setPinned(args.path, args.pinned === true, exec.signal);
						if (!env.ok) throw new Error(env.message);
						return env.value;
					}
				},
				{
					name: "worktree_remove",
					description: "Remove a pool-managed git worktree (unified plugin pool or legacy checkout location). Uncommitted changes or child worktrees require force: true.",
					parameters: {
						type: "object",
						properties: {
							path: {
								type: "string",
								description: "Worktree checkout path."
							},
							force: {
								type: "boolean",
								description: "Discard uncommitted changes and detach child worktrees."
							},
							deleteRemote: {
								type: "boolean",
								description: "Also delete the branch upstream (e.g. origin/<branch>) when set."
							}
						},
						required: ["path"]
					},
					async execute(args, exec) {
						if (typeof args.path !== "string" || args.path.length === 0) throw new Error("path is required");
						return JSON.parse(JSON.stringify(await self.removeInternal(self.policy(exec.agent), exec.agent, args.path, args.force === true, exec.signal, args.deleteRemote === true)));
					}
				}
			];
			const tools = this.host().tools;
			if (tools !== void 0) for (const definition of definitions) disposers.push(tools.register({
				...definition,
				output: {
					schema: { type: "object" },
					render: (_args, value) => [{
						type: "text",
						text: JSON.stringify(value, null, 2)
					}]
				},
				async execute(args, exec) {
					if (!exec?.agent || typeof exec.agent !== "object") throw new Error("no calling agent context for worktree tool");
					return definition.execute(args ?? {}, exec);
				}
			}));
			this.ctx.effect(() => async () => {
				for (const dispose of disposers) dispose();
			}, "worktree-manager: tools");
		}
		registryPath() {
			return `${poolRoot()}/${REGISTRY_FILE}`;
		}
		async registry() {
			try {
				const target = await this.fs().resolve(this.registryPath(), { signal: void 0 });
				const text = await this.fs().readText(target, void 0);
				const parsed = JSON.parse(text);
				if (parsed && Array.isArray(parsed.worktrees)) return {
					version: REGISTRY_VERSION,
					unpinnedPaths: Array.isArray(parsed.unpinnedPaths) ? parsed.unpinnedPaths : [],
					worktrees: parsed.worktrees,
					archivedBranches: Array.isArray(parsed.archivedBranches) ? parsed.archivedBranches : []
				};
			} catch {}
			return {
				version: REGISTRY_VERSION,
				unpinnedPaths: [],
				worktrees: [],
				archivedBranches: []
			};
		}
		async registryMutateFile(mutate) {
			const current = await this.registry();
			const next = mutate({
				version: REGISTRY_VERSION,
				unpinnedPaths: [...current.unpinnedPaths ?? []],
				worktrees: current.worktrees.map((item) => ({ ...item })),
				archivedBranches: (current.archivedBranches ?? []).map((item) => ({
					...item,
					...item.sessionIds !== void 0 ? { sessionIds: [...item.sessionIds] } : {}
				}))
			});
			const filePath = this.registryPath();
			await this.runArgv({ mode: "danger-full-access" }, pathDirname(pathDirname(filePath)), [
				"node",
				"--input-type=module",
				"-e",
				PREPARE_POOL_SCRIPT,
				pathDirname(filePath),
				filePath,
				`${JSON.stringify(next, null, 2)}\n`
			], COMMAND_TIMEOUT_MS, void 0);
		}
		/**
		* Best-effort read of Orca Desktop's `worktreeLineageById` domain so child worktrees
		* created inside Orca also preserve their parent-child hierarchy inside DSH's sidebar.
		* Cached for 15s and completely silent when Orca or `node:sqlite` is absent.
		*/
		async readOrcaExternalLineage(signal) {
			const now = Date.now();
			if (this.orcaLineageCache !== null && now < this.orcaLineageCache.expiresAt) return this.orcaLineageCache.map;
			const empty = /* @__PURE__ */ new Map();
			const env = globalThis.process?.env;
			if (env?.DSH_WORKTREE_POOL) return empty;
			const home = (env?.HOME ?? env?.USERPROFILE)?.trim();
			if (!home) return empty;
			const script = `
import fs from 'node:fs';
import path from 'node:path';
const home = process.argv[1];
const base = process.platform === 'darwin'
  ? path.join(home, 'Library', 'Application Support', 'Orca')
  : path.join(home, '.config', 'Orca');
const idxPath = path.join(base, 'orca-profile-index.json');
if (!fs.existsSync(idxPath)) { process.stdout.write('{}'); process.exit(0); }
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
const profId = idx.activeProfileId || 'local-default';
const dbPath = path.join(base, 'profiles', profId, 'profile-state.db');
if (!fs.existsSync(dbPath)) { process.stdout.write('{}'); process.exit(0); }
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(dbPath, { readOnly: true });
const row = db.prepare("SELECT payload FROM profile_state_documents WHERE domain = 'worktreeLineageById'").get();
db.close();
process.stdout.write(row && typeof row.payload === 'string' ? row.payload : '{}');
`;
			try {
				const out = await this.runArgv({ mode: "danger-full-access" }, home, [
					"node",
					"--no-warnings",
					"--input-type=module",
					"-e",
					script,
					home
				], 4e3, signal, [0]);
				const parsed = JSON.parse(out.stdout || "{}");
				const rawPairs = [];
				const extractPath = (id) => {
					if (typeof id !== "string") return void 0;
					const sep = id.indexOf("::");
					return sep >= 0 ? id.slice(sep + 2) : void 0;
				};
				for (const rec of Object.values(parsed)) {
					const childRaw = extractPath(rec?.worktreeId);
					const parentRaw = extractPath(rec?.parentWorktreeId);
					if (childRaw && parentRaw && childRaw !== parentRaw) rawPairs.push([childRaw, parentRaw]);
				}
				const map = /* @__PURE__ */ new Map();
				await Promise.all(rawPairs.map(async ([childRaw, parentRaw]) => {
					try {
						const [cTarget, pTarget] = await Promise.all([this.fs().resolve(childRaw, { signal }), this.fs().resolve(parentRaw, { signal })]);
						const cPath = this.fs().processPath(cTarget);
						const pPath = this.fs().processPath(pTarget);
						if (cPath !== pPath) map.set(cPath, pPath);
					} catch {}
				}));
				this.orcaLineageCache = {
					expiresAt: Date.now() + 15e3,
					map
				};
				return map;
			} catch {
				this.orcaLineageCache = {
					expiresAt: Date.now() + 15e3,
					map: empty
				};
				return empty;
			}
		}
		/**
		* Archive every session whose cwd sits inside `canonicalPath` (or `rawPath`)
		* or is explicitly accounted on the removed Workspace, delegating to DSH's
		* authoritative `workspaceRegistry.archiveSession`. Never archives `excludeSessionId`
		* when an active Agent removes a worktree from inside its own turn.
		*/
		async archiveSessionsInCheckout(canonicalPath, rawPath, explicitSessionIds, excludeSessionId) {
			const host = this.host();
			const wsRegistry = host.workspaceRegistry;
			if (wsRegistry === void 0 || typeof wsRegistry.archiveSession !== "function") return [];
			const candidates = new Set(explicitSessionIds ?? []);
			const matchesPath = (cwd) => {
				if (!cwd) return false;
				const norm = cwd.length > 1 ? cwd.replace(/\/+$/, "") : cwd;
				return norm === canonicalPath || norm.startsWith(`${canonicalPath}/`) || norm === rawPath || norm.startsWith(`${rawPath}/`);
			};
			try {
				for (const live of host.sessions?.list() ?? []) if (matchesPath(live.header?.cwd)) candidates.add(live.header.id);
			} catch {}
			try {
				const stored = await host.sessionPersistence?.list();
				for (const snap of stored ?? []) if (matchesPath(snap.header?.cwd)) candidates.add(snap.header.id);
			} catch {}
			if (excludeSessionId !== void 0) candidates.delete(excludeSessionId);
			const archived = [];
			for (const sid of candidates) try {
				await wsRegistry.archiveSession(sid, { stopActivity: true });
				archived.push(sid);
			} catch {}
			return archived;
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
				workingDirectory: this.getService("workingDirectory"),
				workspaceRegistry: this.getService("workspaceRegistry"),
				sessionPersistence: this.getService("sessionPersistence"),
				sessions: this.getService("sessions"),
				tools: this.getService("tools"),
				sandbox: this.getService("sandbox"),
				sandboxPolicy: this.getService("sandboxPolicy"),
				llm: this.getService("llm")
			};
		}
		workingDirectory() {
			return this.host().workingDirectory;
		}
		policy(agent) {
			const sandboxPolicy = this.host().sandboxPolicy;
			return sandboxPolicy !== void 0 ? sandboxPolicy.resolve({ session: agent.session }) : { mode: "danger-full-access" };
		}
		async runArgv(policy, cwd, argv, timeoutMs, signal, allowedExitCodes = [0], allowLossy = false) {
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
					GIT_NO_LAZY_FETCH: "1"
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
					if (timeoutSignal.aborted) throw new WorktreeError("WORKTREE_TIMEOUT", "command timed out");
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
		gitRunner(policy, signal, timeoutMs = COMMAND_TIMEOUT_MS) {
			return (cwd, args, allowedExitCodes = [0], allowLossy = false) => this.runArgv(policy, cwd, [
				"git",
				"-c",
				"core.hooksPath=/dev/null",
				"-c",
				"core.fsmonitor=false",
				"-c",
				"gc.auto=0",
				...args
			], timeoutMs, signal, allowedExitCodes, allowLossy);
		}
		async poolPath(root) {
			const safe = pathBasename(root).replace(/[^A-Za-z0-9._-]+/g, "-") || "repo";
			const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(root));
			const hash = Array.from(new Uint8Array(digest).slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
			return `${poolRoot()}/${safe}-${hash}`;
		}
		async tryRepositoryRootOf(policy, from, signal) {
			try {
				if (await this.fs().lstat(from, void 0, signal) === void 0) return void 0;
				return await this.repositoryRootOf(policy, from, signal);
			} catch {
				return;
			}
		}
		async repositoryRootOf(policy, from, signal) {
			const run = this.gitRunner(policy, signal);
			const out = await run(from, [
				"rev-parse",
				"--path-format=absolute",
				"--git-common-dir"
			], [0, 128]);
			if (out.exitCode !== 0) throw new WorktreeError("WORKTREE_NOT_A_REPO", `${from} is not a git repository`);
			const commonDir = out.stdout.trim();
			const rawRoot = commonDir.endsWith("/.git") ? commonDir.slice(0, -5) : (await run(from, [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel"
			])).stdout.trim();
			const resolved = await this.fs().resolve(rawRoot, { signal });
			return this.fs().processPath(resolved);
		}
		async canonicalWorktreePath(policy, path, signal) {
			if (await this.fs().lstat(path, void 0, signal) === void 0) throw new WorktreeError("WORKTREE_NOT_FOUND", `no such directory: ${path}`);
			const top = await this.gitRunner(policy, signal)(path, [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel"
			], [0, 128]);
			if (top.exitCode !== 0) throw new WorktreeError("WORKTREE_NOT_A_WORKTREE", `${path} is not inside a git work tree`);
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
		async worktreeRows(root, policy, wsByPath, currentCwd, includeDirty, signal) {
			const run = this.gitRunner(policy, signal);
			const listed = await run(root, [
				"worktree",
				"list",
				"--porcelain",
				"-z"
			]);
			const registry = await this.registry();
			const unpinned = new Set(registry.unpinnedPaths ?? []);
			const rootTarget = await this.fs().resolve(root, { signal });
			const poolTarget = await this.fs().resolve(await this.poolPath(root), { signal });
			const parsedBlocks = [];
			for (const block of listed.stdout.split("\0\0")) {
				const fields = block.split("\0");
				const rawPath = fields.find((field) => field.startsWith("worktree "))?.slice(9);
				if (rawPath === void 0 || rawPath.length === 0) continue;
				if (fields.some((field) => field === "bare" || field.startsWith("prunable"))) continue;
				if (rawPath.includes("/.orca-preparing/") || rawPath.includes("\\.orca-preparing\\")) continue;
				const headField = fields.find((field) => field.startsWith("HEAD "));
				const branchField = fields.find((field) => field.startsWith("branch "));
				let pathTarget;
				try {
					pathTarget = await this.fs().resolve(rawPath, { signal });
				} catch {
					continue;
				}
				const canonicalPath = this.fs().processPath(pathTarget);
				if (canonicalPath.includes("/.orca-preparing/") || canonicalPath.includes("\\.orca-preparing\\")) continue;
				const isMain = canonicalPath === this.fs().processPath(rootTarget);
				const isManaged = !isMain && this.fs().contains(poolTarget, pathTarget);
				const branch = branchField !== void 0 ? branchField.slice(7).replace(/^refs\/heads\//, "") : `detached at ${(headField?.slice(5) ?? "").slice(0, 7) || "HEAD"}`;
				parsedBlocks.push({
					canonicalPath,
					branch,
					isMain,
					isManaged
				});
			}
			const orcaLineage = await this.readOrcaExternalLineage(signal);
			const derivedParentOf = /* @__PURE__ */ new Map();
			for (const block of parsedBlocks) {
				const orcaParent = orcaLineage.get(block.canonicalPath);
				if (orcaParent !== void 0 && orcaParent !== block.canonicalPath) {
					derivedParentOf.set(block.canonicalPath, orcaParent);
					continue;
				}
				if (block.isManaged) continue;
				let best;
				for (const other of parsedBlocks) {
					if (other.canonicalPath === block.canonicalPath) continue;
					if (!block.canonicalPath.startsWith(`${other.canonicalPath}/`)) continue;
					if (best === void 0 || other.canonicalPath.length > best.length) best = other.canonicalPath;
				}
				if (best !== void 0) derivedParentOf.set(block.canonicalPath, best);
			}
			const rows = (await Promise.all(parsedBlocks.map(async ({ canonicalPath, branch, isMain, isManaged }) => {
				if (await this.fs().lstat(canonicalPath, void 0, signal) === void 0) return void 0;
				const entry = registry.worktrees.find((item) => item.path === canonicalPath);
				const pinned = entry?.pinned !== void 0 ? entry.pinned : isMain && !unpinned.has(canonicalPath);
				const dirtyCount = includeDirty ? await this.dirtyCountOf(policy, canonicalPath, signal) : 0;
				let upstream;
				if (!branch.startsWith("detached")) {
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
					if (up.exitCode === 0) upstream = up.stdout.trim() || void 0;
				}
				const linkedWs = wsByPath.get(canonicalPath);
				return {
					path: canonicalPath,
					branch,
					kind: isMain ? "main" : isManaged ? "managed" : "external",
					dirtyCount,
					pinned,
					upstream,
					displayName: entry?.displayName,
					parentPath: entry?.parentPath ?? derivedParentOf.get(canonicalPath),
					createdAt: entry?.createdAt,
					workspaceId: linkedWs?.id,
					...currentCwd !== void 0 ? { current: currentCwd === canonicalPath || currentCwd.startsWith(`${canonicalPath}/`) } : {}
				};
			}))).filter((row) => row !== void 0);
			const rank = {
				main: 0,
				managed: 1,
				external: 2
			};
			rows.sort((a, b) => {
				if (a.kind === "main" && b.kind !== "main") return -1;
				if (b.kind === "main" && a.kind !== "main") return 1;
				if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
				return rank[a.kind] - rank[b.kind] || a.branch.localeCompare(b.branch);
			});
			return rows;
		}
	};
})();
export { WorktreeManagerService as default };
