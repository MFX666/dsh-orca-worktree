// End-to-end for GitReviewService: SRC descriptors, branches, and the
// diff / commit / push / suggest pipeline against real git fixtures.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import GitReviewService from '../lib/review/index.js'

function makeHostStubs() {
  const fsService = {
    async resolve(p, opts) {
      const full = opts?.cwd ? resolve(opts.cwd, p) : resolve(p)
      let canonical = full
      try {
        canonical = realpathSync(full)
      } catch {
        // Parent may exist while leaf does not yet exist.
        try {
          canonical = join(realpathSync(resolve(full, '..')), full.split('/').pop())
        } catch {
          canonical = full
        }
      }
      return { displayPath: canonical, targetKey: canonical }
    },
    processPath(target) {
      return target.displayPath
    },
    contains(parent, child) {
      return child.displayPath === parent.displayPath || child.displayPath.startsWith(`${parent.displayPath}/`)
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
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: { ...process.env, ...spec.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', chunk => stdoutChunks.push(chunk))
      child.stderr.on('data', chunk => stderrChunks.push(chunk))
      const done = new Promise((res, rej) => {
        child.on('error', rej)
        child.on('close', (exitCode, signal) => res({ exitCode, signal }))
      })
      return {
        done,
        collected: {
          stdout: { readFrom: () => ({ text: Buffer.concat(stdoutChunks).toString('utf8'), lossy: false }) },
          stderr: { readFrom: () => ({ text: Buffer.concat(stderrChunks).toString('utf8'), lossy: false }) },
        },
        terminate() {
          child.kill('SIGTERM')
        },
        async waitForExit() {
          await done.catch(() => {})
        },
      }
    },
  }

  const registeredTools = new Map()
  const tools = {
    register(def) {
      registeredTools.set(def.name, def)
      return () => registeredTools.delete(def.name)
    },
  }

  return { fsService, subprocessService, tools, registeredTools }
}

test('GitReviewService end-to-end: SRC descriptors, branches, diff/commit/push, AI suggestion', async () => {
  const tempRoot = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-git-review-e2e-')))
  try {
    const repoDir = join(tempRoot, 'qiz-pg-penta-server')
    execFileSync('git', ['init', '-b', 'develop', repoDir])
    execFileSync('git', ['-C', repoDir, 'config', 'user.email', 'test@example.com'])
    execFileSync('git', ['-C', repoDir, 'config', 'user.name', 'Test'])
    writeFileSync(join(repoDir, 'README.md'), 'hello\n')
    execFileSync('git', ['-C', repoDir, 'add', 'README.md'])
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'init'])

    const ctx = new Context()
    const stubs = makeHostStubs()
    ctx.provide('fs', stubs.fsService)
    ctx.provide('subprocess', stubs.subprocessService)
    ctx.provide('tools', stubs.tools)

    // Mount through Cordis `ctx.plugin(...)` so Proxy `inject` enforcement runs identically to Host!
    const fiber = ctx.plugin(GitReviewService)
    await new Promise(r => setTimeout(r, 20))
    assert.ok(fiber, 'plugin fiber created')
    const svc = ctx.get('rGitReview')
    assert.ok(svc, 'rGitReview service must activate under strict Cordis inject proxy')

    // 1. Verify Typert SRC markers & browser verbs carry zero `agent` parameter!
    const methods = remoteMethods(svc)
    const exportedNames = methods.map(m => m.exportName ?? m.method).sort()
    assert.deepEqual(exportedNames, [
      'applyPatch',
      'blame',
      'branches',
      'commit',
      'compare',
      'diff',
      'log',
      'push',
      'showCommit',
      'status',
      'suggestCommitMessage',
    ])
    for (const m of methods) {
      const src = String(svc[m.method])
      const header = src.slice(0, src.indexOf('{'))
      assert.ok(!/\bagent\b/.test(header), `Remote ${m.method} must not declare agent lookup parameter: ${header}`)
    }

    // 1b. `branches` lists remote & local refs, filters origin/HEAD symref, supports refresh fetch.
    const remoteBareDir = join(tempRoot, 'origin.git')
    execFileSync('git', ['init', '--bare', '-b', 'develop', remoteBareDir])
    execFileSync('git', ['-C', repoDir, 'remote', 'add', 'origin', remoteBareDir])
    execFileSync('git', ['-C', repoDir, 'push', '-u', 'origin', 'develop'])
    execFileSync('git', ['-C', remoteBareDir, 'symbolic-ref', 'HEAD', 'refs/heads/develop'])
    execFileSync('git', ['-C', repoDir, 'fetch', 'origin'])
    execFileSync('git', ['-C', repoDir, 'remote', 'set-head', 'origin', '-a'])

    const peerClone = join(tempRoot, 'peer-clone')
    execFileSync('git', ['clone', remoteBareDir, peerClone])
    execFileSync('git', ['-C', peerClone, 'config', 'user.email', 'peer@example.com'])
    execFileSync('git', ['-C', peerClone, 'config', 'user.name', 'Peer'])
    execFileSync('git', ['-C', peerClone, 'checkout', '-b', 'release/v1'])
    writeFileSync(join(peerClone, 'RELEASE.md'), 'v1\n')
    execFileSync('git', ['-C', peerClone, 'add', 'RELEASE.md'])
    execFileSync('git', ['-C', peerClone, 'commit', '-m', 'release v1'])
    execFileSync('git', ['-C', peerClone, 'push', '-u', 'origin', 'release/v1'])

    const beforeFetch = await svc.branches(repoDir, false)
    assert.equal(beforeFetch.ok, true)
    assert.deepEqual(beforeFetch.value.remoteBranches, ['origin/develop'])
    assert.deepEqual(beforeFetch.value.localBranches, ['develop'])
    assert.equal(beforeFetch.value.defaultBase, 'origin/develop')

    const afterFetch = await svc.branches(repoDir, true)
    assert.equal(afterFetch.ok, true)
    assert.equal(afterFetch.value.remoteBranches[0], 'origin/develop')
    assert.ok(afterFetch.value.remoteBranches.includes('origin/release/v1'))

    // Unborn (0-commit) repository falls back cleanly to HEAD instead of a non-existent ref.
    const unbornDir = join(tempRoot, 'unborn-repo')
    execFileSync('git', ['init', '-b', 'main', unbornDir])
    const unbornBranches = await svc.branches(unbornDir, false)
    assert.equal(unbornBranches.ok, true)
    assert.deepEqual(unbornBranches.value, { remoteBranches: [], localBranches: [], defaultBase: 'HEAD' })

    // 9. Git-diff management: combined diff, file-scoped commit, AI commit-message suggestion.
    writeFileSync(join(repoDir, 'README.md'), 'hello changed\n')
    writeFileSync(join(repoDir, 'NEW.md'), 'brand new\n')

    // 9a. Without a mounted llm runtime the suggestion fails with GIT_LLM_UNAVAILABLE.
    const suggestNoLlm = await svc.suggestCommitMessage(repoDir)
    assert.equal(suggestNoLlm.ok, false)
    assert.equal(suggestNoLlm.code, 'GIT_LLM_UNAVAILABLE')

    // 9b. `diff` lists staged/unstaged/untracked rows and inlines untracked diffs.
    const diffEnv = await svc.diff(repoDir)
    assert.equal(diffEnv.ok, true)
    assert.equal(diffEnv.value.branch, 'develop')
    assert.deepEqual(
      diffEnv.value.changes.map(c => c.file).sort(),
      ['NEW.md', 'README.md'],
    )
    const newEntry = diffEnv.value.changes.find(c => c.file === 'NEW.md')
    assert.equal(newEntry.untracked, true)
    assert.equal(diffEnv.value.changes.find(c => c.file === 'README.md').untracked, false)
    assert.ok(diffEnv.value.diff.includes('+hello changed'), 'tracked diff must be included')
    assert.ok(diffEnv.value.diff.includes('+brand new'), 'untracked diff must be inlined')

    // 9c. Empty message and empty selection are rejected without touching the repo.
    const badMsg = await svc.commit(repoDir, '   ', undefined)
    assert.equal(badMsg.ok, false)
    assert.equal(badMsg.code, 'GIT_COMMIT_FAILED')
    const badFiles = await svc.commit(repoDir, 'msg', [])
    assert.equal(badFiles.ok, false)
    assert.equal(badFiles.code, 'GIT_COMMIT_FAILED')

    // 9d. Commit stages exactly the selected files and reports branch/hash/summary.
    const committed = await svc.commit(repoDir, 'docs: extend readme, add NEW', ['README.md', 'NEW.md'])
    assert.equal(committed.ok, true)
    assert.equal(committed.value.branch, 'develop')
    assert.ok(committed.value.commit.length >= 7, 'commit hash must be present')
    assert.equal(committed.value.summary, 'docs: extend readme, add NEW')
    assert.equal(committed.value.path, repoDir)
    const cleanDiff = await svc.diff(repoDir)
    assert.equal(cleanDiff.ok, true)
    assert.equal(cleanDiff.value.changes.length, 0)
    const lastSubject = execFileSync('git', ['-C', repoDir, 'log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim()
    assert.equal(lastSubject, 'docs: extend readme, add NEW')

    // 9d2. Rename rows keep the porcelain source path as oldFile.
    execFileSync('git', ['-C', repoDir, 'mv', 'README.md', 'RENAMED.md'])
    const renameDiff = await svc.diff(repoDir)
    assert.equal(renameDiff.ok, true)
    const renameEntry = renameDiff.value.changes.find(c => c.file === 'RENAMED.md')
    assert.equal(renameEntry?.oldFile, 'README.md', 'rename row must carry its source path')
    assert.ok(renameDiff.value.diff.includes('rename from README.md'), 'rename header must survive in the diff text')
    execFileSync('git', ['-C', repoDir, 'mv', 'RENAMED.md', 'README.md'])

    // 9d3. Push publishes the branch to its upstream and clears the ahead count.
    const pushed = await svc.push(repoDir)
    assert.equal(pushed.ok, true)
    assert.equal(pushed.value.branch, 'develop')
    assert.equal(pushed.value.upstream, 'origin/develop')
    const afterPush = await svc.status(repoDir)
    assert.equal(afterPush.ok, true)
    assert.equal(afterPush.value.ahead, 0)

    // 9d4. ignoreWhitespace drops whitespace-only edits from the diff text; staged rows carry the flag.
    writeFileSync(join(repoDir, 'README.md'), 'hello changed  \n')
    const wsDefault = await svc.diff(repoDir)
    assert.ok(wsDefault.value.diff.includes('diff --git a/README.md'), 'whitespace-only edit appears by default')
    const wsIgnored = await svc.diff(repoDir, undefined, true)
    assert.equal(wsIgnored.ok, true)
    assert.ok(!wsIgnored.value.diff.includes('diff --git a/README.md'), 'ignoreWhitespace must drop whitespace-only edits')
    assert.equal(wsIgnored.value.changes.find(c => c.file === 'README.md').staged, false, 'unstaged row before git add')
    execFileSync('git', ['-C', repoDir, 'add', 'README.md'])
    const stagedDiff = await svc.diff(repoDir)
    assert.equal(stagedDiff.value.changes.find(c => c.file === 'README.md').staged, true, 'staged row after git add')
    execFileSync('git', ['-C', repoDir, 'checkout', 'HEAD', '--', 'README.md'])

    // 9e. Suggestion streams through the mounted llm runtime and returns the cleaned message.
    const llmCalls = []
    ctx.provide('llm', {
      listProviders: () => [{ id: 'test-provider', name: 'Test' }],
      listModels: async provider => {
        assert.equal(provider, 'test-provider')
        return [{ id: 'test-model', name: 'Test Model', provider }]
      },
      async *stream(options) {
        llmCalls.push(options)
        yield { type: 'text-delta', text: '```\nfeat: add demo file\n```' }
        yield { type: 'finish' }
      },
    })
    writeFileSync(join(repoDir, 'SUGGEST.md'), 'write me\n')
    const suggest = await svc.suggestCommitMessage(repoDir)
    assert.equal(suggest.ok, true)
    assert.equal(suggest.value.message, 'feat: add demo file', 'code fences must be stripped')
    assert.equal(suggest.value.provider, 'test-provider')
    assert.equal(suggest.value.model, 'test-model')
    assert.equal(llmCalls.length, 1)
    assert.ok(llmCalls[0].messages[0].content[0].text.includes('+write me'), 'prompt must carry the diff')

    // 9f. No working-tree changes -> GIT_COMMIT_FAILED without calling the model.
    execFileSync('rm', [join(repoDir, 'SUGGEST.md')])
    const suggestNone = await svc.suggestCommitMessage(repoDir)
    assert.equal(suggestNone.ok, false)
    assert.equal(suggestNone.code, 'GIT_COMMIT_FAILED')
    assert.equal(llmCalls.length, 1)

    // 9g. Huge *.map artifact must NOT starve source files or untracked subdirectories after it,
    // and single-file `diff(path, file)` fetches on demand.
    writeFileSync(join(repoDir, 'a_bundle.js.map'), 'x\n')
    writeFileSync(join(repoDir, 'z_source.ts'), 'export const v = 1\n')
    execFileSync('git', ['-C', repoDir, 'add', 'a_bundle.js.map', 'z_source.ts'])
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'seed map and source'])
    writeFileSync(join(repoDir, 'a_bundle.js.map'), `${'M'.repeat(620_000)}\n`)
    writeFileSync(join(repoDir, 'z_source.ts'), 'export const v = 2\n')
    mkdirSync(join(repoDir, 'nested-new'), { recursive: true })
    writeFileSync(join(repoDir, 'nested-new', 'child.ts'), 'export const child = true\n')

    const bigDiff = await svc.diff(repoDir)
    assert.equal(bigDiff.ok, true)
    assert.deepEqual(
      bigDiff.value.changes.map(c => c.file).sort(),
      ['a_bundle.js.map', 'nested-new/child.ts', 'z_source.ts'],
    )
    assert.equal(bigDiff.value.changes.find(c => c.file === 'z_source.ts').add, 1)
    assert.ok(bigDiff.value.diff.includes('+export const v = 2'), 'source file after 620KB .map must be present!')
    assert.ok(bigDiff.value.diff.includes('+export const child = true'), 'untracked nested file must be expanded & diffed!')

    const mapSingle = await svc.diff(repoDir, 'a_bundle.js.map')
    assert.equal(mapSingle.ok, true)
    assert.ok(mapSingle.value.diff.includes('diff --git a/a_bundle.js.map b/a_bundle.js.map'))

    // 8. Agent tools registered cleanly (git_diff + git_commit); each must
    // declare output { schema, render } or the real host refuses activation.
    assert.deepEqual([...stubs.registeredTools.keys()].sort(), ['git_commit', 'git_diff'])
    for (const def of stubs.registeredTools.values()) {
      assert.equal(typeof def.output?.render, 'function', `${def.name} missing output.render`)
      assert.deepEqual(def.output.schema, { type: 'object' }, `${def.name} missing output.schema`)
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
