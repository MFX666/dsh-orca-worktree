/**
 * Browser-side client of `rWorktreeManager`. All parameters are plain JSON
 * (session-independent), so every verb works whether or not a Session is open.
 * @module dsh-worktree-plugin/client/api
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  WorktreeArchivedMetaValue,
  WorktreeBranchesValue,
  WorktreeCreateValue,
  WorktreeEnsureWorkspaceValue,
  WorktreeEnvelope,
  WorktreeOverviewValue,
  WorktreePinValue,
  WorktreeRemoveValue,
  WorktreeStatusValue,
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
  }
}
