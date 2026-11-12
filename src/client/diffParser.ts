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
}

export interface ParsedFileDiff {
  readonly file: string
  readonly add: number
  readonly del: number
  readonly rows: readonly DiffLineRow[]
  readonly binary: boolean
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
