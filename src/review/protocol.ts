/**
 * Wire vocabulary shared by host and browser halves. Pure JSON types only.
 * @module dsh-git-review-plugin/protocol
 */

export type GitErrorCode =
  | 'GIT_NOT_FOUND'
  | 'GIT_NOT_A_WORKTREE'
  | 'GIT_NOT_A_REPO'
  | 'GIT_TIMEOUT'
  | 'GIT_DIFF_FAILED'
  | 'GIT_LOG_FAILED'
  | 'GIT_APPLY_FAILED'
  | 'GIT_BLAME_FAILED'
  | 'GIT_COMMIT_FAILED'
  | 'GIT_PUSH_FAILED'
  | 'GIT_LLM_UNAVAILABLE'
  | 'RPC_ERROR'

export type GitEnvelope<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: GitErrorCode; readonly message: string }

/** `branches` outcome — remote and local branch candidates for push/compare. */
export interface GitBranchesValue {
  readonly remoteBranches: readonly string[]
  readonly localBranches: readonly string[]
  readonly defaultBase: string
}

/** `status` outcome. */
export interface GitStatusValue {
  readonly path: string
  readonly branch: string
  readonly dirtyCount: number
  /** Resolved remote branch ref (e.g. `origin/feat-x`) when this branch has been pushed to a remote. */
  readonly upstream?: string
  readonly ahead?: number
  readonly behind?: number
}

/** One changed file from `git status --porcelain -z` inside a checkout. */
export interface GitChangeRow {
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
export interface GitDiffValue {
  readonly path: string
  readonly branch: string
  readonly changes: readonly GitChangeRow[]
  /** `git diff HEAD` plus per-file untracked diffs (`--no-index /dev/null <file>`). */
  readonly diff: string
  /** True when the combined diff exceeded the size cap and was cut short. */
  readonly truncated: boolean
}

/** `commit` outcome. */
export interface GitCommitValue {
  readonly path: string
  readonly commit: string
  readonly summary: string
  readonly branch: string
}

/** `push` outcome. */
export interface GitPushValue {
  readonly path: string
  readonly branch: string
  /** Upstream ref after the push (e.g. `origin/develop`), set when `-u` established it. */
  readonly upstream: string
}

/** One commit row from `git log` (log / compare / push preview). */
export interface GitCommitRow {
  readonly hash: string
  readonly shortHash: string
  readonly author: string
  readonly email: string
  /** Author date, ISO 8601 (git `%aI`). */
  readonly date: string
  readonly subject: string
  readonly body?: string
  /** Parent hashes, first parent first (git `%P`); empty for root commits. */
  readonly parents: readonly string[]
  /** Ref decorations pointing at this commit (git `%d`, e.g. `HEAD -> main`, `origin/main`, `tag: v1`). */
  readonly refs: readonly string[]
}

/** `log` outcome — branch/file/range commit list. */
export interface GitLogValue {
  readonly path: string
  readonly commits: readonly GitCommitRow[]
  readonly truncated?: boolean
}

/** `showCommit` outcome — one commit's changes + unified diff. */
export interface GitCommitDetailValue {
  readonly path: string
  readonly hash: string
  readonly branch: string
  readonly changes: readonly GitChangeRow[]
  readonly diff: string
  readonly truncated?: boolean
}

/** `compare` outcome — our side of `ref..HEAD`. */
export interface GitCompareValue {
  readonly path: string
  readonly branch: string
  readonly ref: string
  readonly commits: readonly GitCommitRow[]
  readonly changes: readonly GitChangeRow[]
  readonly diff: string
  readonly truncated?: boolean
}

/** Deduplicated commit metadata inside a blame result. */
export interface GitBlameCommit {
  readonly hash: string
  readonly author: string
  readonly date: string
  readonly subject: string
}

/** One content line of a blame result; `commit` indexes into `commits`. */
export interface GitBlameLine {
  readonly commit: number
  readonly oldNo: number
  readonly newNo: number
  readonly code: string
}

/** `blame` outcome — per-line annotation for one file. */
export interface GitBlameValue {
  readonly path: string
  readonly file: string
  readonly commits: readonly GitBlameCommit[]
  readonly lines: readonly GitBlameLine[]
  readonly truncated?: boolean
}

/** One file's selected-hunk patch sent from the browser for partial staging. */
export interface GitHunkPatch {
  readonly file: string
  readonly patch: string
}

/** `applyPatch` outcome. */
export interface GitApplyPatchValue {
  readonly path: string
}

/** `suggestCommitMessage` outcome. */
export interface GitSuggestMessageValue {
  readonly path: string
  readonly message: string
  readonly provider: string
  readonly model: string
}
