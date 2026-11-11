/**
 * Orca-style left sidebar tree overriding `sidebar.workspaces` at priority -1.
 *
 * Hierarchy:
 * 1. Git Repository Group (`📁 repo-name` + hover `⌄ ••• +`)
 *    └── Worktree Branch Row (`● branch_name` + `[chats]` + `★` + hover `+ •••`)
 *          ├── Expandable Conversation sub-rows (when multi-chat or toggled)
 *          └── Orca Lineage Capsule (`[ ⑂ N | ● running ● idle ⌄ ]`)
 *                └── Indented Child Worktree Rows (18px per level)
 * 2. Non-Git Folder Workspaces (registered folders that are not Git checkouts)
 * 3. Ungrouped Sessions (fallback so zero conversations are ever stranded)
 * @module dsh-worktree-plugin/client/OrcaSidebar
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { WorktreeBranchesValue, WorktreeOverviewValue, WorktreeRepoGroup, WorktreeRow } from '../protocol.ts'
import type { WorktreeApi } from './api.ts'
import {
  IconChat,
  IconChevron,
  IconDots,
  IconFolder,
  IconLineage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStar,
} from './icons.tsx'
import { TREE_INDENT_PX } from './styles.ts'

type Translate = (key: string, params?: Record<string, string | number>) => string

export interface SessionSummaryLike {
  readonly id: string
  readonly title?: string
  readonly displayTitle?: string
  readonly blank?: boolean
  readonly origin?: string
  readonly running?: boolean
  readonly updatedAt?: number
  readonly cwd?: string
  readonly retainedBy?: { readonly mainView?: number }
}

export interface SessionListSnapshotLike {
  readonly phase?: string
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummaryLike | undefined>>
}

export interface SessionStatusEntryLike {
  readonly running?: boolean
  readonly pendingInteraction?: { readonly kind?: string }
  readonly completionUnread?: boolean
}

export interface WorkspaceViewLike {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

export interface WorkspaceListSnapshotLike {
  readonly phase?: string
  readonly items: readonly WorkspaceViewLike[]
  readonly archivedSessionIds: readonly string[]
  readonly pinnedSessionIds: readonly string[]
}

export interface OrcaSidebarProps {
  /** Owner share supplied by `ui-sidebar`. */
  wide?: boolean
  expandSidebar?: () => void
  /** Standard framework root hooks provided by `ui-session`, `ui-workspace`, `ui-layout`. */
  useSessions: <R>(selector: (state: SessionListSnapshotLike) => R) => R
  useSessionStatus: <R>(selector: (state: ReadonlyMap<string, SessionStatusEntryLike>) => R) => R
  useWorkspaces: <R>(selector: (state: WorkspaceListSnapshotLike) => R) => R
  usePanelInfo?: <R>(selector: (info: { activePanelId: string | null }) => R) => R
  /** Locale seat from `locale: NS`. */
  t: Translate
  /** Injected plugin callbacks from `client/index.ts`. */
  api: WorktreeApi
  openSession: (sessionId: string) => void
  startSession: (workspaceId?: string) => void
  pickAndAddWorkspace: () => Promise<void>
  openWorkspaceMenu: (workspaceId: string | undefined, path: string, title: string, point: { x: number; y: number }) => void
  openSessionMenu: (sessionId: string, displayTitle: string, point: { x: number; y: number }) => void
}

interface CreateDialogState {
  repositoryRoot: string
  parentPath?: string
  parentBranch?: string
}

interface RemoveDialogState {
  row: WorktreeRow
  childCount: number
}

interface ToastNotice {
  kind: 'info' | 'error'
  text: string
}

const STORAGE_COLLAPSED_REPOS = 'dsh.orcaWorktree.collapsedRepos.v1'
const STORAGE_COLLAPSED_LINEAGE = 'dsh.orcaWorktree.collapsedLineage.v1'
const STORAGE_EXPANDED_CHATS = 'dsh.orcaWorktree.expandedChats.v1'

function loadStoredSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    // Ignore storage unavailability.
  }
  return new Set()
}

function saveStoredSet(key: string, values: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]))
  } catch {
    // Ignore storage unavailability.
  }
}

function normalizePath(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

function sessionLabel(s: SessionSummaryLike, t: Translate): string {
  if (s.blank) return t('wt.unnamedChat')
  const text = (s.displayTitle ?? s.title ?? '').trim()
  return text.length > 0 ? text : t('wt.untitledChat')
}

export function OrcaSidebar(props: OrcaSidebarProps): ReactElement {
  const { wide = true, t, api } = props
  const sessionList = props.useSessions(s => s)
  const sessionStatuses = props.useSessionStatus(s => s)
  const workspaceSnap = props.useWorkspaces(s => s)
  const panelActive = props.usePanelInfo !== undefined ? props.usePanelInfo(i => i.activePanelId !== null) : false

  const [overview, setOverview] = useState<WorktreeOverviewValue | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsedRepos, setCollapsedRepos] = useState<ReadonlySet<string>>(() => loadStoredSet(STORAGE_COLLAPSED_REPOS))
  const [collapsedLineage, setCollapsedLineage] = useState<ReadonlySet<string>>(() => loadStoredSet(STORAGE_COLLAPSED_LINEAGE))
  const [expandedChats, setExpandedChats] = useState<ReadonlySet<string>>(() => loadStoredSet(STORAGE_EXPANDED_CHATS))
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null)
  const [branchDraft, setBranchDraft] = useState('')
  const [fromDraft, setFromDraft] = useState('')
  const [branchOptions, setBranchOptions] = useState<WorktreeBranchesValue | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [fetchingBranches, setFetchingBranches] = useState(false)
  const [staleHostHint, setStaleHostHint] = useState(false)
  const [removeDialog, setRemoveDialog] = useState<RemoveDialogState | null>(null)
  const [forceRemove, setForceRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastNotice | null>(null)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const composingRef = useRef(false)
  const userPickedFromRef = useRef(false)
  const overviewRef = useRef<WorktreeOverviewValue | null>(null)
  overviewRef.current = overview

  const showToast = useCallback((kind: 'info' | 'error', text: string) => {
    setToast({ kind, text })
  }, [])

  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => { setToast(null) }, 3500)
    return () => { window.clearTimeout(timer) }
  }, [toast])

  // Refresh git worktree overview whenever registered workspaces change or periodically.
  const workspaceSignature = useMemo(
    () => workspaceSnap.items.map(item => `${item.workspaceId}:${item.path}:${item.title}`).join('|'),
    [workspaceSnap.items],
  )

  const refreshOverview = useCallback(
    async (includeDirty = false, signal?: AbortSignal) => {
      try {
        const next = await api.overview(includeDirty, signal)
        if (!signal?.aborted) setOverview(next)
      } catch (error) {
        if (!signal?.aborted) {
          showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
        }
      }
    },
    [api, showToast, t],
  )

  useEffect(() => {
    const controller = new AbortController()
    // Fast initial paint without git status, followed by dirty-count enrichment.
    void refreshOverview(false, controller.signal).then(() => {
      if (!controller.signal.aborted) void refreshOverview(true, controller.signal)
    })
    const timer = window.setInterval(() => {
      void refreshOverview(true, controller.signal)
    }, 12_000)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [refreshOverview, workspaceSignature])

  // Load remote & local branches whenever Create Worktree dialog opens.
  useEffect(() => {
    if (createDialog === null) {
      setBranchOptions(null)
      setLoadingBranches(false)
      setFetchingBranches(false)
      setStaleHostHint(false)
      return
    }
    userPickedFromRef.current = false
    setStaleHostHint(false)
    const childSeed =
      createDialog.parentBranch !== undefined
        ? createDialog.parentBranch.startsWith('detached')
          ? 'HEAD'
          : createDialog.parentBranch
        : ''
    setFromDraft(childSeed)
    const controller = new AbortController()
    setLoadingBranches(true)
    void api
      .branches(createDialog.repositoryRoot, false, controller.signal)
      .then(res => {
        if (controller.signal.aborted) return
        setStaleHostHint(false)
        setBranchOptions(res)
        if (!userPickedFromRef.current) {
          if (childSeed !== '' && (childSeed === 'HEAD' || res.localBranches.includes(childSeed) || res.remoteBranches.includes(childSeed))) {
            setFromDraft(childSeed)
          } else {
            setFromDraft(res.defaultBase)
          }
        }
      })
      .catch(error => {
        if (controller.signal.aborted) return
        const msg = error instanceof Error ? error.message : String(error)
        const isStaleHost = msg.includes('no active Remote method')
        const repo = overviewRef.current?.repos.find(r => r.repositoryRoot === createDialog.repositoryRoot)
        const fallbackLocals = Array.from(
          new Set((repo?.rows ?? []).map(r => r.branch).filter(b => b.length > 0 && !b.startsWith('detached'))),
        )
        const fallbackBase = childSeed || fallbackLocals[0] || 'HEAD'
        setBranchOptions({ remoteBranches: [], localBranches: fallbackLocals, defaultBase: fallbackBase })
        if (!userPickedFromRef.current) setFromDraft(fallbackBase)
        if (isStaleHost) {
          // shortcut: client HMR reloads client.js immediately while host index.js stays cached until DSH restarts
          setStaleHostHint(true)
        } else {
          showToast('error', t('notice.error', { message: msg }))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBranches(false)
      })
    return () => { controller.abort() }
  }, [api, createDialog, showToast, t])

  const handleFetchBranches = useCallback(async () => {
    if (createDialog === null || fetchingBranches || busy) return
    setFetchingBranches(true)
    try {
      const res = await api.branches(createDialog.repositoryRoot, true)
      setStaleHostHint(false)
      setBranchOptions(res)
      setFromDraft(prev =>
        prev !== '' && (prev === 'HEAD' || res.remoteBranches.includes(prev) || res.localBranches.includes(prev))
          ? prev
          : res.defaultBase,
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('no active Remote method')) {
        setStaleHostHint(true)
        showToast('error', t('dialog.create.restartHint'))
      } else {
        showToast('error', t('notice.error', { message: msg }))
      }
    } finally {
      setFetchingBranches(false)
    }
  }, [api, busy, createDialog, fetchingBranches, showToast, t])

  // Modal Escape listener.
  useEffect(() => {
    if (createDialog === null && removeDialog === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setCreateDialog(null)
        setRemoveDialog(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [createDialog, removeDialog, busy])

  const activeSessionId = useMemo(() => {
    if (panelActive) return undefined
    for (const id of sessionList.ids) {
      const s = sessionList.byId[id]
      if (s !== undefined && (s.retainedBy?.mainView ?? 0) > 0) return s.id
    }
    return undefined
  }, [panelActive, sessionList])

  const archivedSet = useMemo(() => new Set(workspaceSnap.archivedSessionIds), [workspaceSnap.archivedSessionIds])
  const pinnedSessionSet = useMemo(() => new Set(workspaceSnap.pinnedSessionIds), [workspaceSnap.pinnedSessionIds])

  const visibleSessions = useMemo(() => {
    const list: SessionSummaryLike[] = []
    for (const id of sessionList.ids) {
      const s = sessionList.byId[id]
      if (s === undefined) continue
      if (s.origin === 'subagent') continue
      if (archivedSet.has(s.id)) continue
      if (s.blank && s.id !== activeSessionId) continue
      list.push(s)
    }
    list.sort((a, b) => {
      if (a.blank && !b.blank) return -1
      if (!a.blank && b.blank) return 1
      const aPin = pinnedSessionSet.has(a.id)
      const bPin = pinnedSessionSet.has(b.id)
      if (aPin !== bPin) return aPin ? -1 : 1
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
    return list
  }, [sessionList, archivedSet, activeSessionId, pinnedSessionSet])

  // Assign each visible Session to its deepest matching checkout/workspace path (or workspaceId).
  const { sessionsByPath, ungroupedSessions } = useMemo(() => {
    const byWsId = new Map<string, string>()
    for (const ws of workspaceSnap.items) byWsId.set(ws.workspaceId, normalizePath(ws.path))

    const allKnownPaths: string[] = []
    const seen = new Set<string>()
    for (const repo of overview?.repos ?? []) {
      for (const row of repo.rows) {
        const p = normalizePath(row.path)
        if (!seen.has(p)) { seen.add(p); allKnownPaths.push(p) }
      }
    }
    for (const ws of workspaceSnap.items) {
      const p = normalizePath(ws.path)
      if (!seen.has(p)) { seen.add(p); allKnownPaths.push(p) }
    }
    // Deepest path first so a pool worktree wins over its parent `<repo>`!
    allKnownPaths.sort((a, b) => b.length - a.length)

    const sessionExplicitWsPath = new Map<string, string>()
    for (const ws of workspaceSnap.items) {
      const wsPath = normalizePath(ws.path)
      for (const sid of ws.sessionIds) sessionExplicitWsPath.set(sid, wsPath)
    }

    const bucket = new Map<string, SessionSummaryLike[]>()
    const loose: SessionSummaryLike[] = []

    for (const s of visibleSessions) {
      const cwdNorm = s.cwd !== undefined && s.cwd.length > 0 ? normalizePath(s.cwd) : undefined
      let matchedPath: string | undefined
      if (cwdNorm !== undefined) {
        matchedPath = allKnownPaths.find(candidate => cwdNorm === candidate || cwdNorm.startsWith(`${candidate}/`))
      }
      if (matchedPath === undefined) {
        matchedPath = sessionExplicitWsPath.get(s.id)
      }
      if (matchedPath !== undefined && seen.has(matchedPath)) {
        const arr = bucket.get(matchedPath) ?? []
        arr.push(s)
        bucket.set(matchedPath, arr)
      } else {
        loose.push(s)
      }
    }
    return { sessionsByPath: bucket, ungroupedSessions: loose }
  }, [overview, workspaceSnap.items, visibleSessions])

  const nonGitWorkspaces = useMemo(() => {
    const claimed = new Set((overview?.claimedPaths ?? []).map(normalizePath))
    for (const repo of overview?.repos ?? []) {
      claimed.add(normalizePath(repo.repositoryRoot))
      for (const row of repo.rows) claimed.add(normalizePath(row.path))
    }
    return workspaceSnap.items.filter(ws => !claimed.has(normalizePath(ws.path)))
  }, [overview, workspaceSnap.items])

  const toggleSetItem = (
    setter: (updater: (prev: ReadonlySet<string>) => ReadonlySet<string>) => void,
    storageKey: string,
    itemKey: string,
  ) => {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(itemKey)) next.delete(itemKey)
      else next.add(itemKey)
      saveStoredSet(storageKey, next)
      return next
    })
  }

  /** Click a worktree branch row: open its active/latest conversation, or start one inside it. */
  const activateWorktreeChat = useCallback(
    async (row: WorktreeRow) => {
      const norm = normalizePath(row.path)
      const chats = sessionsByPath.get(norm) ?? []
      const currentInRow = chats.find(c => c.id === activeSessionId)
      if (currentInRow !== undefined) {
        // Already viewing a chat in this worktree: toggle multi-chat drawer when >1 chat exists.
        if (chats.length > 1) {
          toggleSetItem(setExpandedChats, STORAGE_EXPANDED_CHATS, norm)
        }
        return
      }
      if (chats.length > 0) {
        props.openSession(chats[0]!.id)
        return
      }
      try {
        const wsId =
          row.workspaceId ?? (await api.ensureWorkspace(row.path, row.displayName ?? row.branch)).workspaceId
        props.startSession(wsId)
      } catch (error) {
        showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
      }
    },
    [activeSessionId, api, props, sessionsByPath, showToast, t],
  )

  /** Start a brand-new conversation inside `row.path`. */
  const startNewChatInWorktree = useCallback(
    async (row: WorktreeRow, event?: MouseEvent) => {
      event?.stopPropagation()
      const norm = normalizePath(row.path)
      try {
        const wsId =
          row.workspaceId ?? (await api.ensureWorkspace(row.path, row.displayName ?? row.branch)).workspaceId
        setExpandedChats(prev => {
          const next = new Set(prev)
          next.add(norm)
          saveStoredSet(STORAGE_EXPANDED_CHATS, next)
          return next
        })
        props.startSession(wsId)
      } catch (error) {
        showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
      }
    },
    [api, props, showToast, t],
  )

  const handleTogglePin = useCallback(
    async (row: WorktreeRow, event: MouseEvent) => {
      event.stopPropagation()
      try {
        await api.setPinned(row.path, !row.pinned)
        await refreshOverview(true)
      } catch (error) {
        showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
      }
    },
    [api, refreshOverview, showToast, t],
  )

  const submitCreateWorktree = useCallback(async () => {
    if (createDialog === null || busy) return
    setBusy(true)
    try {
      const created = await api.create({
        repositoryRoot: createDialog.repositoryRoot,
        name: branchDraft.trim() || undefined,
        from: fromDraft.trim() || undefined,
        parentPath: createDialog.parentPath,
      })
      setCreateDialog(null)
      setBranchDraft('')
      setFromDraft('')
      showToast('info', t('notice.created', { branch: created.branch }))
      await refreshOverview(true)
      if (created.workspaceId !== undefined) {
        props.startSession(created.workspaceId)
      }
    } catch (error) {
      showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setBusy(false)
    }
  }, [api, branchDraft, busy, createDialog, fromDraft, props, refreshOverview, showToast, t])

  const submitRemoveWorktree = useCallback(async () => {
    if (removeDialog === null || busy) return
    const { row, childCount } = removeDialog
    const needsForce = row.dirtyCount > 0 || childCount > 0
    if (needsForce && !forceRemove) return
    setBusy(true)
    try {
      const removed = await api.remove(row.path, forceRemove || !needsForce ? forceRemove : false)
      setRemoveDialog(null)
      setForceRemove(false)
      const msg = `${t('notice.removed', { path: row.branch })}${removed.branchPreserved ? ` ${t('notice.preserved')}` : ''}`
      showToast('info', msg)
      await refreshOverview(true)
    } catch (error) {
      showToast('error', t('notice.error', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setBusy(false)
    }
  }, [api, busy, forceRemove, refreshOverview, removeDialog, showToast, t])

  const sessionStateKind = useCallback(
    (s: SessionSummaryLike): 'running' | 'pending' | 'idle' => {
      const live = sessionStatuses.get(s.id)
      if (live?.pendingInteraction?.kind !== undefined) return 'pending'
      if ((live?.running ?? s.running) === true) return 'running'
      return 'idle'
    },
    [sessionStatuses],
  )

  const worktreeStateKind = useCallback(
    (path: string): 'running' | 'pending' | 'idle' => {
      const chats = sessionsByPath.get(normalizePath(path)) ?? []
      let hasRunning = false
      for (const c of chats) {
        const kind = sessionStateKind(c)
        if (kind === 'pending') return 'pending'
        if (kind === 'running') hasRunning = true
      }
      return hasRunning ? 'running' : 'idle'
    },
    [sessionStateKind, sessionsByPath],
  )

  const normalizedQuery = query.trim().toLowerCase()

  // Collapsed sidebar rail mode (56px column).
  if (!wide) {
    return (
      <div className="owt-rail">
        <button
          type="button"
          className="owt-icon-btn"
          aria-label={t('header.search')}
          title={t('header.search')}
          onClick={() => {
            setSearchOpen(true)
            props.expandSidebar?.()
            window.setTimeout(() => { searchInputRef.current?.focus() }, 180)
          }}
        >
          <IconSearch size={16} />
        </button>
        <button
          type="button"
          className="owt-icon-btn"
          aria-label={t('header.addRepo')}
          title={t('header.addRepo')}
          onClick={() => { void props.pickAndAddWorkspace() }}
        >
          <IconPlus size={16} />
        </button>
      </div>
    )
  }

  const renderRepo = (repo: WorktreeRepoGroup): ReactElement | null => {
    const byPath = new Map<string, WorktreeRow>()
    for (const row of repo.rows) byPath.set(normalizePath(row.path), row)

    const matchesRow = (row: WorktreeRow): boolean => {
      if (normalizedQuery === '') return true
      if ((row.displayName ?? row.branch).toLowerCase().includes(normalizedQuery)) return true
      if (repo.name.toLowerCase().includes(normalizedQuery)) return true
      const chats = sessionsByPath.get(normalizePath(row.path)) ?? []
      return chats.some(c => sessionLabel(c, t).toLowerCase().includes(normalizedQuery))
    }

    const childrenMap = new Map<string, WorktreeRow[]>()
    for (const row of repo.rows) {
      const parentNorm = row.parentPath !== undefined ? normalizePath(row.parentPath) : undefined
      if (parentNorm !== undefined && parentNorm !== normalizePath(row.path) && byPath.has(parentNorm)) {
        const list = childrenMap.get(parentNorm) ?? []
        list.push(row)
        childrenMap.set(parentNorm, list)
      }
    }

    const subtreeVisible = (row: WorktreeRow): boolean => {
      if (matchesRow(row)) return true
      const kids = childrenMap.get(normalizePath(row.path)) ?? []
      return kids.some(subtreeVisible)
    }

    const roots = repo.rows.filter(row => {
      const parentNorm = row.parentPath !== undefined ? normalizePath(row.parentPath) : undefined
      const isRoot = parentNorm === undefined || parentNorm === normalizePath(row.path) || !byPath.has(parentNorm)
      return isRoot && subtreeVisible(row)
    })

    if (normalizedQuery !== '' && roots.length === 0) return null
    const repoCollapsed = normalizedQuery === '' && collapsedRepos.has(repo.repositoryRoot)

    const renderWorktreeTree = (row: WorktreeRow, depth: number): ReactElement => {
      const rowNorm = normalizePath(row.path)
      const kids = (childrenMap.get(rowNorm) ?? []).filter(subtreeVisible)
      const lineageCollapsed = normalizedQuery === '' && collapsedLineage.has(rowNorm)
      const chats = sessionsByPath.get(rowNorm) ?? []
      const hasActiveChat = chats.some(c => c.id === activeSessionId)
      const chatsOpen =
        normalizedQuery !== ''
          ? chats.some(c => sessionLabel(c, t).toLowerCase().includes(normalizedQuery))
          : expandedChats.has(rowNorm)
      const status = worktreeStateKind(row.path)

      // Count child worktree status breakdown for the `[⑂ 2 | ● 1 ● 1 ⌄]` capsule!
      let runningKids = 0
      let readyKids = 0
      for (const kid of kids) {
        const st = worktreeStateKind(kid.path)
        if (st === 'running' || st === 'pending') runningKids += 1
        else readyKids += 1
      }

      return (
        <div
          key={row.path}
          className="owt-wt-block"
          style={depth > 0 ? { marginLeft: depth * TREE_INDENT_PX } : undefined}
        >
          <div
            className="owt-wt-row"
            role="treeitem"
            tabIndex={0}
            aria-selected={hasActiveChat}
            data-active={hasActiveChat ? 'true' : 'false'}
            title={`${row.branch}\n${row.path}`}
            onClick={event => {
              event.stopPropagation()
              void activateWorktreeChat(row)
            }}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void activateWorktreeChat(row)
              }
            }}
            onContextMenu={event => {
              event.preventDefault()
              event.stopPropagation()
              props.openWorkspaceMenu(row.workspaceId, row.path, row.displayName ?? row.branch, {
                x: event.clientX,
                y: event.clientY,
              })
            }}
          >
            <span className="owt-dot" data-status={status} aria-hidden />
            <span className="owt-wt-branch">{row.displayName ?? row.branch}</span>
            {row.dirtyCount > 0 && (
              <span className="owt-dirty-pill" title={`${row.dirtyCount} uncommitted`}>
                {row.dirtyCount}
              </span>
            )}
            {chats.length > 1 && (
              <button
                type="button"
                className="owt-chat-pill"
                aria-expanded={chatsOpen}
                title={t('wt.chatsCount', { count: chats.length })}
                onClick={event => {
                  event.stopPropagation()
                  toggleSetItem(setExpandedChats, STORAGE_EXPANDED_CHATS, rowNorm)
                }}
              >
                <IconChat size={11} />
                <span>{chats.length}</span>
              </button>
            )}
            <span className="owt-hover-actions" onClick={event => { event.stopPropagation() }}>
              <button
                type="button"
                className="owt-icon-btn"
                title={t('wt.newChat')}
                aria-label={t('wt.newChat')}
                onClick={event => { void startNewChatInWorktree(row, event) }}
              >
                <IconPlus size={13} />
              </button>
              <button
                type="button"
                className="owt-icon-btn"
                title={t('wt.more')}
                aria-label={t('wt.more')}
                onClick={event => {
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  props.openWorkspaceMenu(row.workspaceId, row.path, row.displayName ?? row.branch, {
                    x: rect.left,
                    y: rect.bottom,
                  })
                }}
              >
                <IconDots size={13} />
              </button>
            </span>
            <button
              type="button"
              className="owt-star-btn"
              data-pinned={row.pinned ? 'true' : 'false'}
              aria-label={row.pinned ? t('wt.unpin') : t('wt.pin')}
              title={row.pinned ? t('wt.unpin') : t('wt.pin')}
              onClick={event => { void handleTogglePin(row, event) }}
            >
              <IconStar filled={row.pinned} size={13} />
            </button>
          </div>

          {/* Expandable conversation sub-list under this worktree */}
          {chatsOpen && chats.length > 0 && (
            <div className="owt-chats" role="group">
              {chats.map(chat => {
                const selected = chat.id === activeSessionId
                const label = sessionLabel(chat, t)
                const chatSt = sessionStateKind(chat)
                return (
                  <div
                    key={chat.id}
                    className="owt-chat-row"
                    role="treeitem"
                    tabIndex={0}
                    data-selected={selected ? 'true' : 'false'}
                    aria-selected={selected}
                    title={label}
                    onClick={event => {
                      event.stopPropagation()
                      props.openSession(chat.id)
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        props.openSession(chat.id)
                      }
                    }}
                    onContextMenu={event => {
                      if (chat.blank) return
                      event.preventDefault()
                      event.stopPropagation()
                      props.openSessionMenu(chat.id, label, { x: event.clientX, y: event.clientY })
                    }}
                  >
                    <span className="owt-mini-dot" data-tone={chatSt === 'pending' ? 'warn' : 'ok'} aria-hidden />
                    <span className="owt-chat-title">{label}</span>
                    {!chat.blank && (
                      <span className="owt-hover-actions" onClick={event => { event.stopPropagation() }}>
                        <button
                          type="button"
                          className="owt-icon-btn"
                          onClick={event => {
                            event.stopPropagation()
                            const rect = event.currentTarget.getBoundingClientRect()
                            props.openSessionMenu(chat.id, label, { x: rect.left, y: rect.bottom })
                          }}
                        >
                          <IconDots size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Orca child-worktree lineage capsule: [ ⑂ 2 | ● 1 ● 1 ⌄ ] */}
          {kids.length > 0 && (
            <div className="owt-capsule-wrap">
              <button
                type="button"
                className="owt-capsule"
                aria-expanded={!lineageCollapsed}
                title={t('wt.childrenBadge', { count: kids.length })}
                onClick={event => {
                  event.stopPropagation()
                  toggleSetItem(setCollapsedLineage, STORAGE_COLLAPSED_LINEAGE, rowNorm)
                }}
              >
                <IconLineage size={11} />
                <span>{kids.length}</span>
                <span className="owt-capsule-sep" aria-hidden />
                {runningKids > 0 && (
                  <span className="owt-capsule-stat">
                    <span className="owt-mini-dot" data-tone="warn" aria-hidden />
                    <span>{runningKids}</span>
                  </span>
                )}
                {readyKids > 0 && (
                  <span className="owt-capsule-stat">
                    <span className="owt-mini-dot" aria-hidden />
                    <span>{readyKids}</span>
                  </span>
                )}
                <IconChevron open={!lineageCollapsed} size={10} />
              </button>
            </div>
          )}

          {!lineageCollapsed && kids.map(kid => renderWorktreeTree(kid, depth + 1))}
        </div>
      )
    }

    return (
      <div className="owt-group" key={repo.repositoryRoot}>
        <div
          className="owt-repo-row"
          role="treeitem"
          aria-expanded={!repoCollapsed}
          title={repo.repositoryRoot}
          onClick={() => { toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, repo.repositoryRoot) }}
          onContextMenu={event => {
            event.preventDefault()
            props.openWorkspaceMenu(repo.rootWorkspaceId, repo.repositoryRoot, repo.name, {
              x: event.clientX,
              y: event.clientY,
            })
          }}
        >
          <span className="owt-repo-icon">
            <IconFolder size={15} />
          </span>
          <span className="owt-repo-name">{repo.name}</span>
          <span className="owt-hover-actions" onClick={event => { event.stopPropagation() }}>
            <button
              type="button"
              className="owt-icon-btn"
              title={repoCollapsed ? t('repo.expand') : t('repo.collapse')}
              aria-label={repoCollapsed ? t('repo.expand') : t('repo.collapse')}
              onClick={() => { toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, repo.repositoryRoot) }}
            >
              <IconChevron open={!repoCollapsed} size={13} />
            </button>
            <button
              type="button"
              className="owt-icon-btn"
              title={t('repo.more')}
              aria-label={t('repo.more')}
              onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                props.openWorkspaceMenu(repo.rootWorkspaceId, repo.repositoryRoot, repo.name, {
                  x: rect.left,
                  y: rect.bottom,
                })
              }}
            >
              <IconDots size={14} />
            </button>
            <button
              type="button"
              className="owt-icon-btn"
              title={t('repo.newWorktree')}
              aria-label={t('repo.newWorktree')}
              onClick={() => {
                setBranchDraft('')
                setFromDraft('')
                setCreateDialog({ repositoryRoot: repo.repositoryRoot })
              }}
            >
              <IconPlus size={14} />
            </button>
          </span>
        </div>
        {!repoCollapsed && roots.map(row => renderWorktreeTree(row, 0))}
      </div>
    )
  }

  // Listen for custom create/remove dialog requests dispatched from the context menu in `client/index.ts`.
  useEffect(() => {
    const onRequestCreate = (event: Event) => {
      const detail = (event as CustomEvent<CreateDialogState>).detail
      if (!detail?.repositoryRoot) return
      setBranchDraft('')
      setFromDraft('')
      setCreateDialog(detail)
    }
    const onRequestRemove = (event: Event) => {
      const detail = (event as CustomEvent<RemoveDialogState>).detail
      if (!detail?.row) return
      setForceRemove(false)
      setRemoveDialog(detail)
    }
    const onRequestNewChat = (event: Event) => {
      const detail = (event as CustomEvent<{ row: WorktreeRow }>).detail
      if (!detail?.row) return
      void startNewChatInWorktree(detail.row)
    }
    const onRequestRefresh = () => {
      void refreshOverview(true)
    }
    window.addEventListener('dsh-worktree:open-create', onRequestCreate)
    window.addEventListener('dsh-worktree:open-remove', onRequestRemove)
    window.addEventListener('dsh-worktree:new-chat', onRequestNewChat)
    window.addEventListener('dsh-worktree:refresh', onRequestRefresh)
    return () => {
      window.removeEventListener('dsh-worktree:open-create', onRequestCreate)
      window.removeEventListener('dsh-worktree:open-remove', onRequestRemove)
      window.removeEventListener('dsh-worktree:new-chat', onRequestNewChat)
      window.removeEventListener('dsh-worktree:refresh', onRequestRefresh)
    }
  }, [refreshOverview, startNewChatInWorktree])

  const renderedRepos = (overview?.repos ?? []).map(renderRepo).filter((node): node is ReactElement => node !== null)

  const filteredNonGit = nonGitWorkspaces.filter(ws => {
    if (normalizedQuery === '') return true
    if (ws.title.toLowerCase().includes(normalizedQuery)) return true
    const chats = sessionsByPath.get(normalizePath(ws.path)) ?? []
    return chats.some(c => sessionLabel(c, t).toLowerCase().includes(normalizedQuery))
  })

  const filteredUngrouped = ungroupedSessions.filter(
    s => normalizedQuery === '' || sessionLabel(s, t).toLowerCase().includes(normalizedQuery),
  )

  const nothingShown =
    renderedRepos.length === 0 && filteredNonGit.length === 0 && filteredUngrouped.length === 0

  return (
    <div className="owt-root">
      <div className="owt-toolbar">
        {searchOpen ? (
          <div className="owt-search-wrap">
            <IconSearch size={13} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('header.search')}
              value={query}
              autoFocus
              onChange={event => { setQuery(event.target.value) }}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  setQuery('')
                  setSearchOpen(false)
                }
              }}
            />
            <button
              type="button"
              className="owt-icon-btn"
              onClick={() => {
                setQuery('')
                setSearchOpen(false)
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <span className="owt-toolbar-title">{t('header.title')}</span>
            <button
              type="button"
              className="owt-icon-btn"
              title={t('header.search')}
              aria-label={t('header.search')}
              onClick={() => { setSearchOpen(true) }}
            >
              <IconSearch size={14} />
            </button>
            <button
              type="button"
              className="owt-icon-btn"
              title={t('header.addRepo')}
              aria-label={t('header.addRepo')}
              onClick={() => { void props.pickAndAddWorkspace() }}
            >
              <IconPlus size={15} />
            </button>
          </>
        )}
      </div>

      {toast !== null && (
        <div className="owt-toast" data-kind={toast.kind} role="status">
          {toast.text}
        </div>
      )}

      <div className="owt-scroll" role="tree" aria-label={t('header.title')}>
        {renderedRepos}

        {/* Non-Git registered folder workspaces */}
        {filteredNonGit.map(ws => {
          const norm = normalizePath(ws.path)
          const collapsed = normalizedQuery === '' && collapsedRepos.has(norm)
          const chats = sessionsByPath.get(norm) ?? []
          return (
            <div className="owt-group" key={ws.workspaceId}>
              <div
                className="owt-repo-row"
                role="treeitem"
                aria-expanded={!collapsed}
                title={ws.path}
                onClick={() => { toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, norm) }}
                onContextMenu={event => {
                  event.preventDefault()
                  props.openWorkspaceMenu(ws.workspaceId, ws.path, ws.title, {
                    x: event.clientX,
                    y: event.clientY,
                  })
                }}
              >
                <span className="owt-repo-icon">
                  <IconFolder size={15} />
                </span>
                <span className="owt-repo-name">{ws.title}</span>
                <span className="owt-hover-actions" onClick={event => { event.stopPropagation() }}>
                  <button
                    type="button"
                    className="owt-icon-btn"
                    onClick={() => { toggleSetItem(setCollapsedRepos, STORAGE_COLLAPSED_REPOS, norm) }}
                  >
                    <IconChevron open={!collapsed} size={13} />
                  </button>
                  <button
                    type="button"
                    className="owt-icon-btn"
                    onClick={event => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      props.openWorkspaceMenu(ws.workspaceId, ws.path, ws.title, {
                        x: rect.left,
                        y: rect.bottom,
                      })
                    }}
                  >
                    <IconDots size={14} />
                  </button>
                  <button
                    type="button"
                    className="owt-icon-btn"
                    title={t('wt.newChat')}
                    onClick={() => { props.startSession(ws.workspaceId) }}
                  >
                    <IconPlus size={14} />
                  </button>
                </span>
              </div>
              {!collapsed &&
                chats.map(chat => {
                  const selected = chat.id === activeSessionId
                  const label = sessionLabel(chat, t)
                  const st = sessionStateKind(chat)
                  return (
                    <div
                      key={chat.id}
                      className="owt-wt-row"
                      role="treeitem"
                      data-active={selected ? 'true' : 'false'}
                      onClick={() => { props.openSession(chat.id) }}
                      onContextMenu={event => {
                        if (chat.blank) return
                        event.preventDefault()
                        props.openSessionMenu(chat.id, label, { x: event.clientX, y: event.clientY })
                      }}
                    >
                      <span className="owt-dot" data-status={st} aria-hidden />
                      <span className="owt-wt-branch">{label}</span>
                    </div>
                  )
                })}
            </div>
          )
        })}

        {/* Ungrouped sessions fallback */}
        {filteredUngrouped.length > 0 && (
          <div className="owt-group">
            <div className="owt-repo-row" role="treeitem">
              <span className="owt-repo-icon">
                <IconChat size={14} />
              </span>
              <span className="owt-repo-name">{t('folder.ungrouped')}</span>
            </div>
            {filteredUngrouped.map(chat => {
              const selected = chat.id === activeSessionId
              const label = sessionLabel(chat, t)
              const st = sessionStateKind(chat)
              return (
                <div
                  key={chat.id}
                  className="owt-wt-row"
                  role="treeitem"
                  data-active={selected ? 'true' : 'false'}
                  onClick={() => { props.openSession(chat.id) }}
                  onContextMenu={event => {
                    if (chat.blank) return
                    event.preventDefault()
                    props.openSessionMenu(chat.id, label, { x: event.clientX, y: event.clientY })
                  }}
                >
                  <span className="owt-dot" data-status={st} aria-hidden />
                  <span className="owt-wt-branch">{label}</span>
                </div>
              )
            })}
          </div>
        )}

        {nothingShown && (
          <div className="owt-empty">
            {normalizedQuery !== '' ? t('empty.search') : t('empty.repos')}
          </div>
        )}
      </div>

      {/* Create Worktree Modal */}
      {createDialog !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="owt-modal-backdrop"
            onClick={() => {
              if (!busy) setCreateDialog(null)
            }}
          >
            <div className="owt-modal" role="dialog" aria-modal="true" onClick={event => { event.stopPropagation() }}>
              <div className="owt-modal-title">
                {createDialog.parentBranch !== undefined
                  ? t('dialog.create.childTitle', { parent: createDialog.parentBranch })
                  : t('dialog.create.title')}
              </div>
              <input
                className="owt-input"
                type="text"
                autoFocus
                disabled={busy}
                placeholder={t('dialog.create.branchPlaceholder')}
                value={branchDraft}
                onChange={event => { setBranchDraft(event.target.value) }}
                onCompositionStart={() => { composingRef.current = true }}
                onCompositionEnd={() => { composingRef.current = false }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !composingRef.current) {
                    event.preventDefault()
                    void submitCreateWorktree()
                  }
                }}
              />
              <div className="owt-field">
                <span className="owt-field-label">{t('dialog.create.fromLabel')}</span>
                <div className="owt-select-row">
                  <select
                    className="owt-select"
                    aria-label={t('dialog.create.fromLabel')}
                    disabled={busy || loadingBranches}
                    value={fromDraft || branchOptions?.defaultBase || 'HEAD'}
                    onChange={event => {
                      userPickedFromRef.current = true
                      setFromDraft(event.target.value)
                    }}
                  >
                    {loadingBranches && branchOptions === null && (
                      <option value={fromDraft || 'HEAD'}>{t('dialog.create.loadingBranches')}</option>
                    )}
                    {(branchOptions?.remoteBranches.length ?? 0) > 0 && (
                      <optgroup label={t('dialog.create.remoteGroup')}>
                        {branchOptions!.remoteBranches.map(b => (
                          <option key={`remote:${b}`} value={b}>
                            {b}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {(branchOptions?.localBranches.length ?? 0) > 0 && (
                      <optgroup label={t('dialog.create.localGroup')}>
                        {branchOptions!.localBranches.map(b => (
                          <option key={`local:${b}`} value={b}>
                            {b}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {branchOptions !== null &&
                      ((branchOptions.remoteBranches.length === 0 && branchOptions.localBranches.length === 0) ||
                        fromDraft === 'HEAD') && <option value="HEAD">HEAD</option>}
                  </select>
                  <button
                    type="button"
                    className="owt-fetch-btn"
                    title={t('dialog.create.fetchBranches')}
                    aria-label={t('dialog.create.fetchBranches')}
                    disabled={busy || loadingBranches || fetchingBranches}
                    onClick={() => { void handleFetchBranches() }}
                  >
                    <IconRefresh size={13} spinning={fetchingBranches} />
                  </button>
                </div>
                {staleHostHint && <span className="owt-field-hint">{t('dialog.create.restartHint')}</span>}
              </div>
              <div className="owt-modal-foot">
                <button
                  type="button"
                  className="owt-btn"
                  disabled={busy}
                  onClick={() => { setCreateDialog(null) }}
                >
                  {t('dialog.create.cancel')}
                </button>
                <button
                  type="button"
                  className="owt-btn"
                  data-kind="primary"
                  disabled={busy}
                  onClick={() => { void submitCreateWorktree() }}
                >
                  {t('dialog.create.submit')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Remove Worktree Confirmation Modal */}
      {removeDialog !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="owt-modal-backdrop"
            onClick={() => {
              if (!busy) setRemoveDialog(null)
            }}
          >
            <div className="owt-modal" role="dialog" aria-modal="true" onClick={event => { event.stopPropagation() }}>
              <div className="owt-modal-title">
                {t('dialog.remove.title', { branch: removeDialog.row.branch })}
              </div>
              <div className="owt-modal-desc">{t('dialog.remove.desc')}</div>
              {removeDialog.row.dirtyCount > 0 && (
                <div className="owt-modal-desc">
                  {t('dialog.remove.dirty', { count: removeDialog.row.dirtyCount })}
                </div>
              )}
              {removeDialog.childCount > 0 && (
                <div className="owt-modal-desc">
                  {t('dialog.remove.children', { count: removeDialog.childCount })}
                </div>
              )}
              {(removeDialog.row.dirtyCount > 0 || removeDialog.childCount > 0) && (
                <label className="owt-modal-check">
                  <input
                    type="checkbox"
                    checked={forceRemove}
                    disabled={busy}
                    onChange={event => { setForceRemove(event.target.checked) }}
                  />
                  <span>{t('dialog.remove.force')}</span>
                </label>
              )}
              <div className="owt-modal-foot">
                <button
                  type="button"
                  className="owt-btn"
                  disabled={busy}
                  onClick={() => { setRemoveDialog(null) }}
                >
                  {t('dialog.create.cancel')}
                </button>
                <button
                  type="button"
                  className="owt-btn"
                  data-kind="danger"
                  disabled={busy || ((removeDialog.row.dirtyCount > 0 || removeDialog.childCount > 0) && !forceRemove)}
                  onClick={() => { void submitRemoveWorktree() }}
                >
                  {t('dialog.remove.confirm')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
