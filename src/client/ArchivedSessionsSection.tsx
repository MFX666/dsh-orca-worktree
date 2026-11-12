/**
 * Settings -> Archived Sessions section (`id: "archived-sessions"`),
 * organizing DSH's official `archivedSessionIds` by Git Repository -> Git Branch -> Session.
 *
 * Uses 100% official DSH archive state (`useWorkspaces(s => s.archivedSessionIds)`
 * and `workspaces.unarchiveSession`) so sidebar context-menu Archive/Unarchive
 * and worktree-removal auto-archive stay in complete sync without conflict.
 * @module dsh-worktree-plugin/client/ArchivedSessionsSection
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type { WorktreeArchivedMetaValue, WorktreeOverviewValue } from '../protocol.ts'
import type { WorktreeApi } from './api.ts'
import { IconChat, IconChevron, IconClose, IconGitBranch, IconRefresh, IconSearch } from './icons.tsx'
import type { SessionListSnapshotLike, SessionSummaryLike, WorkspaceListSnapshotLike } from './OrcaSidebar.tsx'

type Translate = (key: string, params?: Record<string, string | number>) => string

export interface ArchivedSessionsSectionProps {
  /** Provided by `SettingsPanel` when rendering `settings.section`. */
  close?: () => void
  /** Root hooks provided by `ui-session` and `ui-workspace`. */
  useSessions: <R>(selector: (state: SessionListSnapshotLike) => R) => R
  useWorkspaces: <R>(selector: (state: WorkspaceListSnapshotLike) => R) => R
  /** Locale seat from `locale: NS`. */
  t: Translate
  /** Injected callbacks from `client/index.ts`. */
  api: WorktreeApi
  unarchiveSession: (sessionId: string) => Promise<void>
  openSession: (sessionId: string) => void
}

interface BranchBucket {
  readonly branchKey: string
  readonly branchName: string
  readonly path?: string
  readonly removedAt?: string
  readonly isWorktreeBranch: boolean
  readonly isRemovedCheckout: boolean
  readonly sessions: SessionSummaryLike[]
}

interface RepoBucket {
  readonly repoKey: string
  readonly repoName: string
  readonly repositoryRoot?: string
  readonly isGitRepo: boolean
  readonly branches: BranchBucket[]
  readonly totalSessions: number
}

function normalizePath(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

function pathBasename(p: string): string {
  const norm = normalizePath(p)
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

function formatShortTime(ts: number | undefined): string {
  if (ts === undefined || !Number.isFinite(ts) || ts <= 0) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const datePart =
      d.getFullYear() === now.getFullYear()
        ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function sessionDisplayTitle(s: SessionSummaryLike, t: Translate): string {
  const raw = (s.displayTitle ?? s.title ?? '').trim()
  if (raw.length > 0) return raw
  return s.blank ? t('wt.unnamedChat') : t('wt.untitledChat')
}

export function ArchivedSessionsSection(props: ArchivedSessionsSectionProps): ReactElement {
  const { t, api } = props
  const sessionList = props.useSessions(s => s)
  const workspaceSnap = props.useWorkspaces(s => s)

  const [meta, setMeta] = useState<WorktreeArchivedMetaValue | null>(null)
  const [overview, setOverview] = useState<WorktreeOverviewValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(() => new Set())
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [errorText, setErrorText] = useState<string | null>(null)

  const reloadMeta = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setErrorText(null)
      try {
        const [ov, am] = await Promise.all([
          api.overview(false, signal).catch(() => null),
          api.archivedMeta(signal).catch(() => ({ branches: [], repos: [] } satisfies WorktreeArchivedMetaValue)),
        ])
        if (signal?.aborted) return
        if (ov !== null) setOverview(ov)
        setMeta(am)
      } catch (error) {
        if (!signal?.aborted) {
          setErrorText(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    const controller = new AbortController()
    void reloadMeta(controller.signal)
    return () => { controller.abort() }
  }, [reloadMeta])

  const repoGroups = useMemo((): RepoBucket[] => {
    const archivedIds = workspaceSnap.archivedSessionIds
    if (archivedIds.length === 0) return []

    // 1. Index live git repositories and their active worktree rows.
    const repoNameByRoot = new Map<string, string>()
    const poolToRepoRoot = new Map<string, string>()
    const activeWorktrees: Array<{ path: string; repoRoot: string; branch: string; isMain: boolean }> = []
    const activeWorktreePaths = new Set<string>()

    for (const r of meta?.repos ?? []) {
      const root = normalizePath(r.repositoryRoot)
      repoNameByRoot.set(root, r.name)
      poolToRepoRoot.set(normalizePath(r.poolPath), root)
    }
    for (const repo of overview?.repos ?? []) {
      const root = normalizePath(repo.repositoryRoot)
      repoNameByRoot.set(root, repo.name)
      poolToRepoRoot.set(normalizePath(repo.poolPath), root)
      for (const row of repo.rows) {
        const normRowPath = normalizePath(row.path)
        activeWorktreePaths.add(normRowPath)
        activeWorktrees.push({
          path: normRowPath,
          repoRoot: root,
          branch: row.branch,
          isMain: row.kind === 'main',
        })
      }
    }
    activeWorktrees.sort((a, b) => b.path.length - a.path.length)

    // 2. Index historical removed worktrees from `archivedMeta.branches` (both by sessionId and by path).
    const archivedByPath = new Map<string, (typeof meta extends null ? never : NonNullable<typeof meta>['branches'][number])>()
    const archivedBySession = new Map<string, (typeof meta extends null ? never : NonNullable<typeof meta>['branches'][number])>()
    for (const rec of meta?.branches ?? []) {
      const norm = normalizePath(rec.path)
      if (!archivedByPath.has(norm)) archivedByPath.set(norm, rec)
      for (const sid of rec.sessionIds ?? []) {
        if (!archivedBySession.has(sid)) archivedBySession.set(sid, rec)
      }
    }
    const archivedPathsDesc = [...archivedByPath.keys()].sort((a, b) => b.length - a.length)

    // 3. Index registered workspaces (non-Git folders or git roots) & explicit session accounting.
    const wsBySessionId = new Map<string, { path: string; title: string }>()
    const wsByPath = new Map<string, { path: string; title: string }>()
    for (const ws of workspaceSnap.items) {
      const norm = normalizePath(ws.path)
      wsByPath.set(norm, { path: norm, title: ws.title })
      for (const sid of ws.sessionIds) {
        wsBySessionId.set(sid, { path: norm, title: ws.title })
      }
    }

    // Heuristic: infer repo + branch from common worktree path layouts even for pre-plugin historical sessions!
    const inferFromCwd = (
      cwdNorm: string,
    ): {
      repoKey: string
      repoName: string
      repositoryRoot?: string
      branchName: string
      isGitRepo: boolean
      isWorktreeBranch: boolean
      isRemovedCheckout: boolean
    } => {
      // a) Exact / prefix match on recorded archivedBranches
      const recPath = archivedPathsDesc.find(p => cwdNorm === p || cwdNorm.startsWith(`${p}/`))
      if (recPath !== undefined) {
        const rec = archivedByPath.get(recPath)!
        const root = rec.repositoryRoot ? normalizePath(rec.repositoryRoot) : undefined
        return {
          repoKey: root ?? `repo:${rec.repositoryName}`,
          repoName: (root ? repoNameByRoot.get(root) : undefined) ?? rec.repositoryName,
          repositoryRoot: root,
          branchName: rec.branch,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: !activeWorktreePaths.has(recPath),
        }
      }

      // b) Active git worktree row (e.g. session archived manually on an existing branch or main)
      const activeWt = activeWorktrees.find(w => cwdNorm === w.path || cwdNorm.startsWith(`${w.path}/`))
      if (activeWt !== undefined && !activeWt.isMain) {
        return {
          repoKey: activeWt.repoRoot,
          repoName: repoNameByRoot.get(activeWt.repoRoot) ?? pathBasename(activeWt.repoRoot),
          repositoryRoot: activeWt.repoRoot,
          branchName: activeWt.branch,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: false,
        }
      }

      // c) Unified pool pattern: `.../dsh-orca-worktrees/<repoKey>/<branch>` or legacy `.../lib/worktrees/<repoKey>/<branch>`
      const poolMatch = /^(.*\/(?:dsh-orca-worktrees|worktrees)\/([^/]+))\/([^/]+)(?:\/|$)/.exec(cwdNorm)
      if (poolMatch !== null) {
        const poolDir = poolMatch[1]!
        const repoSlug = poolMatch[2]!
        const branchSeg = poolMatch[3]!
        const checkoutRoot = `${poolDir}/${branchSeg}`
        const knownRoot = poolToRepoRoot.get(poolDir)
        const strippedSlug = repoSlug.replace(/-[0-9a-f]{8}$/i, '')
        let matchedRoot = knownRoot
        if (matchedRoot === undefined) {
          for (const [root, name] of repoNameByRoot.entries()) {
            if (name === strippedSlug || pathBasename(root) === strippedSlug) {
              matchedRoot = root
              break
            }
          }
        }
        return {
          repoKey: matchedRoot ?? `pool:${strippedSlug}`,
          repoName: (matchedRoot ? repoNameByRoot.get(matchedRoot) : undefined) ?? strippedSlug,
          repositoryRoot: matchedRoot,
          branchName: branchSeg,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot),
        }
      }

      // d) Legacy `.agents/worktrees/<branch>` inside a repository
      const agentsMatch = /^(.*)\/\.agents\/worktrees\/([^/]+)(?:\/|$)/.exec(cwdNorm)
      if (agentsMatch !== null) {
        const repoRoot = agentsMatch[1]!
        const branchSeg = agentsMatch[2]!
        const checkoutRoot = `${repoRoot}/.agents/worktrees/${branchSeg}`
        return {
          repoKey: repoRoot,
          repoName: repoNameByRoot.get(repoRoot) ?? wsByPath.get(repoRoot)?.title ?? pathBasename(repoRoot),
          repositoryRoot: repoRoot,
          branchName: branchSeg,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot),
        }
      }

      // e) Orca external workspace layout: `.../orca/workspaces/<repoName>/<branch>`
      const orcaMatch = /^(.*\/orca\/workspaces\/([^/]+)\/([^/]+))(?:\/|$)/.exec(cwdNorm)
      if (orcaMatch !== null) {
        const checkoutRoot = orcaMatch[1]!
        const repoSlug = orcaMatch[2]!
        const branchSeg = orcaMatch[3]!
        let matchedRoot: string | undefined
        for (const [root, name] of repoNameByRoot.entries()) {
          if (name === repoSlug || pathBasename(root) === repoSlug) {
            matchedRoot = root
            break
          }
        }
        return {
          repoKey: matchedRoot ?? `orca:${repoSlug}`,
          repoName: (matchedRoot ? repoNameByRoot.get(matchedRoot) : undefined) ?? repoSlug,
          repositoryRoot: matchedRoot,
          branchName: branchSeg,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: !activeWorktreePaths.has(checkoutRoot),
        }
      }

      // f) Main checkout of a known Git repository
      if (activeWt !== undefined && activeWt.isMain) {
        return {
          repoKey: activeWt.repoRoot,
          repoName: repoNameByRoot.get(activeWt.repoRoot) ?? pathBasename(activeWt.repoRoot),
          repositoryRoot: activeWt.repoRoot,
          branchName: activeWt.branch,
          isGitRepo: true,
          isWorktreeBranch: false,
          isRemovedCheckout: false,
        }
      }

      // g) Non-Git registered Workspace folder
      for (const [wsPath, wsInfo] of wsByPath.entries()) {
        if (cwdNorm === wsPath || cwdNorm.startsWith(`${wsPath}/`)) {
          return {
            repoKey: `ws:${wsPath}`,
            repoName: wsInfo.title === 'default-workspace' ? t('archive.defaultWorkspace') : wsInfo.title,
            branchName: t('archive.folderDirect'),
            isGitRepo: false,
            isWorktreeBranch: false,
            isRemovedCheckout: false,
          }
        }
      }

      // h) Fallback by directory basename
      return {
        repoKey: `dir:${cwdNorm}`,
        repoName: pathBasename(cwdNorm) || cwdNorm,
        branchName: t('archive.folderDirect'),
        isGitRepo: false,
        isWorktreeBranch: false,
        isRemovedCheckout: false,
      }
    }

    const repoMap = new Map<
      string,
      {
        repoKey: string
        repoName: string
        repositoryRoot?: string
        isGitRepo: boolean
        branches: Map<string, BranchBucket>
      }
    >()

    for (const sid of archivedIds) {
      const summary: SessionSummaryLike = sessionList.byId[sid] ?? { id: sid }
      if (summary.origin === 'subagent') continue

      let resolved: {
        repoKey: string
        repoName: string
        repositoryRoot?: string
        branchName: string
        path?: string
        removedAt?: string
        isGitRepo: boolean
        isWorktreeBranch: boolean
        isRemovedCheckout: boolean
      }

      const explicitRec = archivedBySession.get(sid)
      if (explicitRec !== undefined) {
        const root = explicitRec.repositoryRoot ? normalizePath(explicitRec.repositoryRoot) : undefined
        const normRecPath = normalizePath(explicitRec.path)
        resolved = {
          repoKey: root ?? `repo:${explicitRec.repositoryName}`,
          repoName: (root ? repoNameByRoot.get(root) : undefined) ?? explicitRec.repositoryName,
          repositoryRoot: root,
          branchName: explicitRec.branch,
          path: explicitRec.path,
          removedAt: explicitRec.removedAt,
          isGitRepo: true,
          isWorktreeBranch: true,
          isRemovedCheckout: !activeWorktreePaths.has(normRecPath),
        }
      } else {
        const cwdRaw = summary.cwd ?? wsBySessionId.get(sid)?.path
        if (cwdRaw !== undefined && cwdRaw.length > 0) {
          const inferred = inferFromCwd(normalizePath(cwdRaw))
          resolved = { ...inferred, path: normalizePath(cwdRaw) }
        } else {
          resolved = {
            repoKey: 'ungrouped',
            repoName: t('folder.ungrouped'),
            branchName: t('archive.folderDirect'),
            isGitRepo: false,
            isWorktreeBranch: false,
            isRemovedCheckout: false,
          }
        }
      }

      let repoEntry = repoMap.get(resolved.repoKey)
      if (repoEntry === undefined) {
        repoEntry = {
          repoKey: resolved.repoKey,
          repoName: resolved.repoName,
          repositoryRoot: resolved.repositoryRoot,
          isGitRepo: resolved.isGitRepo,
          branches: new Map(),
        }
        repoMap.set(resolved.repoKey, repoEntry)
      }

      const bKey = `${resolved.repoKey}::${resolved.branchName}`
      let branchEntry = repoEntry.branches.get(bKey)
      if (branchEntry === undefined) {
        branchEntry = {
          branchKey: bKey,
          branchName: resolved.branchName,
          path: resolved.path,
          removedAt: resolved.removedAt,
          isWorktreeBranch: resolved.isWorktreeBranch,
          isRemovedCheckout: resolved.isRemovedCheckout,
          sessions: [],
        }
        repoEntry.branches.set(bKey, branchEntry)
      }
      branchEntry.sessions.push(summary)
    }

    const result: RepoBucket[] = []
    for (const repoEntry of repoMap.values()) {
      const branches = [...repoEntry.branches.values()].map(b => ({
        ...b,
        sessions: [...b.sessions].sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0)),
      }))
      branches.sort((a, b) => {
        const aTop = a.sessions[0]?.updatedAt ?? 0
        const bTop = b.sessions[0]?.updatedAt ?? 0
        return bTop - aTop || a.branchName.localeCompare(b.branchName)
      })
      const totalSessions = branches.reduce((acc, b) => acc + b.sessions.length, 0)
      result.push({
        repoKey: repoEntry.repoKey,
        repoName: repoEntry.repoName,
        repositoryRoot: repoEntry.repositoryRoot,
        isGitRepo: repoEntry.isGitRepo,
        branches,
        totalSessions,
      })
    }

    // Sort Git repos ahead of plain folders/default-workspace, newest archived session first.
    result.sort((a, b) => {
      if (a.isGitRepo !== b.isGitRepo) return a.isGitRepo ? -1 : 1
      const aTop = a.branches[0]?.sessions[0]?.updatedAt ?? 0
      const bTop = b.branches[0]?.sessions[0]?.updatedAt ?? 0
      return bTop - aTop || a.repoName.localeCompare(b.repoName)
    })
    return result
  }, [workspaceSnap.archivedSessionIds, workspaceSnap.items, meta, overview, sessionList.byId, t])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredGroups = useMemo(() => {
    if (normalizedQuery === '') return repoGroups
    const out: RepoBucket[] = []
    for (const repo of repoGroups) {
      const repoMatches = repo.repoName.toLowerCase().includes(normalizedQuery)
      const matchedBranches: BranchBucket[] = []
      for (const b of repo.branches) {
        if (repoMatches || b.branchName.toLowerCase().includes(normalizedQuery)) {
          matchedBranches.push(b)
          continue
        }
        const matchedSessions = b.sessions.filter(s =>
          sessionDisplayTitle(s, t).toLowerCase().includes(normalizedQuery),
        )
        if (matchedSessions.length > 0) {
          matchedBranches.push({ ...b, sessions: matchedSessions })
        }
      }
      if (matchedBranches.length > 0) {
        out.push({
          ...repo,
          branches: matchedBranches,
          totalSessions: matchedBranches.reduce((sum, item) => sum + item.sessions.length, 0),
        })
      }
    }
    return out
  }, [normalizedQuery, repoGroups, t])

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleUnarchive = async (sessionId: string, openAfter: boolean) => {
    setBusyIds(prev => new Set([...prev, sessionId]))
    setErrorText(null)
    try {
      await props.unarchiveSession(sessionId)
      if (openAfter) {
        props.close?.()
        props.openSession(sessionId)
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  const handleUnarchiveBranch = async (branch: BranchBucket) => {
    const ids = branch.sessions.map(s => s.id)
    setBusyIds(prev => new Set([...prev, ...ids]))
    setErrorText(null)
    try {
      for (const id of ids) {
        await props.unarchiveSession(id)
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }

  const totalCount = workspaceSnap.archivedSessionIds.length

  return (
    <div className="owt-arch-root">
      <div className="owt-arch-header">
        <div className="owt-arch-title-wrap">
          <div className="owt-arch-title">
            {t('archive.title')}
            {totalCount > 0 && <span className="owt-arch-count">{totalCount}</span>}
          </div>
          <div className="owt-arch-desc">{t('archive.desc')}</div>
        </div>
        <button
          type="button"
          className="owt-btn"
          disabled={loading}
          onClick={() => { void reloadMeta() }}
          aria-label={t('archive.refreshAria')}
          title={t('archive.refreshAria')}
        >
          <IconRefresh size={12.5} spinning={loading} />
          <span>{t('archive.refresh')}</span>
        </button>
      </div>

      {totalCount > 0 && (
        <div className="owt-arch-search">
          <IconSearch size={13.5} />
          <input
            type="text"
            value={query}
            placeholder={t('archive.searchPlaceholder')}
            aria-label={t('archive.searchPlaceholder')}
            onChange={event => { setQuery(event.target.value) }}
          />
          {query !== '' && (
            <button
              type="button"
              className="owt-clear-btn"
              aria-label={t('header.clearSearch')}
              onClick={() => { setQuery('') }}
            >
              <IconClose size={11} />
            </button>
          )}
        </div>
      )}

      {errorText !== null && (
        <div className="owt-toast" data-kind="error" role="alert">
          {errorText}
        </div>
      )}

      {totalCount === 0 ? (
        <div className="owt-arch-empty">{t('archive.empty')}</div>
      ) : filteredGroups.length === 0 ? (
        <div className="owt-arch-empty">{t('empty.search')}</div>
      ) : (
        <div className="owt-arch-list">
          {filteredGroups.map(repo => {
            const repoCollapsed = normalizedQuery === '' && collapsedGroups.has(repo.repoKey)
            const summaryText = repo.isGitRepo
              ? t('archive.repoSummary', { branches: repo.branches.length, chats: repo.totalSessions })
              : t('archive.chatsOnlySummary', { chats: repo.totalSessions })
            return (
              <div className="owt-arch-card" key={repo.repoKey}>
                <div
                  className="owt-arch-repo-head"
                  role="button"
                  tabIndex={0}
                  aria-expanded={!repoCollapsed}
                  onClick={() => { toggleGroup(repo.repoKey) }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleGroup(repo.repoKey)
                    }
                  }}
                >
                  <IconChevron open={!repoCollapsed} size={12} />
                  <span className="owt-arch-repo-name">{repo.repoName}</span>
                  <span className="owt-arch-repo-meta">{summaryText}</span>
                </div>

                {!repoCollapsed && (
                  <div className="owt-arch-branches">
                    {repo.branches.map(branch => {
                      const bCollapsed = normalizedQuery === '' && collapsedGroups.has(branch.branchKey)
                      const showBranchHeader = repo.isGitRepo || repo.branches.length > 1
                      return (
                        <div className="owt-arch-branch-group" key={branch.branchKey}>
                          {showBranchHeader && (
                            <div className="owt-arch-branch-head">
                              <div
                                className="owt-arch-branch-toggle"
                                role="button"
                                tabIndex={0}
                                aria-expanded={!bCollapsed}
                                title={branch.path}
                                onClick={() => { toggleGroup(branch.branchKey) }}
                                onKeyDown={event => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    toggleGroup(branch.branchKey)
                                  }
                                }}
                              >
                                <IconChevron open={!bCollapsed} size={11} />
                                <span className="owt-arch-branch-icon">
                                  <IconGitBranch size={12.5} />
                                </span>
                                <span className="owt-arch-branch-name">{branch.branchName}</span>
                                {branch.isRemovedCheckout && (
                                  <span className="owt-arch-removed-tag">{t('archive.removedTag')}</span>
                                )}
                                <span className="owt-count-pill">{branch.sessions.length}</span>
                              </div>
                              {branch.sessions.length > 1 && (
                                <button
                                  type="button"
                                  className="owt-arch-link-btn"
                                  disabled={branch.sessions.some(s => busyIds.has(s.id))}
                                  onClick={() => { void handleUnarchiveBranch(branch) }}
                                >
                                  {t('archive.restoreBranch')}
                                </button>
                              )}
                            </div>
                          )}

                          {(!showBranchHeader || !bCollapsed) && (
                            <div className="owt-arch-sessions" data-indented={showBranchHeader ? 'true' : 'false'}>
                              {branch.sessions.map(session => {
                                const isBusy = busyIds.has(session.id)
                                const label = sessionDisplayTitle(session, t)
                                const timeText = formatShortTime(session.updatedAt)
                                return (
                                  <div
                                    className="owt-arch-session-row"
                                    key={session.id}
                                    data-busy={isBusy ? 'true' : 'false'}
                                    tabIndex={0}
                                  >
                                    <span className="owt-git-icon">
                                      <IconChat size={12} />
                                    </span>
                                    <div className="owt-arch-session-main" title={`${label}\n${session.cwd ?? ''}`}>
                                      <span className="owt-arch-session-title">{label}</span>
                                      {timeText !== '' && <span className="owt-arch-session-time">{timeText}</span>}
                                    </div>
                                    <div className="owt-arch-session-actions">
                                      <button
                                        type="button"
                                        className="owt-btn owt-btn-xs"
                                        disabled={isBusy}
                                        onClick={() => { void handleUnarchive(session.id, false) }}
                                      >
                                        {t('archive.unarchive')}
                                      </button>
                                      <button
                                        type="button"
                                        className="owt-btn owt-btn-xs"
                                        data-kind="primary"
                                        disabled={isBusy}
                                        onClick={() => { void handleUnarchive(session.id, true) }}
                                      >
                                        {t('archive.unarchiveAndOpen')}
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
