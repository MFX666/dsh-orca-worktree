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
  readonly ahead?: number
  readonly behind?: number
}

/** `remove` outcome. */
export interface WorktreeRemoveValue {
  readonly path: string
  readonly branchPreserved: boolean
  readonly resetCwdTo?: string
}

/** `enter` outcome. */
export interface WorktreeEnterValue {
  readonly path: string
}
