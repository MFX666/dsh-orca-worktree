/**
 * Git Source-Control & Diff Review Workbench mounted in the conversation view
 * tab strip (`conversation.view`), next to 对话 / 轨迹 / AOCI.
 *
 * Layout: IDE two-pane split workbench
 * - Left pane (320px): branch & upstream bar, commit composer with inline AI
 *   writer, and directory-grouped file tree with per-file staging checkboxes.
 * - Right pane (flex 1): GitHub/Cursor-grade structured unified diff viewer
 *   with sticky file headers, hunk banners, dual old/new line-number gutters,
 *   and instant single-file / all-files mode switching.
 * @module dsh-worktree-plugin/client/GitPanel
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { WorktreeChangeRow, WorktreeDiffValue, WorktreeStatusValue } from '../protocol.ts'
import type { WorktreeApi } from './api.ts'
import { changeLetter, parseStructuredDiff, type ParsedFileDiff } from './diffParser.ts'
import {
  IconCheck,
  IconChevron,
  IconFile,
  IconFolder,
  IconGitBranch,
  IconRefresh,
  IconSparkle,
} from './icons.tsx'

type Translate = (key: string, params?: Record<string, string | number>) => string

const MAX_FILE_RENDER_LINES = 2500
const MAX_ALL_RENDER_LINES = 4500

interface CommitGroup {
  readonly dir: string
  readonly files: ReadonlyArray<{
    readonly change: WorktreeChangeRow
    readonly baseName: string
    readonly add: number
    readonly del: number
    readonly letter: 'A' | 'M' | 'D' | 'R'
  }>
}

function buildGroups(
  changes: readonly WorktreeChangeRow[],
  parsedMap: ReadonlyMap<string, ParsedFileDiff>,
): CommitGroup[] {
  const map = new Map<string, Array<CommitGroup['files'][number]>>()
  for (const change of changes) {
    const sep = change.file.lastIndexOf('/')
    const dir = sep > 0 ? change.file.slice(0, sep) : ''
    const baseName = sep >= 0 ? change.file.slice(sep + 1) : change.file
    const parsed = parsedMap.get(change.file)
    const entry = {
      change,
      baseName,
      add: change.add ?? parsed?.add ?? 0,
      del: change.del ?? parsed?.del ?? 0,
      letter: changeLetter(change),
    }
    const bucket = map.get(dir)
    if (bucket !== undefined) bucket.push(entry)
    else map.set(dir, [entry])
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([dir, files]) => ({ dir, files }))
}

/** 5-block visual diffstat bar like GitHub PR file headers. */
function DiffStatBlocks({ add, del }: { add: number; del: number }): ReactElement | null {
  const total = add + del
  if (total === 0) return null
  const blocks = 5
  const addBlocks = Math.round((add / total) * blocks)
  const delBlocks = Math.min(blocks - addBlocks, del > 0 ? Math.max(1, blocks - addBlocks) : 0)
  const neutral = Math.max(0, blocks - addBlocks - delBlocks)
  return (
    <span className="owt-gp-blocks" aria-hidden>
      {Array.from({ length: addBlocks }).map((_, idx) => (
        <span key={`a${idx}`} className="owt-gp-block" data-kind="add" />
      ))}
      {Array.from({ length: delBlocks }).map((_, idx) => (
        <span key={`d${idx}`} className="owt-gp-block" data-kind="del" />
      ))}
      {Array.from({ length: neutral }).map((_, idx) => (
        <span key={`n${idx}`} className="owt-gp-block" />
      ))}
    </span>
  )
}

/** Session summary slice needed to resolve a conversation's checkout. */
export interface SessionSummarySlice {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, { readonly cwd?: string } | undefined>>
}

/** Injected face for the `conversation.view` Git tab body. */
export interface CommitPanelProps {
  api: WorktreeApi
  t: Translate
  sessionId: string
  useSessions: <R>(selector: (state: SessionSummarySlice) => R) => R
}

export function CommitPanel(props: CommitPanelProps): ReactElement {
  const { api, t, sessionId, useSessions } = props
  const sessions = useSessions(s => s)
  const path = useMemo(() => sessions.byId[sessionId]?.cwd, [sessions, sessionId])

  const [diff, setDiff] = useState<WorktreeDiffValue | null>(null)
  const [status, setStatus] = useState<WorktreeStatusValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [banner, setBanner] = useState<string | undefined>(undefined)

  const [selectedFiles, setSelectedFiles] = useState<ReadonlySet<string>>(() => new Set())
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single')
  const [collapsedDirs, setCollapsedDirs] = useState<ReadonlySet<string>>(() => new Set())
  const [collapsedCards, setCollapsedCards] = useState<ReadonlySet<string>>(() => new Set())
  const [extraParsed, setExtraParsed] = useState<ReadonlyMap<string, ParsedFileDiff>>(() => new Map())
  const [loadingFile, setLoadingFile] = useState<string | null>(null)

  const diffScrollRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const attemptedFilesRef = useRef<Set<string>>(new Set())

  const loadWorkspaceDiff = useCallback(
    async (targetPath: string, isInitial: boolean, signal?: AbortSignal) => {
      if (isInitial) setLoading(true)
      else setRefreshing(true)
      setError(undefined)
      try {
        const [nextDiff, nextStatus] = await Promise.all([
          api.diff(targetPath, signal),
          api.status(targetPath, signal).catch(() => null),
        ])
        if (signal?.aborted) return
        attemptedFilesRef.current.clear()
        setExtraParsed(new Map())
        setDiff(nextDiff)
        setStatus(nextStatus)
        const allPaths = nextDiff.changes.map(c => c.file)
        setSelectedFiles(prev => {
          if (isInitial || prev.size === 0) return new Set(allPaths)
          const kept = allPaths.filter(f => prev.has(f))
          return kept.length > 0 ? new Set(kept) : new Set(allPaths)
        })
        setActiveFile(prev => (prev !== null && allPaths.includes(prev) ? prev : (allPaths[0] ?? null)))
      } catch (err) {
        if (signal?.aborted) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [api],
  )

  useEffect(() => {
    if (path === undefined) {
      setDiff(null)
      setStatus(null)
      return
    }
    setDiff(null)
    setStatus(null)
    setMsg('')
    setBanner(undefined)
    setCollapsedDirs(new Set())
    setCollapsedCards(new Set())
    const controller = new AbortController()
    void loadWorkspaceDiff(path, true, controller.signal)
    return () => controller.abort()
  }, [loadWorkspaceDiff, path])

  useEffect(() => {
    if (banner === undefined) return
    const timer = window.setTimeout(() => setBanner(undefined), 4000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const baseParsedMap = useMemo(
    () => (diff !== null ? parseStructuredDiff(diff.diff) : new Map<string, ParsedFileDiff>()),
    [diff],
  )

  const parsedMap = useMemo(() => {
    if (extraParsed.size === 0) return baseParsedMap
    const merged = new Map(baseParsedMap)
    for (const [k, v] of extraParsed) merged.set(k, v)
    return merged
  }, [baseParsedMap, extraParsed])

  // Lazy single-file fetch when clicking a file omitted from the initial overview budget (e.g. *.map / lockfiles / huge repos).
  useEffect(() => {
    if (path === undefined || diff === null || activeFile === null) return
    if (parsedMap.has(activeFile) || attemptedFilesRef.current.has(activeFile)) return
    if (!diff.changes.some(c => c.file === activeFile)) return
    attemptedFilesRef.current.add(activeFile)
    const controller = new AbortController()
    setLoadingFile(activeFile)
    api
      .diff(path, controller.signal, activeFile)
      .then(single => {
        if (controller.signal.aborted) return
        const singleParsed = parseStructuredDiff(single.diff)
        const hit = singleParsed.get(activeFile)
        if (hit !== undefined) {
          setExtraParsed(prev => {
            const next = new Map(prev)
            next.set(activeFile, hit)
            return next
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingFile(curr => (curr === activeFile ? null : curr))
      })
    return () => controller.abort()
  }, [activeFile, api, diff, parsedMap, path])

  const groups = useMemo(
    () => (diff !== null ? buildGroups(diff.changes, parsedMap) : []),
    [diff, parsedMap],
  )

  const totals = useMemo(() => {
    let add = 0
    let del = 0
    for (const group of groups) {
      for (const f of group.files) {
        add += f.add
        del += f.del
      }
    }
    return { add, del }
  }, [groups])

  const toggleSelectAll = useCallback(() => {
    if (diff === null) return
    const all = diff.changes.map(c => c.file)
    setSelectedFiles(prev => (prev.size === all.length ? new Set() : new Set(all)))
  }, [diff])

  const toggleCheckFile = useCallback((file: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }, [])

  const toggleDir = useCallback((dir: string) => {
    setCollapsedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }, [])

  const toggleCard = useCallback((file: string) => {
    setCollapsedCards(prev => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }, [])

  const handleSelectFileRow = useCallback(
    (file: string) => {
      setActiveFile(file)
      if (viewMode === 'all') {
        const el = cardRefs.current.get(file)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (diffScrollRef.current !== null) {
        diffScrollRef.current.scrollTop = 0
      }
    },
    [viewMode],
  )

  const handleSuggest = useCallback(async () => {
    if (path === undefined || suggesting || busy) return
    setSuggesting(true)
    setError(undefined)
    try {
      const res = await api.suggestCommitMessage(path)
      setMsg(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggesting(false)
    }
  }, [api, busy, path, suggesting])

  const submit = useCallback(async () => {
    if (path === undefined || busy || suggesting || diff === null) return
    if (msg.trim().length === 0 || selectedFiles.size === 0) return
    setBusy(true)
    setError(undefined)
    try {
      const filesToCommit = diff.changes.map(c => c.file).filter(f => selectedFiles.has(f))
      const committed = await api.commit(path, msg, filesToCommit)
      setMsg('')
      setBanner(t('notice.committed', { commit: committed.commit, summary: committed.summary }))
      window.dispatchEvent(new CustomEvent('dsh-worktree:refresh'))
      await loadWorkspaceDiff(path, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, busy, diff, loadWorkspaceDiff, msg, path, selectedFiles, suggesting, t])

  const renderedChanges = useMemo(() => {
    if (diff === null || diff.changes.length === 0) return []
    if (viewMode === 'all') return diff.changes
    const found = diff.changes.find(c => c.file === activeFile) ?? diff.changes[0]
    return found !== undefined ? [found] : []
  }, [activeFile, diff, viewMode])

  if (path === undefined) {
    return (
      <div className="owt-gp-root">
        <div className="owt-gp-empty-full">
          <div className="owt-gp-empty-icon"><IconGitBranch size={22} /></div>
          <div className="owt-gp-empty-title">{t('dialog.commit.noTarget')}</div>
        </div>
      </div>
    )
  }

  const branch = diff?.branch || status?.branch || 'HEAD'
  const upstream = status?.upstream
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const totalChanges = diff?.changes.length ?? 0
  const hasChanges = totalChanges > 0
  const allChecked = hasChanges && selectedFiles.size === totalChanges
  const someChecked = selectedFiles.size > 0 && !allChecked
  const canCommit = !busy && !suggesting && selectedFiles.size > 0 && msg.trim().length > 0

  const renderDiffCard = (change: WorktreeChangeRow, lineLimit: number): ReactElement => {
    const parsed = parsedMap.get(change.file)
    const letter = changeLetter(change)
    const sep = change.file.lastIndexOf('/')
    const dirPrefix = sep > 0 ? `${change.file.slice(0, sep + 1)}` : ''
    const baseName = sep >= 0 ? change.file.slice(sep + 1) : change.file
    const add = change.add ?? parsed?.add ?? 0
    const del = change.del ?? parsed?.del ?? 0
    const rows = parsed?.rows ?? []
    const isCollapsed = collapsedCards.has(change.file)
    const slicedRows = rows.length > lineLimit ? rows.slice(0, lineLimit) : rows

    return (
      <section
        key={change.file}
        ref={el => {
          if (el !== null) cardRefs.current.set(change.file, el)
          else cardRefs.current.delete(change.file)
        }}
        className="owt-gp-card"
      >
        <header className="owt-gp-card-head" onClick={() => toggleCard(change.file)}>
          <span className="owt-gp-chevron">
            <IconChevron open={!isCollapsed} size={12} />
          </span>
          <span className="owt-gp-badge" data-kind={letter}>
            {letter}
          </span>
          <span className="owt-gp-card-path" title={change.file}>
            {dirPrefix !== '' && <span className="owt-gp-card-dir">{dirPrefix}</span>}
            <span className="owt-gp-card-name">{baseName}</span>
          </span>
          <span className="owt-gp-card-stats">
            {add > 0 && <span className="owt-gp-add">+{add}</span>}
            {del > 0 && <span className="owt-gp-del">−{del}</span>}
            <DiffStatBlocks add={add} del={del} />
          </span>
        </header>

        {!isCollapsed && (
          <div className="owt-gp-card-body">
            {rows.length === 0 ? (
              <div className="owt-gp-card-empty">
                {loadingFile === change.file ? t('dialog.commit.loading') : t('dialog.commit.noDiffText')}
              </div>
            ) : (
              <div className="owt-gp-table-wrap">
                <table className="owt-gp-table">
                  <tbody>
                    {slicedRows.map((row, idx) => {
                      if (row.kind === 'hunk') {
                        return (
                          <tr key={idx} className="owt-gp-tr-hunk">
                            <td className="owt-gp-td-num owt-gp-td-hunk-gutter" colSpan={2}>
                              ⋯
                            </td>
                            <td className="owt-gp-td-hunk" colSpan={2}>
                              <span className="owt-gp-hunk-range">{row.hunkHeader}</span>
                              {row.hunkContext && <span className="owt-gp-hunk-ctx">{row.hunkContext}</span>}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={idx} className={`owt-gp-tr owt-gp-tr--${row.kind}`}>
                          <td className="owt-gp-td-num">{row.oldNo ?? ''}</td>
                          <td className="owt-gp-td-num">{row.newNo ?? ''}</td>
                          <td className="owt-gp-td-sign">{row.sign}</td>
                          <td className="owt-gp-td-code">{row.code || ' '}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > lineLimit && (
                  <div className="owt-gp-truncated">
                    {t('dialog.commit.truncated', { count: lineLimit })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="owt-gp-root">
      {/* Left Sidebar: Source Control & File Tree */}
      <aside className="owt-gp-sidebar">
        <div className="owt-gp-branchbar">
          <div className="owt-gp-branch-left">
            <span className="owt-gp-branch-pill" title={path}>
              <IconGitBranch size={13} />
              <span>{branch}</span>
            </span>
            {upstream !== undefined && (
              <span className="owt-gp-upstream" title={upstream}>
                <span>→ {upstream}</span>
                {ahead > 0 && <span className="owt-gp-ahead">↑{ahead}</span>}
                {behind > 0 && <span className="owt-gp-behind">↓{behind}</span>}
              </span>
            )}
          </div>
          <button
            type="button"
            className="owt-gp-iconbtn"
            title={t('dialog.commit.refresh')}
            aria-label={t('dialog.commit.refresh')}
            disabled={loading || refreshing || busy}
            onClick={() => { void loadWorkspaceDiff(path, false) }}
          >
            <IconRefresh size={13.5} spinning={loading || refreshing} />
          </button>
        </div>

        <div className="owt-gp-composer">
          <div className="owt-gp-textarea-box">
            <textarea
              className="owt-gp-textarea"
              placeholder={t('dialog.commit.msgPlaceholder')}
              disabled={busy || suggesting || !hasChanges}
              rows={3}
              value={msg}
              onChange={event => { setMsg(event.target.value) }}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canCommit) {
                  event.preventDefault()
                  void submit()
                }
              }}
            />
            <div className="owt-gp-textarea-foot">
              <span className="owt-gp-subject-len" data-warn={(msg.split('\n')[0]?.length ?? 0) > 72}>
                {msg.length > 0 ? `${msg.split('\n')[0]?.length ?? 0} / 72` : ''}
              </span>
              <button
                type="button"
                className="owt-gp-aibtn"
                disabled={busy || suggesting || !hasChanges}
                onClick={() => { void handleSuggest() }}
              >
                <IconSparkle size={12.5} />
                <span>{suggesting ? t('dialog.commit.aiDoing') : t('dialog.commit.ai')}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="owt-gp-submit"
            disabled={!canCommit}
            onClick={() => { void submit() }}
          >
            <IconCheck size={13.5} />
            <span>
              {busy
                ? t('dialog.commit.submitting')
                : t('dialog.commit.submit', { count: selectedFiles.size })}
            </span>
          </button>

          {error !== undefined && (
            <div className="owt-gp-alert" data-kind="error">
              {t('notice.error', { message: error })}
            </div>
          )}
          {banner !== undefined && (
            <div className="owt-gp-alert" data-kind="ok">
              {banner}
            </div>
          )}
        </div>

        <div className="owt-gp-tree-head">
          <label className="owt-gp-checkall" title={t('dialog.commit.selectAll')}>
            <input
              type="checkbox"
              disabled={!hasChanges || busy}
              checked={allChecked}
              ref={el => {
                if (el !== null) el.indeterminate = someChecked
              }}
              onChange={toggleSelectAll}
            />
            <span className="owt-gp-tree-title">{t('dialog.commit.changes')}</span>
            <span className="owt-gp-count-pill">{totalChanges}</span>
          </label>
          {(totals.add > 0 || totals.del > 0) && (
            <span className="owt-gp-tree-totals">
              {totals.add > 0 && <span className="owt-gp-add">+{totals.add}</span>}
              {totals.del > 0 && <span className="owt-gp-del">−{totals.del}</span>}
            </span>
          )}
        </div>

        <div className="owt-gp-tree-scroll">
          {loading && diff === null && (
            <div className="owt-gp-side-hint">{t('dialog.commit.loading')}</div>
          )}
          {!loading && !hasChanges && (
            <div className="owt-gp-side-hint">{t('dialog.commit.clean')}</div>
          )}
          {hasChanges &&
            groups.map(group => {
              const dirCollapsed = group.dir !== '' && collapsedDirs.has(group.dir)
              return (
                <div key={group.dir || '/'} className="owt-gp-group">
                  {group.dir !== '' && (
                    <button
                      type="button"
                      className="owt-gp-dir-row"
                      onClick={() => toggleDir(group.dir)}
                    >
                      <span className="owt-gp-chevron">
                        <IconChevron open={!dirCollapsed} size={11} />
                      </span>
                      <span className="owt-gp-dir-icon">
                        <IconFolder size={13} />
                      </span>
                      <span className="owt-gp-dir-name" title={group.dir}>{group.dir}</span>
                      <span className="owt-gp-dir-count">{group.files.length}</span>
                    </button>
                  )}
                  {!dirCollapsed &&
                    group.files.map(({ change, baseName, add, del, letter }) => {
                      const isSelected = activeFile === change.file
                      const isChecked = selectedFiles.has(change.file)
                      return (
                        <div
                          key={change.file}
                          className="owt-gp-file-row"
                          data-active={isSelected}
                          data-nested={group.dir !== ''}
                          onClick={() => handleSelectFileRow(change.file)}
                        >
                          <input
                            type="checkbox"
                            className="owt-gp-file-check"
                            checked={isChecked}
                            disabled={busy}
                            onClick={event => event.stopPropagation()}
                            onChange={() => toggleCheckFile(change.file)}
                          />
                          <span className="owt-gp-file-icon">
                            <IconFile size={13} />
                          </span>
                          <span className="owt-gp-file-name" title={change.file}>
                            {baseName}
                          </span>
                          <span className="owt-gp-file-stats">
                            {add > 0 && <span className="owt-gp-add">+{add}</span>}
                            {del > 0 && <span className="owt-gp-del">−{del}</span>}
                          </span>
                          <span className="owt-gp-badge" data-kind={letter}>
                            {letter}
                          </span>
                        </div>
                      )
                    })}
                </div>
              )
            })}
        </div>
      </aside>

      {/* Right Main Area: Diff Viewer */}
      <main className="owt-gp-main">
        {hasChanges && (
          <div className="owt-gp-main-bar">
            <div className="owt-gp-main-crumb">
              {viewMode === 'single' && activeFile !== null ? (
                <>
                  <IconFile size={13.5} />
                  <span className="owt-gp-crumb-text" title={activeFile}>{activeFile}</span>
                </>
              ) : (
                <span className="owt-gp-crumb-text">
                  {t('dialog.commit.changes')} · {totalChanges}
                </span>
              )}
            </div>
            <div className="owt-gp-seg" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'single'}
                className="owt-gp-seg-btn"
                data-active={viewMode === 'single'}
                onClick={() => setViewMode('single')}
              >
                {t('dialog.commit.modeSingle')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'all'}
                className="owt-gp-seg-btn"
                data-active={viewMode === 'all'}
                onClick={() => setViewMode('all')}
              >
                {t('dialog.commit.modeAll')}
              </button>
            </div>
          </div>
        )}

        <div className="owt-gp-diff-scroll" ref={diffScrollRef}>
          {loading && diff === null && (
            <div className="owt-gp-empty-full">
              <div className="owt-gp-empty-sub">{t('dialog.commit.loading')}</div>
            </div>
          )}
          {!loading && !hasChanges && (
            <div className="owt-gp-empty-full">
              <div className="owt-gp-empty-icon" data-clean="true">
                <IconCheck size={22} />
              </div>
              <div className="owt-gp-empty-title">{t('dialog.commit.clean')}</div>
              <div className="owt-gp-empty-sub">{t('dialog.commit.cleanSub')}</div>
            </div>
          )}
          {hasChanges && (
            <div className="owt-gp-cards">
              {renderedChanges.map(change =>
                renderDiffCard(change, viewMode === 'single' ? MAX_FILE_RENDER_LINES : Math.ceil(MAX_ALL_RENDER_LINES / Math.max(1, renderedChanges.length))),
              )}
              {diff?.truncated && (
                <div className="owt-gp-truncated">
                  {t('dialog.commit.truncated', { count: MAX_ALL_RENDER_LINES })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
