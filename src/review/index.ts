/**
 * dsh-git-review-plugin — host half.
 *
 * Exposes `rGitReview` over Typert SRC mode:
 * - Browser verbs (`status`, `diff`, `commit`, `push`, `log`, `showCommit`,
 *   `compare`, `blame`, `applyPatch`, `suggestCommitMessage`, `branches`)
 *   operate on any git checkout via a plain `path` argument.
 * - Agent tools (`git_diff`, `git_commit`) call the same service methods
 *   under the calling Session's sandbox policy.
 * @module dsh-git-review-plugin
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-fs'

function randomHex6(): string {
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
import type {
  GitApplyPatchValue,
  GitBlameCommit,
  GitBlameLine,
  GitBlameValue,
  GitBranchesValue,
  GitChangeRow,
  GitCommitDetailValue,
  GitCommitRow,
  GitCommitValue,
  GitCompareValue,
  GitHunkPatch,
  GitLogValue,
  GitDiffValue,
  GitEnvelope,
  GitErrorCode,
  GitPushValue,
  GitStatusValue,
  GitSuggestMessageValue,
} from './protocol.ts'

const COMMAND_TIMEOUT_MS = 120_000
const COMMAND_GRACE_MS = 5_000
const MAX_OUTPUT_BYTES = 1 << 20
const MAX_DIFF_STDOUT_BYTES = 4 << 20
const MAX_DIFF_CHARS = 768_000
const PER_FILE_DIFF_CHARS = 96_000
const SUGGEST_DIFF_CHARS = 48_000
const SUGGEST_TIMEOUT_MS = 60_000

const NOISY_DIFF_PATHSPECS = [
  ':(exclude)*.map',
  ':(exclude)*.min.js',
  ':(exclude)*.min.css',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)package-lock.json',
  ':(exclude)yarn.lock',
] as const

// P0 git review: `git log --pretty` with 0x1f field / 0x1e record separators so
// authors and subjects containing tabs or newlines can never corrupt parsing.
const LOG_FORMAT = '%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1f%d%x1f%P%x1e'
const DEFAULT_LOG_LIMIT = 200
const MAX_LOG_LIMIT = 1000
const MAX_BLAME_LINES = 5000

// Tiny node one-liners for file ops `fs()` cannot express (binary copy, temp
// writes outside sandbox-managed dirs).
const FS_COPY_SCRIPT = "import fs from 'node:fs/promises'; const [src, dst] = process.argv.slice(1); await fs.copyFile(src, dst);\n"
const FS_WRITE_SCRIPT = "import fs from 'node:fs/promises'; const [dst, text] = process.argv.slice(1); await fs.writeFile(dst, text, 'utf8');\n"
const FS_UNLINK_SCRIPT = "import fs from 'node:fs/promises'; await Promise.all(process.argv.slice(1).map(p => fs.rm(p, { force: true })));\n"

interface AgentLike {
  readonly session: { readonly id: string }
}

interface SpawnSpec {
  argv: readonly string[]
  cwd: string
  env: Record<string, string | undefined>
  signal: AbortSignal
  graceMs: number
  stdio: { stdin: 'ignore'; stdout: { maxBytes: number }; stderr: { maxBytes: number } }
}

interface SpawnedProcess {
  done: Promise<{ exitCode: number | null; signal: string | null }>
  collected: {
    stdout: { readFrom(offset: number): { text: string; lossy: boolean } }
    stderr: { readFrom(offset: number): { text: string; lossy: boolean } }
  }
  terminate(): void
  waitForExit(): Promise<void>
}

interface SubprocessService {
  resolveExecutable(command: string, env?: Record<string, string>, signal?: AbortSignal): Promise<string>
  spawn(spec: SpawnSpec): SpawnedProcess
}

interface SandboxService {
  confine(argv: readonly string[], policy: unknown, signal?: AbortSignal): Promise<{ argv: readonly string[] }>
}

interface SandboxPolicyService {
  resolve(request?: { session?: unknown }): { mode: string }
}

interface ToolsService {
  register(definition: unknown): () => void
}

/** Structural slice of `@deepseek-ai/dsh-llm` LlmRuntime used for commit-message suggestions. */
interface LlmRuntimeLike {
  listProviders(): ReadonlyArray<{ id: string }>
  listModels(provider: string): Promise<ReadonlyArray<{ id: string }>>
  stream(options: {
    provider: string
    model: string
    system?: string
    messages: ReadonlyArray<{ role: 'user'; content: ReadonlyArray<{ type: 'text'; text: string }> }>
    maxTokens?: number
    signal?: AbortSignal
  }): AsyncIterable<{ type: string; text?: string }>
}

interface HostServices {
  subprocess: SubprocessService
  sandbox?: SandboxService
  sandboxPolicy?: SandboxPolicyService
  tools?: ToolsService
  llm?: LlmRuntimeLike
}

const GIT_ENV: Record<string, string | undefined> = Object.fromEntries(
  [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_CONFIG',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_COUNT',
    'GIT_CEILING_DIRECTORIES',
    'GIT_PREFIX',
    'GIT_SHALLOW_FILE',
    'GIT_GRAFT_FILE',
    'GIT_REPLACE_REF_BASE',
    'GIT_ATTR_SOURCE',
  ].map(key => [key, undefined]),
)

class GitError extends Error {
  constructor(readonly code: GitErrorCode, message: string) {
    super(message)
  }
}

function fail(error: unknown): GitEnvelope<never> {
  if (error instanceof GitError) return { ok: false, code: error.code, message: error.message }
  const text = error instanceof Error ? error.message : String(error)
  return { ok: false, code: 'RPC_ERROR', message: text }
}

function ok<T>(value: T): GitEnvelope<T> {
  return { ok: true, value: JSON.parse(JSON.stringify(value)) as T }
}

/** Convert blame's raw `author-time` + `author-tz` into an ISO-8601 string. */
function isoFromEpoch(ts: string, tz: string): string {
  const seconds = Number.parseInt(ts, 10)
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const match = /^([+-])(\d{2})(\d{2})$/.exec(tz.trim())
  const offsetMinutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number.parseInt(match[2]!, 10) * 60 + Number.parseInt(match[3]!, 10))
    : 0
  const shifted = new Date((seconds + offsetMinutes * 60) * 1000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  const hh = String(Math.trunc(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${shifted.toISOString().slice(0, 19)}${offsetMinutes === 0 ? 'Z' : `${sign}${hh}:${mm}`}`
}

/** C-quoted git path (e.g. `"spa ce\ttab"`) -> raw path; plain paths pass through. */
function unquoteGitPath(value: string): string {
  if (!value.startsWith('"') || value.length < 2) return value
  let out = ''
  for (let i = 1; i < value.length; i++) {
    const ch = value[i]!
    if (ch === '"') break
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = value[++i]
    if (next === undefined) break
    const simple: Record<string, string> = {
      a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '"': '"', '\\': '\\',
    }
    if (simple[next] !== undefined) {
      out += simple[next]!
      continue
    }
    const octal = /^([0-7]{1,3})/.exec(value.slice(i))
    if (octal) {
      out += String.fromCharCode(Number.parseInt(octal[1]!, 8))
      i += octal[1]!.length - 1
      continue
    }
    out += next
  }
  return out
}

/** Validate one patch-side path: repo-relative, no `..` escape, no absolute/drive forms. */
function safePatchRelPath(rawPath: string): string | undefined {
  let p = unquoteGitPath(rawPath).trim()
  if (p.length === 0 || p === '/dev/null' || p.startsWith('-')) return undefined
  p = p.replace(/\\/g, '/')
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return undefined
  const segments: string[] = []
  for (const segment of p.split('/')) {
    if (segment.length === 0 || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return undefined
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  if (segments.length === 0) return undefined
  return segments.join('/')
}

/** Repo-relative paths a patch touches; throws GIT_APPLY_FAILED on any escape attempt. */
function patchPathsOf(patch: string): string[] {
  const found = new Set<string>()
  const require = (rawPath: string): void => {
    // Strip the conventional a/ b/ prefixes so the result is a worktree-relative
    // path usable for `git add -N`; validation still applies to the stripped form.
    const stripped = /^[ab]\//.test(rawPath) ? rawPath.slice(2) : rawPath
    const rel = safePatchRelPath(stripped)
    if (rel === undefined) {
      throw new GitError('GIT_APPLY_FAILED', `patch path escapes the worktree: ${JSON.stringify(rawPath)}`)
    }
    found.add(rel)
  }
  for (const rawLine of patch.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      const p = line.slice(4).split('\t')[0] ?? ''
      if (p === '/dev/null') continue
      require(p)
      continue
    }
    if (line.startsWith('rename from ') || line.startsWith('copy from ')) {
      require(line.slice('rename from '.length))
      continue
    }
    if (line.startsWith('rename to ')) {
      require(line.slice('rename to '.length))
      continue
    }
    if (line.startsWith('copy to ')) {
      require(line.slice('copy to '.length))
      continue
    }
    if (line.startsWith('diff --git ')) {
      // Best-effort pair split (---/+++ headers above cover plain cases).
      const parts = /^(?:"([^"]*)"|(\S+)) (?:"([^"]*)"|(\S+))$/.exec(line.slice('diff --git '.length))
      if (parts) {
        for (const raw of [parts[1] ?? parts[2], parts[3] ?? parts[4]]) {
          const rawPath = raw ?? ''
          if (rawPath.length > 0 && rawPath !== '/dev/null') {
            const rel = safePatchRelPath(rawPath)
            if (rel !== undefined) found.add(rel)
          }
        }
      }
    }
  }
  return [...found]
}

/** Truncate to a character budget on a line boundary. */
function truncateChars(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const nl = text.lastIndexOf('\n', maxChars)
  return { text: nl > 0 ? text.slice(0, nl + 1) : text.slice(0, maxChars), truncated: true }
}

/** Unified multi-file diff text with diffTextOf-style budget + per-file sectioning. */
function sectionedDiffText(
  raw: string,
  wasLossy: boolean,
  maxChars: number,
): { diff: string; truncated: boolean } {
  let total = 0
  let truncated = wasLossy
  const parts: string[] = []
  const perFileCap = Math.min(PER_FILE_DIFF_CHARS, maxChars)
  const appendSection = (section: string): boolean => {
    if (total >= maxChars) {
      truncated = true
      return false
    }
    let text = section
    if (total + text.length > maxChars) {
      const cut = Math.max(0, maxChars - total)
      const nl = text.lastIndexOf('\n', cut - 1)
      text = nl > 0 ? text.slice(0, nl + 1) : text.slice(0, cut)
      truncated = true
    }
    if (text.length > perFileCap) {
      const nl = text.lastIndexOf('\n', perFileCap - 1)
      text = nl > 0 ? text.slice(0, nl + 1) : text.slice(0, perFileCap)
      truncated = true
    }
    if (text.length > 0) {
      parts.push(text)
      total += text.length
    }
    return total < maxChars
  }
  let start = 0
  while (start < raw.length) {
    const next = raw.indexOf('\ndiff --git ', start)
    const section = next >= 0 ? raw.slice(start, next + 1) : raw.slice(start)
    if (!appendSection(section)) break
    if (next < 0) break
    start = next + 1
  }
  return { diff: parts.join(''), truncated }
}

/** Parse `git log --pretty=format:${LOG_FORMAT}` output into contract rows. */
function parseCommitLogRows(stdout: string): GitCommitRow[] {
  const rows: GitCommitRow[] = []
  for (const segment of stdout.split('\u001e')) {
    const record = segment.replace(/^\n/, '')
    if (record.trim().length === 0) continue
    const fields = record.split('\u001f')
    if (fields.length < 6) continue
    const body = (fields[6] ?? '').replace(/\n+$/, '')
    // `%d` renders as ` (HEAD -> main, origin/main)` with a leading space, or ''.
    const decorationsRaw = (fields[7] ?? '').trim()
    const refs =
      decorationsRaw.startsWith('(') && decorationsRaw.endsWith(')')
        ? decorationsRaw.slice(1, -1).split(',').map(item => item.trim()).filter(item => item.length > 0)
        : []
    const parents = (fields[8] ?? '').split(' ').filter(hash => hash.length > 0)
    rows.push({
      hash: fields[0]!,
      shortHash: fields[1]!,
      author: fields[2]!,
      email: fields[3]!,
      date: fields[4]!,
      subject: fields[5]!,
      ...(body.length > 0 ? { body } : {}),
      parents,
      refs,
    })
  }
  return rows
}

/** Parse `git diff-tree --name-status` TSV (`old\tnew`, old first). */
function parseNameStatusText(stdout: string): GitChangeRow[] {
  const rows: GitChangeRow[] = []
  for (const line of stdout.split('\n')) {
    if (line.length === 0) continue
    const [status = '', oldPath = '', newPath = ''] = line.split('\t')
    if (status.length === 0) continue
    const renameOrCopy = status.startsWith('R') || status.startsWith('C')
    const file = renameOrCopy ? newPath : oldPath
    if (file.length === 0) continue
    rows.push({
      file,
      status,
      staged: true,
      untracked: false,
      ...(renameOrCopy && oldPath.length > 0 ? { oldFile: oldPath } : {}),
    })
  }
  return rows
}

/** Parse `git diff --name-status -z` NUL stream (`status\0old\0new`, old first). */
function parseNameStatusZ(stdout: string): GitChangeRow[] {
  const rows: GitChangeRow[] = []
  const tokens = stdout.split('\0')
  for (let i = 0; i < tokens.length; i++) {
    const status = tokens[i]!
    if (status.length === 0) continue
    const renameOrCopy = status.startsWith('R') || status.startsWith('C')
    const oldFile = tokens[i + 1] ?? ''
    const file = renameOrCopy ? tokens[i + 2] ?? '' : oldFile
    if (file.length === 0) continue
    i += renameOrCopy ? 2 : 1
    rows.push({
      file,
      status,
      staged: true,
      untracked: false,
      ...(renameOrCopy && oldFile.length > 0 ? { oldFile } : {}),
    })
  }
  return rows
}

/** Parse `git blame --porcelain` into deduped commits + per-line entries. */
function parseBlamePorcelain(stdout: string): {
  commits: GitBlameCommit[]
  lines: GitBlameLine[]
  truncated: boolean
} {
  const commits: GitBlameCommit[] = []
  const indexByHash = new Map<string, number>()
  const lines: GitBlameLine[] = []
  let truncated = false
  let pending: { hash: string; oldNo: number; newNo: number } | undefined
  let meta: { author: string; time: string; tz: string; subject: string } = { author: '', time: '', tz: '', subject: '' }
  const emit = (code: string): void => {
    if (pending === undefined) return
    let idx = indexByHash.get(pending.hash)
    if (idx === undefined) {
      idx = commits.length
      indexByHash.set(pending.hash, idx)
      commits.push({
        hash: pending.hash,
        author: meta.author,
        date: isoFromEpoch(meta.time, meta.tz),
        subject: meta.subject,
      })
    }
    if (lines.length < MAX_BLAME_LINES) {
      lines.push({ commit: idx, oldNo: pending.oldNo, newNo: pending.newNo, code })
    } else {
      truncated = true
    }
    pending = undefined
  }
  for (const raw of stdout.split('\n')) {
    const header = /^([0-9a-f]{40,64}) (\d+) (\d+)(?: \d+)?$/.exec(raw)
    if (header) {
      emit('') // straggler entry without a content line (should not happen)
      pending = { hash: header[1]!, oldNo: Number.parseInt(header[2]!, 10), newNo: Number.parseInt(header[3]!, 10) }
      meta = { author: '', time: '', tz: '', subject: '' }
      continue
    }
    if (raw.startsWith('\t')) {
      emit(raw.slice(1))
      continue
    }
    if (raw.startsWith('author ')) meta.author = raw.slice('author '.length)
    else if (raw.startsWith('author-time ')) meta.time = raw.slice('author-time '.length)
    else if (raw.startsWith('author-tz ')) meta.tz = raw.slice('author-tz '.length)
    else if (raw.startsWith('summary ')) meta.subject = raw.slice('summary '.length)
  }
  return { commits, lines, truncated }
}

export default class GitReviewService extends TypertRemoteService {
  static inject = ['fs', 'subprocess', 'tools']

  constructor(ctx: Context) {
    super(ctx, 'rGitReview')
    this.registerTools()
  }

  // ---------------------------------------------------------------------
  // Git & Subprocess plumbing
  // ---------------------------------------------------------------------

  private fs(): Context['fs'] {
    return this.ctx.fs
  }

  private getService<K extends keyof HostServices>(key: K): HostServices[K] | undefined {
    const getter = (this.ctx as unknown as { get?: (name: string) => unknown }).get
    if (typeof getter === 'function') {
      return getter.call(this.ctx, key) as HostServices[K] | undefined
    }
    return (this.ctx as unknown as Record<string, unknown>)[key] as HostServices[K] | undefined
  }

  private host(): HostServices {
    return {
      subprocess: this.getService('subprocess')!,
      tools: this.getService('tools'),
      sandbox: this.getService('sandbox'),
      sandboxPolicy: this.getService('sandboxPolicy'),
      llm: this.getService('llm'),
    }
  }

  /** List remote & local branches (newest commit first) and default base ref for worktree creation. */
  @Remote('branches')
  async branches(
    repositoryRoot: string,
    refresh: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitBranchesValue>> {
    try {
      const policy = { mode: 'danger-full-access' }
      const root = await this.repositoryRootOf(policy, repositoryRoot, signal)
      const run = this.gitRunner(policy, signal)
      if (refresh === true) {
        await run(root, ['fetch', '--all', '--prune', '--quiet'], [0, 1, 128]).catch(() => {})
      }
      const listed = await run(
        root,
        ['for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(symref)', 'refs/remotes', 'refs/heads'],
        [0, 128],
      )
      const remoteBranches: string[] = []
      const localBranches: string[] = []
      let originHead: string | undefined

      for (const rawLine of listed.stdout.split('\n')) {
        if (rawLine.length === 0) continue
        const [refname = '', symref = ''] = rawLine.split('\t')
        if (refname === 'refs/remotes/origin/HEAD' && symref.startsWith('refs/remotes/')) {
          originHead = symref.slice('refs/remotes/'.length)
          continue
        }
        if (symref.length > 0) continue
        if (refname.startsWith('refs/remotes/')) {
          const short = refname.slice('refs/remotes/'.length)
          if (short.includes('/') && !short.endsWith('/HEAD')) remoteBranches.push(short)
        } else if (refname.startsWith('refs/heads/')) {
          const short = refname.slice('refs/heads/'.length)
          if (short.length > 0) localBranches.push(short)
        }
      }

      if (originHead !== undefined) {
        const idx = remoteBranches.indexOf(originHead)
        if (idx > 0) {
          remoteBranches.splice(idx, 1)
          remoteBranches.unshift(originHead)
        }
      }

      const currentBranch = await this.branchOf(policy, root, signal)
      const defaultBase =
        originHead ??
        remoteBranches.find(b => b === 'origin/main' || b === 'origin/master' || b === 'origin/develop') ??
        remoteBranches[0] ??
        (currentBranch !== undefined && localBranches.includes(currentBranch) ? currentBranch : undefined) ??
        localBranches[0] ??
        'HEAD'

      return ok({ remoteBranches, localBranches, defaultBase })
    } catch (error) {
      return fail(error)
    }
  }

  /**
  /** Branch / dirty / ahead-behind report for one checkout. */
  @Remote('status')
  async status(path: string, signal?: AbortSignal): Promise<GitEnvelope<GitStatusValue>> {
    try {
      const value = await this.statusInternal({ mode: 'danger-full-access' }, path, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Working-tree changes + combined (or single-file) diff text. */
  @Remote('diff')
  async diff(
    path: string,
    file?: string | undefined,
    ignoreWhitespace?: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitDiffValue>> {
    try {
      const value = await this.diffInternal(
        { mode: 'danger-full-access' },
        path,
        signal,
        file,
        ignoreWhitespace === true,
      )
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Commit the working tree with `message`, staging exactly `files`, or only the selected `hunks` via a throwaway temp index (the user's real index and worktree stay untouched). */
  @Remote('commit')
  async commit(
    path: string,
    message: string,
    files: readonly string[] | undefined,
    hunks: readonly GitHunkPatch[] | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitCommitValue>> {
    try {
      const value = await this.commitInternal({ mode: 'danger-full-access' }, path, message, files, hunks, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Push the current branch to its upstream, establishing one via `-u` when missing; `forceWithLease` performs a safe force push. */
  @Remote('push')
  async push(
    path: string,
    forceWithLease: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitPushValue>> {
    try {
      const value = await this.pushInternal({ mode: 'danger-full-access' }, path, forceWithLease === true, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Commit history for the branch range or a single file, newest first, ISO dates. */
  @Remote('log')
  async log(
    path: string,
    refRange: string | undefined,
    file: string | undefined,
    limit: number | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitLogValue>> {
    try {
      const value = await this.logInternal({ mode: 'danger-full-access' }, path, refRange, file, limit, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** One commit's changed files (changesOf semantics) plus its unified diff. */
  @Remote('showCommit')
  async showCommit(path: string, hash: string, signal?: AbortSignal): Promise<GitEnvelope<GitCommitDetailValue>> {
    try {
      const value = await this.showCommitInternal({ mode: 'danger-full-access' }, path, hash, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Commits, changes and diff between `ref` (inclusive) and HEAD (three-dot). */
  @Remote('compare')
  async compare(path: string, ref: string, signal?: AbortSignal): Promise<GitEnvelope<GitCompareValue>> {
    try {
      const value = await this.compareInternal({ mode: 'danger-full-access' }, path, ref, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Line-by-line attribution of one file via `git blame --porcelain`. */
  @Remote('blame')
  async blame(path: string, file: string, signal?: AbortSignal): Promise<GitEnvelope<GitBlameValue>> {
    try {
      const value = await this.blameInternal({ mode: 'danger-full-access' }, path, file, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Apply a unified patch to the worktree, the index (--cached), or reversed. */
  @Remote('applyPatch')
  async applyPatch(
    path: string,
    patch: string,
    cached: boolean | undefined,
    reverse: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitEnvelope<GitApplyPatchValue>> {
    try {
      const value = await this.applyPatchInternal({ mode: 'danger-full-access' }, path, patch, cached, reverse, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  /** Draft one commit message from the working-tree diff via the mounted LLM provider. */
  @Remote('suggestCommitMessage')
  async suggestCommitMessage(path: string, signal?: AbortSignal): Promise<GitEnvelope<GitSuggestMessageValue>> {
    try {
      const value = await this.suggestCommitMessageInternal({ mode: 'danger-full-access' }, path, signal)
      return ok(value)
    } catch (error) {
      return fail(error)
    }
  }

  private async statusInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
  ): Promise<GitStatusValue> {
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const branch = await this.branchOf(policy, canonical, signal)
    const dirtyCount = await this.dirtyCountOf(policy, canonical, signal)
    const run = this.gitRunner(policy, signal)
    const counts = await run(canonical, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], [0, 1, 128])
    let ahead: number | undefined
    let behind: number | undefined
    if (counts.exitCode === 0) {
      const [aheadText, behindText] = counts.stdout.trim().split(/\s+/)
      ahead = Number.parseInt(aheadText ?? '0', 10)
      behind = Number.parseInt(behindText ?? '0', 10)
    }
    const up = await run(canonical, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], [0, 1, 128])
    const upstream = up.exitCode === 0 ? (up.stdout.trim() || undefined) : undefined
    return { path: canonical, branch: branch ?? 'detached', dirtyCount, ahead, behind, upstream }
  }

  /** Parse `git status --porcelain -z` (with `--untracked-files=all`) + `--numstat` into change rows. */
  private async changesOf(
    run: (cwd: string, args: readonly string[], allowedExitCodes?: readonly number[], allowLossy?: boolean) => Promise<{ stdout: string; exitCode: number; lossy?: boolean }>,
    canonical: string,
    signal: AbortSignal | undefined,
  ): Promise<GitChangeRow[]> {
    const [st, numstat] = await Promise.all([
      run(canonical, ['status', '--porcelain', '-z', '--untracked-files=all'], [0, 128], true),
      run(canonical, ['diff', '--numstat', '-z', 'HEAD'], [0, 128], true).catch(() => ({ stdout: '', exitCode: 128 })),
    ])
    void signal

    const statsByFile = new Map<string, { add: number; del: number }>()
    if (numstat.exitCode === 0 && numstat.stdout.length > 0) {
      const parts = numstat.stdout.split('\0')
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]!
        if (seg.length === 0) continue
        const t1 = seg.indexOf('\t')
        const t2 = t1 >= 0 ? seg.indexOf('\t', t1 + 1) : -1
        if (t1 < 0 || t2 < 0) continue
        const addRaw = seg.slice(0, t1)
        const delRaw = seg.slice(t1 + 1, t2)
        let filePath = seg.slice(t2 + 1)
        if (filePath.length === 0) {
          // Rename/copy entry in `-z` mode: `add\tdel\t\0oldPath\0newPath\0`
          filePath = parts[i + 2] ?? parts[i + 1] ?? ''
          i += 2
        }
        if (filePath.length > 0 && addRaw !== '-' && delRaw !== '-') {
          statsByFile.set(filePath, {
            add: Number.parseInt(addRaw, 10) || 0,
            del: Number.parseInt(delRaw, 10) || 0,
          })
        }
      }
    }

    const changes: GitChangeRow[] = []
    const tokens = st.stdout.split('\0')
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!
      if (token.length < 4) continue
      const x = token[0]!
      const y = token[1]!
      if (x === ' ' && y === ' ') continue
      const file = token.slice(3)
      const stat = statsByFile.get(file)
      const row: {
        file: string
        status: string
        staged: boolean
        untracked: boolean
        add?: number
        del?: number
        oldFile?: string
      } = {
        file,
        status: token.slice(0, 2),
        staged: x !== ' ' && x !== '?',
        untracked: x === '?' && y === '?',
      }
      if (stat !== undefined) {
        row.add = stat.add
        row.del = stat.del
      }
      if (x === 'R' || x === 'C') {
        // Porcelain -z rename entry: the next token is the source path.
        const oldFile = tokens[i + 1] ?? ''
        i++
        if (oldFile.length > 0) row.oldFile = oldFile
      }
      changes.push(row)
    }
    return changes
  }

  /**
   * Combined (or single-file) working-tree diff text:
   * - Single-file mode (`onlyFile` set): fetches just that file up to `maxChars`, even `.map` / lockfiles.
   * - Overview mode: excludes noisy build maps/lockfiles in the first pass and caps each file at
   *   `PER_FILE_DIFF_CHARS` so one large bundle never starves source files alphabetically after it!
   */
  private async diffTextOf(
    run: (cwd: string, args: readonly string[], allowedExitCodes?: readonly number[], allowLossy?: boolean) => Promise<{ stdout: string; exitCode: number; lossy?: boolean }>,
    canonical: string,
    changes: readonly GitChangeRow[],
    maxChars: number,
    signal: AbortSignal | undefined,
    onlyFile?: string,
    ignoreWhitespace?: boolean,
  ): Promise<{ diff: string; truncated: boolean }> {
    void signal
    const wsFlag = ignoreWhitespace === true ? ['--ignore-all-space'] : []
    if (onlyFile !== undefined && onlyFile.length > 0) {
      if (onlyFile.startsWith('-')) throw new GitError('GIT_DIFF_FAILED', 'invalid file path')
      const entry = changes.find(c => c.file === onlyFile)
      const res = entry?.untracked
        ? await run(canonical, ['diff', '--no-color', '--no-index', '--', '/dev/null', onlyFile], [0, 1], true).catch(() => ({ stdout: '', exitCode: 0, lossy: false }))
        : await run(canonical, ['diff', '--no-color', '--no-ext-diff', ...wsFlag, 'HEAD', '--', onlyFile], [0, 128], true).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
      const truncated = Boolean(res.lossy) || res.stdout.length > maxChars
      return { diff: truncated ? res.stdout.slice(0, maxChars) : res.stdout, truncated }
    }

    const parts: string[] = []
    let total = 0
    let truncated = false
    const perFileCap = Math.min(PER_FILE_DIFF_CHARS, maxChars)

    const appendSection = (section: string): boolean => {
      if (total >= maxChars) {
        truncated = true
        return false
      }
      let chunk = section
      if (chunk.length > perFileCap) {
        // Trim cleanly at a newline boundary so the last rendered line isn't half-broken.
        const nl = chunk.lastIndexOf('\n', perFileCap)
        chunk = nl > 0 ? `${chunk.slice(0, nl + 1)}` : chunk.slice(0, perFileCap)
        truncated = true
      }
      if (chunk.length > maxChars - total) {
        const nl = chunk.lastIndexOf('\n', maxChars - total)
        chunk = nl > 0 ? chunk.slice(0, nl + 1) : chunk.slice(0, maxChars - total)
        truncated = true
      }
      parts.push(chunk)
      total += chunk.length
      return total < maxChars
    }

    const appendMultiFileDiff = (raw: string, wasLossy: boolean): void => {
      if (wasLossy) truncated = true
      if (raw.length === 0) return
      let start = 0
      while (start < raw.length) {
        const next = raw.indexOf('\ndiff --git ', start)
        const section = next >= 0 ? raw.slice(start, next + 1) : raw.slice(start)
        if (!appendSection(section)) break
        if (next < 0) break
        start = next + 1
      }
    }

    const isNoisy = (file: string): boolean =>
      /\.(map|lock)$|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$|\.min\.(js|css)$/.test(file)

    // Pass 1: tracked non-noisy files first so real source code always gets budget.
    const trackedMain = await run(
      canonical,
      ['diff', '--no-color', '--no-ext-diff', ...wsFlag, 'HEAD', '--', '.', ...NOISY_DIFF_PATHSPECS],
      [0, 128],
      true,
    ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
    if (trackedMain.exitCode === 128) {
      // Unborn HEAD (0 commits in repo): fall back to staged diff (`--cached`).
      const stagedOnly = await run(
        canonical,
        ['diff', '--no-color', '--no-ext-diff', ...wsFlag, '--cached', '--', '.', ...NOISY_DIFF_PATHSPECS],
        [0, 128],
        true,
      ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
      appendMultiFileDiff(stagedOnly.stdout, Boolean(stagedOnly.lossy))
    } else {
      appendMultiFileDiff(trackedMain.stdout, Boolean(trackedMain.lossy))
    }

    // Pass 2: untracked non-noisy files, then untracked noisy files if budget remains.
    const untrackedChanges = [
      ...changes.filter(c => c.untracked && !isNoisy(c.file)),
      ...changes.filter(c => c.untracked && isNoisy(c.file)),
    ]
    for (const change of untrackedChanges) {
      if (total >= maxChars) {
        truncated = true
        break
      }
      const one = await run(
        canonical,
        ['diff', '--no-color', '--no-index', '--', '/dev/null', change.file],
        [0, 1],
        true,
      ).catch(() => ({ stdout: '', exitCode: 0, lossy: false }))
      if (one.lossy) truncated = true
      if (one.stdout.length > 0 && !appendSection(one.stdout)) break
    }

    // Marking truncated when noisy tracked files were skipped lets the UI know lazy per-file fetch is available.
    if (changes.some(c => !c.untracked && isNoisy(c.file))) {
      // Do not pollute small diffs if budget remains: fetch noisy tracked files last when space allows.
      for (const noisy of changes.filter(c => !c.untracked && isNoisy(c.file))) {
        if (total >= maxChars) {
          truncated = true
          break
        }
        const one = await run(
          canonical,
          ['diff', '--no-color', '--no-ext-diff', ...wsFlag, 'HEAD', '--', noisy.file],
          [0, 128],
          true,
        ).catch(() => ({ stdout: '', exitCode: 128, lossy: false }))
        if (one.lossy) truncated = true
        if (one.stdout.length > 0 && !appendSection(one.stdout)) break
      }
    }

    return { diff: parts.join(''), truncated }
  }

  private async diffInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
    onlyFile?: string,
    ignoreWhitespace?: boolean,
  ): Promise<GitDiffValue> {
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const changes = await this.changesOf(run, canonical, signal)
    const { diff, truncated } = await this.diffTextOf(run, canonical, changes, MAX_DIFF_CHARS, signal, onlyFile, ignoreWhitespace)
    return { path: canonical, branch, changes, diff, truncated }
  }

  private async commitInternal(
    policy: { mode: string },
    path: string,
    message: string,
    files: readonly string[] | undefined,
    hunks?: readonly GitHunkPatch[] | undefined,
    signal?: AbortSignal,
  ): Promise<GitCommitValue> {
    const trimmed = message.replace(/^\s+|\s+$/g, '')
    if (trimmed.length === 0) throw new GitError('GIT_COMMIT_FAILED', 'commit message is empty')
    if (files !== undefined && (files.length === 0 || files.some(f => typeof f !== 'string' || f.length === 0 || f.startsWith('-')))) {
      throw new GitError('GIT_COMMIT_FAILED', 'invalid file list')
    }
    const hunkList: GitHunkPatch[] = []
    if (hunks !== undefined) {
      if (!Array.isArray(hunks)) throw new GitError('GIT_COMMIT_FAILED', 'invalid hunk list')
      for (const rawHunk of hunks as readonly unknown[]) {
        // RPC payloads are untrusted at runtime even though the type says otherwise.
        const hunk = rawHunk as Partial<GitHunkPatch> | null
        if (
          hunk === null || typeof hunk !== 'object' ||
          typeof hunk.file !== 'string' || hunk.file.length === 0 || hunk.file.startsWith('-') ||
          typeof hunk.patch !== 'string' || hunk.patch.trim().length === 0
        ) {
          throw new GitError('GIT_COMMIT_FAILED', 'invalid hunk patch')
        }
        hunkList.push({ file: hunk.file, patch: hunk.patch })
      }
    }
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    if (hunkList.length === 0) {
      if (files !== undefined) {
        // Stage exactly the selected files (including untracked), then `--only` commits
        // precisely them so pre-staged-but-unselected index content stays untouched.
        await run(canonical, ['add', '--', ...files]).catch(error => {
          throw new GitError('GIT_COMMIT_FAILED', error instanceof Error ? error.message : String(error))
        })
      }
      try {
        await run(canonical, ['commit', '-m', trimmed, ...(files !== undefined ? ['--only', '--', ...files] : [])])
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        throw new GitError('GIT_COMMIT_FAILED', text)
      }
      const short = await run(canonical, ['rev-parse', '--short=7', 'HEAD'], [0, 128])
      const summary = await run(canonical, ['log', '-1', '--pretty=%s'], [0, 128])
      const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
      return {
        path: canonical,
        commit: short.stdout.trim(),
        summary: summary.stdout.trim(),
        branch,
      }
    }
    // -------------------------------------------------------------------
    // Selected-hunk commit through a throwaway index: the user's real index
    // and worktree stay completely untouched (only HEAD moves).
    // -------------------------------------------------------------------
    const realIndex = await this.gitPathOf(run, canonical, 'index')
    const tmpIndex = await this.gitPathOf(run, canonical, `owt-commit-${randomHex6()}.index`)
    const runIdx = this.gitRunner(policy, signal, COMMAND_TIMEOUT_MS, { GIT_INDEX_FILE: tmpIndex })
    const patchFiles: string[] = []
    try {
      try {
        await this.runFsScript(policy, canonical, FS_COPY_SCRIPT, [realIndex, tmpIndex], signal)
      } catch {
        // Unborn HEAD (no index file yet): start the temp index empty.
        await runIdx(canonical, ['read-tree', '--empty']).catch(error => {
          throw new GitError('GIT_COMMIT_FAILED', error instanceof Error ? error.message : String(error))
        })
      }
      if (files !== undefined) {
        await runIdx(canonical, ['add', '--', ...files]).catch(error => {
          throw new GitError('GIT_COMMIT_FAILED', error instanceof Error ? error.message : String(error))
        })
      }
      const wholeFileAdded = new Set<string>(files ?? [])
      const untracked = new Set(
        (await runIdx(canonical, ['ls-files', '--others', '--exclude-standard', '-z'], [0], true))
          .stdout.split('\0')
          .filter(Boolean),
      )
      for (const hunk of hunkList) {
        if (wholeFileAdded.has(hunk.file)) continue // whole file already staged; a hunk patch would double-apply
        if (untracked.has(hunk.file)) {
          try {
            // Untracked file: intent-to-add plants an empty pre-image blob in the
            // TEMP index so the hunk patch can `apply --cached`; real index untouched.
            await runIdx(canonical, ['add', '--intent-to-add', '--', hunk.file])
          } catch {
            // Contract fallback: when intent-to-add is blocked, degrade the hunk to a
            // whole-file add so the change is still captured.
            await runIdx(canonical, ['add', '--', hunk.file]).catch(error => {
              throw new GitError('GIT_APPLY_FAILED', error instanceof Error ? error.message : String(error))
            })
            wholeFileAdded.add(hunk.file)
            continue
          }
        }
        const normalizedPatch = hunk.patch.endsWith('\n') ? hunk.patch : `${hunk.patch}\n`
        patchPathsOf(normalizedPatch) // directory-escape guard -> GIT_APPLY_FAILED
        const tmpPatch = await this.gitPathOf(runIdx, canonical, `owt-hunk-${randomHex6()}.diff`)
        patchFiles.push(tmpPatch)
        await this.runFsScript(policy, canonical, FS_WRITE_SCRIPT, [tmpPatch, normalizedPatch], signal)
        await runIdx(canonical, ['apply', '--cached', '--whitespace=nowarn', tmpPatch]).catch(error => {
          throw new GitError('GIT_APPLY_FAILED', error instanceof Error ? error.message : String(error))
        })
      }
      try {
        await runIdx(canonical, ['commit', '-m', trimmed])
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        throw new GitError('GIT_COMMIT_FAILED', text)
      }
    } finally {
      // Never leak the temp index or hunk patch files into the git dir.
      await this.runFsScript(policy, canonical, FS_UNLINK_SCRIPT, [tmpIndex, ...patchFiles], undefined).catch(() => {})
    }
    const short = await run(canonical, ['rev-parse', '--short=7', 'HEAD'], [0, 128])
    const summary = await run(canonical, ['log', '-1', '--pretty=%s'], [0, 128])
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    return {
      path: canonical,
      commit: short.stdout.trim(),
      summary: summary.stdout.trim(),
      branch,
    }
  }

  private async pushInternal(
    policy: { mode: string },
    path: string,
    forceWithLease: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitPushValue> {
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const upstreamRes = await run(canonical, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], [0, 1, 128])
    const existingUpstream = upstreamRes.exitCode === 0 ? upstreamRes.stdout.trim() : ''
    if (existingUpstream.length > 0) {
      // Plain push; a non-fast-forward surfaces the remote's rejection verbatim.
      // --force-with-lease (browser opt-in) fails instead when the remote moved
      // beyond the local reflog view, i.e. safe force push.
      await run(canonical, ['push', ...(forceWithLease === true ? ['--force-with-lease'] : [])]).catch(error => {
        throw new GitError('GIT_PUSH_FAILED', error instanceof Error ? error.message : String(error))
      })
      return { path: canonical, branch, upstream: existingUpstream }
    }
    const remotes = await run(canonical, ['remote'], [0, 128]).catch(() => ({ stdout: '', exitCode: 128 }))
    const remote = remotes.stdout.split('\n').map(l => l.trim()).find(l => l.length > 0)
    if (remote === undefined) {
      throw new GitError('GIT_PUSH_FAILED', 'no remote configured for this checkout')
    }
    await run(canonical, ['push', '-u', remote, branch]).catch(error => {
      throw new GitError('GIT_PUSH_FAILED', error instanceof Error ? error.message : String(error))
    })
    return { path: canonical, branch, upstream: `${remote}/${branch}` }
  }

  private async suggestCommitMessageInternal(
    policy: { mode: string },
    path: string,
    signal?: AbortSignal,
  ): Promise<GitSuggestMessageValue> {
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const changes = await this.changesOf(run, canonical, signal)
    if (changes.length === 0) {
      throw new GitError('GIT_COMMIT_FAILED', 'no working-tree changes to describe')
    }
    const { diff } = await this.diffTextOf(run, canonical, changes, SUGGEST_DIFF_CHARS, signal)
    const log = await run(canonical, ['log', '--oneline', '-8'], [0, 128]).catch(() => ({ stdout: '', exitCode: 128 }))

    const llm = this.host().llm
    if (llm === undefined) {
      throw new GitError('GIT_LLM_UNAVAILABLE', 'llm service is not mounted in this DSH profile')
    }
    const providers = llm.listProviders()
    const provider = providers[0]?.id
    if (provider === undefined) {
      throw new GitError('GIT_LLM_UNAVAILABLE', 'no LLM provider adapter is registered')
    }
    const models = await llm.listModels(provider).catch(() => [])
    const model = models[0]?.id
    if (model === undefined) {
      throw new GitError('GIT_LLM_UNAVAILABLE', `provider ${provider} advertises no models`)
    }

    const signals: AbortSignal[] = [AbortSignal.timeout(SUGGEST_TIMEOUT_MS)]
    if (signal !== undefined) signals.push(signal)
    const llmSignal = AbortSignal.any(signals)
    const recent = log.stdout.trim()
    const prompt = [
      `Branch: ${branch}`,
      recent.length > 0 ? `Recent commit subjects (match their style/language):\n${recent}` : 'No commit history yet.',
      'Write one git commit message for the staged-and-unstaged diff below.',
      'Rules: first line = imperative subject <= 72 chars, no trailing period; then one blank line;',
      'body <= 5 bullet lines explaining the why; reply with the raw message only, no quotes, no fences, no explanations.',
      '--- DIFF ---',
      diff,
    ].join('\n')
    let text = ''
    try {
      for await (const chunk of llm.stream({
        provider,
        model,
        system: 'You are a precise git commit-message writer. Output only the commit message text.',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens: 512,
        signal: llmSignal,
      })) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
        if (llmSignal.aborted) break
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      throw new GitError('GIT_LLM_UNAVAILABLE', `commit message generation failed: ${messageText}`)
    }
    const cleaned = text
      .trim()
      .replace(/^```[a-z]*\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim()
    if (cleaned.length === 0) {
      throw new GitError('GIT_LLM_UNAVAILABLE', 'model returned an empty commit message')
    }
    return { path: canonical, message: cleaned, provider, model }
  }

  // ---------------------------------------------------------------------
  // P0 git review internals (log / showCommit / compare / blame / applyPatch)
  // ---------------------------------------------------------------------

  /** Resolve a git-dir-relative path (e.g. `index`, temp patch) to an absolute path. */
  private async gitPathOf(
    run: ReturnType<GitReviewService['gitRunner']>,
    canonical: string,
    name: string,
  ): Promise<string> {
    const resolved = await run(canonical, ['rev-parse', '--git-path', name])
    const p = resolved.stdout.trim()
    return p.startsWith('/') ? p : `${canonical}/${p}`
  }

  /** Run a tiny node script for file ops fs() cannot express (git prefix `${run.prefix}`). */
  private async runFsScript(
    policy: { mode: string },
    cwd: string,
    script: string,
    args: readonly string[],
    signal: AbortSignal | undefined,
  ): Promise<void> {
    await this.runArgv(policy, cwd, ['node', '--input-type=module', '-e', script, ...args], COMMAND_TIMEOUT_MS, signal, [0])
  }

  private async commitRowsOf(
    run: ReturnType<GitReviewService['gitRunner']>,
    canonical: string,
    extraArgs: readonly string[],
    limit: number,
  ): Promise<{ commits: GitCommitRow[]; truncated: boolean }> {
    const res = await run(
      canonical,
      ['log', `--pretty=format:${LOG_FORMAT}`, '--date=iso-strict', `--max-count=${limit + 1}`, ...extraArgs],
      [0],
      true,
    ).catch(error => {
      throw new GitError('GIT_LOG_FAILED', error instanceof Error ? error.message : String(error))
    })
    const rows = parseCommitLogRows(res.stdout)
    // One extra row was requested purely to detect truncation.
    return { commits: rows.slice(0, limit), truncated: res.lossy || rows.length > limit }
  }

  private async logInternal(
    policy: { mode: string },
    path: string,
    refRange: string | undefined,
    file: string | undefined,
    limit: number | undefined,
    signal?: AbortSignal,
  ): Promise<GitLogValue> {
    for (const rev of [refRange, file]) {
      if (rev !== undefined && (rev.length === 0 || rev.startsWith('-') || rev.length > 512)) {
        throw new GitError('GIT_LOG_FAILED', `invalid argument: ${JSON.stringify(rev)}`)
      }
    }
    const requested = Math.trunc(Number(limit ?? DEFAULT_LOG_LIMIT))
    const bounded = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), MAX_LOG_LIMIT)
      : DEFAULT_LOG_LIMIT
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const args = ['log', `--pretty=format:${LOG_FORMAT}`, '--date=iso-strict', `--max-count=${bounded + 1}`]
    if (refRange !== undefined) args.push(refRange)
    if (file !== undefined) args.push('--follow', '--', file)
    // Unborn HEAD (exit 128) with no selector just means: nothing logged yet.
    const unbornOk = refRange === undefined && file === undefined
    const res = await run(canonical, args, unbornOk ? [0, 128] : [0], true).catch(error => {
      throw new GitError('GIT_LOG_FAILED', error instanceof Error ? error.message : String(error))
    })
    if (res.exitCode === 128) return { path: canonical, commits: [] }
    const rows = parseCommitLogRows(res.stdout)
    const truncated = res.lossy || rows.length > bounded
    return { path: canonical, commits: rows.slice(0, bounded), ...(truncated ? { truncated: true } : {}) }
  }

  private async showCommitInternal(
    policy: { mode: string },
    path: string,
    hash: string,
    signal?: AbortSignal,
  ): Promise<GitCommitDetailValue> {
    if (!/^[0-9a-f]{7,64}$/i.test(hash)) {
      throw new GitError('GIT_DIFF_FAILED', `invalid commit hash: ${JSON.stringify(hash)}`)
    }
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    // Name-status via diff-tree so `staged: true` rows reuse changesOf semantics;
    // --root makes the initial commit list its files instead of showing nothing.
    const nameStatus = await run(
      canonical,
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '-M', '--root', hash],
      [0],
      true,
    ).catch(error => {
      throw new GitError('GIT_DIFF_FAILED', error instanceof Error ? error.message : String(error))
    })
    const changes = parseNameStatusText(nameStatus.stdout)
    const shown = await run(
      canonical,
      ['show', '--format=', '--no-color', '--no-ext-diff', '--diff-merges=off', hash, '--', '.', ...NOISY_DIFF_PATHSPECS],
      [0],
      true,
    ).catch(error => {
      throw new GitError('GIT_DIFF_FAILED', error instanceof Error ? error.message : String(error))
    })
    const { text, truncated } = truncateChars(shown.stdout, MAX_DIFF_CHARS)
    return {
      path: canonical,
      hash,
      branch,
      changes,
      diff: text,
      ...(truncated || shown.lossy ? { truncated: true } : {}),
    }
  }

  private async compareInternal(
    policy: { mode: string },
    path: string,
    ref: string,
    signal?: AbortSignal,
  ): Promise<GitCompareValue> {
    if (ref.length === 0 || ref.startsWith('-') || /\s/.test(ref) || ref.length > 256) {
      throw new GitError('GIT_DIFF_FAILED', `invalid ref: ${JSON.stringify(ref)}`)
    }
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const branch = (await this.branchOf(policy, canonical, signal)) ?? 'detached'
    const verify = await run(canonical, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], [0, 1])
    if (verify.exitCode !== 0) {
      throw new GitError('GIT_DIFF_FAILED', `unknown ref: ${ref}`)
    }
    const { commits, truncated: commitsTruncated } = await this.commitRowsOf(run, canonical, [`${ref}..HEAD`], DEFAULT_LOG_LIMIT)
    const nameStatus = await run(canonical, ['diff', '--name-status', '-z', '-M', `${ref}...HEAD`], [0], true).catch(error => {
      throw new GitError('GIT_DIFF_FAILED', error instanceof Error ? error.message : String(error))
    })
    const changes = parseNameStatusZ(nameStatus.stdout)
    const ranged = await run(
      canonical,
      ['diff', '--no-color', '--no-ext-diff', `${ref}...HEAD`, '--', '.', ...NOISY_DIFF_PATHSPECS],
      [0],
      true,
    ).catch(error => {
      throw new GitError('GIT_DIFF_FAILED', error instanceof Error ? error.message : String(error))
    })
    const { diff, truncated: diffTruncated } = sectionedDiffText(ranged.stdout, ranged.lossy, MAX_DIFF_CHARS)
    return {
      path: canonical,
      branch,
      ref,
      commits,
      changes,
      diff,
      ...(commitsTruncated || diffTruncated ? { truncated: true } : {}),
    }
  }

  private async blameInternal(
    policy: { mode: string },
    path: string,
    file: string,
    signal?: AbortSignal,
  ): Promise<GitBlameValue> {
    if (file.length === 0 || file.startsWith('-')) {
      throw new GitError('GIT_BLAME_FAILED', `invalid file path: ${JSON.stringify(file)}`)
    }
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const blamed = await run(canonical, ['blame', '--porcelain', '--', file], [0], true).catch(error => {
      throw new GitError('GIT_BLAME_FAILED', error instanceof Error ? error.message : String(error))
    })
    const parsed = parseBlamePorcelain(blamed.stdout)
    return {
      path: canonical,
      file,
      commits: parsed.commits,
      lines: parsed.lines,
      ...(parsed.truncated || blamed.lossy ? { truncated: true } : {}),
    }
  }

  private async applyPatchInternal(
    policy: { mode: string },
    path: string,
    patch: string,
    cached: boolean | undefined,
    reverse: boolean | undefined,
    signal?: AbortSignal,
  ): Promise<GitApplyPatchValue> {
    if (typeof patch !== 'string' || patch.trim().length === 0) {
      throw new GitError('GIT_APPLY_FAILED', 'patch is empty')
    }
    const normalizedPatch = patch.endsWith('\n') ? patch : `${patch}\n`
    const touched = patchPathsOf(normalizedPatch) // directory-escape guard -> GIT_APPLY_FAILED
    const canonical = await this.canonicalGitPath(policy, path, signal)
    const run = this.gitRunner(policy, signal)
    const tmpPatch = await this.gitPathOf(run, canonical, `owt-patch-${randomHex6()}.diff`)
    try {
      await this.runFsScript(policy, canonical, FS_WRITE_SCRIPT, [tmpPatch, normalizedPatch], signal)
      if (cached === true && reverse !== true) {
        // Untracked files have no index blob to diff against: record intent-to-add
        // (empty blob) so `git apply --cached` can stage the patch content.
        const untracked = new Set(
          (await run(canonical, ['ls-files', '--others', '--exclude-standard', '-z'], [0], true))
            .stdout.split('\0')
            .filter(Boolean),
        )
        for (const rel of touched) {
          if (!untracked.has(rel)) continue
          await run(canonical, ['add', '--intent-to-add', '--', rel]).catch(error => {
            throw new GitError('GIT_APPLY_FAILED', error instanceof Error ? error.message : String(error))
          })
        }
      }
      const args = ['apply', '--whitespace=nowarn']
      if (reverse === true) args.push('--reverse')
      if (cached === true) args.push('--cached')
      args.push(tmpPatch)
      await run(canonical, args).catch(error => {
        throw new GitError('GIT_APPLY_FAILED', error instanceof Error ? error.message : String(error))
      })
      return { path: canonical }
    } finally {
      await this.runFsScript(policy, canonical, FS_UNLINK_SCRIPT, [tmpPatch], undefined).catch(() => {})
    }
  }
  private policy(agent: AgentLike): { mode: string } {
    const sandboxPolicy = this.host().sandboxPolicy
    return sandboxPolicy !== undefined ? sandboxPolicy.resolve({ session: agent.session }) : { mode: 'danger-full-access' }
  }

  private async runArgv(
    policy: { mode: string },
    cwd: string,
    argv: readonly string[],
    timeoutMs: number,
    signal: AbortSignal | undefined,
    allowedExitCodes: readonly number[] = [0],
    allowLossy = false,
    extraEnv: Record<string, string | undefined> = {},
  ): Promise<{ stdout: string; exitCode: number; lossy: boolean }> {
    const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)]
    if (signal !== undefined) signals.push(signal)
    const timeoutSignal = AbortSignal.any(signals)
    timeoutSignal.throwIfAborted()
    const host = this.host()
    let command: readonly string[] = argv
    if (host.sandbox !== undefined && policy.mode !== 'danger-full-access') {
      command = (await host.sandbox.confine(command, policy, timeoutSignal)).argv
    }
    command = [await host.subprocess.resolveExecutable(command[0]!, undefined, timeoutSignal), ...command.slice(1)]
    timeoutSignal.throwIfAborted()
    const stdoutCap = allowLossy ? MAX_DIFF_STDOUT_BYTES : MAX_OUTPUT_BYTES
    const child = host.subprocess.spawn({
      argv: command,
      cwd,
      env: { ...GIT_ENV, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', GIT_NO_LAZY_FETCH: '1', ...extraEnv },
      signal: timeoutSignal,
      graceMs: COMMAND_GRACE_MS,
      stdio: { stdin: 'ignore', stdout: { maxBytes: stdoutCap }, stderr: { maxBytes: MAX_OUTPUT_BYTES } },
    })
    try {
      const outcome = await child.done
      timeoutSignal.throwIfAborted()
      const stdout = child.collected.stdout.readFrom(0)
      const stderr = child.collected.stderr.readFrom(0)
      if (outcome.exitCode === null || !allowedExitCodes.includes(outcome.exitCode)) {
        if (timeoutSignal.aborted) throw new GitError('GIT_TIMEOUT', 'command timed out')
        throw new Error(`${argv.slice(0, 3).join(' ')} failed (${outcome.signal ?? outcome.exitCode}): ${stderr.text.trim()}`)
      }
      if (stdout.lossy && !allowLossy) throw new Error(`command output exceeds ${stdoutCap} bytes`)
      return { stdout: stdout.text, exitCode: outcome.exitCode, lossy: stdout.lossy }
    } finally {
      child.terminate()
      await child.waitForExit()
    }
  }

  private gitRunner(
    policy: { mode: string },
    signal: AbortSignal | undefined,
    timeoutMs = COMMAND_TIMEOUT_MS,
    extraEnv: Record<string, string | undefined> = {},
  ) {
    return (cwd: string, args: readonly string[], allowedExitCodes: readonly number[] = [0], allowLossy = false) =>
      this.runArgv(
        policy,
        cwd,
        ['git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', ...args],
        timeoutMs,
        signal,
        allowedExitCodes,
        allowLossy,
        extraEnv,
      )
  }
  private async repositoryRootOf(policy: { mode: string }, from: string, signal: AbortSignal | undefined): Promise<string> {
    const run = this.gitRunner(policy, signal)
    const out = await run(from, ['rev-parse', '--path-format=absolute', '--git-common-dir'], [0, 128])
    if (out.exitCode !== 0) throw new GitError('GIT_NOT_A_REPO', `${from} is not a git repository`)
    const commonDir = out.stdout.trim()
    const rawRoot = commonDir.endsWith('/.git')
      ? commonDir.slice(0, -'/'.length - '.git'.length)
      : (await run(from, ['rev-parse', '--path-format=absolute', '--show-toplevel'])).stdout.trim()
    const resolved = await this.fs().resolve(rawRoot, { signal })
    return this.fs().processPath(resolved)
  }

  private async canonicalGitPath(
    policy: { mode: string },
    path: string,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    const stat = await this.fs().lstat(path, undefined, signal)
    if (stat === undefined) throw new GitError('GIT_NOT_FOUND', `no such directory: ${path}`)
    const run = this.gitRunner(policy, signal)
    const top = await run(path, ['rev-parse', '--path-format=absolute', '--show-toplevel'], [0, 128])
    if (top.exitCode !== 0) {
      throw new GitError('GIT_NOT_A_WORKTREE', `${path} is not inside a git work tree`)
    }
    const resolved = await this.fs().resolve(top.stdout.trim(), { signal })
    return this.fs().processPath(resolved)
  }

  /**
   * Resolve the remote-tracking counterpart of a local branch, preferring its
   * configured upstream and falling back to `<remote>/<branch>` for every known
   * remote. `verifyTip` additionally requires the remote-tracking ref to exist,
   * i.e. the branch was actually pushed at some point. Returns `undefined` when
   * the branch has never been pushed.
   */
  private async resolvePushedRemoteBranch(
    policy: { mode: string },
    root: string,
    branch: string,
    verifyTip: boolean,
    signal: AbortSignal | undefined,
  ): Promise<{ remote: string; remoteBranch: string; displayRef: string } | undefined> {
    const run = this.gitRunner(policy, signal)
    const candidates: string[] = []
    const up = await run(root, ['rev-parse', '--abbrev-ref', '--quiet', `${branch}@{upstream}`], [0, 1, 128])
    if (up.exitCode === 0 && up.stdout.trim().length > 0) candidates.push(up.stdout.trim())
    try {
      const remotes = await run(root, ['remote'], [0, 128])
      for (const remote of remotes.stdout.split('\n').map(line => line.trim()).filter(Boolean)) {
        const candidate = `${remote}/${branch}`
        if (!candidates.includes(candidate)) candidates.push(candidate)
      }
    } catch {
      // No remotes configured: upstream candidate alone decides.
    }
    for (const ref of candidates) {
      const sep = ref.indexOf('/')
      if (sep <= 0) continue
      if (verifyTip) {
        const verify = await run(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${ref}`], [0, 1, 128])
        if (verify.exitCode !== 0) continue
      }
      return { remote: ref.slice(0, sep), remoteBranch: ref.slice(sep + 1), displayRef: ref }
    }
    return undefined
  }

  private async branchOf(policy: { mode: string }, path: string, signal: AbortSignal | undefined): Promise<string | undefined> {
    const run = this.gitRunner(policy, signal)
    const out = await run(path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1])
    if (out.exitCode !== 0) {
      const head = await run(path, ['rev-parse', '--short=7', 'HEAD'], [0, 128])
      return head.exitCode === 0 ? `detached at ${head.stdout.trim()}` : 'HEAD'
    }
    return out.stdout.trim()
  }

  private async dirtyCountOf(policy: { mode: string }, path: string, signal: AbortSignal | undefined): Promise<number> {
    try {
      const run = this.gitRunner(policy, signal)
      const out = await run(path, ['status', '--porcelain', '--untracked-files=normal'], [0, 128])
      if (out.exitCode !== 0) return 0
      return out.stdout.split('\n').filter(line => line.length > 0).length
    } catch {
      return 0
    }
  }

  // ---------------------------------------------------------------------
  // Agent tools (one operation, two callers)
  // ---------------------------------------------------------------------

  private registerTools(): void {
    const disposers: Array<() => void> = []
    const self = this
    const definitions: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
      execute(args: Record<string, unknown>, exec: { agent: AgentLike; signal: AbortSignal }): Promise<unknown>
    }> = [
      {
        name: 'git_diff',
        description:
          'Show uncommitted changes of a git checkout: per-file status rows (staged / unstaged / untracked) plus the combined or single-file diff text.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Checkout path.' },
            file: { type: 'string', description: 'Optional relative file path to fetch only that file diff.' },
          },
          required: ['path'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          const file = typeof args.file === 'string' && args.file.length > 0 ? args.file : undefined
          return JSON.parse(JSON.stringify(await self.diffInternal(self.policy(exec.agent), args.path, exec.signal, file)))
        },
      },
      {
        name: 'git_commit',
        description:
          'Commit changes in a git checkout. Stages exactly `files` (may include untracked paths) and commits them with `message`; omit `files` to commit the index as-is.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Checkout path.' },
            message: { type: 'string', description: 'Commit message (first line is the subject).' },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths (relative to the checkout) to stage and commit; omitted commits the whole index.',
            },
          },
          required: ['path', 'message'],
        },
        async execute(args, exec) {
          if (typeof args.path !== 'string' || args.path.length === 0) throw new Error('path is required')
          if (typeof args.message !== 'string' || args.message.trim().length === 0) throw new Error('message is required')
          const files = Array.isArray(args.files) ? args.files.filter((f): f is string => typeof f === 'string') : undefined
          return JSON.parse(
            JSON.stringify(await self.commitInternal(self.policy(exec.agent), args.path, args.message, files, undefined, exec.signal)),
          )
        },
      },
    ]
    for (const definition of definitions) {
      disposers.push(this.host().tools!.register(definition))
    }
  }
}
