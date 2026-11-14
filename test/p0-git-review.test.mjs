// P0 git review host verbs: log / showCommit / compare / blame / applyPatch,
// selected-hunk commit via throwaway temp index, push --force-with-lease.
// Style mirrors worktree.test.mjs: stubbed host services + real git fixtures.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import GitReviewService from '../lib/review/index.js'

function makeHostStubs(initialWorkspaces) {
  const workspaces = [...initialWorkspaces]
  let wsSeq = 1
  let currentCwd = initialWorkspaces[0]?.path ?? process.cwd()

  const fsService = {
    async resolve(p, opts) {
      const full = opts?.cwd ? join(opts.cwd, p) : p
      try {
        return { displayPath: realpathSync(full), targetKey: realpathSync(full) }
      } catch {
        return { displayPath: full, targetKey: full }
      }
    },
    processPath(target) {
      return target.displayPath
    },
    contains(parent, child) {
      return child.displayPath === parent.displayPath || child.displayPath.startsWith(parent.displayPath + '/')
    },
    async lstat(p) {
      try {
        return statSync(p)
      } catch {
        return undefined
      }
    },
    async readText(target) {
      return readFileSync(target.displayPath, 'utf8')
    },
    async writeText(target, content) {
      writeFileSync(target.displayPath, content, 'utf8')
    },
  }

  const subprocessService = {
    async resolveExecutable(cmd) {
      if (cmd === 'node') return process.execPath
      return execFileSync('/usr/bin/which', [cmd], { encoding: 'utf8' }).trim()
    },
    spawn(spec) {
      const stdoutChunks = []
      const stderrChunks = []
      const child = spawnSync(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: { ...process.env, ...spec.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      if (child.error) throw child.error
      stdoutChunks.push(child.stdout ?? Buffer.alloc(0))
      stderrChunks.push(child.stderr ?? Buffer.alloc(0))
      return {
        done: Promise.resolve({ exitCode: child.status, signal: child.signal }),
        collected: {
          stdout: { readFrom: () => ({ text: Buffer.concat(stdoutChunks).toString('utf8'), lossy: false }) },
          stderr: { readFrom: () => ({ text: Buffer.concat(stderrChunks).toString('utf8'), lossy: false }) },
        },
        terminate() {},
        async waitForExit() {},
      }
    },
  }

  const workspaceRegistry = {
    list: () => [...workspaces],
    archivedSessionIds: [],
    async resolveByPath(p) {
      return workspaces.find(w => w.path === p)
    },
    async create(p, title) {
      const existing = workspaces.find(w => w.path === p)
      if (existing) return existing
      const entity = { id: 'ws-' + wsSeq++, path: p, title: title ?? p.split('/').pop(), sessionIds: [] }
      workspaces.push(entity)
      return entity
    },
    async delete(id) {
      const idx = workspaces.findIndex(w => w.id === id)
      if (idx < 0) return false
      workspaces.splice(idx, 1)
      return true
    },
    async archiveSession() {},
  }

  const workingDirectory = {
    get: () => currentCwd,
    ensure: async () => currentCwd,
    set: async (_agent, next) => {
      currentCwd = next
      return next
    },
  }

  const tools = {
    register() {
      return () => {}
    },
  }

  return { fsService, subprocessService, workspaceRegistry, workingDirectory, tools }
}

async function makeSvc(repoDir) {
  process.env.DSH_GIT_POOL = join(realpathSync(mkdtempSync(join(tmpdir(), 'dsh-p0-pool-'))), 'pool')
  const ctx = new Context()
  const stubs = makeHostStubs([{ id: 'ws-root', path: repoDir, title: 'p0-test' }])
  ctx.provide('fs', stubs.fsService)
  ctx.provide('subprocess', stubs.subprocessService)
  ctx.provide('workingDirectory', stubs.workingDirectory)
  ctx.provide('workspaceRegistry', stubs.workspaceRegistry)
  ctx.provide('sessionPersistence', { async list() { return [] } })
  ctx.provide('tools', stubs.tools)
  ctx.plugin(GitReviewService)
  await new Promise(r => setTimeout(r, 20))
  return ctx.get('rGitReview')
}

function git(repoDir, ...args) {
  return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8' })
}

function initRepo(withRemote = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-p0-repo-')))
  const repoDir = join(root, 'repo')
  execFileSync('git', ['init', '-b', 'main', repoDir])
  git(repoDir, 'config', 'user.email', 'test@example.com')
  git(repoDir, 'config', 'user.name', 'Tëst Üser')
  if (withRemote) {
    const remoteDir = join(root, 'remote.git')
    execFileSync('git', ['init', '--bare', '-b', 'main', remoteDir])
    git(repoDir, 'remote', 'add', 'origin', remoteDir)
    return { root, repoDir, remoteDir }
  }
  return { root, repoDir }
}

function baseCommit(repoDir) {
  writeFileSync(join(repoDir, 'README.md'), 'hello\n')
  git(repoDir, 'add', 'README.md')
  git(repoDir, 'commit', '-m', 'init')
}

const ISO_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

test('log parses ISO dates, unicode authors, bodies; limit sets truncated; refRange and --follow work', async () => {
  const { root, repoDir } = initRepo()
  try {
    baseCommit(repoDir)
    writeFileSync(join(repoDir, 'a.txt'), 'one\n')
    git(repoDir, 'add', 'a.txt')
    git(repoDir, 'commit', '-m', 'fix: handle "quotes" & <angles>', '-m', 'body line about \"stuff\"\nsecond para')
    const svc = await makeSvc(repoDir)

    const all = await svc.log(repoDir, undefined, undefined, undefined)
    assert.ok(all.ok)
    assert.equal(all.value.path, repoDir)
    assert.equal(all.value.commits.length, 2)
    const head = all.value.commits[0]
    assert.equal(head.subject, 'fix: handle "quotes" & <angles>')
    assert.equal(head.author, 'Tëst Üser')
    assert.equal(head.email, 'test@example.com')
    assert.match(head.hash, /^[0-9a-f]{40}$/)
    assert.match(head.shortHash, /^[0-9a-f]{7,10}$/)
    assert.match(head.date, ISO_STRICT)
    assert.ok(head.body.includes('second para'))
    assert.equal(all.value.truncated, undefined)

    const limited = await svc.log(repoDir, undefined, undefined, 1)
    assert.equal(limited.value.commits.length, 1)
    assert.equal(limited.value.truncated, true)

    git(repoDir, 'checkout', '-b', 'feature')
    writeFileSync(join(repoDir, 'a.txt'), 'one\ntwo\n')
    git(repoDir, 'commit', '-am', 'feature commit')
    const ranged = await svc.log(repoDir, 'main..HEAD', undefined, undefined)
    assert.equal(ranged.value.commits.length, 1)
    assert.equal(ranged.value.commits[0].subject, 'feature commit')

    git(repoDir, 'checkout', 'main')
    git(repoDir, 'mv', 'a.txt', 'b.txt')
    git(repoDir, 'commit', '-m', 'rename a to b')
    const followed = await svc.log(repoDir, undefined, 'b.txt', undefined)
    assert.ok(followed.ok)
    assert.ok(followed.value.commits.some(c => c.subject === 'fix: handle "quotes" & <angles>'))

    const bad = await svc.log(repoDir, '-oops', undefined, undefined)
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'GIT_LOG_FAILED')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('log on unborn HEAD returns empty commit list', async () => {
  const { root, repoDir } = initRepo()
  try {
    const svc = await makeSvc(repoDir)
    const empty = await svc.log(repoDir, undefined, undefined, undefined)
    assert.ok(empty.ok)
    assert.deepEqual(empty.value.commits, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// showCommit
// ---------------------------------------------------------------------------

test('showCommit lists changes with changesOf semantics and renders diff; rejects bad hash', async () => {
  const { root, repoDir } = initRepo()
  try {
    baseCommit(repoDir)
    writeFileSync(join(repoDir, 'm.txt'), 'l1\nl2\n')
    git(repoDir, 'add', 'm.txt')
    git(repoDir, 'commit', '-m', 'add m')
    const svc = await makeSvc(repoDir)

    const head = git(repoDir, 'rev-parse', 'HEAD').trim()
    const detail = await svc.showCommit(repoDir, head)
    assert.ok(detail.ok)
    assert.equal(detail.value.hash, head)
    assert.equal(detail.value.branch, 'main')
    const row = detail.value.changes.find(c => c.file === 'm.txt')
    assert.ok(row, 'm.txt row present')
    assert.equal(row.status, 'A')
    assert.equal(row.staged, true)
    assert.equal(row.untracked, false)
    assert.ok(detail.value.diff.includes('+++ b/m.txt'))
    assert.ok(detail.value.diff.includes('+l2'))

    const rootHash = git(repoDir, 'rev-list', '--max-parents=0', 'HEAD').trim()
    const rootDetail = await svc.showCommit(repoDir, rootHash)
    assert.ok(rootDetail.ok)
    assert.ok(rootDetail.value.changes.some(c => c.file === 'README.md' && c.status === 'A'))

    const unknown = await svc.showCommit(repoDir, 'deadbeef')
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'GIT_DIFF_FAILED')

    const injection = await svc.showCommit(repoDir, '--all')
    assert.equal(injection.ok, false)
    assert.equal(injection.code, 'GIT_DIFF_FAILED')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------

test('compare returns commits (ref..HEAD), changes and diff (ref...HEAD); unknown ref rejected', async () => {
  const { root, repoDir } = initRepo()
  try {
    baseCommit(repoDir)
    git(repoDir, 'checkout', '-b', 'feature')
    writeFileSync(join(repoDir, 'x.txt'), 'x1\n')
    git(repoDir, 'add', 'x.txt')
    git(repoDir, 'commit', '-m', 'add x')
    writeFileSync(join(repoDir, 'x.txt'), 'x1\nx2\n')
    git(repoDir, 'commit', '-am', 'extend x')
    const svc = await makeSvc(repoDir)

    const cmp = await svc.compare(repoDir, 'main')
    assert.ok(cmp.ok)
    assert.equal(cmp.value.ref, 'main')
    assert.equal(cmp.value.branch, 'feature')
    assert.equal(cmp.value.commits.length, 2)
    assert.ok(cmp.value.commits.some(c => c.subject === 'add x'))
    assert.ok(cmp.value.changes.some(c => c.file === 'x.txt' && c.status === 'A'))
    assert.ok(cmp.value.diff.includes('+x2'))
    assert.equal(cmp.value.truncated, undefined)

    const bad = await svc.compare(repoDir, 'does-not-exist')
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'GIT_DIFF_FAILED')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// blame
// ---------------------------------------------------------------------------

test('blame maps lines to deduped commits with ISO dates; fails for untracked file', async () => {
  const { root, repoDir } = initRepo()
  try {
    writeFileSync(join(repoDir, 'b.txt'), 'l1\nl2\nl3\n')
    git(repoDir, 'add', 'b.txt')
    git(repoDir, 'commit', '-m', 'b base')
    writeFileSync(join(repoDir, 'b.txt'), 'l1\nl2\nl3\nl4 added\n')
    git(repoDir, 'commit', '-am', 'b extend')
    const svc = await makeSvc(repoDir)

    const blamed = await svc.blame(repoDir, 'b.txt')
    assert.ok(blamed.ok)
    assert.equal(blamed.value.file, 'b.txt')
    assert.equal(blamed.value.commits.length, 2)
    assert.equal(blamed.value.lines.length, 4)
    const bySubject = new Map(blamed.value.commits.map(c => [c.subject, c]))
    const base = bySubject.get('b base')
    const extend = bySubject.get('b extend')
    assert.ok(base && extend)
    assert.match(base.date, ISO_STRICT)
    assert.equal(blamed.value.lines[0].commit, blamed.value.commits.indexOf(base))
    assert.equal(blamed.value.lines[3].commit, blamed.value.commits.indexOf(extend))
    assert.deepEqual([blamed.value.lines[0].newNo, blamed.value.lines[3].newNo], [1, 4])
    assert.equal(blamed.value.lines[3].code, 'l4 added')

    writeFileSync(join(repoDir, 'untracked.txt'), 'nope\n')
    const bad = await svc.blame(repoDir, 'untracked.txt')
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'GIT_BLAME_FAILED')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// applyPatch
// ---------------------------------------------------------------------------

test('applyPatch applies to worktree, stages with cached, undoes with reverse; rejects escapes', async () => {
  const { root, repoDir } = initRepo()
  try {
    baseCommit(repoDir)
    writeFileSync(join(repoDir, 'f.txt'), 'l1\nl2\nl3\n')
    git(repoDir, 'add', 'f.txt')
    git(repoDir, 'commit', '-m', 'add f')
    const svc = await makeSvc(repoDir)

    writeFileSync(join(repoDir, 'f.txt'), 'l1\nl2 changed\nl3\n')
    const patch = git(repoDir, 'diff', '--', 'f.txt')
    git(repoDir, 'checkout', '--', 'f.txt')
    assert.equal(readFileSync(join(repoDir, 'f.txt'), 'utf8'), 'l1\nl2\nl3\n')

    const applied = await svc.applyPatch(repoDir, patch, undefined, undefined)
    assert.ok(applied.ok)
    assert.equal(applied.value.path, repoDir)
    assert.equal(readFileSync(join(repoDir, 'f.txt'), 'utf8'), 'l1\nl2 changed\nl3\n')

    const reversed = await svc.applyPatch(repoDir, patch, undefined, true)
    assert.ok(reversed.ok)
    assert.equal(readFileSync(join(repoDir, 'f.txt'), 'utf8'), 'l1\nl2\nl3\n')

    const cached = await svc.applyPatch(repoDir, patch, true, undefined)
    assert.ok(cached.ok)
    // Staged content changes while the worktree file stays original -> 'MM'.
    const statusAfterCached = git(repoDir, 'status', '--porcelain').trim()
    assert.ok(statusAfterCached.includes('MM f.txt'), 'staged-only change: ' + statusAfterCached)
    assert.ok(git(repoDir, 'diff', '--cached').includes('+l2 changed'), 'index carries the patch')
    assert.equal(readFileSync(join(repoDir, 'f.txt'), 'utf8'), 'l1\nl2\nl3\n')
    const unstaged = await svc.applyPatch(repoDir, patch, true, true)
    assert.ok(unstaged.ok)
    assert.equal(git(repoDir, 'status', '--porcelain').trim(), '')

    const escape = await svc.applyPatch(
      repoDir,
      'diff --git a/../evil.txt b/../evil.txt\n--- a/../evil.txt\n+++ b/../evil.txt\n@@ -1 +1 @@\n-x\n+y\n',
      undefined,
      undefined,
    )
    assert.equal(escape.ok, false)
    assert.equal(escape.code, 'GIT_APPLY_FAILED')
    assert.ok(!existsSync(join(root, 'evil.txt')), 'no file written outside worktree')
    assert.ok(!existsSync(join(repoDir, 'evil.txt')))

    const absolute = await svc.applyPatch(
      repoDir,
      'diff --git a/f.txt b/f.txt\n--- /etc/passwd\n+++ b/f.txt\n@@ -1 +1 @@\n-x\n+y\n',
      undefined,
      undefined,
    )
    assert.equal(absolute.ok, false)
    assert.equal(absolute.code, 'GIT_APPLY_FAILED')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// selected-hunk commit (temp index flow)
// ---------------------------------------------------------------------------

test('commit with selected hunks commits only that hunk, keeps worktree changes, leaves real index untouched', async () => {
  const { root, repoDir } = initRepo()
  try {
    const lines = Array.from({ length: 10 }, (_, i) => 'l' + (i + 1))
    writeFileSync(join(repoDir, 'f.txt'), lines.join('\n') + '\n')
    git(repoDir, 'add', 'f.txt')
    git(repoDir, 'commit', '-m', 'base f')
    const svc = await makeSvc(repoDir)

    const before = git(repoDir, 'ls-files', '-s', 'f.txt').trim()
    const modified = lines.map(l => (l === 'l1' ? 'L1-mod' : l === 'l10' ? 'L10-mod' : l))
    writeFileSync(join(repoDir, 'f.txt'), modified.join('\n') + '\n')
    const diff = git(repoDir, 'diff', '--', 'f.txt')
    const sections = diff.split(/\n(?=@@ )/)
    const hunkB = sections.find(s => s.includes('+L10-mod'))
    assert.ok(hunkB, 'second hunk found')
    const hunkPatch = sections[0] + '\n' + hunkB + '\n'

    const res = await svc.commit(repoDir, 'commit hunk B only', undefined, [{ file: 'f.txt', patch: hunkPatch }])
    assert.ok(res.ok, 'commit ok: ' + (res.message ?? ''))
    assert.equal(res.value.summary, 'commit hunk B only')
    assert.equal(res.value.branch, 'main')

    const headContent = git(repoDir, 'show', 'HEAD:f.txt')
    assert.ok(headContent.includes('L10-mod'), 'HEAD has selected hunk')
    assert.ok(headContent.startsWith('l1\n'), 'HEAD keeps l1 original')
    assert.ok(!headContent.includes('L1-mod'), 'HEAD excludes unselected hunk')

    const worktreeContent = readFileSync(join(repoDir, 'f.txt'), 'utf8')
    assert.ok(worktreeContent.includes('L1-mod'), 'worktree keeps unselected hunk')
    // Real index untouched: it differs from both the new HEAD (hunk B) and the
    // worktree (hunk A), hence 'MM' — ' M' would mean the index was polluted.
    assert.deepEqual(git(repoDir, 'status', '--porcelain').trim().split('\n'), ['MM f.txt'])

    assert.equal(git(repoDir, 'ls-files', '-s', 'f.txt').trim(), before, 'real index blob untouched')
    const leftovers = readdirSync(join(repoDir, '.git')).filter(n => n.startsWith('owt-'))
    assert.deepEqual(leftovers, [], 'no temp index/patch files left behind')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('commit with untracked-file hunk stages via intent-to-add and stays out of the real index', async () => {
  const { root, repoDir } = initRepo()
  try {
    baseCommit(repoDir)
    const svc = await makeSvc(repoDir)

    writeFileSync(join(repoDir, 'u.txt'), 'new line one\nnew line two\n')
    const spawned = spawnSync('git', ['-C', repoDir, 'diff', '--no-index', '--', '/dev/null', 'u.txt'], { encoding: 'utf8' })
    assert.equal(spawned.status, 1, 'diff --no-index exits 1 on differences')
    const patch = spawned.stdout

    const res = await svc.commit(repoDir, 'add u hunk', undefined, [{ file: 'u.txt', patch }])
    assert.ok(res.ok, 'commit ok: ' + (res.message ?? ''))
    assert.equal(git(repoDir, 'show', 'HEAD:u.txt'), 'new line one\nnew line two\n')

    const realIndex = git(repoDir, 'ls-files', '-s')
    assert.ok(!realIndex.includes('u.txt'), 'real index has no u.txt entry: ' + realIndex)
    assert.ok(git(repoDir, 'status', '--porcelain').includes('?? u.txt'), 'worktree still sees untracked u.txt')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// push --force-with-lease
// ---------------------------------------------------------------------------

test('push forceWithLease force-updates a diverged remote and rejects when the lease is stale', async () => {
  const { root, repoDir, remoteDir } = initRepo(true)
  try {
    baseCommit(repoDir)
    git(repoDir, 'push', '-u', 'origin', 'main')
    const svc = await makeSvc(repoDir)

    const plain = await svc.push(repoDir, undefined)
    assert.ok(plain.ok, 'plain push ok')
    assert.equal(plain.value.upstream, 'origin/main')

    // Diverge locally (amend) -- a plain push would be rejected as non-fast-forward.
    writeFileSync(join(repoDir, 'README.md'), 'hello amended\n')
    git(repoDir, 'commit', '--amend', '-m', 'init amended')
    const amended = await svc.push(repoDir, true)
    assert.ok(amended.ok, 'force-with-lease push ok: ' + (amended.message ?? ''))
    assert.equal(
      git(remoteDir, 'rev-parse', 'main').trim(),
      git(repoDir, 'rev-parse', 'HEAD').trim(),
      'remote now at amended HEAD',
    )

    // Remote moves out-of-band via a second clone; stale lease must reject.
    const cloneDir = join(root, 'clone')
    execFileSync('git', ['clone', remoteDir, cloneDir])
    git(cloneDir, 'config', 'user.email', 'c@example.com')
    git(cloneDir, 'config', 'user.name', 'Cloner')
    writeFileSync(join(cloneDir, 'other.txt'), 'from clone\n')
    git(cloneDir, 'add', 'other.txt')
    git(cloneDir, 'commit', '-m', 'clone commit')
    git(cloneDir, 'push', 'origin', 'main')

    writeFileSync(join(repoDir, 'README.md'), 'hello amended twice\n')
    git(repoDir, 'commit', '--amend', '-m', 'init amended twice')
    const stale = await svc.push(repoDir, true)
    assert.equal(stale.ok, false, 'stale lease rejected')
    assert.equal(stale.code, 'GIT_PUSH_FAILED')
    assert.ok(
      !git(remoteDir, 'rev-parse', 'main').includes('twice'),
      'remote unchanged after rejection',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
