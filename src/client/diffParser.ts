/**
 * Pure unified-diff parser producing structured hunks & dual old/new line numbers.
 * @module dsh-worktree-plugin/client/diffParser
 */
import type { WorktreeChangeRow } from '../protocol.ts'

export interface DiffLineRow {
  readonly kind: 'hunk' | 'add' | 'del' | 'ctx'
  readonly oldNo?: number
  readonly newNo?: number
  readonly sign: string
  readonly code: string
  readonly hunkHeader?: string
  readonly hunkContext?: string
  /** Character ranges inside `code` that differ from the paired line (intra-line highlight). Filled by markInlinePairs. */
  spans?: readonly InlineSpan[]
}

export interface ParsedFileDiff {
  readonly file: string
  readonly add: number
  readonly del: number
  readonly rows: readonly DiffLineRow[]
  readonly binary: boolean
}

export interface InlineSpan {
  readonly start: number
  readonly end: number
}

// Desktop-style guards: only pair equal-count del/add runs, cap line length and pair count
// so a pathological diff can never trigger quadratic LCS work on huge lines.
const MAX_INLINE_CHARS = 300
const MAX_INLINE_RUN = 10
const MAX_INLINE_PAIRS = 200

function spansOf(match: readonly boolean[]): InlineSpan[] {
  const spans: InlineSpan[] = []
  let start = -1
  for (let i = 0; i < match.length; i++) {
    if (!match[i] && start < 0) start = i
    else if (match[i] && start >= 0) {
      spans.push({ start, end: i })
      start = -1
    }
  }
  if (start >= 0) spans.push({ start, end: match.length })
  return spans
}

/** Bounded LCS; returns changed char ranges for both lines, or null when pairing is pointless. */
function changedRanges(a: string, b: string): [InlineSpan[], InlineSpan[]] | null {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0 || n > MAX_INLINE_CHARS || m > MAX_INLINE_CHARS || a === b) return null
  const stride = m + 1
  const dp = new Uint16Array((n + 1) * stride)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * stride + j] =
        a[i] === b[j] ? dp[(i + 1) * stride + j + 1] + 1 : Math.max(dp[(i + 1) * stride + j], dp[i * stride + j + 1])
    }
  }
  const matchA: boolean[] = new Array<boolean>(n).fill(false)
  const matchB: boolean[] = new Array<boolean>(m).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      matchA[i] = true
      matchB[j] = true
      i++
      j++
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) i++
    else j++
  }
  const spansA = spansOf(matchA)
  const spansB = spansOf(matchB)
  if (spansA.length === 0 && spansB.length === 0) return null
  return [spansA, spansB]
}

/** Pair equal-count del/add runs and tag changed character ranges on both sides. */
function markInlinePairs(rows: DiffLineRow[]): void {
  let budget = MAX_INLINE_PAIRS
  for (let i = 0; i < rows.length; ) {
    if (rows[i]!.kind !== 'del') {
      i++
      continue
    }
    const dels: DiffLineRow[] = []
    while (i < rows.length && rows[i]!.kind === 'del') dels.push(rows[i++]!)
    const adds: DiffLineRow[] = []
    while (i < rows.length && rows[i]!.kind === 'add') adds.push(rows[i++]!)
    if (dels.length === 0 || dels.length !== adds.length || dels.length > MAX_INLINE_RUN) continue
    for (let k = 0; k < dels.length && budget > 0; k++) {
      const delRow = dels[k]!
      const addRow = adds[k]!
      const spans = changedRanges(delRow.code, addRow.code)
      if (spans === null) continue
      delRow.spans = spans[0]
      addRow.spans = spans[1]
      budget--
    }
  }
}

/** Parse combined `git diff` text into structured per-file hunks & numbered lines. */
export function parseStructuredDiff(raw: string): Map<string, ParsedFileDiff> {
  const result = new Map<string, ParsedFileDiff>()
  if (!raw) return result

  const lines = raw.split('\n')
  let currentFile: string | null = null
  let add = 0
  let del = 0
  let binary = false
  let rows: DiffLineRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  const flush = (): void => {
    if (currentFile !== null) {
      markInlinePairs(rows)
      result.set(currentFile, { file: currentFile, add, del, rows, binary })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith('diff --git ')) {
      flush()
      const m = /^diff --git a\/(.*) b\/(.*)$/.exec(line)
      currentFile = m !== null ? m[2]! : line.slice(11)
      add = 0
      del = 0
      binary = false
      rows = []
      inHunk = false
      continue
    }
    if (currentFile === null) continue

    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      binary = true
      continue
    }

    if (line.startsWith('@@ ')) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line)
      if (m !== null) {
        oldLine = Number.parseInt(m[1]!, 10)
        newLine = Number.parseInt(m[2]!, 10)
        const endIdx = line.indexOf('@@', 2)
        const header = endIdx >= 0 ? line.slice(0, endIdx + 2) : line
        const ctxText = (m[3] ?? '').trim()
        rows.push({ kind: 'hunk', sign: '@@', code: line, hunkHeader: header, hunkContext: ctxText })
        inHunk = true
        continue
      }
    }

    if (!inHunk) continue
    if (line.startsWith('\\ No newline at end of file')) continue

    const prefix = line[0]
    if (prefix === '+') {
      add++
      rows.push({ kind: 'add', newNo: newLine++, sign: '+', code: line.slice(1) })
    } else if (prefix === '-') {
      del++
      rows.push({ kind: 'del', oldNo: oldLine++, sign: '-', code: line.slice(1) })
    } else if (prefix === ' ' || line === '') {
      if (line === '' && i === lines.length - 1) continue
      rows.push({ kind: 'ctx', oldNo: oldLine++, newNo: newLine++, sign: ' ', code: line.length > 0 ? line.slice(1) : '' })
    }
  }
  flush()
  return result
}

/** Single status letter shown on a change row (`??` reads as A like VS Code). */
export function changeLetter(change: WorktreeChangeRow): 'A' | 'M' | 'D' | 'R' {
  if (change.untracked) return 'A'
  const code = change.status.trim()
  const ch = code[0]
  if (ch === 'A') return 'A'
  if (ch === 'D') return 'D'
  if (ch === 'R' || ch === 'C') return 'R'
  return 'M'
}
