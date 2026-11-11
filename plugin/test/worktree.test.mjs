import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import WorktreeManagerService from '../lib/index.js'

function makeHostStubs(initialWorkspaces) {
  const workspaces = [...initialWorkspaces]
  let wsSeq = 1
  let currentCwd = initialWorkspaces[0]?.path ?? process.cwd()

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

  const archivedSessionIds = []
  const workspaceRegistry = {
    list: () => [...workspaces],
    archivedSessionIds,
    async resolveByPath(p) {
      const canon = realpathSync(p)
      return workspaces.find(w => w.path === canon)
    },
    async create(p, title) {
      const canon = realpathSync(p)
      const existing = workspaces.find(w => w.path === canon)
      if (existing) return existing
      const entity = { id: `ws-${wsSeq++}`, path: canon, title: title ?? canon.split('/').pop(), sessionIds: [] }
      workspaces.push(entity)
      return entity
    },
    async delete(id) {
      const idx = workspaces.findIndex(w => w.id === id)
      if (idx < 0) return false
      workspaces.splice(idx, 1)
      return true
    },
    async archiveSession(sessionId) {
      if (!archivedSessionIds.includes(sessionId)) archivedSessionIds.push(sessionId)
    },
  }

  const workingDirectory = {
    get: () => currentCwd,
    ensure: async () => currentCwd,
    set: async (_agent, next) => {
      currentCwd = next
      return next
    },
  }

  const registeredTools = new Map()
  const tools = {
    register(def) {
      registeredTools.set(def.name, def)
      return () => registeredTools.delete(def.name)
    },
  }

  const storedSessions = []
  const sessionPersistence = {
    async list() {
      return [...storedSessions]
    },
  }

  return {
    fsService,
    subprocessService,
    workspaceRegistry,
    sessionPersistence,
    storedSessions,
    archivedSessionIds,
    workingDirectory,
    tools,
    registeredTools,
    workspaces,
  }
}

test('WorktreeManagerService end-to-end: SRC descriptors, multi-repo overview, lineage create, pin, workspace sync, safe remove', async () => {
  const tempRoot = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-orca-wt-test-')))
  // Unified pool must live outside the plugin install dir during tests.
  process.env.DSH_WORKTREE_POOL = join(tempRoot, 'unified-pool')
  try {
    const repoDir = join(tempRoot, 'qiz-pg-penta-server')
    execFileSync('git', ['init', '-b', 'develop', repoDir])
    execFileSync('git', ['-C', repoDir, 'config', 'user.email', 'test@example.com'])
    execFileSync('git', ['-C', repoDir, 'config', 'user.name', 'Test'])
    writeFileSync(join(repoDir, 'README.md'), 'hello\n')
    execFileSync('git', ['-C', repoDir, 'add', 'README.md'])
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'init'])

    const ctx = new Context()
    const stubs = makeHostStubs([{ id: 'ws-root', path: repoDir, title: 'qiz-pg-penta-server' }])
    ctx.provide('fs', stubs.fsService)
    ctx.provide('subprocess', stubs.subprocessService)
    ctx.provide('workingDirectory', stubs.workingDirectory)
    ctx.provide('workspaceRegistry', stubs.workspaceRegistry)
    ctx.provide('sessionPersistence', stubs.sessionPersistence)
    ctx.provide('tools', stubs.tools)

    // Mount through Cordis `ctx.plugin(...)` so Proxy `inject` enforcement runs identically to Host!
    const fiber = ctx.plugin(WorktreeManagerService)
    await new Promise(r => setTimeout(r, 20))
    assert.ok(fiber, 'plugin fiber created')
    const svc = ctx.get('rWorktreeManager')
    assert.ok(svc, 'rWorktreeManager service must activate under strict Cordis inject proxy')

    // 1. Verify Typert SRC markers & browser verbs carry zero `agent` parameter!
    const methods = remoteMethods(svc)
    const exportedNames = methods.map(m => m.exportName ?? m.method).sort()
    assert.deepEqual(exportedNames, [
      'archivedMeta',
      'branches',
      'create',
      'ensureWorkspace',
      'overview',
      'remove',
      'setPinned',
      'status',
    ])
    for (const m of methods) {
      const src = String(svc[m.method])
      const header = src.slice(0, src.indexOf('{'))
      assert.ok(!/\bagent\b/.test(header), `Remote ${m.method} must not declare agent lookup parameter: ${header}`)
    }

    // 1b. Verify `branches` lists remote & local refs, filters origin/HEAD symref, and supports refresh fetch.
    const remoteBareDir = join(tempRoot, 'origin.git')
    execFileSync('git', ['init', '--bare', '-b', 'develop', remoteBareDir])
    execFileSync('git', ['-C', repoDir, 'remote', 'add', 'origin', remoteBareDir])
    execFileSync('git', ['-C', repoDir, 'push', '-u', 'origin', 'develop'])
    execFileSync('git', ['-C', remoteBareDir, 'symbolic-ref', 'HEAD', 'refs/heads/develop'])
    execFileSync('git', ['-C', repoDir, 'fetch', 'origin'])
    execFileSync('git', ['-C', repoDir, 'remote', 'set-head', 'origin', '-a'])

    // Push a new branch via a temp clone so `branches(..., true)` must `git fetch` to discover it.
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

    // 2. Overview discovers repo & defaults main branch (`develop`) to pinned=true.
    const initial = await svc.overview(true)
    assert.equal(initial.ok, true)
    assert.equal(initial.value.repos.length, 1)
    assert.equal(initial.value.repos[0].name, 'qiz-pg-penta-server')
    assert.equal(initial.value.repos[0].rows.length, 1)
    assert.equal(initial.value.repos[0].rows[0].branch, 'develop')
    assert.equal(initial.value.repos[0].rows[0].pinned, true)

    // 3. Create worktree from remote branch `origin/release/v1` -> auto-registers DSH Workspace + persists base ref + lineage!
    const created1 = await svc.create(repoDir, 'feat_gen_task', 'origin/release/v1', repoDir)
    assert.equal(created1.ok, true)
    assert.equal(created1.value.branch, 'feat_gen_task')
    assert.ok(created1.value.path.startsWith(process.env.DSH_WORKTREE_POOL), 'worktree must live in the unified pool')
    assert.ok(created1.value.workspaceId, 'created worktree must auto-register a DSH Workspace')
    assert.equal(readFileSync(join(created1.value.path, 'RELEASE.md'), 'utf8'), 'v1\n')

    // Create grandchild worktree under `feat_gen_task` to verify Orca lineage nesting!
    const created2 = await svc.create(repoDir, 'feat_sub_task', 'HEAD', created1.value.path)
    assert.equal(created2.ok, true)
    assert.equal(created2.value.parentPath, created1.value.path)

    // 4. Pin `feat_gen_task` and check overview reflects lineage & pin state.
    const pinRes = await svc.setPinned(created1.value.path, true)
    assert.equal(pinRes.ok, true)

    const afterCreate = await svc.overview(true)
    assert.equal(afterCreate.ok, true)
    const rows = afterCreate.value.repos[0].rows
    assert.equal(rows.length, 3)
    const genRow = rows.find(r => r.branch === 'feat_gen_task')
    const subRow = rows.find(r => r.branch === 'feat_sub_task')
    assert.equal(genRow.pinned, true)
    assert.equal(subRow.parentPath, genRow.path)

    // 4b. Physical-nesting fallback: a checkout created outside the plugin
    // registry (like the native DSH worktree tool) still nests under the
    // worktree physically containing it.
    const manualPath = join(repoDir, '.agents/worktrees/manual_native')
    execFileSync('git', ['-C', repoDir, 'worktree', 'add', '-b', 'manual_native', manualPath])
    const nested = await svc.overview(true)
    assert.equal(nested.ok, true)
    const nestedRows = nested.value.repos[0].rows
    assert.equal(nestedRows.length, 4)
    const manualRow = nestedRows.find(r => r.branch === 'manual_native')
    assert.equal(manualRow.parentPath, repoDir)

    // 4c. A physically nested child blocks parent removal even without a registry entry.
    const manualLeaf = join(manualPath, '.agents/worktrees/manual_leaf')
    execFileSync('mkdir', ['-p', join(manualPath, '.agents/worktrees')])
    execFileSync('git', ['-C', repoDir, 'worktree', 'add', '-b', 'manual_leaf', manualLeaf])
    const blockedByPhysical = await svc.remove(manualPath, false)
    assert.equal(blockedByPhysical.ok, false)
    assert.equal(blockedByPhysical.code, 'WORKTREE_HAS_CHILDREN')

    // 5. Removing parent without force is blocked by WORKTREE_HAS_CHILDREN!
    const blockedByChild = await svc.remove(genRow.path, false)
    assert.equal(blockedByChild.ok, false)
    assert.equal(blockedByChild.code, 'WORKTREE_HAS_CHILDREN')

    // 6. Dirty file blocks non-force removal with WORKTREE_DIRTY!
    writeFileSync(join(subRow.path, 'dirty.txt'), 'uncommitted\n')
    const blockedByDirty = await svc.remove(subRow.path, false)
    assert.equal(blockedByDirty.ok, false)
    assert.equal(blockedByDirty.code, 'WORKTREE_DIRTY')

    // 7. Force removal succeeds and cleans up workspace registration.
    const removedSub = await svc.remove(subRow.path, true)
    assert.equal(removedSub.ok, true)
    const removedGen = await svc.remove(genRow.path, false)
    assert.equal(removedGen.ok, true)

    // 7b. Full cleanup: an unpushed branch with unmerged commits is force-deleted and flagged.
    const createdUnmerged = await svc.create(repoDir, 'feat_unmerged', 'HEAD', repoDir)
    assert.equal(createdUnmerged.ok, true)
    writeFileSync(join(createdUnmerged.value.path, 'wip.txt'), 'unmerged\n')
    execFileSync('git', ['-C', createdUnmerged.value.path, 'add', 'wip.txt'])
    execFileSync('git', ['-C', createdUnmerged.value.path, 'commit', '-m', 'wip'])
    const removedUnmerged = await svc.remove(createdUnmerged.value.path, false)
    assert.equal(removedUnmerged.ok, true)
    assert.equal(removedUnmerged.value.branchDeleted, true)
    assert.equal(removedUnmerged.value.branchHadUnmerged, true)
    assert.equal(removedUnmerged.value.remoteDeleted, undefined)
    assert.equal(
      execFileSync('git', ['-C', repoDir, 'branch', '--list', 'feat_unmerged'], { encoding: 'utf8' }).trim(),
      '',
      'unmerged branch must be gone after remove',
    )

    // 7c. Pushed branch: overview exposes the upstream and remove can delete the remote branch too.
    // Note `branch -d` succeeds here already because git treats the pushed upstream as merged.
    const createdPushed = await svc.create(repoDir, 'feat_pushed', 'HEAD', repoDir)
    assert.equal(createdPushed.ok, true)
    execFileSync('git', ['-C', createdPushed.value.path, 'push', '-u', 'origin', 'feat_pushed'])
    const withUpstream = await svc.overview(true)
    const upstreamRow = withUpstream.value.repos[0].rows.find(r => r.branch === 'feat_pushed')
    assert.equal(upstreamRow.upstream, 'origin/feat_pushed')
    const removedPushed = await svc.remove(createdPushed.value.path, false, true)
    assert.equal(removedPushed.ok, true)
    assert.equal(removedPushed.value.remoteDeleted, true)
    assert.equal(
      execFileSync('git', ['-C', repoDir, 'branch', '-r', '--list', 'origin/feat_pushed'], { encoding: 'utf8' }).trim(),
      '',
      'remote branch must be gone when deleteRemote is set',
    )

    // 7d. Ghost guard: a checkout deleted outside the plugin (rm -rf) is hidden from overview,
    // flagged in `missingPaths` when registered as a Workspace, and removable cleanly via `svc.remove`.
    const ghostCreated = await svc.create(repoDir, 'ghost_branch', 'HEAD', repoDir)
    assert.equal(ghostCreated.ok, true)
    rmSync(ghostCreated.value.path, { recursive: true, force: true })
    const ghostOverview = await svc.overview(true)
    assert.ok(
      !ghostOverview.value.repos[0].rows.some(r => r.branch === 'ghost_branch'),
      'checkout deleted on disk must not be listed',
    )
    assert.ok(
      ghostOverview.value.missingPaths.includes(ghostCreated.value.path),
      'missing workspace path must be reported in missingPaths',
    )
    const ghostRemoved = await svc.remove(ghostCreated.value.path, false)
    assert.equal(ghostRemoved.ok, true)
    assert.ok(
      !stubs.workspaces.some(w => w.path === ghostCreated.value.path),
      'removing a missing checkout must unregister its stale Workspace',
    )

    // 7e. Removing a worktree auto-archives its sessions via `workspaceRegistry.archiveSession`
    // and records repo/branch metadata in `archivedMeta()` for Settings -> Archived Sessions.
    const createdWithChats = await svc.create(repoDir, 'feat_archive_demo', 'HEAD', repoDir)
    assert.equal(createdWithChats.ok, true)
    stubs.storedSessions.push(
      { header: { id: 'session-arch-1', cwd: createdWithChats.value.path } },
      { header: { id: 'session-arch-2', cwd: `${createdWithChats.value.path}/sub` } },
    )
    const removedWithChats = await svc.remove(createdWithChats.value.path, false)
    assert.equal(removedWithChats.ok, true)
    assert.equal(removedWithChats.value.archivedCount, 2)
    assert.ok(stubs.archivedSessionIds.includes('session-arch-1'))
    assert.ok(stubs.archivedSessionIds.includes('session-arch-2'))

    const archMeta = await svc.archivedMeta()
    assert.equal(archMeta.ok, true)
    const archBranch = archMeta.value.branches.find(b => b.branch === 'feat_archive_demo')
    assert.ok(archBranch, 'archivedMeta must record removed branch')
    assert.equal(archBranch.repositoryRoot, repoDir)
    assert.equal(archBranch.repositoryName, 'qiz-pg-penta-server')
    assert.deepEqual(archBranch.sessionIds, ['session-arch-1', 'session-arch-2'])

    // 8b. Verify default poolRoot resolves to $HOME/.dsh/dsh-orca-worktrees when DSH_WORKTREE_POOL is unset.
    const savedPool = process.env.DSH_WORKTREE_POOL
    const savedDshHome = process.env.DSH_HOME
    const savedHome = process.env.HOME
    try {
      delete process.env.DSH_WORKTREE_POOL
      delete process.env.DSH_HOME
      process.env.HOME = join(tempRoot, 'fake-home')
      const defaultPoolCheck = await svc.overview(false)
      assert.equal(defaultPoolCheck.ok, true)
      assert.ok(
        defaultPoolCheck.value.repos[0].poolPath.startsWith(join(tempRoot, 'fake-home', '.dsh', 'dsh-orca-worktrees')),
        `expected poolPath under ~/.dsh/dsh-orca-worktrees, got ${defaultPoolCheck.value.repos[0].poolPath}`,
      )
    } finally {
      process.env.DSH_WORKTREE_POOL = savedPool
      if (savedDshHome !== undefined) process.env.DSH_HOME = savedDshHome
      process.env.HOME = savedHome
    }

    execFileSync('git', ['-C', repoDir, 'worktree', 'remove', '--force', manualLeaf])
    execFileSync('git', ['-C', repoDir, 'worktree', 'remove', '--force', manualPath])
    const finalOverview = await svc.overview(true)
    assert.equal(finalOverview.ok, true)
    assert.equal(finalOverview.value.repos[0].rows.length, 1)

    // 8. Verify Agent tools registered cleanly + central registry file in pool root.
    assert.equal(stubs.registeredTools.size, 6)
    assert.equal(JSON.parse(readFileSync(join(process.env.DSH_WORKTREE_POOL, 'worktree-manager.json'), 'utf8')).version, 2)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
