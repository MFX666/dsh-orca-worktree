/**
 * Wire vocabulary shared by host and browser halves. Pure JSON types only.
 * @module dsh-worktree-plugin/protocol
 */

export type WorktreeErrorCode =
  | 'WORKTREE_NOT_FOUND'
  | 'WORKTREE_NOT_A_WORKTREE'
  | 'WORKTREE_MAIN_CHECKOUT'
  | 'WORKTREE_EXTERNAL'
  | 'WORKTREE_DIRTY'
  | 'WORKTREE_HAS_CHILDREN'
  | 'WORKTREE_BRANCH_EXISTS'
  | 'WORKTREE_PATH_EXISTS'
  | 'WORKTREE_CREATE_FAILED'
  | 'WORKTREE_REMOVE_FAILED'
  | 'WORKTREE_NOT_A_REPO'
  | 'WORKTREE_TIMEOUT'
  | 'WORKTREE_DIFF_FAILED'
  | 'WORKTREE_COMMIT_FAILED'
  | 'WORKTREE_LLM_UNAVAILABLE'
  | 'RPC_ERROR'

export type WorktreeEnvelope<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: WorktreeErrorCode; readonly message: string }

export type WorktreeKind = 'main' | 'managed' | 'external'

/** One git worktree row inside a repository group. */
export interface WorktreeRow {
  readonly path: string
  readonly branch: string
  readonly kind: WorktreeKind
  readonly dirtyCount: number
  readonly pinned: boolean
  readonly displayName?: string
  readonly parentPath?: string
  readonly createdAt?: string
  /** Registered DSH Workspace id owning conversations in this checkout, when present. */
  readonly workspaceId?: string
  /** Upstream ref like `origin/feat-x` when the branch is pushed, enabling remote-branch cleanup on remove. */
  readonly upstream?: string
  /** True when calling from an agent tool whose session cwd sits inside this checkout. */
  readonly current?: boolean
}

/** One top-level Git repository discovered from registered DSH Workspaces. */
export interface WorktreeRepoGroup {
  readonly repositoryRoot: string
  readonly name: string
  readonly poolPath: string
  /** Primary Workspace id registered at `repositoryRoot`, when present. */
  readonly rootWorkspaceId?: string
  readonly rows: readonly WorktreeRow[]
}

/** Multi-repository overview consumed by the left sidebar tree. */
export interface WorktreeOverviewValue {
  readonly repos: readonly WorktreeRepoGroup[]
  /** Canonical paths of registered Workspaces that belong to one of `repos` (main or worktree). */
  readonly claimedPaths: readonly string[]
  /** Registered Workspace paths that no longer exist on disk. */
  readonly missingPaths?: readonly string[]
}

/** Single-repository list outcome (used by agent tools). */
export interface WorktreeListValue {
  readonly repositoryRoot: string
  readonly poolPath: string
  readonly rows: readonly WorktreeRow[]
}

/** `branches` outcome — remote and local branch candidates for worktree creation. */
export interface WorktreeBranchesValue {
  readonly remoteBranches: readonly string[]
  readonly localBranches: readonly string[]
  readonly defaultBase: string
}

/** `create` outcome — includes the auto-registered DSH Workspace id so UI can start a chat immediately. */
export interface WorktreeCreateValue {
  readonly path: string
  readonly branch: string
  readonly baseCommit: string
  readonly repositoryRoot: string
  readonly parentPath?: string
  readonly workspaceId?: string
}

/** `ensureWorkspace` outcome — ensures a worktree path has a DSH Workspace id for conversations. */
export interface WorktreeEnsureWorkspaceValue {
  readonly workspaceId: string
  readonly path: string
}

/** `pin` outcome. */
export interface WorktreePinValue {
  readonly path: string
  readonly pinned: boolean
}

/** `status` outcome. */
export interface WorktreeStatusValue {
  readonly path: string
  readonly branch: string
  readonly dirtyCount: number
  /** Resolved remote branch ref (e.g. `origin/feat-x`) when this branch has been pushed to a remote. */
  readonly upstream?: string
  readonly ahead?: number
  readonly behind?: number
}

/** `remove` outcome. */
export interface WorktreeRemoveValue {
  readonly path: string
  readonly branchDeleted: boolean
  /** True when the branch had unmerged commits and was force-deleted. */
  readonly branchHadUnmerged: boolean
  /** Number of conversations inside this worktree automatically archived via DSH `workspaceRegistry`. */
  readonly archivedCount?: number
  /** Set when remote-branch deletion was requested. */
  readonly remoteDeleted?: boolean
  readonly remoteError?: string
  readonly resetCwdTo?: string
}

/** Metadata remembered when a worktree is removed so Settings -> Archived can group by Git repo + branch. */
export interface ArchivedBranchRecord {
  readonly path: string
  readonly branch: string
  readonly repositoryRoot?: string
  readonly repositoryName: string
  readonly removedAt: string
  readonly sessionIds?: readonly string[]
}

/** `archivedMeta` outcome consumed by the Settings -> Archived Sessions page. */
export interface WorktreeArchivedMetaValue {
  readonly branches: readonly ArchivedBranchRecord[]
  /** Known repo roots + display names + poolPaths so any pool/external session cwd can be attributed cleanly. */
  readonly repos: ReadonlyArray<{
    readonly repositoryRoot: string
    readonly name: string
    readonly poolPath: string
  }>
}

/** `enter` outcome. */
export interface WorktreeEnterValue {
  readonly path: string
}

/** One changed file from `git status --porcelain -z` inside a checkout. */
export interface WorktreeChangeRow {
  /** Path relative to the checkout root (rename destination when applicable). */
  readonly file: string
  /** Rename/copy source path relative to the checkout root, when the row is an R/C entry. */
  readonly oldFile?: string
  /** Two-char XY porcelain code, e.g. `M ` (staged modify), ` M`, `??`, `R `. */
  readonly status: string
  readonly staged: boolean
  readonly untracked: boolean
  readonly add?: number
  readonly del?: number
}

/** `diff` outcome — combined working-tree view used by the commit dialog. */
export interface WorktreeDiffValue {
  readonly path: string
  readonly branch: string
  readonly changes: readonly WorktreeChangeRow[]
  /** `git diff HEAD` plus per-file untracked diffs (`--no-index /dev/null <file>`). */
  readonly diff: string
  /** True when the combined diff exceeded the size cap and was cut short. */
  readonly truncated: boolean
}

/** `commit` outcome. */
export interface WorktreeCommitValue {
  readonly path: string
  readonly commit: string
  readonly summary: string
  readonly branch: string
}

/** `suggestCommitMessage` outcome. */
export interface WorktreeSuggestMessageValue {
  readonly path: string
  readonly message: string
  readonly provider: string
  readonly model: string
}
