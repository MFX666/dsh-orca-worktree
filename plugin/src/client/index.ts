/**
 * dsh-worktree-plugin — browser half.
 *
 * Overrides `sidebar.workspaces` at `priority: -1` with `OrcaSidebar`
 * (1:1 Orca repository -> worktree branch -> conversation tree), and
 * enriches the shared `workspace` context menu with fast, cached worktree
 * actions (<10ms resolution, never hitting the 1000ms menu timeout).
 * @module dsh-worktree-plugin/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { WorktreeOverviewValue, WorktreeRow } from '../protocol.ts'
import { createWorktreeApi, type WorktreeApi } from './api.ts'
import { IconCreate, IconRemove } from './icons.tsx'
import { OrcaSidebar } from './OrcaSidebar.tsx'
import { injectStyles, removeStyles } from './styles.ts'
import { en, NS, type WorktreeKey, zh } from './locales.ts'

export const inject = ['slots', 'connection', 'locale', 'uiWorkspace', 'workspaces', 'contextMenus']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    worktreeManager: WorktreeKey
  }
}

interface MenuAction {
  id: string
  label: string
  icon?: { key: string }
  danger?: boolean
  separatorBefore?: boolean
  run?: () => unknown
}

interface ContextMenusFace {
  register(input: {
    id: string
    target: string
    order: number
    resolve(
      value: { workspaceId?: string; path?: string; displayTitle?: string },
      signal: AbortSignal,
    ): readonly MenuAction[] | Promise<readonly MenuAction[]>
  }): () => void
  open(
    target: { kind: string; value: Record<string, unknown> },
    point: { x: number; y: number },
  ): void
  notify(text: string, success?: boolean): void
}

interface UiWorkspaceFace {
  openSession(sessionId: string): void
  startSession(workspaceId?: string): void
  pickDirectory(): Promise<string | null>
}

interface WorkspacesFace {
  create(input: { path: string }): Promise<{ workspaceId: string }>
}

interface SlotsFace {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: unknown): unknown
}

type ServiceEventFace = { on(name: 'internal/service', listener: (name: string) => void): () => void }

const ICON_CREATE = 'worktreeManager.create'
const ICON_REMOVE = 'worktreeManager.remove'

export function apply(ctx: ClientContext): void {
  injectStyles()
  ctx.effect(() => () => { removeStyles() }, 'worktree-manager: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'worktree-manager: dictionaries')

  const api: WorktreeApi = createWorktreeApi(ctx)
  const t = ctx.locale.bind(NS)
  const slots = (ctx as unknown as { slots: SlotsFace }).slots
  const uiWorkspace = (ctx as unknown as { uiWorkspace: UiWorkspaceFace }).uiWorkspace
  const workspaces = (ctx as unknown as { workspaces: WorkspacesFace }).workspaces

  // Fast cache so right-click / "..." context menus resolve immediately without git status timeout.
  let cachedOverview: WorktreeOverviewValue | null = null
  const getFastOverview = async (signal?: AbortSignal): Promise<WorktreeOverviewValue | null> => {
    try {
      cachedOverview = await api.overview(false, signal)
      return cachedOverview
    } catch {
      return cachedOverview
    }
  }

  const getMenus = (): ContextMenusFace | undefined => {
    const getter = (ctx as unknown as { get?: (name: string) => unknown }).get
    if (typeof getter === 'function') return getter.call(ctx, 'contextMenus') as ContextMenusFace | undefined
    return (ctx as unknown as { contextMenus?: ContextMenusFace }).contextMenus
  }

  const pickAndAddWorkspace = async (): Promise<void> => {
    const picked = await uiWorkspace.pickDirectory()
    if (picked === null) return
    const ws = await workspaces.create({ path: picked })
    uiWorkspace.startSession(ws.workspaceId)
  }

  // Override `sidebar.workspaces` at priority -1 (do NOT re-declare ui-workspace's child slots!).
  slots.inject('sidebar.workspaces', () =>
    slots.register(
      {
        name: 'sidebar.workspaces',
        priority: -1,
        locale: NS,
        inject: () => ({
          api,
          openSession: (sessionId: string) => { uiWorkspace.openSession(sessionId) },
          startSession: (workspaceId?: string) => { uiWorkspace.startSession(workspaceId) },
          pickAndAddWorkspace,
          openWorkspaceMenu: (
            workspaceId: string | undefined,
            path: string,
            displayTitle: string,
            point: { x: number; y: number },
          ) => {
            getMenus()?.open(
              {
                kind: 'workspace',
                value: {
                  ...(workspaceId !== undefined ? { workspaceId } : { workspaceId: '' }),
                  path,
                  displayTitle,
                },
              },
              point,
            )
          },
          openSessionMenu: (sessionId: string, displayTitle: string, point: { x: number; y: number }) => {
            getMenus()?.open(
              {
                kind: 'session',
                value: { sessionId, displayTitle },
              },
              point,
            )
          },
        }),
      },
      OrcaSidebar,
    ),
  )

  for (const [key, icon] of [
    [ICON_CREATE, IconCreate],
    [ICON_REMOVE, IconRemove],
  ] as const) {
    slots.inject('contextMenu.icon', () => slots.register({ name: 'contextMenu.icon', key }, icon))
  }

  const registerMenu = (menus: ContextMenusFace): void => {
    ctx.effect(
      () =>
        menus.register({
          id: 'worktree-manager.workspace',
          target: 'workspace',
          order: 400,
          resolve: async ({ path }, signal) => {
            if (path === undefined || path.length === 0) return []
            const data = await getFastOverview(signal)
            if (data === null) return []

            const norm = path.length > 1 ? path.replace(/\/+$/, '') : path
            let matchedRepoRoot: string | undefined
            let matchedRow: WorktreeRow | undefined

            for (const repo of data.repos) {
              for (const item of repo.rows) {
                const itemNorm = item.path.length > 1 ? item.path.replace(/\/+$/, '') : item.path
                if (norm !== itemNorm && !norm.startsWith(`${itemNorm}/`)) continue
                if (matchedRow === undefined || itemNorm.length > matchedRow.path.length) {
                  matchedRow = item
                  matchedRepoRoot = repo.repositoryRoot
                }
              }
            }
            if (matchedRow === undefined || matchedRepoRoot === undefined) return []

            const row = matchedRow
            const repoRoot = matchedRepoRoot
            const repoRows = data.repos.find(r => r.repositoryRoot === repoRoot)?.rows ?? []
            const childCount = repoRows.filter(item => item.parentPath === row.path).length

            const actions: MenuAction[] = [
              {
                id: 'newChat',
                label: t('menu.newChat'),
                icon: { key: ICON_CREATE },
                separatorBefore: true,
                run: () => {
                  window.dispatchEvent(new CustomEvent('dsh-worktree:new-chat', { detail: { row } }))
                },
              },
              {
                id: 'create',
                label: t('menu.create'),
                icon: { key: ICON_CREATE },
                run: () => {
                  window.dispatchEvent(
                    new CustomEvent('dsh-worktree:open-create', {
                      detail: { repositoryRoot: repoRoot },
                    }),
                  )
                },
              },
              {
                id: 'createChild',
                label: t('menu.createChild'),
                icon: { key: ICON_CREATE },
                run: () => {
                  window.dispatchEvent(
                    new CustomEvent('dsh-worktree:open-create', {
                      detail: {
                        repositoryRoot: repoRoot,
                        parentPath: row.path,
                        parentBranch: row.branch,
                      },
                    }),
                  )
                },
              },
              {
                id: 'pin',
                label: row.pinned ? t('menu.unpin') : t('menu.pin'),
                run: () =>
                  api.setPinned(row.path, !row.pinned).then(() => {
                    window.dispatchEvent(new CustomEvent('dsh-worktree:refresh'))
                  }),
              },
              {
                id: 'copyPath',
                label: t('menu.copyPath'),
                run: () =>
                  navigator.clipboard?.writeText(row.path).then(() => {
                    menus.notify(t('notice.copied'), true)
                  }),
              },
            ]

            if (row.kind === 'managed') {
              actions.push({
                id: 'remove',
                label: t('menu.remove'),
                icon: { key: ICON_REMOVE },
                danger: true,
                separatorBefore: true,
                run: async () => {
                  // Fetch fresh dirty count right when opening the confirmation dialog.
                  let freshRow = row
                  try {
                    const st = await api.status(row.path)
                    freshRow = { ...row, dirtyCount: st.dirtyCount }
                  } catch {
                    // Keep cached row if status check fails.
                  }
                  window.dispatchEvent(
                    new CustomEvent('dsh-worktree:open-remove', {
                      detail: { row: freshRow, childCount },
                    }),
                  )
                },
              })
            }
            return actions
          },
        }),
      'worktree-manager: workspace context menu',
    )
  }

  const initialMenus = getMenus()
  if (initialMenus !== undefined) {
    registerMenu(initialMenus)
    return
  }
  const host = ctx as unknown as ServiceEventFace
  if (typeof host.on !== 'function') return
  const off = host.on('internal/service', (name: string) => {
    if (name !== 'contextMenus') return
    const menus = getMenus()
    if (menus === undefined) return
    off()
    registerMenu(menus)
  })
}
