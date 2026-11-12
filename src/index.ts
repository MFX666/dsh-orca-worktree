/**
 * dsh-worktree-plugin — host half.
 *
 * Exposes `rWorktreeManager` over Typert SRC mode:
 * - Browser verbs (`overview`, `create`, `remove`, `setPinned`, `ensureWorkspace`, `status`)
 *   take plain JSON arguments (no `agent` lookup parameter), so sidebar calls
 *   succeed even before any Session is opened.
 * - Agent tools (`worktree_list`, `worktree_create`, `worktree_enter`,
 *   `worktree_status`, `worktree_diff`, `worktree_commit`, `worktree_remove`,
 *   `worktree_pin`) call the same
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
  WorktreeChangeRow,
  WorktreeCommitValue,
  WorktreeCreateValue,
  WorktreeDiffValue,
  WorktreeEnsureWorkspaceValue,
  WorktreeEnterValue,
  WorktreeEnvelope,
  WorktreeErrorCode,
  WorktreeListValue,
  WorktreePinValue,
  WorktreePushValue,
  WorktreeOverviewValue,
  WorktreeRemoveValue,
  WorktreeRepoGroup,
  WorktreeRow,
  WorktreeStatusValue,
  WorktreeSuggestMessageValue,
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
const MAX_DIFF_STDOUT_BYTES = 4 << 20
const MAX_DIFF_CHARS = 768_000
const PER_FILE_DIFF_CHARS = 96_000
const SUGGEST_DIFF_CHARS = 48_000
const SUGGEST_TIMEOUT_MS = 60_000

const NOISY_DIFF_PATHSPECS = [
  ':(exclude)*.map',
  ':(exclude)*.min.js',
  ':(exclude)*.min.css',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)package-lock.json',
  ':(exclude)yarn.lock',
] as const

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

/** Structural slice of `@deepseek-ai/dsh-llm` LlmRuntime used for commit-message suggestions. */
interface LlmRuntimeLike {
  listProviders(): ReadonlyArray<{ id: string }>
  listModels(provider: string): Promise<ReadonlyArray<{ id: string }>>
  stream(options: {
    provider: string
    model: string
    system?: string
    messages: ReadonlyArray<{ role: 'user'; content: ReadonlyArray<{ type: 'text'; text: string }> }>
    maxTokens?: number
    signal?: AbortSignal
  }): AsyncIterable<{ type: string; text?: string }>
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
  llm?: LlmRuntimeLike
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

  private orcaLineageCache: { expiresAt: number; map: ReadonlyMap<string, string> } | null = null

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
            if (ws.path.includes('/.orca-preparing/') || ws.path.includes('\\.orca-preparing\\')) {
              claimedPaths.add(ws.path)
            } else {
              missingPaths.add(ws.path)
            }
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

  /** Working-tree changes + combined (or single-file) diff text. */
  @Remote('diff')
  async diff(
    path: string,
    file?: string | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeDiffValue>> {
    try {
      const value = await this.diffInternal({ mode: 'danger-full-access' }, path, signal, file)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Commit the working tree with `message`, staging exactly `files` when provided. */
  @Remote('commit')
  async commit(
    path: string,
    message: string,
    files: readonly string[] | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeEnvelope<WorktreeCommitValue>> {
    try {
      const value = await this.commitInternal({ mode: 'danger-full-access' }, path, message, files, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Push the current branch to its upstream, establishing one via `-u` when missing. */
  @Remote('push')
  async push(path: string, signal?: AbortSignal): Promise<WorktreeEnvelope<WorktreePushValue>> {
    try {
      const value = await this.pushInternal({ mode: 'danger-full-access' }, path, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Draft one commit message from the working-tree diff via the mounted LLM provider. */
  @Remote('suggestCommitMessage')
  async suggestCommitMessage(path: string, signal?: AbortSignal): Promise<WorktreeEnvelope<WorktreeSuggestMessageValue>> {
    try {
      const value = await this.suggestCommitMessageInternal({ mode: 'danger-full-access' }, path, signal)
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
    // `--no-track` prevents `git worktree add -b <branch> <path> origin/main` from setting
    // `origin/main` as `<branch>@{upstream}` before `<branch>` itself has ever been pushed!
    await run(root, ['--work-tree', root, 'worktree', 'add', '--no-track', '-b', branch, '--', destPath, baseCommit])

    const canonicalDest = await this.canonicalWorktreePath(policy, destPath, signal)
    const canonicalParent = parentPath !== undefined ? await this.canonicalWorktreePath(policy, parentPath, signal) : undefined

    await this.registryMutateFile(file => {
      const rest = file.worktrees.filter(item => item.path !== canonicalDest)
      rest.push({
        path: canonicalDest,
        branch,
        baseCommit,
        repositoryRoot: root,
        parentPath: canonicalParent !== undefined && canonicalParent !== canonicalDest ? canonicalParent : undefined,
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
      parentPath: canonicalParent !== undefined && canonicalParent !== canonicalDest ? canonicalParent : undefined,
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
    let pushedTarget: { remote: string; remoteBranch: string; displayRef: string } | undefined
    if (branch !== undefined && !branch.startsWith('detached')) {
      pushedTarget = await this.resolvePushedRemoteBranch(policy, root, branch, true, signal)
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
    if (deleteRemote && pushedTarget !== undefined) {
      const pushed = await run(root, ['push', '--delete', pushedTarget.remote, pushedTarget.remoteBranch], [0, 1, 128])
      remoteDeleted = pushed.exitCode === 0
      if (!remoteDeleted) remoteError = `failed to delete remote branch ${pushedTarget.displayRef}`
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

  /** Parse `git status --porcelain -z` (with `--untracked-files=all`) + `--numstat` into change rows. */
  private async changesOf(
    run: (cwd: string, args: readonly string[], allowedExitCodes?: readonly number[], allowLossy?: boolean) => Promise<{ stdout: string; exitCode: number; lossy?: boolean }>,
    canonical: string,
    signal: AbortSignal | undefined,
  ): Promise<WorktreeChangeRow[]> {
    const [st, numstat] = await Promise.all([
      run(canonical, ['status', '--porcelain', '-z', '--untracked-files=all'], [0, 128], true),
      run(canonical, ['diff', '--numstat', '-z', 'HEAD'], [0, 128], true).catch(() => ({ stdout: '', exitCode: 128 })),
    ])
    void signal

    const statsByFile = new Map<string, { add: number; del: number }>()
    if (numstat.exitCode === 0 && numstat.stdout.length > 0) {
      const parts = numstat.stdout.split('\0')
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]!
        if (seg.length === 0) continue
        const t1 = seg.indexOf('\t')
        const t2 = t1 >= 0 ? seg.indexOf('\t', t1 + 1) : -1
        if (t1 < 0 || t2 < 0) continue
        const addRaw = seg.slice(0, t1)
        const delRaw = seg.slice(t1 + 1, t2)
        let filePath = seg.slice(t2 + 1)
        if (filePath.length === 0) {
          // Rename/copy entry in `-z` mode: `add\tdel\t\0oldPath\0newPath\0`
          filePath = parts[i + 2] ?? parts[i + 1] ?? ''
          i += 2
        }
        if (filePath.length > 0 && addRaw !== '-' && delRaw !== '-') {
          statsByFile.set(filePath, {
            add: Number.parseInt(addRaw, 10) || 0,
            del: Number.parseInt(delRaw, 10) || 0,
          })
        }
      }
    }

    const changes: WorktreeChangeRow[] = []
    const tokens = st.stdout.split('\0')
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!
      if (token.length < 4) continue
      const x = token[0]!
      const y = token[1]!
      if (x === ' ' && y === ' ') continue
      const file = token.slice(3)
      const stat = statsByFile.get(file)
      const row: {
        file: string
        status: string
        staged: boolean
        untracked: boolean
        add?: number
        del?: number
        oldFile?: string
      } = {
        file,
        status: token.slice(0, 2),
        staged: x !== ' ' && x !== '?',
        untracked: x === '?' && y === '?',
      }
      if (stat !== undefined) {
        row.add = stat.add
        row.del = stat.del
      }
      if (x === 'R' || x === 'C') {
        // Porcelain -z rename entry: the next token is the source path.
        const oldFile = tokens[i + 1] ?? ''
        i++
        if (oldFile.length > 0) row.oldFile = oldFile
      }
      changes.push(row)
    }
    return changes
  }

  /**
   * Combined (or single-file) working-tree diff text:
   * - Single-file mode (`onlyFile` set): fetches just that file up to `maxChars`, even `.map` / lockfiles.
   * - Overview mode: excludes noisy build maps/lockfiles in the first pass and caps each file at
   *   `PER_FILE_DIFF_CHARS` so one large bundle never starves source files alphabetically after it!
   */
  private async diffTextOf(
    run: (cwd: string, args: readonly string[], allowedExitCodes?: readonly number[], allowLossy?: boolean) => Promise<{ stdout: string; exitCode: number; lossy?: boolean }>,
    canonical: string,
    changes: readonly WorktreeChangeRow[],
    maxChars: number,
    signal: AbortSignal | undefined,
    onlyFile?: string,
  ): Promise<{ diff: string; truncated: boolean }> {
    void signal
    if (onlyFile !== undefined && onlyFile.length > 0) {
      if (onlyFile.startsWith('-')) throw new WorktreeError('WORKTREE_DIFF_FAILED', 'invalid file path')
      const entry = changes.find(c => c.file === onlyFile)
      const res = entry?.untracked
        ? await run(canonical, ['diff', '--no-color', '--no-index', '--', '/dev/null', onlyFile], [0, 1], true).catch(() => ({ stdout: '', exitCode: 0, lossy: false }))
        : await run(canonical, ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', onlyFile], [0, 128], true).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
      const truncated = Boolean(res.lossy) || res.stdout.length > maxChars
      return { diff: truncated ? res.stdout.slice(0, maxChars) : res.stdout, truncated }
    }

    const parts: string[] = []
    let total = 0
    let truncated = false
    const perFileCap = Math.min(PER_FILE_DIFF_CHARS, maxChars)

    const appendSection = (section: string): boolean => {
      if (total >= maxChars) {
        truncated = true
        return false
      }
      let chunk = section
      if (chunk.length > perFileCap) {
        // Trim cleanly at a newline boundary so the last rendered line isn't half-broken.
        const nl = chunk.lastIndexOf('\n', perFileCap)
        chunk = nl > 0 ? `${chunk.slice(0, nl + 1)}` : chunk.slice(0, perFileCap)
        truncated = true
      }
      if (chunk.length > maxChars - total) {
        const nl = chunk.lastIndexOf('\n', maxChars - total)
        chunk = nl > 0 ? chunk.slice(0, nl + 1) : chunk.slice(0, maxChars - total)
        truncated = true
      }
      parts.push(chunk)
      total += chunk.length
      return total < maxChars
    }

    const appendMultiFileDiff = (raw: string, wasLossy: boolean): void => {
      if (wasLossy) truncated = true
      if (raw.length === 0) return
      let start = 0
      while (start < raw.length) {
        const next = raw.indexOf('\ndiff --git ', start)
        const section = next >= 0 ? raw.slice(start, next + 1) : raw.slice(start)
        if (!appendSection(section)) break
        if (next < 0) break
        start = next + 1
      }
    }

    const isNoisy = (file: string): boolean =>
      /\.(map|lock)$|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$|\.min\.(js|css)$/.test(file)

    // Pass 1: tracked non-noisy files first so real source code always gets budget.
    const trackedMain = await run(
      canonical,
      ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', '.', ...NOISY_DIFF_PATHSPECS],
      [0, 128],
      true,
    ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
    if (trackedMain.exitCode === 128) {
      // Unborn HEAD (0 commits in repo): fall back to staged diff (`--cached`).
      const stagedOnly = await run(
        canonical,
        ['diff', '--no-color', '--no-ext-diff', '--cached', '--', '.', ...NOISY_DIFF_PATHSPECS],
        [0, 128],
        true,
      ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
      appendMultiFileDiff(stagedOnly.stdout, Boolean(stagedOnly.lossy))
    } else {
      appendMultiFileDiff(trackedMain.stdout, Boolean(trackedMain.lossy))
    }

    // Pass 2: untracked non-noisy files, then untracked noisy files if budget remains.
    const untrackedChanges = [
      ...changes.filter(c => c.untracked && !isNoisy(c.file)),
      ...changes.filter(c => c.untracked && isNoisy(c.file)),
    ]
    for (const change of untrackedChanges) {
      if (total >= maxChars) {
        truncated = true
        break
      }
      const one = await run(
        canonical,
        ['diff', '--no-color', '--no-index', '--', '/dev/null', change.file],
        [0, 1],
        true,
      ).catch(() => ({ stdout: '', exitCode: 0, lossy: false }))
      if (one.lossy) truncated = true
      if (one.stdout.length > 0 && !appendSection(one.stdout)) break
    }

    // Marking truncated when noisy tracked files were skipped lets the UI know lazy per-file fetch is available.
    if (changes.some(c => !c.untracked && isNoisy(c.file))) {
      // Do not pollute small diffs if budget remains: fetch noisy tracked files last when space allows.
      for (const noisy of changes.filter(c => !c.untracked && isNoisy(c.file))) {
        if (total >= maxChars) {
          truncated = true
          break
        }
        const one = await run(
          canonical,
          ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', noisy.file],
          [0, 128],
          true,
        ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
        if (one.lossy) truncated = true
        if (one.stdout.length > 0 && !appendSection(one.stdout)) break
      }
    }

    return { diff: parts.join(''), truncated }
  }

  private async diffInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
    onlyFile?: string,
  ): Promise<WorktreeDiffValue> {
    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const changes = await this.changesOf(run, canonical, signal)
    const { diff, truncated } = await this.diffTextOf(run, canonical, changes, MAX_DIFF_CHARS, signal, onlyFile)
    return { path: canonical, branch, changes, diff, truncated }
  }

  private async commitInternal(
    policy: { mode: string },
    path: string,
    message: string,
    files: readonly string[] | undefined,
    signal?: AbortSignal,
  ): Promise<WorktreeCommitValue> {
    const trimmed = message.replace(/^\s+|\s+$/g, '')
    if (trimmed.length === 0) throw new WorktreeError('WORKTREE_COMMIT_FAILED', 'commit message is empty')
    if (files !== undefined && (files.length === 0 || files.some(f => typeof f !== 'string' || f.length === 0 || f.startsWith('-')))) {
      throw new WorktreeError('WORKTREE_COMMIT_FAILED', 'invalid file list')
    }
    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    if (files !== undefined) {
      // Stage exactly the selected files (including untracked), then `--only` commits
      // precisely them so pre-staged-but-unselected index content stays untouched.
      await run(canonical, ['add', '--', ...files]).catch(error => {
        throw new WorktreeError('WORKTREE_COMMIT_FAILED', error instanceof Error ? error.message : String(error))
      })
    }
    try {
      await run(canonical, ['commit', '-m', trimmed, ...(files !== undefined ? ['--only', '--', ...files] : [])])
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      throw new WorktreeError('WORKTREE_COMMIT_FAILED', text)
    }
    const short = await run(canonical, ['rev-parse', '--short=7', 'HEAD'], [0, 128])
    const summary = await run(canonical, ['log', '-1', '--pretty=%s'], [0, 128])
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    return {
      path: canonical,
      commit: short.stdout.trim(),
      summary: summary.stdout.trim(),
      branch,
    }
  }

  private async pushInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
  ): Promise<WorktreePushValue> {
    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const upstreamRes = await run(canonical, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], [0, 1, 128])
    const existingUpstream = upstreamRes.exitCode === 0 ? upstreamRes.stdout.trim() : ''
    if (existingUpstream.length > 0) {
      // Plain push; a non-fast-forward surfaces the remote's rejection verbatim.
      await run(canonical, ['push']).catch(error => {
        throw new WorktreeError('WORKTREE_PUSH_FAILED', error instanceof Error ? error.message : String(error))
      })
      return { path: canonical, branch, upstream: existingUpstream }
    }
    const remotes = await run(canonical, ['remote'], [0, 128]).catch(() => ({ stdout: '', exitCode: 128 }))
    const remote = remotes.stdout.split('\n').map(l => l.trim()).find(l => l.length > 0)
    if (remote === undefined) {
      throw new WorktreeError('WORKTREE_PUSH_FAILED', 'no remote configured for this checkout')
    }
    await run(canonical, ['push', '-u', remote, branch]).catch(error => {
      throw new WorktreeError('WORKTREE_PUSH_FAILED', error instanceof Error ? error.message : String(error))
    })
    return { path: canonical, branch, upstream: `${remote}/${branch}` }
  }

  private async suggestCommitMessageInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
  ): Promise<WorktreeSuggestMessageValue> {
    const canonical = await this.canonicalWorktreePath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const changes = await this.changesOf(run, canonical, signal)
    if (changes.length === 0) {
      throw new WorktreeError('WORKTREE_COMMIT_FAILED', 'no working-tree changes to describe')
    }
    const { diff } = await this.diffTextOf(run, canonical, changes, SUGGEST_DIFF_CHARS, signal)
    const log = await run(canonical, ['log', '--oneline', '-8'], [0, 128]).catch(() => ({ stdout: '', exitCode: 128 }))

    const llm = this.host().llm
    if (llm === undefined) {
      throw new WorktreeError('WORKTREE_LLM_UNAVAILABLE', 'llm service is not mounted in this DSH profile')
    }
    const providers = llm.listProviders()
    const provider = providers[0]?.id
    if (provider === undefined) {
      throw new WorktreeError('WORKTREE_LLM_UNAVAILABLE', 'no LLM provider adapter is registered')
    }
    const models = await llm.listModels(provider).catch(() => [])
    const model = models[0]?.id
    if (model === undefined) {
      throw new WorktreeError('WORKTREE_LLM_UNAVAILABLE', `provider ${provider} advertises no models`)
    }

    const signals: AbortSignal[] = [AbortSignal.timeout(SUGGEST_TIMEOUT_MS)]
    if (signal !== undefined) signals.push(signal)
    const llmSignal = AbortSignal.any(signals)
    const recent = log.stdout.trim()
    const prompt = [
      `Branch: ${branch}`,
      recent.length > 0 ? `Recent commit subjects (match their style/language):\n${recent}` : 'No commit history yet.',
      'Write one git commit message for the staged-and-unstaged diff below.',
      'Rules: first line = imperative subject <= 72 chars, no trailing period; then one blank line;',
      'body <= 5 bullet lines explaining the why; reply with the raw message only, no quotes, no fences, no explanations.',
      '--- DIFF ---',
      diff,
    ].join('\n')
    let text = ''
    try {
      for await (const chunk of llm.stream({
        provider,
        model,
        system: 'You are a precise git commit-message writer. Output only the commit message text.',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens: 512,
        signal: llmSignal,
      })) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
        if (llmSignal.aborted) break
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      throw new WorktreeError('WORKTREE_LLM_UNAVAILABLE', `commit message generation failed: ${messageText}`)
    }
    const cleaned = text
      .trim()
      .replace(/^```[a-z]*\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim()
    if (cleaned.length === 0) {
      throw new WorktreeError('WORKTREE_LLM_UNAVAILABLE', 'model returned an empty commit message')
    }
    return { path: canonical, message: cleaned, provider, model }
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
        name: 'worktree_diff',
        description:
          'Show uncommitted changes of a git checkout: per-file status rows (staged / unstaged / untracked) plus the combined or single-file diff text.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Checkout path.' },
            file: { type: 'string', description: 'Optional relative file path to fetch only that file diff.' },
          },
          required: ['path'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          const file = typeof args.file === 'string' && args.file.length > 0 ? args.file : undefined
          return JSON.parse(JSON.stringify(await self.diffInternal(self.policy(exec.agent), args.path, exec.signal, file)))
        },
      },
      {
        name: 'worktree_commit',
        description:
          'Commit changes in a git checkout. Stages exactly `files` (may include untracked paths) and commits them with `message`; omit `files` to commit the index as-is.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Checkout path.' },
            message: { type: 'string', description: 'Commit message (first line is the subject).' },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths (relative to the checkout) to stage and commit; omitted commits the whole index.',
            },
          },
          required: ['path', 'message'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          if (typeof args.message !== 'string' || args.message.trim().length === 0) throw new Error('message is required')
          const files = Array.isArray(args.files) ? args.files.filter((f): f is string => typeof f === 'string') : undefined
          return JSON.parse(
            JSON.stringify(await self.commitInternal(self.policy(exec.agent), args.path, args.message, files, exec.signal)),
          )
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
   * Best-effort read of Orca Desktop's `worktreeLineageById` domain so child worktrees
   * created inside Orca also preserve their parent-child hierarchy inside DSH's sidebar.
   * Cached for 15s and completely silent when Orca or `node:sqlite` is absent.
   */
  private async readOrcaExternalLineage(signal: AbortSignal | undefined): Promise<ReadonlyMap<string, string>> {
    const now = Date.now()
    if (this.orcaLineageCache !== null && now < this.orcaLineageCache.expiresAt) {
      return this.orcaLineageCache.map
    }
    const empty = new Map<string, string>()
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    if (env?.DSH_WORKTREE_POOL) {
      // Isolated test pool: skip external Orca profile database lookup.
      return empty
    }
    const home = (env?.HOME ?? env?.USERPROFILE)?.trim()
    if (!home) return empty

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
`
    try {
      const out = await this.runArgv(
        { mode: 'danger-full-access' },
        home,
        ['node', '--no-warnings', '--input-type=module', '-e', script, home],
        4_000,
        signal,
        [0],
      )
      const parsed = JSON.parse(out.stdout || '{}') as Record<
        string,
        { worktreeId?: string; parentWorktreeId?: string } | undefined
      >
      const rawPairs: Array<[string, string]> = []
      const extractPath = (id: string | undefined): string | undefined => {
        if (typeof id !== 'string') return undefined
        const sep = id.indexOf('::')
        return sep >= 0 ? id.slice(sep + 2) : undefined
      }
      for (const rec of Object.values(parsed)) {
        const childRaw = extractPath(rec?.worktreeId)
        const parentRaw = extractPath(rec?.parentWorktreeId)
        if (childRaw && parentRaw && childRaw !== parentRaw) {
          rawPairs.push([childRaw, parentRaw])
        }
      }
      const map = new Map<string, string>()
      await Promise.all(
        rawPairs.map(async ([childRaw, parentRaw]) => {
          try {
            const [cTarget, pTarget] = await Promise.all([
              this.fs().resolve(childRaw, { signal }),
              this.fs().resolve(parentRaw, { signal }),
            ])
            const cPath = this.fs().processPath(cTarget)
            const pPath = this.fs().processPath(pTarget)
            if (cPath !== pPath) map.set(cPath, pPath)
          } catch {
            // Skip paths no longer resolvable.
          }
        }),
      )
      this.orcaLineageCache = { expiresAt: Date.now() + 15_000, map }
      return map
    } catch {
      this.orcaLineageCache = { expiresAt: Date.now() + 15_000, map: empty }
      return empty
    }
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
      llm: this.getService('llm'),
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
    allowLossy = false,
  ): Promise<{ stdout: string; exitCode: number; lossy: boolean }> {
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
    const stdoutCap = allowLossy ? MAX_DIFF_STDOUT_BYTES : MAX_OUTPUT_BYTES
    const child = host.subprocess.spawn({
      argv: command,
      cwd,
      env: { ...GIT_ENV, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', GIT_NO_LAZY_FETCH: '1' },
      signal: timeoutSignal,
      graceMs: COMMAND_GRACE_MS,
      stdio: { stdin: 'ignore', stdout: { maxBytes: stdoutCap }, stderr: { maxBytes: MAX_OUTPUT_BYTES } },
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
      if (stdout.lossy && !allowLossy) throw new Error(`command output exceeds ${stdoutCap} bytes`)
      return { stdout: stdout.text, exitCode: outcome.exitCode, lossy: stdout.lossy }
    } finally {
      child.terminate()
      await child.waitForExit()
    }
  }

  private gitRunner(policy: { mode: string }, signal: AbortSignal | undefined, timeoutMs = COMMAND_TIMEOUT_MS) {
    return (cwd: string, args: readonly string[], allowedExitCodes: readonly number[] = [0], allowLossy = false) =>
      this.runArgv(
        policy,
        cwd,
        ['git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', ...args],
        timeoutMs,
        signal,
        allowedExitCodes,
        allowLossy,
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

  /**
   * Resolve the remote-tracking counterpart of a local branch, preferring its
   * configured upstream and falling back to `<remote>/<branch>` for every known
   * remote. `verifyTip` additionally requires the remote-tracking ref to exist,
   * i.e. the branch was actually pushed at some point. Returns `undefined` when
   * the branch has never been pushed.
   */
  private async resolvePushedRemoteBranch(
    policy: { mode: string },
    root: string,
    branch: string,
    verifyTip: boolean,
    signal: AbortSignal | undefined,
  ): Promise<{ remote: string; remoteBranch: string; displayRef: string } | undefined> {
    const run = this.gitRunner(policy, signal)
    const candidates: string[] = []
    const up = await run(root, ['rev-parse', '--abbrev-ref', '--quiet', `${branch}@{upstream}`], [0, 1, 128])
    if (up.exitCode === 0 && up.stdout.trim().length > 0) candidates.push(up.stdout.trim())
    try {
      const remotes = await run(root, ['remote'], [0, 128])
      for (const remote of remotes.stdout.split('\n').map(line => line.trim()).filter(Boolean)) {
        const candidate = `${remote}/${branch}`
        if (!candidates.includes(candidate)) candidates.push(candidate)
      }
    } catch {
      // No remotes configured: upstream candidate alone decides.
    }
    for (const ref of candidates) {
      const sep = ref.indexOf('/')
      if (sep <= 0) continue
      if (verifyTip) {
        const verify = await run(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${ref}`], [0, 1, 128])
        if (verify.exitCode !== 0) continue
      }
      return { remote: ref.slice(0, sep), remoteBranch: ref.slice(sep + 1), displayRef: ref }
    }
    return undefined
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
      // Skip Orca's transient locked staging directories (`.../.orca-preparing/...`).
      if (rawPath.includes('/.orca-preparing/') || rawPath.includes('\\.orca-preparing\\')) continue
      const headField = fields.find(field => field.startsWith('HEAD '))
      const branchField = fields.find(field => field.startsWith('branch '))
      let pathTarget
      try {
        pathTarget = await this.fs().resolve(rawPath, { signal })
      } catch {
        continue
      }
      const canonicalPath = this.fs().processPath(pathTarget)
      if (canonicalPath.includes('/.orca-preparing/') || canonicalPath.includes('\\.orca-preparing\\')) continue
      const isMain = canonicalPath === this.fs().processPath(rootTarget)
      const isManaged = !isMain && this.fs().contains(poolTarget, pathTarget)
      const branch =
        branchField !== undefined
          ? branchField.slice('branch '.length).replace(/^refs\/heads\//, '')
          : `detached at ${(headField?.slice('HEAD '.length) ?? '').slice(0, 7) || 'HEAD'}`
      parsedBlocks.push({ canonicalPath, branch, isMain, isManaged })
    }

    // Read external Orca desktop lineage (`worktreeLineageById`) when available so worktrees
    // derived in Orca also preserve their parent-child hierarchy in DSH's sidebar!
    const orcaLineage = await this.readOrcaExternalLineage(signal)

    // Lineage fallback: a non-managed external worktree nested inside another worktree
    // (registry entry absent, e.g. created by the native DSH `.agents/worktrees` tool)
    // is its physical child. Managed pool checkouts stay top-level unless given an explicit parentPath.
    const derivedParentOf = new Map<string, string>()
    for (const block of parsedBlocks) {
      const orcaParent = orcaLineage.get(block.canonicalPath)
      if (orcaParent !== undefined && orcaParent !== block.canonicalPath) {
        derivedParentOf.set(block.canonicalPath, orcaParent)
        continue
      }
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
