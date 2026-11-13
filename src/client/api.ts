/**
 * Browser-side client of `rWorktreeManager`. All parameters are plain JSON
 * (session-independent), so every verb works whether or not a Session is open.
 * @module dsh-worktree-plugin/client/api
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  WorktreeApplyPatchValue,
  WorktreeArchivedMetaValue,
  WorktreeBlameValue,
  WorktreeBranchesValue,
  WorktreeCommitDetailValue,
  WorktreeCommitValue,
  WorktreeCompareValue,
  WorktreeCreateValue,
  WorktreeDiffValue,
  WorktreeEnsureWorkspaceValue,
  WorktreeEnvelope,
  WorktreeHunkPatch,
  WorktreeLogValue,
  WorktreeOverviewValue,
  WorktreePinValue,
  WorktreePushValue,
  WorktreeRemoveValue,
  WorktreeStatusValue,
  WorktreeSuggestMessageValue,
} from '../protocol.ts'

export interface WorktreeApi {
  overview(includeDirty?: boolean, signal?: AbortSignal): Promise<WorktreeOverviewValue>
  archivedMeta(signal?: AbortSignal): Promise<WorktreeArchivedMetaValue>
  branches(repositoryRoot: string, refresh?: boolean, signal?: AbortSignal): Promise<WorktreeBranchesValue>
  create(
    input: { repositoryRoot: string; name?: string; from?: string; parentPath?: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCreateValue>
  ensureWorkspace(path: string, title?: string, signal?: AbortSignal): Promise<WorktreeEnsureWorkspaceValue>
  setPinned(path: string, pinned: boolean, signal?: AbortSignal): Promise<WorktreePinValue>
  remove(path: string, force: boolean, deleteRemote?: boolean, signal?: AbortSignal): Promise<WorktreeRemoveValue>
  status(path: string, signal?: AbortSignal): Promise<WorktreeStatusValue>
  diff(path: string, signal?: AbortSignal, file?: string, ignoreWhitespace?: boolean): Promise<WorktreeDiffValue>
  commit(
    path: string,
    message: string,
    files: readonly string[],
    opts?: { hunks?: readonly WorktreeHunkPatch[] },
    signal?: AbortSignal,
  ): Promise<WorktreeCommitValue>
  push(path: string, opts?: { forceWithLease?: boolean }, signal?: AbortSignal): Promise<WorktreePushValue>
  suggestCommitMessage(path: string, signal?: AbortSignal): Promise<WorktreeSuggestMessageValue>
  log(
    path: string,
    opts?: { refRange?: string; file?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<WorktreeLogValue>
  showCommit(path: string, hash: string, signal?: AbortSignal): Promise<WorktreeCommitDetailValue>
  compare(path: string, ref: string, signal?: AbortSignal): Promise<WorktreeCompareValue>
  blame(path: string, file: string, signal?: AbortSignal): Promise<WorktreeBlameValue>
  applyPatch(
    path: string,
    patch: string,
    opts?: { cached?: boolean; reverse?: boolean },
    signal?: AbortSignal,
  ): Promise<WorktreeApplyPatchValue>
}

const NAMESPACE = 'rWorktreeManager'

type TransportResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { code?: unknown; message?: unknown } }

export function createWorktreeApi(ctx: ClientContext): WorktreeApi {
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
      WorktreeEnvelope<T>
    >
    if (!result.ok) {
      throw new Error(typeof result.error?.message === 'string' ? result.error.message : `${NAMESPACE}/${method} failed`)
    }
    if (!result.value.ok) throw new Error(result.value.message)
    return result.value.value
  }

  return {
    overview: (includeDirty = false, signal) => call('overview', { includeDirty }, signal),
    archivedMeta: signal => call('archivedMeta', {}, signal),
    branches: (repositoryRoot, refresh = false, signal) => call('branches', { repositoryRoot, refresh }, signal),
    create: ({ repositoryRoot, name, from, parentPath }, signal) =>
      call('create', { repositoryRoot, name, from, parentPath }, signal),
    ensureWorkspace: (path, title, signal) => call('ensureWorkspace', { path, title }, signal),
    setPinned: (path, pinned, signal) => call('setPinned', { path, pinned }, signal),
    remove: (path, force, deleteRemote, signal) => call('remove', { path, force, deleteRemote }, signal),
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
