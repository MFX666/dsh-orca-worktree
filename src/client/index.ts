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
import { ArchivedSessionsSection } from './ArchivedSessionsSection.tsx'
import { IconCreate, IconRemove } from './icons.tsx'
import { OrcaSidebar } from './OrcaSidebar.tsx'
import { CommitPanel } from './GitPanel.tsx'
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
  unarchiveSession?(sessionId: string): Promise<void>
}

interface WorkspacesFace {
  create(input: { path: string }): Promise<{ workspaceId: string }>
  rename(workspaceId: string, title: string): Promise<unknown>
  delete(workspaceId: string): Promise<void>
  unarchiveSession?(sessionId: string): Promise<void>
}

interface SlotsFace {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: unknown): unknown
}

type ServiceEventFace = { on(name: 'internal/service', listener: (name: string) => void): () => void }

const ICON_CREATE = 'worktreeManager.create'
const ICON_REMOVE = 'worktreeManager.remove'
const MENU_TARGET_WORKSPACE = 'worktreeManager.workspace'

export function apply(ctx: ClientContext): void {
  injectStyles()
  ctx.effect(() => () => { removeStyles() }, 'worktree-manager: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'worktree-manager: dictionaries')

  const api: WorktreeApi = createWorktreeApi(ctx)
  const t = ctx.locale.bind(NS)
  const slots = (ctx as unknown as { slots: SlotsFace }).slots
  const uiWorkspace = (ctx as unknown as { uiWorkspace: UiWorkspaceFace }).uiWorkspace
  const workspaces = (ctx as unknown as { workspaces: WorkspacesFace }).workspaces

  // Git tab (review changes & commit) in the conversation view tab strip, next to 对话 / 轨迹 / AOCI.
  slots.inject('conversation.view', () =>
    slots.register(
      {
        name: 'conversation.view',
        id: 'worktree-git',
        order: 40,
        label: () => t('view.gitTab'),
        locale: NS,
        inject: (sessionId: string) => ({ api, t, sessionId }),
      },
      CommitPanel,
    ),
  )

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
    // `uiWorkspace.startSession` silently no-ops ("unknown workspace" warning)
    // when the client workspaces store has not yet received the just-created
    // workspace, so wait for the store to list it before starting.
    const list = (workspaces as unknown as {
      list?: { getSnapshot?: () => { items?: readonly { workspaceId?: string }[] } }
    }).list
    const listed = (): boolean => {
      const items = list?.getSnapshot?.().items
      return items === undefined || items.some(item => item.workspaceId === ws.workspaceId)
    }
    for (let waited = 0; !listed() && waited < 10_000; waited += 200) {
      await new Promise(resolve => window.setTimeout(resolve, 200))
    }
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
          renameWorkspace: (workspaceId: string, title: string) => workspaces.rename(workspaceId, title),
          deleteWorkspace: (workspaceId: string) => workspaces.delete(workspaceId),
          openWorkspaceMenu: (
            workspaceId: string | undefined,
            path: string,
            displayTitle: string,
            point: { x: number; y: number },
          ) => {
            getMenus()?.open(
              {
                kind: MENU_TARGET_WORKSPACE,
                value: {
                  ...(workspaceId !== undefined ? { workspaceId } : {}),
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

  // Register `已归档会话` (`id: "archived-sessions"`) in the Settings modal nav (`settings.section`).
  // Note: `dsh-client-ui-settings-general` natively recognizes `id === "archived-sessions"` with `IconArchiveOutlineMedium`.
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'archived-sessions',
        order: 25,
        label: () => t('archive.nav'),
        locale: NS,
        inject: () => ({
          api,
          unarchiveSession: async (sessionId: string) => {
            if (typeof uiWorkspace.unarchiveSession === 'function') {
              await uiWorkspace.unarchiveSession(sessionId)
            } else if (typeof workspaces.unarchiveSession === 'function') {
              await workspaces.unarchiveSession(sessionId)
            }
          },
          openSession: (sessionId: string) => {
            uiWorkspace.openSession(sessionId)
          },
        }),
      },
      ArchivedSessionsSection,
    ),
  )

  for (const [key, icon] of [
    [ICON_CREATE, IconCreate],
    [ICON_REMOVE, IconRemove],
  ] as const) {
    slots.inject('contextMenu.icon', () => slots.register({ name: 'contextMenu.icon', key }, icon))
  }

  const registerMenu = (menus: ContextMenusFace): void => {
    const buildActions = async (
      {
        workspaceId,
        path,
        displayTitle,
        includeWorkspaceCrud,
      }: { workspaceId?: string; path?: string; displayTitle?: string; includeWorkspaceCrud: boolean },
      signal: AbortSignal,
    ): Promise<readonly MenuAction[]> => {
      if (path === undefined || path.length === 0) return []
      const data = await getFastOverview(signal)

      const norm = path.length > 1 ? path.replace(/\/+$/, '') : path
      let matchedRepoRoot: string | undefined
      let matchedRow: WorktreeRow | undefined

      if (data !== null) {
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
      }

      const missingSet = new Set((data?.missingPaths ?? []).map(p => (p.length > 1 ? p.replace(/\/+$/, '') : p)))
      const isMissing = missingSet.has(norm)
      const actions: MenuAction[] = []

      if (matchedRow !== undefined && matchedRepoRoot !== undefined) {
        const row = matchedRow
        const repoRoot = matchedRepoRoot
        const repoRows = data?.repos.find(r => r.repositoryRoot === repoRoot)?.rows ?? []
        const childCount = repoRows.filter(item => item.parentPath === row.path).length

        actions.push(
          {
            id: 'newChat',
            label: t('menu.newChat'),
            icon: { key: ICON_CREATE },
            separatorBefore: !includeWorkspaceCrud,
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
        )

        if (row.kind !== 'main') {
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
      } else if (includeWorkspaceCrud) {
        if (!isMissing && workspaceId) {
          actions.push({
            id: 'newChatFolder',
            label: t('menu.newChat'),
            icon: { key: ICON_CREATE },
            run: () => {
              uiWorkspace.startSession(workspaceId)
            },
          })
        }
        actions.push({
          id: 'copyPath',
          label: t('menu.copyPath'),
          icon: { key: 'workspace.copy' },
          run: () =>
            navigator.clipboard?.writeText(path).then(() => {
              menus.notify(t('notice.copied'), true)
            }),
        })
      }

      // Workspace-level Rename / Remove (replaces stock WorkspaceDialogs which are unmounted when OrcaSidebar is active).
      const hasWsId = typeof workspaceId === 'string' && workspaceId.length > 0
      const isSecondaryCheckout = matchedRow !== undefined && matchedRow.kind !== 'main'
      if (includeWorkspaceCrud && hasWsId && !isSecondaryCheckout) {
        const labelTitle = (displayTitle ?? '').trim() || path
        actions.push({
          id: 'wsRename',
          label: t('menu.renameWorkspace'),
          icon: { key: 'workspace.rename' },
          separatorBefore: actions.length > 0,
          run: () => {
            window.dispatchEvent(
              new CustomEvent('dsh-worktree:open-ws-rename', {
                detail: { workspaceId, path, title: labelTitle },
              }),
            )
          },
        })
        actions.push({
          id: 'wsDelete',
          label: t('menu.deleteWorkspace'),
          icon: { key: 'workspace.delete' },
          danger: true,
          separatorBefore: true,
          run: () => {
            window.dispatchEvent(
              new CustomEvent('dsh-worktree:open-ws-delete', {
                detail: { workspaceId, path, title: labelTitle, missing: isMissing },
              }),
            )
          },
        })
      }

      return actions
    }

    ctx.effect(() => {
      const offSidebarMenu = menus.register({
        id: 'worktree-manager.sidebar-workspace',
        target: MENU_TARGET_WORKSPACE,
        order: 100,
        resolve: (val, signal) => buildActions({ ...val, includeWorkspaceCrud: true }, signal),
      })
      const offSharedMenu = menus.register({
        id: 'worktree-manager.workspace',
        target: 'workspace',
        order: 400,
        resolve: (val, signal) => buildActions({ ...val, includeWorkspaceCrud: false }, signal),
      })
      return () => {
        offSidebarMenu()
        offSharedMenu()
      }
    }, 'worktree-manager: workspace context menu')
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
