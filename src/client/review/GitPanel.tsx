/**
 * Git Source-Control & Diff Review Workbench mounted in the conversation view
 * tab strip ('conversation.view'), next to 对话 / 轨迹 / AOCI.
 *
 * Layout: IDE two-pane split workbench
 * - Left pane (320px): branch & upstream bar, commit composer with inline AI
 *   writer, and directory-grouped file tree with per-file staging checkboxes.
 * - Right pane (flex 1): three tabs — 变更 (structured unified diff; per-hunk
 *   commit checkboxes, stage/discard hunk buttons, per-file history/blame),
 *   日志 (commit log with client-side filter + commit detail), 比较 (diff
 *   against a local base branch). Push goes through a confirm overlay.
 * @module dsh-git-review-plugin/client/GitPanel
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type {
  GitBlameValue,
  GitChangeRow,
  GitCommitDetailValue,
  GitCommitRow,
  GitCompareValue,
  GitDiffValue,
  GitHunkPatch,
  GitStatusValue,
} from '../../review/protocol.ts'
import type { GitApi } from './api.ts'
import { assemblePatch, changeLetter, filterCommits, parseStructuredDiff, type DiffLineRow, type ParsedFileDiff } from './diffParser.ts'
import { buildGraphRows, GraphCell, decorationOf, refLabel } from './graph.tsx'
import type { ReactNode } from 'react'
import {
  IconBack,
  IconCheck,
  IconChevron,
  IconFolder,
  IconGitBranch,
  IconPush,
  IconRefresh,
  IconWhitespace,
  IconSparkle,
  FileTypeGlyph,
} from './icons.tsx'

type Translate = (key: string, params?: Record<string, string | number>) => string

/** Persisted UI flag (graph section collapse); storage misses keep the default. */
function loadStoredFlag(key: string, fallback: boolean): boolean {
  try {
    return window.localStorage.getItem(key) === null ? fallback : window.localStorage.getItem(key) === '1'
  } catch {
    return fallback
  }
}

function saveStoredFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* private mode etc. — collapse state just does not persist */
  }
}

const MAX_FILE_RENDER_LINES = 2500
const MAX_ALL_RENDER_LINES = 4500
const LOG_LIMIT = 200
/** Fixed pixel height of one graph row (keeps the SVG cell and row in sync). */
const GRAPH_ROW_HEIGHT = 24
/** Newline character without a backslash escape (keeps this file escape-free). */
const LF = String.fromCharCode(10)

interface CommitGroup {
  readonly dir: string
  readonly files: ReadonlyArray<{
    readonly change: GitChangeRow
    readonly baseName: string
    readonly add: number
    readonly del: number
    readonly letter: 'A' | 'M' | 'D' | 'R'
  }>
}

function buildGroups(
  changes: readonly GitChangeRow[],
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

/** 'YYYY-MM-DD' slice of an ISO commit date. */
function fmtDate(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso
}

/** Session summary slice needed to resolve a conversation's checkout. */
export interface SessionSummarySlice {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, { readonly cwd?: string } | undefined>>
}

/** Injected face for the 'conversation.view' Git tab body. */
export interface CommitPanelProps {
  api: GitApi
  t: Translate
  sessionId: string
  useSessions: <R>(selector: (state: SessionSummarySlice) => R) => R
}

type RightTab = 'changes' | 'log' | 'compare'

export function CommitPanel(props: CommitPanelProps): ReactElement {
  const { api, t, sessionId, useSessions } = props
  const sessions = useSessions(s => s)
  const path = useMemo(() => sessions.byId[sessionId]?.cwd, [sessions, sessionId])

  const [diff, setDiff] = useState<GitDiffValue | null>(null)
  const [status, setStatus] = useState<GitStatusValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [banner, setBanner] = useState<string | undefined>(undefined)

  const [selectedFiles, setSelectedFiles] = useState<ReadonlySet<string>>(() => new Set())
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single')
  const [ignoreWs, setIgnoreWs] = useState(false)
  const [collapsedDirs, setCollapsedDirs] = useState<ReadonlySet<string>>(() => new Set())
  const [collapsedCards, setCollapsedCards] = useState<ReadonlySet<string>>(() => new Set())
  const [extraParsed, setExtraParsed] = useState<ReadonlyMap<string, ParsedFileDiff>>(() => new Map())
  const [loadingFile, setLoadingFile] = useState<string | null>(null)

  // Right-pane tabs + review features (P0 git review).
  const [tab, setTab] = useState<RightTab>('changes')
  /** file -> selected hunk banner row indexes (rows index into ParsedFileDiff.rows). */
  const [hunkSel, setHunkSel] = useState<ReadonlyMap<string, ReadonlySet<number>>>(() => new Map())
  const [history, setHistory] = useState<{ file: string; commits: readonly GitCommitRow[] } | null>(null)
  const [blame, setBlame] = useState<GitBlameValue | null>(null)
  const [blameLoading, setBlameLoading] = useState(false)
  const [logCommits, setLogCommits] = useState<readonly GitCommitRow[] | null>(null)
  const [graphCommits, setGraphCommits] = useState<readonly GitCommitRow[] | null>(null)
  const [graphOpen, setGraphOpen] = useState(() => loadStoredFlag('owt.gp.graph.open', true))
  const [logTruncated, setLogTruncated] = useState(false)
  const [logRange, setLogRange] = useState<'all' | 'ahead'>('all')
  const [logQuery, setLogQuery] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [detail, setDetail] = useState<GitCommitDetailValue | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [repoRoot, setRepoRoot] = useState<string | null>(null)
  const [localBranches, setLocalBranches] = useState<readonly string[]>([])
  const [compareRef, setCompareRef] = useState<string | null>(null)
  const [compareData, setCompareData] = useState<GitCompareValue | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [pushAhead, setPushAhead] = useState<readonly GitCommitRow[] | null>(null)
  const [forceLease, setForceLease] = useState(false)

  const diffScrollRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  // Host tab wrappers are not guaranteed to constrain height; pin the workbench
  // to the viewport so internal panes scroll (and sticky headers stick).
  const [rootHeight, setRootHeight] = useState<string>('100%')
  useEffect(() => {
    const el = rootRef.current
    if (el === null) return
    const update = () => {
      const top = el.getBoundingClientRect().top
      setRootHeight(top > 1 ? 'calc(100dvh - ' + Math.round(top) + 'px)' : '100%')
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [])
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const attemptedFilesRef = useRef<Set<string>>(new Set())
  const loadCtrlRef = useRef<AbortController | null>(null)

  // Branch/upstream/ahead/behind derived BEFORE the hooks that read them.
  const branch = diff?.branch || status?.branch || 'HEAD'
  const upstream = status?.upstream
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0

  const loadWorkspaceDiff = useCallback(
    async (targetPath: string, isInitial: boolean) => {
      // Abort any in-flight load first so a slow refresh can never overwrite a newer one.
      loadCtrlRef.current?.abort()
      const controller = new AbortController()
      loadCtrlRef.current = controller
      const signal = controller.signal
      if (isInitial) setLoading(true)
      else setRefreshing(true)
      setError(undefined)
      try {
        const [nextDiff, nextStatus] = await Promise.all([
          api.diff(targetPath, signal, undefined, ignoreWs),
          api.status(targetPath, signal).catch(() => null),
        ])
        if (signal.aborted) return
        attemptedFilesRef.current.clear()
        setExtraParsed(new Map())
        setHunkSel(new Map())
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
        if (signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [api, ignoreWs],
  )

  // Graph section (left pane, below the changes list): a windowed log feeds
  // the lane layout. Refreshes ride the same triggers as the diff reload
  // (mount, commit, push, dsh-git-review:refresh); failures keep the old rows.
  const loadGraph = useCallback(
    (targetPath: string) => {
      api
        .log(targetPath, { limit: LOG_LIMIT })
        .then(value => { setGraphCommits(value.commits) })
        .catch(() => { /* decorative section — stale rows beat an error banner */ })
    },
    [api],
  )
  const graphRows = useMemo(() => buildGraphRows(graphCommits ?? []), [graphCommits])
  const toggleGraph = useCallback(() => {
    setGraphOpen(open => {
      saveStoredFlag('owt.gp.graph.open', !open)
      return !open
    })
  }, [])

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
    setHunkSel(new Map())
    setHistory(null)
    setBlame(null)
    setDetail(null)
    setLogCommits(null)
    setGraphCommits(null)
    setCompareData(null)
    setCompareRef(null)
    setRepoRoot(null)
    setLocalBranches([])
    setPushOpen(false)
    void loadWorkspaceDiff(path, true)
    void loadGraph(path)
    return () => loadCtrlRef.current?.abort()
  }, [loadWorkspaceDiff, loadGraph, path])

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
      .diff(path, controller.signal, activeFile, ignoreWs)
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
  }, [activeFile, api, diff, ignoreWs, parsedMap, path])

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

  // Files committed via selected hunks only (whole-file checkbox off, hunks checked, parsable, tracked).
  const hunkReadyFiles = useMemo(() => {
    if (diff === null) return []
    return diff.changes.filter(
      c => !selectedFiles.has(c.file) && !c.untracked && (hunkSel.get(c.file)?.size ?? 0) > 0 && parsedMap.has(c.file),
    )
  }, [diff, hunkSel, parsedMap, selectedFiles])
  // Untracked files with hunk checks degenerate to whole-file commits at submit time.
  const untrackedHunkCount = useMemo(() => {
    if (diff === null) return 0
    return diff.changes.filter(
      c => c.untracked && !selectedFiles.has(c.file) && (hunkSel.get(c.file)?.size ?? 0) > 0,
    ).length
  }, [diff, hunkSel, selectedFiles])
  const hunkTouched = hunkReadyFiles.length > 0 || untrackedHunkCount > 0 || [...hunkSel.values()].some(s => s.size > 0)

  const switchTab = useCallback((next: RightTab) => {
    setTab(next)
    setDetail(null)
    setBlame(null)
    setHistory(null)
  }, [])

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

  const toggleHunk = useCallback((file: string, idx: number) => {
    setHunkSel(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(file) ?? [])
      if (set.has(idx)) set.delete(idx)
      else set.add(idx)
      if (set.size === 0) next.delete(file)
      else next.set(file, set)
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
      if (tab !== 'changes') {
        // Selecting a file in the tree always brings the diff back to the front.
        setTab('changes')
        setDetail(null)
        setBlame(null)
        setHistory(null)
        return
      }
      if (viewMode === 'all') {
        const el = cardRefs.current.get(file)
        el?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        })
      } else if (diffScrollRef.current !== null) {
        diffScrollRef.current.scrollTop = 0
      }
    },
    [tab, viewMode],
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

  const handlePush = useCallback(
    async (withLease = false) => {
      if (path === undefined || pushing || busy || loading || refreshing) return
      setPushing(true)
      setError(undefined)
      try {
        const pushed = await api.push(path, withLease ? { forceWithLease: true } : undefined)
        setPushOpen(false)
        setBanner(t('notice.pushed', { branch: pushed.branch, upstream: pushed.upstream }))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setPushing(false)
        // Reload so ahead/behind and the upstream pill reflect the push.
        void loadWorkspaceDiff(path, false)
        if (path !== undefined) loadGraph(path)
      }
    },
    [api, busy, loadGraph, loadWorkspaceDiff, loading, path, pushing, refreshing, t],
  )

  // Push button: without an upstream keep the legacy direct push; with one, open the confirm overlay.
  const openPushOverlay = useCallback(async () => {
    if (path === undefined) return
    if (upstream === undefined) {
      await handlePush()
      return
    }
    setForceLease(false)
    setPushAhead(null)
    setPushOpen(true)
    try {
      const v = await api.log(path, { refRange: upstream + '..HEAD' })
      setPushAhead(v.commits)
    } catch {
      setPushAhead([])
    }
  }, [api, handlePush, path, upstream])

  const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

  const openHistory = useCallback(
    async (file: string) => {
      if (path === undefined) return
      setBlame(null)
      setDetail(null)
      setTab('changes')
      setHistory({ file, commits: [] })
      try {
        const v = await api.log(path, { file, limit: LOG_LIMIT })
        setHistory({ file, commits: v.commits })
      } catch (err) {
        setHistory(null)
        setError(errText(err))
      }
    },
    [api, path],
  )

  const openBlame = useCallback(
    async (file: string) => {
      if (path === undefined) return
      setHistory(null)
      setDetail(null)
      setTab('changes')
      setBlame(null)
      setBlameLoading(true)
      try {
        setBlame(await api.blame(path, file))
      } catch (err) {
        setError(errText(err))
      } finally {
        setBlameLoading(false)
      }
    },
    [api, path],
  )

  const openCommit = useCallback(
    async (hash: string) => {
      if (path === undefined) return
      setDetailLoading(true)
      setError(undefined)
      try {
        setDetail(await api.showCommit(path, hash))
      } catch (err) {
        setError(errText(err))
      } finally {
        setDetailLoading(false)
      }
    },
    [path],
  )

  // Log tab: full branch history by default; the 'unpushed' preset needs a known upstream.
  useEffect(() => {
    if (path === undefined || tab !== 'log' || detail !== null) return
    const controller = new AbortController()
    setLogLoading(true)
    api
      .log(
        path,
        logRange === 'ahead' && upstream !== undefined ? { refRange: upstream + '..HEAD', limit: LOG_LIMIT } : { limit: LOG_LIMIT },
        controller.signal,
      )
      .then(v => {
        if (controller.signal.aborted) return
        setLogCommits(v.commits)
        setLogTruncated(v.truncated === true)
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(errText(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLogLoading(false)
      })
    return () => controller.abort()
  }, [api, detail, logRange, path, tab, upstream])

  // Local branch list for the compare tab. `git for-each-ref` sees the whole
  // repo's refs from any checkout, so the checkout path itself works as the
  // query root — no lifecycle `overview` call needed.
  useEffect(() => {
    if (tab !== 'compare' || path === undefined || repoRoot !== null) return
    let cancelled = false
    const resolve = async (): Promise<void> => {
      setRepoRoot(path)
      try {
        const b = await api.branches(path)
        if (!cancelled) setLocalBranches(b.localBranches.filter(x => x !== branch))
      } catch {
        if (!cancelled) setLocalBranches([])
      }
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [api, branch, path, repoRoot, tab])

  const loadCompare = useCallback(
    async (ref: string) => {
      if (path === undefined) return
      setCompareRef(ref)
      setDetail(null)
      setCompareLoading(true)
      setError(undefined)
      try {
        setCompareData(await api.compare(path, ref))
      } catch (err) {
        setCompareData(null)
        setError(errText(err))
      } finally {
        setCompareLoading(false)
      }
    },
    [path],
  )

  const applyHunk = useCallback(
    async (file: string, idx: number, opts: { cached?: boolean; reverse?: boolean }) => {
      if (path === undefined) return
      const parsed = parsedMap.get(file)
      if (parsed === undefined) return
      const patch = assemblePatch(parsed, [idx])
      if (patch === '') return
      setError(undefined)
      try {
        await api.applyPatch(path, patch, opts)
        setBanner(t(opts.cached === true ? 'gp.hunk.staged' : 'gp.hunk.discarded'))
        await loadWorkspaceDiff(path, false)
      } catch (err) {
        setError(errText(err))
      }
    },
    [api, loadWorkspaceDiff, parsedMap, path, t],
  )

  const submit = useCallback(async () => {
    if (path === undefined || busy || suggesting || diff === null) return
    if (msg.trim().length === 0) return
    // Whole-file selection wins over its hunk selection (contract); hunk patches
    // apply only to files whose whole checkbox is off.
    const wholeFiles = diff.changes.map(c => c.file).filter(f => selectedFiles.has(f))
    const hunkPatches: GitHunkPatch[] = []
    const extraWhole: string[] = []
    for (const change of hunkReadyFiles) {
      const parsed = parsedMap.get(change.file)
      const idxs = [...(hunkSel.get(change.file) ?? [])]
      if (parsed === undefined) {
        extraWhole.push(change.file)
        continue
      }
      const patch = assemblePatch(parsed, idxs)
      // shortcut: unparsable (e.g. binary-ish) diff degenerates to a whole-file commit
      if (patch === '') extraWhole.push(change.file)
      else hunkPatches.push({ file: change.file, patch })
    }
    // Untracked files cannot go through hunk patches (git apply may reject them) — commit them whole.
    for (const change of diff.changes) {
      if (!change.untracked || selectedFiles.has(change.file)) continue
      if ((hunkSel.get(change.file)?.size ?? 0) > 0) extraWhole.push(change.file)
    }
    if (wholeFiles.length === 0 && extraWhole.length === 0 && hunkPatches.length === 0) return
    setBusy(true)
    setError(undefined)
    try {
      const filesToCommit = [...wholeFiles, ...extraWhole]
      const committed = await api.commit(
        path,
        msg,
        filesToCommit,
        hunkPatches.length > 0 ? { hunks: hunkPatches } : undefined,
      )
      setMsg('')
      setBanner(t('notice.committed', { commit: committed.commit, summary: committed.summary }))
      window.dispatchEvent(new CustomEvent('dsh-git-review:refresh'))
      await loadWorkspaceDiff(path, false)
      loadGraph(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, busy, diff, hunkReadyFiles, hunkSel, loadGraph, loadWorkspaceDiff, msg, parsedMap, path, selectedFiles, suggesting, t])

  const renderedChanges = useMemo(() => {
    if (diff === null || diff.changes.length === 0) return []
    if (viewMode === 'all') return diff.changes
    const found = diff.changes.find(c => c.file === activeFile) ?? diff.changes[0]
    return found !== undefined ? [found] : []
  }, [activeFile, diff, viewMode])

  // Pre-rendered parse maps for the detail (showCommit) and compare bodies.
  const detailParsedMap = useMemo(
    () => (detail !== null ? parseStructuredDiff(detail.diff) : new Map<string, ParsedFileDiff>()),
    [detail],
  )
  const compareParsedMap = useMemo(
    () => (compareData !== null ? parseStructuredDiff(compareData.diff) : new Map<string, ParsedFileDiff>()),
    [compareData],
  )
  const shownLog = useMemo(
    () => (logCommits === null ? null : filterCommits(logCommits, logQuery)),
    [logCommits, logQuery],
  )

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

  const totalChanges = diff?.changes.length ?? 0
  const hasChanges = totalChanges > 0
  const allChecked = hasChanges && selectedFiles.size === totalChanges
  const someChecked = selectedFiles.size > 0 && !allChecked
  const commitCount = selectedFiles.size + hunkReadyFiles.length + untrackedHunkCount
  const canCommit = !busy && !suggesting && msg.trim().length > 0 && commitCount > 0

  const renderCode = (row: DiffLineRow): ReactNode => {
    const code = row.code
    const spans = row.spans
    if (spans === undefined || spans.length === 0) return code.length > 0 ? code : ' '
    const nodes: ReactNode[] = []
    let pos = 0
    spans.forEach((span, idx) => {
      if (span.start > pos) nodes.push(<span key={'p' + idx}>{code.slice(pos, span.start)}</span>)
      nodes.push(
        <span key={'c' + idx} className="owt-gp-inline-chg">
          {code.slice(span.start, span.end)}
        </span>,
      )
      pos = span.end
    })
    if (pos < code.length) nodes.push(<span key="tail">{code.slice(pos)}</span>)
    return nodes
  }

  const renderDiffCard = (
    change: GitChangeRow,
    lineLimit: number,
    map: ReadonlyMap<string, ParsedFileDiff>,
    readonly: boolean,
  ): ReactElement => {
    const parsed = map.get(change.file)
    const letter = changeLetter(change)
    const sep = change.file.lastIndexOf('/')
    const dirPrefix = sep > 0 ? change.file.slice(0, sep + 1) : ''
    const baseName = sep >= 0 ? change.file.slice(sep + 1) : change.file
    const add = change.add ?? parsed?.add ?? 0
    const del = change.del ?? parsed?.del ?? 0
    const rows = parsed?.rows ?? []
    const isCollapsed = collapsedCards.has(change.file)
    const slicedRows = rows.length > lineLimit ? rows.slice(0, lineLimit) : rows
    const hunkChecks = hunkSel.get(change.file)
    // Hunk checkboxes/stage/discard only make sense for tracked worktree changes.
    const hunkControls = !readonly && !change.untracked

    return (
      <section
        key={change.file}
        ref={el => {
          if (el !== null) cardRefs.current.set(change.file, el)
          else cardRefs.current.delete(change.file)
        }}
        className="owt-gp-card"
      >
        <div className="owt-gp-card-head">
          <button
            type="button"
            className="owt-gp-card-head-btn"
            aria-expanded={!isCollapsed}
            onClick={() => toggleCard(change.file)}
          >
            <span className="owt-gp-chevron">
              <IconChevron open={!isCollapsed} size={12} />
            </span>
            <span className="owt-gp-badge" data-kind={letter}>
              {letter}
            </span>
            <span className="owt-gp-card-path" title={change.oldFile !== undefined ? change.oldFile + ' → ' + change.file : change.file}>
              {dirPrefix !== '' && <span className="owt-gp-card-dir">{dirPrefix}</span>}
              {change.oldFile !== undefined && (
                <span className="owt-gp-oldname">{change.oldFile.slice(change.oldFile.lastIndexOf('/') + 1)} → </span>
              )}
              <span className="owt-gp-card-name">{baseName}</span>
            </span>
            <span className="owt-gp-card-stats">
              {add > 0 && <span className="owt-gp-add">+{add}</span>}
              {del > 0 && <span className="owt-gp-del">−{del}</span>}
            </span>
          </button>
          {!readonly && (
            <span className="owt-gp-head-actions">
              <button
                type="button"
                className="owt-gp-headbtn"
                title={t('gp.history')}
                onClick={() => { void openHistory(change.file) }}
              >
                {t('gp.history')}
              </button>
              <button
                type="button"
                className="owt-gp-headbtn"
                title={t('gp.blame')}
                onClick={() => { void openBlame(change.file) }}
              >
                {t('gp.blame')}
              </button>
            </span>
          )}
        </div>

        {!isCollapsed && (
          <div className="owt-gp-card-body">
            {rows.length === 0 ? (
              <div className="owt-gp-card-empty">
                {loadingFile === change.file ? t('dialog.commit.loading') : t('dialog.commit.noDiffText')}
              </div>
            ) : (
              <div className="owt-gp-table-wrap">
                <table className="owt-gp-table" aria-label={change.file}>
                  <tbody>
                    {slicedRows.map((row, idx) => {
                      if (row.kind === 'hunk') {
                        // Orca-style collapsed-context strip; header text kept for tooltip/AT only.
                        const hunkLabel = row.hunkContext !== undefined && row.hunkContext !== ''
                          ? row.hunkHeader + ' ' + row.hunkContext
                          : row.hunkHeader
                        const checked = hunkChecks?.has(idx) === true
                        return (
                          <tr key={idx} className="owt-gp-tr-hunk" title={hunkLabel}>
                            <td className="owt-gp-td-hunk" colSpan={3}>
                              <div className="owt-gp-hunk-bar">
                                {hunkControls && (
                                  <input
                                    type="checkbox"
                                    className="owt-gp-hunk-check"
                                    checked={checked}
                                    disabled={busy}
                                    aria-label={t('gp.hunk.select')}
                                    title={t('gp.hunk.select')}
                                    onChange={() => toggleHunk(change.file, idx)}
                                  />
                                )}
                                <span className="owt-gp-hunk-strip" aria-hidden="true" />
                                <span className="owt-gp-visually-hidden">{hunkLabel}</span>
                                {hunkControls && (
                                  <span className="owt-gp-head-actions">
                                    <button
                                      type="button"
                                      className="owt-gp-headbtn"
                                      disabled={busy}
                                      title={t('gp.hunk.stageTitle')}
                                      onClick={() => { void applyHunk(change.file, idx, { cached: true }) }}
                                    >
                                      {t('gp.hunk.stage')}
                                    </button>
                                    <button
                                      type="button"
                                      className="owt-gp-headbtn"
                                      data-danger="true"
                                      disabled={busy}
                                      title={t('gp.hunk.discardTitle')}
                                      onClick={() => {
                                        if (window.confirm(t('gp.hunk.discardConfirm'))) {
                                          void applyHunk(change.file, idx, { reverse: true })
                                        }
                                      }}
                                    >
                                      {t('gp.hunk.discard')}
                                    </button>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={idx} className={'owt-gp-tr owt-gp-tr--' + row.kind}>
                          <td className="owt-gp-td-num">{row.newNo ?? row.oldNo ?? ''}</td>
                          <td className="owt-gp-td-sign">{row.sign}</td>
                          <td className="owt-gp-td-code">{renderCode(row)}</td>
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

  /** Shared commit-list renderer for the log tab, per-file history and compare. */
  const renderCommitList = (
    commits: readonly GitCommitRow[],
    onPick: (hash: string) => void,
    truncatedNote?: ReactNode,
  ): ReactElement => (
    <div className="owt-gp-commitlist">
      {commits.map(c => (
        <button key={c.hash} type="button" className="owt-gp-commit-row" onClick={() => onPick(c.hash)}>
          <span className="owt-gp-commit-hash" title={c.hash}>{c.shortHash}</span>
          <span className="owt-gp-commit-author">{c.author}</span>
          <span className="owt-gp-commit-date">{fmtDate(c.date)}</span>
          <span className="owt-gp-commit-subj" title={c.body !== undefined && c.body !== '' ? c.subject + LF + c.body : c.subject}>
            {c.subject}
          </span>
        </button>
      ))}
      {truncatedNote}
    </div>
  )

  /** Commit detail body (showCommit): back bar + diff cards rendered readonly. */
  const renderDetail = (): ReactElement => (
    <div className="owt-gp-cards">
      <div className="owt-gp-detail-bar">
        <button type="button" className="owt-gp-headbtn" onClick={() => setDetail(null)}>
          <IconBack size={12} />
          <span>{t('gp.detail.back')}</span>
        </button>
        <span className="owt-gp-commit-hash" title={detail?.hash ?? ''}>{detail?.hash.slice(0, 10)}</span>
        <span className="owt-gp-detail-meta">
          {detail?.branch} · {t('gp.detail.files', { count: detail?.changes.length ?? 0 })}
        </span>
        {detail?.truncated === true && (
          <span className="owt-gp-detail-meta">{t('gp.detail.truncated')}</span>
        )}
        {detailLoading && <span className="owt-gp-detail-meta">{t('dialog.commit.loading')}</span>}
      </div>
      {detail !== null && detail.changes.length === 0 && (
        <div className="owt-gp-card-empty">{t('dialog.commit.noDiffText')}</div>
      )}
      {detail !== null &&
        detail.changes.map(change => renderDiffCard(change, MAX_FILE_RENDER_LINES, detailParsedMap, true))}
    </div>
  )

  /** Blame body: per-line gutter (hash author date subject) + file content. */
  const renderBlame = (): ReactElement => {
    if (blame === null) {
      return (
        <div className="owt-gp-empty-full">
          <div className="owt-gp-empty-sub">{t('dialog.commit.loading')}</div>
        </div>
      )
    }
    return (
      <div className="owt-gp-cards">
        <div className="owt-gp-detail-bar">
          <button type="button" className="owt-gp-headbtn" onClick={() => setBlame(null)}>
            <IconBack size={12} />
            <span>{t('gp.detail.back')}</span>
          </button>
          <span className="owt-gp-crumb-text" title={blame.file}>{blame.file}</span>
        </div>
        <table className="owt-gp-table" aria-label={blame.file}>
          <tbody>
            {blame.lines.map((ln, i) => {
              const bc = blame.commits[ln.commit]
              const prev = i > 0 ? blame.lines[i - 1] : undefined
              const showMeta = prev === undefined || prev.commit !== ln.commit
              const metaText = bc !== undefined
                ? bc.hash.slice(0, 7) + ' ' + bc.author + ' ' + fmtDate(bc.date) + ' ' + bc.subject
                : ''
              return (
                <tr
                  key={i}
                  className="owt-gp-tr owt-gp-tr--ctx"
                  title={metaText !== '' ? t('gp.blame.lineTitle', { meta: metaText }) : undefined}
                >
                  <td className="owt-gp-blame-meta">{showMeta ? metaText : ''}</td>
                  <td className="owt-gp-td-num">{ln.newNo}</td>
                  <td className="owt-gp-td-code">{ln.code.length > 0 ? ln.code : ' '}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {blame.truncated === true && (
          <div className="owt-gp-truncated">{t('dialog.commit.truncated', { count: blame.lines.length })}</div>
        )}
      </div>
    )
  }

  /** Per-file history list shown inside the changes tab. */
  const renderHistory = (): ReactElement => (
    <div className="owt-gp-commitlist">
      <div className="owt-gp-detail-bar">
        <button type="button" className="owt-gp-headbtn" onClick={() => setHistory(null)}>
          <IconBack size={12} />
          <span>{t('gp.detail.back')}</span>
        </button>
        <span className="owt-gp-crumb-text" title={history?.file ?? ''}>{history?.file}</span>
        <span className="owt-gp-detail-meta">{t('gp.history')}</span>
      </div>
      {(history?.commits.length ?? 0) === 0 ? (
        <div className="owt-gp-side-hint">{t('gp.log.empty')}</div>
      ) : (
        renderCommitList(history?.commits ?? [], hash => { void openCommit(hash) })
      )}
    </div>
  )

  return (
    <div className="owt-gp-root" ref={rootRef} style={{ height: rootHeight }}>
      {/* Left Sidebar: Source Control & File Tree */}
      <aside className="owt-gp-sidebar" aria-label={t('dialog.commit.changes')}>
        <div className="owt-gp-branchbar" data-has-upstream={upstream !== undefined}>
          <div className="owt-gp-branch-left">
            <span className="owt-gp-branch-pill" title={path}>
              <IconGitBranch size={13} />
              <span>{branch}</span>
            </span>
            {(totals.add > 0 || totals.del > 0) && (
              <span className="owt-gp-branch-totals">
                {totals.add > 0 && <span className="owt-gp-add">+{totals.add.toLocaleString('en-US')}</span>}
                {totals.del > 0 && <span className="owt-gp-del">−{totals.del.toLocaleString('en-US')}</span>}
              </span>
            )}
          </div>
          <button
            type="button"
            className="owt-gp-iconbtn"
            title={upstream === undefined ? t('dialog.commit.pushNoUpstream') : t('dialog.commit.push', { count: ahead })}
            aria-label={upstream === undefined ? t('dialog.commit.pushNoUpstream') : t('dialog.commit.push', { count: ahead })}
            disabled={loading || refreshing || busy || pushing || (upstream !== undefined && ahead === 0)}
            onClick={() => { void openPushOverlay() }}
          >
            <IconPush size={13.5} spinning={pushing} />
          </button>
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
        {upstream !== undefined && (
          <div className="owt-gp-upstream-row" title={upstream}>
            <span className="owt-gp-upstream">→ {upstream}</span>
            <span className="owt-gp-upstream-counts">
              {ahead > 0 && <span className="owt-gp-ahead">↑{ahead}</span>}
              {behind > 0 && <span className="owt-gp-behind">↓{behind}</span>}
            </span>
          </div>
        )}

        <div className="owt-gp-composer">
          <div className="owt-gp-textarea-box">
            <button
              type="button"
              className="owt-gp-aibtn"
              title={suggesting ? t('dialog.commit.aiDoing') : t('dialog.commit.ai')}
              aria-label={suggesting ? t('dialog.commit.aiDoing') : t('dialog.commit.ai')}
              disabled={busy || suggesting || !hasChanges}
              onClick={() => { void handleSuggest() }}
            >
              <IconSparkle size={13} />
            </button>
            <textarea
              id={'owt-gp-commit-message-' + sessionId}
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
              <span className="owt-gp-subject-len" data-warn={(msg.split(LF)[0]?.length ?? 0) > 72}>
                {msg.length > 0 ? (msg.split(LF)[0]?.length ?? 0) + ' / 72' : ''}
              </span>
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
                : t('dialog.commit.submit', { count: commitCount })}
            </span>
          </button>

          {hunkTouched && <div className="owt-gp-hint">{t('gp.commit.hunkHint')}</div>}

          {error !== undefined && (
            <div className="owt-gp-alert" data-kind="error" role="alert">
              {t('notice.error', { message: error })}
            </div>
          )}
          {banner !== undefined && (
            <div className="owt-gp-alert" data-kind="ok" role="status" aria-live="polite">
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
                      aria-expanded={!dirCollapsed}
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
                          role="button"
                          tabIndex={0}
                          data-active={isSelected}
                          data-nested={group.dir !== ''}
                          data-kind={letter}
                          aria-current={isSelected ? 'true' : undefined}
                          title={change.oldFile !== undefined ? change.oldFile + ' → ' + change.file : change.file}
                          onClick={() => handleSelectFileRow(change.file)}
                          onKeyDown={event => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleSelectFileRow(change.file)
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            className="owt-gp-file-check"
                            aria-label={t('dialog.commit.selectFile', { file: change.file })}
                            checked={isChecked}
                            disabled={busy}
                            onClick={event => event.stopPropagation()}
                            onChange={() => toggleCheckFile(change.file)}
                          />
                          <span className="owt-gp-file-icon">
                            <FileTypeGlyph path={change.file} size={13} />
                          </span>
                          {change.oldFile !== undefined && (
                            <span className="owt-gp-oldname">{change.oldFile.slice(change.oldFile.lastIndexOf('/') + 1)} →</span>
                          )}
                          <span className="owt-gp-file-name" title={change.file}>
                            {baseName}
                          </span>
                          <span className="owt-gp-file-stats">
                            {add > 0 && <span className="owt-gp-add">+{add.toLocaleString('en-US')}</span>}
                            {del > 0 && <span className="owt-gp-del">−{del.toLocaleString('en-US')}</span>}
                          </span>
                          {change.staged && (
                            <span
                              className="owt-gp-staged-dot"
                              title={t('dialog.commit.staged')}
                              role="img"
                              aria-label={t('dialog.commit.staged')}
                            />
                          )}
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

        <div className="owt-gp-graph" data-open={graphOpen}>
          <button type="button" className="owt-gp-graph-head" aria-expanded={graphOpen} onClick={toggleGraph}>
            <span className="owt-gp-chevron">
              <IconChevron open={graphOpen} size={11} />
            </span>
            <IconGitBranch size={12} />
            <span className="owt-gp-graph-title">{t('gp.graph.title')}</span>
            <span className="owt-gp-count-pill">{graphCommits?.length ?? 0}</span>
          </button>
          {graphOpen && (
            <div className="owt-gp-graph-scroll" role="list">
              {graphRows.length === 0 && <div className="owt-gp-side-hint">{t('gp.graph.empty')}</div>}
              {graphRows.map(row => {
                const decorations = row.commit.refs.map(decorationOf)
                const shown = decorations.slice(0, 3)
                const hidden = decorations.length - shown.length
                return (
                  <div
                    key={row.commit.hash}
                    role="listitem"
                    className="owt-gp-graph-row"
                    tabIndex={0}
                    title={
                      row.commit.subject + LF + row.commit.author + ' · ' + fmtDate(row.commit.date) + ' · ' + row.commit.shortHash
                    }
                    onClick={() => { void openCommit(row.commit.hash) }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void openCommit(row.commit.hash)
                      }
                    }}
                  >
                    <GraphCell row={row} height={GRAPH_ROW_HEIGHT} />
                    {shown.map((decoration, index) => (
                      <span
                        key={decoration.kind + ':' + decoration.name + ':' + String(index)}
                        className={'owt-gp-ref owt-gp-ref-' + decoration.kind}
                        title={refLabel(decoration)}
                      >
                        {refLabel(decoration)}
                      </span>
                    ))}
                    {hidden > 0 && (
                      <span className="owt-gp-ref owt-gp-ref-more" title={t('gp.graph.more', { count: hidden })}>
                        +{String(hidden)}
                      </span>
                    )}
                    <span className="owt-gp-graph-subject">{row.commit.subject}</span>
                    <span className="owt-gp-graph-date">{fmtDate(row.commit.date)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Right Main Area: Tabs (变更 diff / 日志 log / 比较 compare) */}
      <section className="owt-gp-main" role="region" aria-label={t('view.gitTab')}>
        <div className="owt-gp-main-bar">
          <div className="owt-gp-main-crumb">
            {tab !== 'changes' ? (
              <span className="owt-gp-crumb-text">
                {tab === 'log' ? t('gp.tab.log') : t('gp.tab.compare')}
              </span>
            ) : viewMode === 'single' && activeFile !== null ? (
              <>
                <FileTypeGlyph path={activeFile} size={13.5} />
                <span className="owt-gp-crumb-text" title={activeFile}>{activeFile}</span>
              </>
            ) : (
              <span className="owt-gp-crumb-text">
                {t('dialog.commit.changes')} · {totalChanges}
              </span>
            )}
          </div>
          <div className="owt-gp-main-actions">
            <div className="owt-gp-seg" role="tablist" aria-label={t('view.gitTab')}>
              <button
                type="button"
                className="owt-gp-seg-btn"
                data-active={tab === 'changes'}
                aria-pressed={tab === 'changes'}
                onClick={() => switchTab('changes')}
              >
                {t('gp.tab.changes')}
              </button>
              <button
                type="button"
                className="owt-gp-seg-btn"
                data-active={tab === 'log'}
                aria-pressed={tab === 'log'}
                onClick={() => switchTab('log')}
              >
                {t('gp.tab.log')}
              </button>
              <button
                type="button"
                className="owt-gp-seg-btn"
                data-active={tab === 'compare'}
                aria-pressed={tab === 'compare'}
                onClick={() => switchTab('compare')}
              >
                {t('gp.tab.compare')}
              </button>
            </div>
            {tab === 'changes' && hasChanges && history === null && blame === null && (
              <div className="owt-gp-seg" role="group" aria-label={t('dialog.commit.changes')}>
                <button
                  type="button"
                  className="owt-gp-seg-btn"
                  data-active={viewMode === 'single'}
                  aria-pressed={viewMode === 'single'}
                  onClick={() => setViewMode('single')}
                >
                  {t('dialog.commit.modeSingle')}
                </button>
                <button
                  type="button"
                  className="owt-gp-seg-btn"
                  data-active={viewMode === 'all'}
                  aria-pressed={viewMode === 'all'}
                  onClick={() => setViewMode('all')}
                >
                  {t('dialog.commit.modeAll')}
                </button>
              </div>
            )}
            {tab === 'changes' && hasChanges && history === null && blame === null && (
              <button
                type="button"
                className="owt-gp-iconbtn"
                data-active={ignoreWs}
                title={t('dialog.commit.ignoreWs')}
                aria-label={t('dialog.commit.ignoreWs')}
                aria-pressed={ignoreWs}
                onClick={() => setIgnoreWs(v => !v)}
              >
                <IconWhitespace size={13.5} />
              </button>
            )}
            {tab === 'log' && (
              <>
                <input
                  type="text"
                  className="owt-gp-filter"
                  value={logQuery}
                  placeholder={t('gp.log.filter')}
                  aria-label={t('gp.log.filter')}
                  onChange={event => setLogQuery(event.target.value)}
                />
                <div className="owt-gp-seg" role="group" aria-label={t('gp.tab.log')}>
                  <button
                    type="button"
                    className="owt-gp-seg-btn"
                    data-active={logRange === 'all'}
                    aria-pressed={logRange === 'all'}
                    disabled={logLoading}
                    onClick={() => setLogRange('all')}
                  >
                    {t('gp.log.all')}
                  </button>
                  <button
                    type="button"
                    className="owt-gp-seg-btn"
                    data-active={logRange === 'ahead'}
                    aria-pressed={logRange === 'ahead'}
                    disabled={logLoading || upstream === undefined}
                    title={upstream === undefined ? t('gp.log.noUpstream') : undefined}
                    onClick={() => setLogRange('ahead')}
                  >
                    {t('gp.log.ahead')}
                  </button>
                </div>
              </>
            )}
            {tab === 'compare' && (
              <select
                className="owt-gp-select"
                value={compareRef ?? ''}
                aria-label={t('gp.compare.pick')}
                onChange={event => {
                  const v = event.target.value
                  if (v !== '') void loadCompare(v)
                }}
              >
                <option value="" disabled>
                  {t('gp.compare.pick')}
                </option>
                {localBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="owt-gp-diff-scroll" ref={diffScrollRef}>
          {tab === 'changes' && (
            <>
              {history !== null ? (
                renderHistory()
              ) : blame !== null || blameLoading ? (
                renderBlame()
              ) : detail !== null ? (
                renderDetail()
              ) : (
                <>
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
                        renderDiffCard(
                          change,
                          viewMode === 'single'
                            ? MAX_FILE_RENDER_LINES
                            : Math.ceil(MAX_ALL_RENDER_LINES / Math.max(1, renderedChanges.length)),
                          parsedMap,
                          false,
                        ),
                      )}
                      {diff?.truncated === true && (
                        <div className="owt-gp-truncated">
                          {t('dialog.commit.truncated', { count: MAX_ALL_RENDER_LINES })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'log' && (
            <>
              {detail !== null ? (
                renderDetail()
              ) : logLoading && logCommits === null ? (
                <div className="owt-gp-empty-full">
                  <div className="owt-gp-empty-sub">{t('dialog.commit.loading')}</div>
                </div>
              ) : shownLog === null || shownLog.length === 0 ? (
                <div className="owt-gp-empty-full">
                  <div className="owt-gp-empty-sub">{t('gp.log.empty')}</div>
                </div>
              ) : (
                renderCommitList(
                  shownLog,
                  hash => { void openCommit(hash) },
                  logTruncated ? <div className="owt-gp-truncated">{t('gp.log.limit', { count: LOG_LIMIT })}</div> : undefined,
                )
              )}
            </>
          )}

          {tab === 'compare' && (
            <>
              {detail !== null ? (
                renderDetail()
              ) : compareRef === null ? (
                <div className="owt-gp-empty-full">
                  <div className="owt-gp-empty-sub">{t('gp.compare.pickHint')}</div>
                </div>
              ) : compareLoading && compareData === null ? (
                <div className="owt-gp-empty-full">
                  <div className="owt-gp-empty-sub">{t('dialog.commit.loading')}</div>
                </div>
              ) : compareData === null ? (
                <div className="owt-gp-empty-full">
                  <div className="owt-gp-empty-sub">{t('gp.compare.empty', { ref: compareRef })}</div>
                </div>
              ) : (
                <div className="owt-gp-cards">
                  {compareData.commits.length > 0 &&
                    renderCommitList(compareData.commits, hash => { void openCommit(hash) })}
                  {compareData.commits.length === 0 && (
                    <div className="owt-gp-empty-full">
                      <div className="owt-gp-empty-sub">{t('gp.compare.empty', { ref: compareRef })}</div>
                    </div>
                  )}
                  {compareData.changes.length > 0 &&
                    compareData.changes.map(change =>
                      renderDiffCard(
                        change,
                        Math.ceil(MAX_ALL_RENDER_LINES / Math.max(1, compareData.changes.length)),
                        compareParsedMap,
                        true,
                      ),
                    )}
                  {compareData.truncated === true && (
                    <div className="owt-gp-truncated">
                      {t('dialog.commit.truncated', { count: MAX_ALL_RENDER_LINES })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Push confirmation overlay */}
      {pushOpen && (
        <div
          className="owt-gp-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('gp.push.title', { count: pushAhead?.length ?? ahead })}
          onClick={event => {
            if (event.target === event.currentTarget && !pushing) setPushOpen(false)
          }}
        >
          <div className="owt-gp-overlay-box">
            <div className="owt-gp-overlay-title">
              {t('gp.push.title', { count: pushAhead?.length ?? ahead })}
              <span className="owt-gp-detail-meta"> → {upstream}</span>
            </div>
            <div className="owt-gp-overlay-list">
              {pushAhead === null ? (
                <div className="owt-gp-side-hint">{t('dialog.commit.loading')}</div>
              ) : pushAhead.length === 0 ? (
                <div className="owt-gp-side-hint">{t('gp.push.empty')}</div>
              ) : (
                pushAhead.map(c => (
                  <div key={c.hash} className="owt-gp-commit-row" role="presentation">
                    <span className="owt-gp-commit-hash" title={c.hash}>{c.shortHash}</span>
                    <span className="owt-gp-commit-subj" title={c.subject}>{c.subject}</span>
                  </div>
                ))
              )}
            </div>
            <label className="owt-gp-checkall" title={t('gp.push.forceLease')}>
              <input
                type="checkbox"
                checked={forceLease}
                onChange={event => setForceLease(event.target.checked)}
              />
              <span className="owt-gp-tree-title">{t('gp.push.forceLease')}</span>
            </label>
            <div className="owt-gp-overlay-actions">
              <button
                type="button"
                className="owt-gp-headbtn"
                disabled={pushing}
                onClick={() => setPushOpen(false)}
              >
                {t('gp.push.cancel')}
              </button>
              <button
                type="button"
                className="owt-gp-submit owt-gp-push-confirm"
                disabled={pushing}
                onClick={() => { void handlePush(forceLease) }}
              >
                <IconPush size={13} spinning={pushing} />
                <span>{pushing ? t('dialog.commit.submitting') : t('gp.push.confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
