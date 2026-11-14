/**
 * Browser-side client of `rGitReview`. All parameters are plain JSON
 * (session-independent): every verb takes an explicit checkout `path`.
 * @module dsh-git-review-plugin/client/api
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  GitApplyPatchValue,
  GitBlameValue,
  GitBranchesValue,
  GitCommitDetailValue,
  GitCommitValue,
  GitCompareValue,
  GitDiffValue,
  GitEnvelope,
  GitHunkPatch,
  GitLogValue,
  GitPushValue,
  GitStatusValue,
  GitSuggestMessageValue,
} from '../../review/protocol.ts'

export interface GitApi {
  branches(repositoryRoot: string, refresh?: boolean, signal?: AbortSignal): Promise<GitBranchesValue>
  status(path: string, signal?: AbortSignal): Promise<GitStatusValue>
  diff(path: string, signal?: AbortSignal, file?: string, ignoreWhitespace?: boolean): Promise<GitDiffValue>
  commit(
    path: string,
    message: string,
    files: readonly string[],
    opts?: { hunks?: readonly GitHunkPatch[] },
    signal?: AbortSignal,
  ): Promise<GitCommitValue>
  push(path: string, opts?: { forceWithLease?: boolean }, signal?: AbortSignal): Promise<GitPushValue>
  suggestCommitMessage(path: string, signal?: AbortSignal): Promise<GitSuggestMessageValue>
  log(
    path: string,
    opts?: { refRange?: string; file?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<GitLogValue>
  showCommit(path: string, hash: string, signal?: AbortSignal): Promise<GitCommitDetailValue>
  compare(path: string, ref: string, signal?: AbortSignal): Promise<GitCompareValue>
  blame(path: string, file: string, signal?: AbortSignal): Promise<GitBlameValue>
  applyPatch(
    path: string,
    patch: string,
    opts?: { cached?: boolean; reverse?: boolean },
    signal?: AbortSignal,
  ): Promise<GitApplyPatchValue>
}

const NAMESPACE = 'rGitReview'

type TransportResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { code?: unknown; message?: unknown } }

export function createGitApi(ctx: ClientContext): GitApi {
  const rpc = (
    ctx as unknown as {
      connection?: {
        rpc?: { call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown> }
      }
    }
  ).connection?.rpc

  const call = async <T>(method: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    if (rpc === undefined) throw new Error('connection service unavailable')
    const result = (await rpc.call('/api', `${NAMESPACE}/${method}`, { args }, signal)) as TransportResult<
      GitEnvelope<T>
    >
    if (!result.ok) {
      throw new Error(typeof result.error?.message === 'string' ? result.error.message : `${NAMESPACE}/${method} failed`)
    }
    if (!result.value.ok) throw new Error(result.value.message)
    return result.value.value
  }

  return {
    branches: (repositoryRoot, refresh = false, signal) => call('branches', { repositoryRoot, refresh }, signal),
    status: (path, signal) => call('status', { path }, signal),
    diff: (path, signal, file, ignoreWhitespace) =>
      call(
        'diff',
        {
          path,
          ...(file !== undefined ? { file } : {}),
          ...(ignoreWhitespace === true ? { ignoreWhitespace: true } : {}),
        },
        signal,
      ),
    commit: (path, message, files, opts, signal) =>
      call('commit', {
        path,
        message,
        files,
        ...(opts?.hunks !== undefined ? { hunks: opts.hunks } : {}),
      }, signal),
    push: (path, opts, signal) =>
      call('push', { path, ...(opts?.forceWithLease === true ? { forceWithLease: true } : {}) }, signal),
    suggestCommitMessage: (path, signal) => call('suggestCommitMessage', { path }, signal),
    log: (path, opts, signal) =>
      call('log', {
        path,
        ...(opts?.refRange !== undefined ? { refRange: opts.refRange } : {}),
        ...(opts?.file !== undefined ? { file: opts.file } : {}),
        ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
      }, signal),
    showCommit: (path, hash, signal) => call('showCommit', { path, hash }, signal),
    compare: (path, ref, signal) => call('compare', { path, ref }, signal),
    blame: (path, file, signal) => call('blame', { path, file }, signal),
    applyPatch: (path, patch, opts, signal) =>
      call('applyPatch', {
        path,
        patch,
        ...(opts?.cached === true ? { cached: true } : {}),
        ...(opts?.reverse === true ? { reverse: true } : {}),
      }, signal),
  }
}
