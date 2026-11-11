/**
 * dsh-worktree-plugin — host half.
 *
 * Exposes `rWorktreeManager` over Typert SRC mode:
 * - Browser verbs (`overview`, `create`, `remove`, `setPinned`, `ensureWorkspace`, `status`)
 *   take plain JSON arguments (no `agent` lookup parameter), so sidebar calls
 *   succeed even before any Session is opened.
 * - Agent tools (`worktree_list`, `worktree_create`, `worktree_enter`,
 *   `worktree_status`, `worktree_remove`, `worktree_pin`) call the same
 *   service methods under the calling Session's sandbox policy.
 * - Every created/opened worktree is registered in `ctx.workspaceRegistry`,
 *   allowing native DSH Conversations (`startSession` / `openSession`) to bind
 *   directly under each worktree directory.
 * @module dsh-worktree-plugin
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-fs'

function pathBasename(p: string): string {
  const trimmed = p.replace(/[/\\]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

function pathDirname(p: string): string {
  const trimmed = p.replace(/[/\\]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return idx > 0 ? trimmed.slice(0, idx) : '/'
}

function randomHex6(): string {
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
import type {
  ArchivedBranchRecord,
  WorktreeArchivedMetaValue,
  WorktreeBranchesValue,
  WorktreeCreateValue,
  WorktreeEnsureWorkspaceValue,
  WorktreeEnterValue,
  WorktreeEnvelope,
  WorktreeErrorCode,
  WorktreeListValue,
  WorktreeOverviewValue,
  WorktreePinValue,
  WorktreeRemoveValue,
  WorktreeRepoGroup,
  WorktreeRow,
  WorktreeStatusValue,
} from './protocol.ts'

// Unified pool: every repo's worktrees live under ~/.dsh/dsh-orca-worktrees/<repo-key>/.
// DSH_WORKTREE_POOL overrides the base (tests, or custom pool locations).
function poolRoot(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const override = env?.DSH_WORKTREE_POOL?.trim()
  if (override) return override.replace(/[/\\]+$/, '')
  const dshHome = env?.DSH_HOME?.trim()
  if (dshHome) return `${dshHome.replace(/[/\\]+$/, '')}/dsh-orca-worktrees`
  const home = (env?.HOME ?? env?.USERPROFILE)?.trim()
  if (home) return `${home.replace(/[/\\]+$/, '')}/.dsh/dsh-orca-worktrees`
  return `${decodeURIComponent(new URL('.', import.meta.url).pathname.replace(/\/+$/, ''))}/worktrees`
}
const REGISTRY_FILE = 'worktree-manager.json'
const REGISTRY_VERSION = 2
const COMMAND_TIMEOUT_MS = 120_000
const REMOVE_TIMEOUT_MS = 600_000
const COMMAND_GRACE_MS = 5_000
const MAX_OUTPUT_BYTES = 1 << 20

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
`

interface AgentLike {
  readonly session: { readonly id: string }
}

interface SpawnSpec {
  argv: readonly string[]
  cwd: string
  env: Record<string, string | undefined>
  signal: AbortSignal
  graceMs: number
  stdio: { stdin: 'ignore'; stdout: { maxBytes: number }; stderr: { maxBytes: number } }
}

interface SpawnedProcess {
  done: Promise<{ exitCode: number | null; signal: string | null }>
  collected: {
    stdout: { readFrom(offset: number): { text: string; lossy: boolean } }
    stderr: { readFrom(offset: number): { text: string; lossy: boolean } }
  }
  terminate(): void
  waitForExit(): Promise<void>
}

interface SubprocessService {
  resolveExecutable(command: string, env?: Record<string, string>, signal?: AbortSignal): Promise<string>
  spawn(spec: SpawnSpec): SpawnedProcess
}

interface SandboxService {
  confine(argv: readonly string[], policy: unknown, signal?: AbortSignal): Promise<{ argv: readonly string[] }>
}

interface SandboxPolicyService {
  resolve(request?: { session?: unknown }): { mode: string }
}

interface WorkingDirectoryService {
  get(session: unknown): string
  set(agent: unknown, path: string, signal?: AbortSignal): Promise<string>
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>
}

interface WorkspaceEntityLike {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly sessionIds?: readonly string[]
}

interface WorkspaceRegistryService {
  list(): WorkspaceEntityLike[]
  create(path: string, title?: string): Promise<WorkspaceEntityLike>
  delete(id: string): Promise<boolean>
  resolveByPath(path: string): Promise<WorkspaceEntityLike | undefined>
  archiveSession?(sessionId: string, options?: { stopActivity?: boolean }): Promise<void>
}

interface SessionPersistenceService {
  list(): Promise<ReadonlyArray<{ header: { id: string; cwd?: string } }>>
}

interface LiveSessionsService {
  list(): ReadonlyArray<{ header: { id: string; cwd?: string } }>
}

interface ToolsService {
  register(definition: unknown): () => void
}

interface HostServices {
  subprocess: SubprocessService
  sandbox?: SandboxService
  sandboxPolicy?: SandboxPolicyService
  workingDirectory: WorkingDirectoryService
  workspaceRegistry?: WorkspaceRegistryService
  sessionPersistence?: SessionPersistenceService
  sessions?: LiveSessionsService
  tools?: ToolsService
}

interface RegistryEntry {
  path: string
  branch: string
  baseCommit?: string
  repositoryRoot?: string
  displayName?: string
  parentPath?: string
  pinned?: boolean
  createdAt?: string
}

interface RegistryFile {
  version: number
  /** Paths explicitly unpinned (since main checkout defaults to pinned unless unpinned). */
  unpinnedPaths?: string[]
  worktrees: RegistryEntry[]
  /** Historical branch -> path / session mapping retained after worktree removal for Settings -> Archived. */
  archivedBranches?: ArchivedBranchRecord[]
}

const GIT_ENV: Record<string, string | undefined> = Object.fromEntries(
  [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_CONFIG',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_COUNT',
    'GIT_CEILING_DIRECTORIES',
    'GIT_PREFIX',
    'GIT_SHALLOW_FILE',
    'GIT_GRAFT_FILE',
    'GIT_REPLACE_REF_BASE',
    'GIT_ATTR_SOURCE',
  ].map(key => [key, undefined]),
)

class WorktreeError extends Error {
  constructor(readonly code: WorktreeErrorCode, message: string) {
    super(message)
  }
}

function fail(error: unknown): WorktreeEnvelope<never> {
  if (error instanceof WorktreeError) return { ok: false, code: error.code, message: error.message }
  const text = error instanceof Error ? error.message : String(error)
  return { ok: false, code: 'WORKTREE_REMOVE_FAILED', message: text }
}

function ok<T>(value: T): WorktreeEnvelope<T> {
  return { ok: true, value: JSON.parse(JSON.stringify(value)) as T }
}

export default class WorktreeManagerService extends TypertRemoteService {
  static inject = ['fs', 'subprocess', 'workingDirectory', 'workspaceRegistry', 'tools']

  constructor(ctx: Context) {
    super(ctx, 'rWorktreeManager')
    this.registerTools()
  }

  // ---------------------------------------------------------------------
  // Browser-facing Remote verbs (session-independent: NO `agent` param!)
  // ---------------------------------------------------------------------

  /** Scan all registered DSH Workspaces and return grouped Git repositories + worktrees. */
  @Remote('overview')
  async overview(includeDirty: boolean | undefined, signal?: AbortSignal): Promise<WorktreeEnvelope<WorktreeOverviewValue>> {
    try {
      const wsRegistry = this.host().workspaceRegistry
      const workspaces = wsRegistry !== undefined ? wsRegistry.list() : []
      const wsByPath = new Map<string, WorkspaceEntityLike>()
      for (const ws of workspaces) wsByPath.set(ws.path, ws)

      // Deduplicate git repository roots in workspace display order.
      const repoOrder: string[] = []
      const seenRoots = new Set<string>()
      const claimedPaths = new Set<string>()
      const missingPaths = new Set<string>()
      const hostPolicy = { mode: 'danger-full-access' }

      await Promise.all(
        workspaces.map(async ws => {
          const stat = await this.fs().lstat(ws.path, undefined, signal).catch(() => undefined)
          if (stat === undefined) {
            missingPaths.add(ws.path)
            return undefined
          }
          const root = await this.tryRepositoryRootOf(hostPolicy, ws.path, signal)
          if (root !== undefined) {
            claimedPaths.add(ws.path)
            return { wsPath: ws.path, root }
          }
          return undefined
        }),
      ).then(resolved => {
        for (const item of resolved) {
          if (item === undefined || seenRoots.has(item.root)) continue
          seenRoots.add(item.root)
          repoOrder.push(item.root)
        }
      })

      const repos: WorktreeRepoGroup[] = await Promise.all(
        repoOrder.map(async root => {
          const rows = await this.worktreeRows(root, hostPolicy, wsByPath, undefined, includeDirty === true, signal)
          for (const row of rows) {
            if (wsByPath.has(row.path)) claimedPaths.add(row.path)
          }
          const rootWs = wsByPath.get(root)
          return {
            repositoryRoot: root,
            name: rootWs?.title && rootWs.title !== 'default-workspace' ? rootWs.title : pathBasename(root) || root,
            poolPath: await this.poolPath(root),
            rootWorkspaceId: rootWs?.id,
            rows,
          }
        }),
      )

      return ok({ repos, claimedPaths: [...claimedPaths], missingPaths: [...missingPaths] })
    } catch (error) {
      return fail(error)
    }
  }

  /** List remote & local branches (newest commit first) and default base ref for worktree creation. */
  @Remote('branches')
  async branches(
    repositoryRoot: string,
    refresh: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeBranchesValue>> {
    try {
      const policy = { mode: 'danger-full-access' }
      const root = await this.repositoryRootOf(policy, repositoryRoot, signal)
      const run = this.gitRunner(policy, signal)
      if (refresh === true) {
        await run(root, ['fetch', '--all', '--prune', '--quiet'], [0, 1, 128]).catch(() => {})
      }
      const listed = await run(
        root,
        ['for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(symref)', 'refs/remotes', 'refs/heads'],
        [0, 128],
      )
      const remoteBranches: string[] = []
      const localBranches: string[] = []
      let originHead: string | undefined

      for (const rawLine of listed.stdout.split('\n')) {
        if (rawLine.length === 0) continue
        const [refname = '', symref = ''] = rawLine.split('\t')
        if (refname === 'refs/remotes/origin/HEAD' && symref.startsWith('refs/remotes/')) {
          originHead = symref.slice('refs/remotes/'.length)
          continue
        }
        if (symref.length > 0) continue
        if (refname.startsWith('refs/remotes/')) {
          const short = refname.slice('refs/remotes/'.length)
          if (short.includes('/') && !short.endsWith('/HEAD')) remoteBranches.push(short)
        } else if (refname.startsWith('refs/heads/')) {
          const short = refname.slice('refs/heads/'.length)
          if (short.length > 0) localBranches.push(short)
        }
      }

      if (originHead !== undefined) {
        const idx = remoteBranches.indexOf(originHead)
        if (idx > 0) {
          remoteBranches.splice(idx, 1)
          remoteBranches.unshift(originHead)
        }
      }

      const currentBranch = await this.branchOf(policy, root, signal)
      const defaultBase =
        originHead ??
        remoteBranches.find(b => b === 'origin/main' || b === 'origin/master' || b === 'origin/develop') ??
        remoteBranches[0] ??
        (currentBranch !== undefined && localBranches.includes(currentBranch) ? currentBranch : undefined) ??
        localBranches[0] ??
        'HEAD'

      return ok({ remoteBranches, localBranches, defaultBase })
    } catch (error) {
      return fail(error)
    }
  }

  /**
   * Create a new pool worktree in `repositoryRoot`, record optional `parentPath`
   * lineage, persist `branch.<name>.base`, and register it as a DSH Workspace
   * so conversations can immediately start inside it without mutating other chats.
   */
  @Remote('create')
  async create(
    repositoryRoot: string,
    name: string | undefined,
    from: string | undefined,
    parentPath: string | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeCreateValue>> {
    try {
      const created = await this.createInternal({ mode: 'danger-full-access' }, repositoryRoot, name, from, parentPath, signal)
      return ok(created)
    } catch (error) {
      return fail(error)
    }
  }

  /** Ensure a checkout directory is registered in DSH `workspaceRegistry` and return its `workspaceId`. */
  @Remote('ensureWorkspace')
  async ensureWorkspace(
    path: string,
    title: string | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeEnsureWorkspaceValue>> {
    try {
      const canonical = await this.canonicalWorktreePath({ mode: 'danger-full-access' }, path, signal)
      const wsRegistry = this.host().workspaceRegistry
      if (wsRegistry === undefined) {
        throw new WorktreeError('WORKTREE_CREATE_FAILED', 'workspaceRegistry service is unavailable')
      }
      const existing = await wsRegistry.resolveByPath(canonical)
      if (existing !== undefined) return ok({ workspaceId: existing.id, path: existing.path })
      const branch = await this.branchOf({ mode: 'danger-full-access' }, canonical, signal)
      const created = await wsRegistry.create(canonical, title?.trim() || branch || pathBasename(canonical))
      return ok({ workspaceId: created.id, path: created.path })
    } catch (error) {
      return fail(error)
    }
  }

  /** Toggle yellow star (pinned) state on one worktree row. */
  @Remote('setPinned')
  async setPinned(
    path: string,
    pinned: boolean,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreePinValue>> {
    try {
      const policy = { mode: 'danger-full-access' }
      const canonical = await this.canonicalWorktreePath(policy, path, signal)
      const root = await this.repositoryRootOf(policy, canonical, signal)
      const branch = (await this.branchOf(policy, canonical, signal)) ?? pathBasename(canonical)
      await this.registryMutateFile(file => {
        const unpinned = new Set(file.unpinnedPaths ?? [])
        if (pinned) unpinned.delete(canonical)
        else unpinned.add(canonical)
        const existing = file.worktrees.find(item => item.path === canonical)
        if (existing !== undefined) {
          existing.pinned = pinned
        } else {
          file.worktrees.push({ path: canonical, branch, repositoryRoot: root, pinned })
        }
        return {
          ...file,
          unpinnedPaths: [...unpinned],
        }
      })
      return ok({ path: canonical, pinned })
    } catch (error) {
      return fail(error)
    }
  }

  /** Remove a pool-managed worktree and unregister its DSH Workspace (retaining session history). */
  @Remote('remove')
  async remove(
    path: string,
    force: boolean | undefined,
    deleteRemote?: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeRemoveValue>> {
    try {
      const removed = await this.removeInternal(
        { mode: 'danger-full-access' },
        undefined,
        path,
        force === true,
        signal,
        deleteRemote === true,
      )
      return ok(removed)
    } catch (error) {
      return fail(error)
    }
  }

  /** Branch / dirty / ahead-behind report for one checkout. */
  @Remote('status')
  async status(path: string, signal?: AbortSignal): Promise<WorktreeEnvelope<WorktreeStatusValue>> {
    try {
      const value = await this.statusInternal({ mode: 'danger-full-access' }, path, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Historical branch & repository metadata for Settings -> Archived Sessions grouping. */
  @Remote('archivedMeta')
  async archivedMeta(signal?: AbortSignal): Promise<WorktreeEnvelope<WorktreeArchivedMetaValue>> {
    try {
      const reg = await this.registry()
      const wsRegistry = this.host().workspaceRegistry
      const workspaces = wsRegistry !== undefined ? wsRegistry.list() : []
      const wsByPath = new Map<string, WorkspaceEntityLike>()
      for (const ws of workspaces) wsByPath.set(ws.path, ws)

      const hostPolicy = { mode: 'danger-full-access' }
      const seenRoots = new Set<string>()
      const repos: Array<{ repositoryRoot: string; name: string; poolPath: string }> = []

      const resolved = await Promise.all(
        workspaces.map(async ws => this.tryRepositoryRootOf(hostPolicy, ws.path, signal)),
      )
      for (const root of resolved) {
        if (root === undefined || seenRoots.has(root)) continue
        seenRoots.add(root)
        const rootWs = wsByPath.get(root)
        repos.push({
          repositoryRoot: root,
          name: rootWs?.title && rootWs.title !== 'default-workspace' ? rootWs.title : pathBasename(root) || root,
          poolPath: await this.poolPath(root),
        })
      }

      // Also include any repositoryRoot referenced by archivedBranches so deleted-repo histories still resolve.
      for (const item of reg.archivedBranches ?? []) {
        if (item.repositoryRoot && !seenRoots.has(item.repositoryRoot)) {
          seenRoots.add(item.repositoryRoot)
          repos.push({
            repositoryRoot: item.repositoryRoot,
            name: item.repositoryName || pathBasename(item.repositoryRoot) || item.repositoryRoot,
            poolPath: await this.poolPath(item.repositoryRoot),
          })
        }
      }

      return ok({
        branches: reg.archivedBranches ?? [],
        repos,
      })
    } catch (error) {
      return fail(error)
    }
  }

  // ---------------------------------------------------------------------
  // Shared internal implementations (called by both RPC and Agent tools)
  // ---------------------------------------------------------------------

  private async listForAgent(agent: AgentLike, signal?: AbortSignal): Promise<WorktreeListValue> {
    const policy = this.policy(agent)
    const cwd = await this.workingDirectory().ensure(agent, signal)
    const root = await this.repositoryRootOf(policy, cwd, signal)
    const wsByPath = new Map<string, WorkspaceEntityLike>()
    for (const ws of this.host().workspaceRegistry?.list() ?? []) wsByPath.set(ws.path, ws)
    const rows = await this.worktreeRows(root, policy, wsByPath, cwd, true, signal)
    return { repositoryRoot: root, poolPath: await this.poolPath(root), rows }
  }

  private async createInternal(
    policy: { mode: string },
    fromDirectory: string,
    name: string | undefined,
    from: string | undefined,
    parentPath: string | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeCreateValue> {
    const root = await this.repositoryRootOf(policy, fromDirectory, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (name?.trim() || `wt-${randomHex6()}`).replace(/^\/*|\/*$/g, '')
    if (branch.length === 0 || branch.startsWith('-') || branch.includes('..') || branch.includes('\\')) {
      throw new WorktreeError('WORKTREE_CREATE_FAILED', `invalid branch name: ${branch}`)
    }
    const fmt = await run(root, ['check-ref-format', `refs/heads/${branch}`], [0, 1, 128])
    if (fmt.exitCode !== 0) {
      throw new WorktreeError('WORKTREE_CREATE_FAILED', `invalid git branch name: ${branch}`)
    }
    const baseSourceDir = parentPath !== undefined ? await this.canonicalWorktreePath(policy, parentPath, signal) : root
    const revision = from?.trim() || 'HEAD'
    const verified = await run(baseSourceDir, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], [0, 1, 128])
    if (verified.exitCode !== 0) {
      throw new WorktreeError('WORKTREE_CREATE_FAILED', `revision not found: ${revision}`)
    }
    const baseCommit = verified.stdout.trim()

    const refExists = await run(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], [0, 1])
    if (refExists.exitCode === 0) {
      throw new WorktreeError('WORKTREE_BRANCH_EXISTS', `branch already exists: ${branch}`)
    }

    const poolTarget = await this.fs().resolve(await this.poolPath(root), { signal })
    const poolPath = this.fs().processPath(poolTarget)
    const destTarget = await this.fs().resolve(branch, { cwd: poolPath, signal })
    const destPath = this.fs().processPath(destTarget)
    if (!this.fs().contains(poolTarget, destTarget) || poolTarget.targetKey === destTarget.targetKey) {
      throw new WorktreeError('WORKTREE_CREATE_FAILED', `worktree destination escapes pool: ${destPath}`)
    }
    if ((await this.fs().lstat(destPath, undefined, signal)) !== undefined) {
      throw new WorktreeError('WORKTREE_PATH_EXISTS', `worktree path already exists: ${destPath}`)
    }

    await this.runArgv(policy, root, ['node', '--input-type=module', '-e', PREPARE_POOL_SCRIPT, poolPath, destPath], COMMAND_TIMEOUT_MS, signal)
    await run(root, ['--work-tree', root, 'worktree', 'add', '-b', branch, '--', destPath, baseCommit])

    const canonicalDest = await this.canonicalWorktreePath(policy, destPath, signal)
    const canonicalParent = parentPath !== undefined ? await this.canonicalWorktreePath(policy, parentPath, signal) : undefined

    await this.registryMutateFile(file => {
      const rest = file.worktrees.filter(item => item.path !== canonicalDest)
      rest.push({
        path: canonicalDest,
        branch,
        baseCommit,
        repositoryRoot: root,
        parentPath: canonicalParent !== root ? canonicalParent : undefined,
        createdAt: new Date().toISOString(),
      })
      return { ...file, worktrees: rest }
    })

    // Orca practice: persist base commit into git config (clear stale on failure).
    try {
      await run(root, ['config', '--local', '--replace-all', `branch.${branch}.base`, baseCommit])
    } catch {
      await run(root, ['config', '--local', '--unset-all', `branch.${branch}.base`], [0, 1, 5]).catch(() => {})
    }

    let workspaceId: string | undefined
    const wsRegistry = this.host().workspaceRegistry
    if (wsRegistry !== undefined) {
      const ws = await wsRegistry.create(canonicalDest, branch)
      workspaceId = ws.id
    }

    return {
      path: canonicalDest,
      branch,
      baseCommit,
      repositoryRoot: root,
      parentPath: canonicalParent !== root ? canonicalParent : undefined,
      workspaceId,
    }
  }

  private async removeInternal(
    policy: { mode: string },
    callingAgent: AgentLike | undefined,
    path: string,
    force: boolean,
    signal?: AbortSignal,
    deleteRemote = false,
  ): Promise<WorktreeRemoveValue> {
    const stat = await this.fs().lstat(path, undefined, signal)
    if (stat === undefined) {
      // Missing checkout directory on disk: clean up stale plugin registry entry,
      // prune parent git worktree metadata if known, archive sessions, and unregister DSH Workspace.
      const resolvedMissing = await this.fs().resolve(path, { signal })
      const missingCanonical = this.fs().processPath(resolvedMissing)
      const registry = await this.registry()
      const staleEntry = registry.worktrees.find(item => item.path === missingCanonical || item.path === path)
      if (staleEntry?.repositoryRoot) {
        await this.gitRunner(policy, signal)(staleEntry.repositoryRoot, ['worktree', 'prune'], [0, 1, 128]).catch(() => {})
      }
      const wsRegistry = this.host().workspaceRegistry
      const matchedWs = wsRegistry?.list().find(ws => ws.path === missingCanonical || ws.path === path)
      const archivedIds = await this.archiveSessionsInCheckout(
        missingCanonical,
        path,
        matchedWs?.sessionIds,
        callingAgent?.session.id,
      )
      const repoRoot = staleEntry?.repositoryRoot
      const rootWs = repoRoot ? wsRegistry?.list().find(ws => ws.path === repoRoot) : undefined
      const repoName =
        rootWs?.title && rootWs.title !== 'default-workspace'
          ? rootWs.title
          : repoRoot
            ? pathBasename(repoRoot) || repoRoot
            : matchedWs?.title || pathBasename(missingCanonical)
      const branchLabel = staleEntry?.branch || matchedWs?.title || pathBasename(missingCanonical)

      await this.registryMutateFile(file => {
        const archivedBranches = [...(file.archivedBranches ?? [])].filter(
          item => item.path !== missingCanonical && item.path !== path,
        )
        if (archivedIds.length > 0 || staleEntry !== undefined || matchedWs !== undefined) {
          archivedBranches.unshift({
            path: missingCanonical,
            branch: branchLabel,
            ...(repoRoot !== undefined ? { repositoryRoot: repoRoot } : {}),
            repositoryName: repoName,
            removedAt: new Date().toISOString(),
            ...(archivedIds.length > 0 ? { sessionIds: archivedIds } : {}),
          })
        }
        return {
          ...file,
          unpinnedPaths: (file.unpinnedPaths ?? []).filter(p => p !== missingCanonical && p !== path),
          worktrees: file.worktrees.filter(item => item.path !== missingCanonical && item.path !== path),
          archivedBranches,
        }
      })
      let wsDeleted = false
      if (wsRegistry !== undefined && matchedWs !== undefined) {
        wsDeleted = await wsRegistry.delete(matchedWs.id).catch(() => false)
      }
      if (staleEntry !== undefined || wsDeleted || archivedIds.length > 0) {
        return {
          path: missingCanonical,
          branchDeleted: false,
          branchHadUnmerged: false,
          ...(archivedIds.length > 0 ? { archivedCount: archivedIds.length } : {}),
        }
      }
      throw new WorktreeError('WORKTREE_NOT_FOUND', `no such directory: ${path}`)
    }

    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const root = await this.repositoryRootOf(policy, canonical, signal)
    const pathTarget = await this.fs().resolve(canonical, { signal })
    const rootTarget = await this.fs().resolve(root, { signal })

    if (this.fs().processPath(pathTarget) === this.fs().processPath(rootTarget)) {
      throw new WorktreeError('WORKTREE_MAIN_CHECKOUT', 'refusing to remove the repository main checkout')
    }
    // No pool containment gate: legacy-layout worktrees (pre unified pool) must stay removable.

    const branch = await this.branchOf(policy, canonical, signal)
    const registry = await this.registry()
    const children = registry.worktrees.filter(item => item.parentPath === canonical)
    // Physical children block removal too: force-removing a parent would delete
    // nested checkouts created outside the plugin registry.
    const listedAll = await this.gitRunner(policy, signal, COMMAND_TIMEOUT_MS)(root, ['worktree', 'list', '--porcelain', '-z'], [0, 128])
    for (const block of listedAll.stdout.split('\0\0')) {
      const raw = block.split('\0').find(field => field.startsWith('worktree '))?.slice('worktree '.length)
      if (raw === undefined || raw.length === 0) continue
      let target
      try {
        target = await this.fs().resolve(raw, { signal })
      } catch {
        continue
      }
      const nested = this.fs().processPath(target)
      if (nested !== canonical && nested.startsWith(`${canonical}/`)) children.push({ path: nested, branch: '' })
    }
    if (children.length > 0 && !force) {
      throw new WorktreeError(
        'WORKTREE_HAS_CHILDREN',
        `${canonical} has ${children.length} child worktree(s); pass force to detach them`,
      )
    }

    const dirty = await this.dirtyCountOf(policy, canonical, signal)
    if (dirty > 0 && !force) {
      throw new WorktreeError('WORKTREE_DIRTY', `${canonical} has ${dirty} uncommitted change(s); pass force to discard them`)
    }

    const removeRun = this.gitRunner(policy, signal, REMOVE_TIMEOUT_MS)
    await removeRun(root, ['worktree', 'remove', ...(force ? ['--force'] : []), '--', canonical])

    const run = this.gitRunner(policy, signal)
    // User opted for full cleanup: the branch is deleted along with the worktree;
    // unmerged branches fall through to -D and are flagged for a loud warning.
    let branchDeleted = false
    let branchHadUnmerged = false
    let upstream: string | undefined
    if (branch !== undefined && !branch.startsWith('detached')) {
      const up = await run(root, ['rev-parse', '--abbrev-ref', '--quiet', `${branch}@{upstream}`], [0, 1, 128])
      if (up.exitCode === 0) upstream = up.stdout.trim() || undefined
      const safe = await run(root, ['branch', '-d', branch], [0, 1])
      if (safe.exitCode === 0) {
        branchDeleted = true
      } else {
        const forced = await run(root, ['branch', '-D', branch], [0, 1])
        branchDeleted = forced.exitCode === 0
        branchHadUnmerged = branchDeleted
      }
    }
    let remoteDeleted: boolean | undefined
    let remoteError: string | undefined
    if (deleteRemote && upstream !== undefined && upstream.includes('/')) {
      const slash = upstream.indexOf('/')
      const pushed = await run(root, ['push', '--delete', upstream.slice(0, slash), upstream.slice(slash + 1)], [0, 1, 128])
      remoteDeleted = pushed.exitCode === 0
      if (!remoteDeleted) remoteError = `failed to delete remote branch ${upstream}`
    }
    await run(root, ['worktree', 'prune'], [0, 1])

    // Archive conversations bound to this checkout via official DSH `workspaceRegistry.archiveSession`
    // before unregistering its Workspace entry, and record branch metadata for Settings -> Archived.
    const wsRegistry = this.host().workspaceRegistry
    const matched = wsRegistry?.list().find(ws => ws.path === canonical)
    const rootWs = wsRegistry?.list().find(ws => ws.path === root)
    const repoName = rootWs?.title && rootWs.title !== 'default-workspace' ? rootWs.title : pathBasename(root) || root
    const branchLabel = branch ?? matched?.title ?? pathBasename(canonical)
    const archivedIds = await this.archiveSessionsInCheckout(
      canonical,
      path,
      matched?.sessionIds,
      callingAgent?.session.id,
    )

    await this.registryMutateFile(file => {
      const unpinned = (file.unpinnedPaths ?? []).filter(p => p !== canonical)
      const next = file.worktrees.filter(item => item.path !== canonical)
      if (force) {
        for (const item of next) if (item.parentPath === canonical) item.parentPath = undefined
      }
      const prevArchived = file.archivedBranches ?? []
      const existingRecord = prevArchived.find(item => item.path === canonical)
      const mergedSessionIds = Array.from(new Set([...(existingRecord?.sessionIds ?? []), ...archivedIds]))
      const archivedBranches = prevArchived.filter(item => item.path !== canonical)
      archivedBranches.unshift({
        path: canonical,
        branch: branchLabel,
        repositoryRoot: root,
        repositoryName: repoName,
        removedAt: new Date().toISOString(),
        ...(mergedSessionIds.length > 0 ? { sessionIds: mergedSessionIds } : {}),
      })
      return { ...file, unpinnedPaths: unpinned, worktrees: next, archivedBranches }
    })

    if (wsRegistry !== undefined && matched !== undefined) {
      await wsRegistry.delete(matched.id).catch(() => {})
    }

    let resetCwdTo: string | undefined
    if (callingAgent !== undefined) {
      const cwd = this.workingDirectory().get(callingAgent.session)
      if (cwd === canonical || cwd.startsWith(`${canonical}/`)) {
        resetCwdTo = await this.workingDirectory().set(callingAgent, root, signal)
      }
    }
    return {
      path: canonical,
      branchDeleted,
      branchHadUnmerged,
      ...(archivedIds.length > 0 ? { archivedCount: archivedIds.length } : {}),
      remoteDeleted,
      remoteError,
      resetCwdTo,
    }
  }

  private async statusInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
  ): Promise<WorktreeStatusValue> {
    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const branch = await this.branchOf(policy, canonical, signal)
    const dirtyCount = await this.dirtyCountOf(policy, canonical, signal)
    const run = this.gitRunner(policy, signal)
    const counts = await run(canonical, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], [0, 1, 128])
    let ahead: number | undefined
    let behind: number | undefined
    if (counts.exitCode === 0) {
      const [aheadText, behindText] = counts.stdout.trim().split(/\s+/)
      ahead = Number.parseInt(aheadText ?? '0', 10)
      behind = Number.parseInt(behindText ?? '0', 10)
    }
    return { path: canonical, branch: branch ?? 'detached', dirtyCount, ahead, behind }
  }

  // ---------------------------------------------------------------------
  // Agent tools (one operation, two callers)
  // ---------------------------------------------------------------------

  private registerTools(): void {
    const disposers: Array<() => void> = []
    const self = this
    const definitions: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (args: Record<string, unknown>, exec: { agent: AgentLike; signal: AbortSignal }) => Promise<unknown>
    }> = [
      {
        name: 'worktree_list',
        description:
          "List git worktrees of the repository containing this session's working directory, including branch, dirty count, pin status, parent lineage, and linked workspaceId.",
        parameters: { type: 'object', properties: {}, required: [] },
        async execute(_args, exec) {
          return JSON.parse(JSON.stringify(await self.listForAgent(exec.agent, exec.signal)))
        },
      },
      {
        name: 'worktree_create',
        description:
          'Create a new managed git worktree under the shared plugin pool directory and register it as a DSH Workspace without leaving the current checkout unless enter is true.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Branch name to create (optional; generated when omitted).' },
            from: { type: 'string', description: 'Base revision/branch (defaults to HEAD).' },
            parentPath: { type: 'string', description: 'Optional parent worktree path for sidebar lineage nesting.' },
            enter: { type: 'boolean', description: 'Switch this session working directory into the new worktree.' },
          },
          required: [],
        },
        async execute(args, exec) {
          const cwd = await self.workingDirectory().ensure(exec.agent, exec.signal)
          const created = await self.createInternal(
            self.policy(exec.agent),
            cwd,
            typeof args.name === 'string' ? args.name : undefined,
            typeof args.from === 'string' ? args.from : undefined,
            typeof args.parentPath === 'string' ? args.parentPath : undefined,
            exec.signal,
          )
          if (args.enter === true) {
            await self.workingDirectory().set(exec.agent, created.path, exec.signal)
          }
          return JSON.parse(JSON.stringify(created))
        },
      },
      {
        name: 'worktree_enter',
        description: "Switch this session's working directory into an existing git worktree checkout.",
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Checkout path to enter.' } },
          required: ['path'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          const canonical = await self.canonicalWorktreePath(self.policy(exec.agent), args.path, exec.signal)
          const entered = await self.workingDirectory().set(exec.agent, canonical, exec.signal)
          return { path: entered } satisfies WorktreeEnterValue
        },
      },
      {
        name: 'worktree_status',
        description: 'Report branch, uncommitted-change count, and ahead/behind counts for a git checkout.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Checkout path.' } },
          required: ['path'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          return JSON.parse(JSON.stringify(await self.statusInternal(self.policy(exec.agent), args.path, exec.signal)))
        },
      },
      {
        name: 'worktree_pin',
        description: 'Pin or unpin a git worktree row (yellow star marker) in the sidebar.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Worktree checkout path.' },
            pinned: { type: 'boolean', description: 'True to pin (star), false to unpin.' },
          },
          required: ['path', 'pinned'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          const env = await self.setPinned(args.path, args.pinned === true, exec.signal)
          if (!env.ok) throw new Error(env.message)
          return env.value
        },
      },
      {
        name: 'worktree_remove',
        description:
          'Remove a pool-managed git worktree (unified plugin pool or legacy checkout location). Uncommitted changes or child worktrees require force: true.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Worktree checkout path.' },
            force: { type: 'boolean', description: 'Discard uncommitted changes and detach child worktrees.' },
            deleteRemote: { type: 'boolean', description: 'Also delete the branch upstream (e.g. origin/<branch>) when set.' },
          },
          required: ['path'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          return JSON.parse(
            JSON.stringify(
              await self.removeInternal(
                self.policy(exec.agent),
                exec.agent,
                args.path,
                args.force === true,
                exec.signal,
                args.deleteRemote === true,
              ),
            ),
          )
        },
      },
    ]

    const tools = this.host().tools
    if (tools !== undefined) {
      for (const definition of definitions) {
        disposers.push(
          tools.register({
            ...definition,
            output: {
              schema: { type: 'object' },
              render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
            },
            async execute(args: unknown, exec: { agent: AgentLike; signal: AbortSignal }) {
              if (!exec?.agent || typeof exec.agent !== 'object') {
                throw new Error('no calling agent context for worktree tool')
              }
              return definition.execute((args ?? {}) as Record<string, unknown>, exec)
            },
          }),
        )
      }
    }
    this.ctx.effect(() => async () => {
      for (const dispose of disposers) dispose()
    }, 'worktree-manager: tools')
  }

  // ---------------------------------------------------------------------
  // Registry store (<poolRoot>/worktree-manager.json, shared by all repos)
  // ---------------------------------------------------------------------

  private registryPath(): string {
    return `${poolRoot()}/${REGISTRY_FILE}`
  }

  private async registry(): Promise<RegistryFile> {
    try {
      const target = await this.fs().resolve(this.registryPath(), { signal: undefined })
      const text = await this.fs().readText(target, undefined)
      const parsed = JSON.parse(text) as RegistryFile
      if (parsed && Array.isArray(parsed.worktrees)) {
        return {
          version: REGISTRY_VERSION,
          unpinnedPaths: Array.isArray(parsed.unpinnedPaths) ? parsed.unpinnedPaths : [],
          worktrees: parsed.worktrees,
          archivedBranches: Array.isArray(parsed.archivedBranches) ? parsed.archivedBranches : [],
        }
      }
    } catch {
      // Missing or corrupt degrades gracefully.
    }
    return { version: REGISTRY_VERSION, unpinnedPaths: [], worktrees: [], archivedBranches: [] }
  }

  private async registryMutateFile(mutate: (file: RegistryFile) => RegistryFile): Promise<void> {
    const current = await this.registry()
    const next = mutate({
      version: REGISTRY_VERSION,
      unpinnedPaths: [...(current.unpinnedPaths ?? [])],
      worktrees: current.worktrees.map(item => ({ ...item })),
      archivedBranches: (current.archivedBranches ?? []).map(item => ({
        ...item,
        ...(item.sessionIds !== undefined ? { sessionIds: [...item.sessionIds] } : {}),
      })),
    })
    const filePath = this.registryPath()
    // Written via the full-access helper script: `.agents/` is harness-managed and
    // rejected by `fs().writeText` under workspace-write sandbox policies.
    await this.runArgv(
      { mode: 'danger-full-access' },
      pathDirname(pathDirname(filePath)),
      ['node', '--input-type=module', '-e', PREPARE_POOL_SCRIPT, pathDirname(filePath), filePath, `${JSON.stringify(next, null, 2)}\n`],
      COMMAND_TIMEOUT_MS,
      undefined,
    )
  }

  /**
   * Archive every session whose cwd sits inside `canonicalPath` (or `rawPath`)
   * or is explicitly accounted on the removed Workspace, delegating to DSH's
   * authoritative `workspaceRegistry.archiveSession`. Never archives `excludeSessionId`
   * when an active Agent removes a worktree from inside its own turn.
   */
  private async archiveSessionsInCheckout(
    canonicalPath: string,
    rawPath: string,
    explicitSessionIds: readonly string[] | undefined,
    excludeSessionId: string | undefined,
  ): Promise<string[]> {
    const host = this.host()
    const wsRegistry = host.workspaceRegistry
    if (wsRegistry === undefined || typeof wsRegistry.archiveSession !== 'function') return []

    const candidates = new Set<string>(explicitSessionIds ?? [])
    const matchesPath = (cwd: string | undefined): boolean => {
      if (!cwd) return false
      const norm = cwd.length > 1 ? cwd.replace(/\/+$/, '') : cwd
      return (
        norm === canonicalPath ||
        norm.startsWith(`${canonicalPath}/`) ||
        norm === rawPath ||
        norm.startsWith(`${rawPath}/`)
      )
    }

    try {
      for (const live of host.sessions?.list() ?? []) {
        if (matchesPath(live.header?.cwd)) candidates.add(live.header.id)
      }
    } catch {
      // Optional live session index.
    }
    try {
      const stored = await host.sessionPersistence?.list()
      for (const snap of stored ?? []) {
        if (matchesPath(snap.header?.cwd)) candidates.add(snap.header.id)
      }
    } catch {
      // Optional persistence listing.
    }

    if (excludeSessionId !== undefined) candidates.delete(excludeSessionId)

    const archived: string[] = []
    for (const sid of candidates) {
      try {
        await wsRegistry.archiveSession(sid, { stopActivity: true })
        archived.push(sid)
      } catch {
        // Ignore unknown/blank transient sessions not yet materialized.
      }
    }
    return archived
  }

  // ---------------------------------------------------------------------
  // Git & Subprocess plumbing
  // ---------------------------------------------------------------------

  private fs(): Context['fs'] {
    return this.ctx.fs
  }

  private getService<K extends keyof HostServices>(key: K): HostServices[K] | undefined {
    const getter = (this.ctx as unknown as { get?: (name: string) => unknown }).get
    if (typeof getter === 'function') {
      return getter.call(this.ctx, key) as HostServices[K] | undefined
    }
    return (this.ctx as unknown as Record<string, unknown>)[key] as HostServices[K] | undefined
  }

  private host(): HostServices {
    return {
      subprocess: this.getService('subprocess')!,
      workingDirectory: this.getService('workingDirectory')!,
      workspaceRegistry: this.getService('workspaceRegistry'),
      sessionPersistence: this.getService('sessionPersistence'),
      sessions: this.getService('sessions'),
      tools: this.getService('tools'),
      sandbox: this.getService('sandbox'),
      sandboxPolicy: this.getService('sandboxPolicy'),
    }
  }

  private workingDirectory(): WorkingDirectoryService {
    return this.host().workingDirectory
  }

  private policy(agent: AgentLike): { mode: string } {
    const sandboxPolicy = this.host().sandboxPolicy
    return sandboxPolicy !== undefined ? sandboxPolicy.resolve({ session: agent.session }) : { mode: 'danger-full-access' }
  }

  private async runArgv(
    policy: { mode: string },
    cwd: string,
    argv: readonly string[],
    timeoutMs: number,
    signal: AbortSignal | undefined,
    allowedExitCodes: readonly number[] = [0],
  ): Promise<{ stdout: string; exitCode: number }> {
    const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)]
    if (signal !== undefined) signals.push(signal)
    const timeoutSignal = AbortSignal.any(signals)
    timeoutSignal.throwIfAborted()
    const host = this.host()
    let command: readonly string[] = argv
    if (host.sandbox !== undefined && policy.mode !== 'danger-full-access') {
      command = (await host.sandbox.confine(command, policy, timeoutSignal)).argv
    }
    command = [await host.subprocess.resolveExecutable(command[0]!, undefined, timeoutSignal), ...command.slice(1)]
    timeoutSignal.throwIfAborted()
    const child = host.subprocess.spawn({
      argv: command,
      cwd,
      env: { ...GIT_ENV, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', GIT_NO_LAZY_FETCH: '1' },
      signal: timeoutSignal,
      graceMs: COMMAND_GRACE_MS,
      stdio: { stdin: 'ignore', stdout: { maxBytes: MAX_OUTPUT_BYTES }, stderr: { maxBytes: MAX_OUTPUT_BYTES } },
    })
    try {
      const outcome = await child.done
      timeoutSignal.throwIfAborted()
      const stdout = child.collected.stdout.readFrom(0)
      const stderr = child.collected.stderr.readFrom(0)
      if (outcome.exitCode === null || !allowedExitCodes.includes(outcome.exitCode)) {
        if (timeoutSignal.aborted) throw new WorktreeError('WORKTREE_TIMEOUT', 'command timed out')
        throw new Error(`${argv.slice(0, 3).join(' ')} failed (${outcome.signal ?? outcome.exitCode}): ${stderr.text.trim()}`)
      }
      if (stdout.lossy) throw new Error(`command output exceeds ${MAX_OUTPUT_BYTES} bytes`)
      return { stdout: stdout.text, exitCode: outcome.exitCode }
    } finally {
      child.terminate()
      await child.waitForExit()
    }
  }

  private gitRunner(policy: { mode: string }, signal: AbortSignal | undefined, timeoutMs = COMMAND_TIMEOUT_MS) {
    return (cwd: string, args: readonly string[], allowedExitCodes: readonly number[] = [0]) =>
      this.runArgv(
        policy,
        cwd,
        ['git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', ...args],
        timeoutMs,
        signal,
        allowedExitCodes,
      )
  }

  private async poolPath(root: string): Promise<string> {
    const safe = pathBasename(root).replace(/[^A-Za-z0-9._-]+/g, '-') || 'repo'
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(root))
    const hash = Array.from(new Uint8Array(digest).slice(0, 4), b => b.toString(16).padStart(2, '0')).join('')
    return `${poolRoot()}/${safe}-${hash}`
  }

  private async tryRepositoryRootOf(
    policy: { mode: string },
    from: string,
    signal: AbortSignal | undefined,
  ): Promise<string | undefined> {
    try {
      const stat = await this.fs().lstat(from, undefined, signal)
      if (stat === undefined) return undefined
      return await this.repositoryRootOf(policy, from, signal)
    } catch {
      return undefined
    }
  }

  private async repositoryRootOf(policy: { mode: string }, from: string, signal: AbortSignal | undefined): Promise<string> {
    const run = this.gitRunner(policy, signal)
    const out = await run(from, ['rev-parse', '--path-format=absolute', '--git-common-dir'], [0, 128])
    if (out.exitCode !== 0) throw new WorktreeError('WORKTREE_NOT_A_REPO', `${from} is not a git repository`)
    const commonDir = out.stdout.trim()
    const rawRoot = commonDir.endsWith('/.git')
      ? commonDir.slice(0, -'/'.length - '.git'.length)
      : (await run(from, ['rev-parse', '--path-format=absolute', '--show-toplevel'])).stdout.trim()
    const resolved = await this.fs().resolve(rawRoot, { signal })
    return this.fs().processPath(resolved)
  }

  private async canonicalWorktreePath(
    policy: { mode: string },
    path: string,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    const stat = await this.fs().lstat(path, undefined, signal)
    if (stat === undefined) throw new WorktreeError('WORKTREE_NOT_FOUND', `no such directory: ${path}`)
    const run = this.gitRunner(policy, signal)
    const top = await run(path, ['rev-parse', '--path-format=absolute', '--show-toplevel'], [0, 128])
    if (top.exitCode !== 0) {
      throw new WorktreeError('WORKTREE_NOT_A_WORKTREE', `${path} is not inside a git work tree`)
    }
    const resolved = await this.fs().resolve(top.stdout.trim(), { signal })
    return this.fs().processPath(resolved)
  }

  private async branchOf(policy: { mode: string }, path: string, signal: AbortSignal | undefined): Promise<string | undefined> {
    const run = this.gitRunner(policy, signal)
    const out = await run(path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1])
    if (out.exitCode !== 0) {
      const head = await run(path, ['rev-parse', '--short=7', 'HEAD'], [0, 128])
      return head.exitCode === 0 ? `detached at ${head.stdout.trim()}` : 'HEAD'
    }
    return out.stdout.trim()
  }

  private async dirtyCountOf(policy: { mode: string }, path: string, signal: AbortSignal | undefined): Promise<number> {
    try {
      const run = this.gitRunner(policy, signal)
      const out = await run(path, ['status', '--porcelain', '--untracked-files=normal'], [0, 128])
      if (out.exitCode !== 0) return 0
      return out.stdout.split('\n').filter(line => line.length > 0).length
    } catch {
      return 0
    }
  }

  private async worktreeRows(
    root: string,
    policy: { mode: string },
    wsByPath: ReadonlyMap<string, WorkspaceEntityLike>,
    currentCwd: string | undefined,
    includeDirty: boolean,
    signal: AbortSignal | undefined,
  ): Promise<WorktreeRow[]> {
    const run = this.gitRunner(policy, signal)
    const listed = await run(root, ['worktree', 'list', '--porcelain', '-z'])
    const registry = await this.registry()
    const unpinned = new Set(registry.unpinnedPaths ?? [])
    const rootTarget = await this.fs().resolve(root, { signal })
    const poolTarget = await this.fs().resolve(await this.poolPath(root), { signal })

    const parsedBlocks: Array<{
      canonicalPath: string
      branch: string
      isMain: boolean
      isManaged: boolean
    }> = []

    for (const block of listed.stdout.split('\0\0')) {
      const fields = block.split('\0')
      const rawPath = fields.find(field => field.startsWith('worktree '))?.slice('worktree '.length)
      if (rawPath === undefined || rawPath.length === 0) continue
      if (fields.some(field => field === 'bare' || field.startsWith('prunable'))) continue
      const headField = fields.find(field => field.startsWith('HEAD '))
      const branchField = fields.find(field => field.startsWith('branch '))
      let pathTarget
      try {
        pathTarget = await this.fs().resolve(rawPath, { signal })
      } catch {
        continue
      }
      const canonicalPath = this.fs().processPath(pathTarget)
      const isMain = canonicalPath === this.fs().processPath(rootTarget)
      const isManaged = !isMain && this.fs().contains(poolTarget, pathTarget)
      const branch =
        branchField !== undefined
          ? branchField.slice('branch '.length).replace(/^refs\/heads\//, '')
          : `detached at ${(headField?.slice('HEAD '.length) ?? '').slice(0, 7) || 'HEAD'}`
      parsedBlocks.push({ canonicalPath, branch, isMain, isManaged })
    }

    // Lineage fallback: a non-managed external worktree nested inside another worktree
    // (registry entry absent, e.g. created by the native DSH `.agents/worktrees` tool)
    // is its physical child. Managed pool checkouts stay top-level unless given an explicit parentPath.
    const derivedParentOf = new Map<string, string>()
    for (const block of parsedBlocks) {
      if (block.isManaged) continue
      let best: string | undefined
      for (const other of parsedBlocks) {
        if (other.canonicalPath === block.canonicalPath) continue
        if (!block.canonicalPath.startsWith(`${other.canonicalPath}/`)) continue
        if (best === undefined || other.canonicalPath.length > best.length) best = other.canonicalPath
      }
      if (best !== undefined) derivedParentOf.set(block.canonicalPath, best)
    }

    const rows = (
      await Promise.all(
        parsedBlocks.map(async ({ canonicalPath, branch, isMain, isManaged }): Promise<WorktreeRow | undefined> => {
          // Ghost guard: a checkout deleted outside the plugin (rm -rf) leaves a prunable
          // git registration; hide the row instead of listing a directory that is gone.
          if ((await this.fs().lstat(canonicalPath, undefined, signal)) === undefined) return undefined
          const entry = registry.worktrees.find(item => item.path === canonicalPath)
          // Main checkout defaults to starred (like Orca's primary branch star) unless explicitly unpinned.
          const pinned = entry?.pinned !== undefined ? entry.pinned : isMain && !unpinned.has(canonicalPath)
          const dirtyCount = includeDirty ? await this.dirtyCountOf(policy, canonicalPath, signal) : 0
          let upstream: string | undefined
          if (!branch.startsWith('detached')) {
            const up = await run(root, ['rev-parse', '--abbrev-ref', '--quiet', `${branch}@{upstream}`], [0, 1, 128])
            if (up.exitCode === 0) upstream = up.stdout.trim() || undefined
          }
          const linkedWs = wsByPath.get(canonicalPath)
          return {
            path: canonicalPath,
            branch,
            kind: isMain ? 'main' : isManaged ? 'managed' : 'external',
            dirtyCount,
            pinned,
            upstream,
            displayName: entry?.displayName,
            parentPath: entry?.parentPath ?? derivedParentOf.get(canonicalPath),
            createdAt: entry?.createdAt,
            workspaceId: linkedWs?.id,
            ...(currentCwd !== undefined
              ? { current: currentCwd === canonicalPath || currentCwd.startsWith(`${canonicalPath}/`) }
              : {}),
          }
        }),
      )
    ).filter((row): row is WorktreeRow => row !== undefined)

    // Pinned rows keep natural priority after main, or sort main -> pinned -> rest by branch.
    const rank = { main: 0, managed: 1, external: 2 } as const
    rows.sort((a, b) => {
      if (a.kind === 'main' && b.kind !== 'main') return -1
      if (b.kind === 'main' && a.kind !== 'main') return 1
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return rank[a.kind] - rank[b.kind] || a.branch.localeCompare(b.branch)
    })
    return rows
  }
}
