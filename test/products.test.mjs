import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

// Test the source module without changing the integration build owned by the parent task.
const source = readFileSync(new URL('../src/products.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText
const { Products } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orca-products-')))
  t.after(() => { assert.ok(root.startsWith(realpathSync(tmpdir()) + '/orca-products-')); rmSync(root, { recursive: true, force: true }) })
  const app = join(root, 'app')
  mkdirSync(app)
  const registry = join(root, 'registry.json')
  const services = new Map()
  const events = new Map()
  const cleanups = []
  const tools = new Map()
  const sessions = new Map()
  const agents = new Map()
  const workspaces = new Map()
  const writes = []
  const context = {
    get: key => services.get(key),
    on(name, listener) {
      const set = events.get(name) ?? new Set()
      set.add(listener)
      events.set(name, set)
      return () => set.delete(listener)
    },
    effect(fn) { const dispose = fn(); if (dispose) cleanups.push(dispose) },
  }
  services.set('fs', {
    async resolve(path, opts) {
      let full = resolve(opts?.cwd ?? root, path)
      try { full = realpathSync(full) } catch { full = join(realpathSync(dirname(full)), full.split('/').at(-1)) }
      return { displayPath: full, targetKey: full }
    },
    processPath: target => target.displayPath,
    async stat(target) {
      try { const info = statSync(target.displayPath); return { type: info.isDirectory() ? 'directory' : 'file', version: `${info.mtimeMs}:${info.size}` } } catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
    },
    async readText(target) { return readFileSync(target.displayPath, 'utf8') },
    async writeText(target, text, expected, signal, policy) {
      signal?.throwIfAborted()
      writes.push({ path: target.displayPath, policy })
      const effectivePolicy = policy ?? { mode: 'workspace-write', workspaceRoot: app }
      if (effectivePolicy.mode === 'workspace-write' && !target.displayPath.startsWith(effectivePolicy.workspaceRoot.replace(/\/$/, '') + '/')) throw new Error('sandbox denied manifest write')
      const existing = await this.stat(target)
      if (expected.kind === 'createIfAbsent' ? existing : existing?.version !== expected.version) throw new Error('stale manifest')
      const temporary = target.displayPath + '.tmp'
      writeFileSync(temporary, text)
      renameSync(temporary, target.displayPath)
    },
  })
  services.set('storageDomain', {
    async open(spec) {
      assert.match(spec.name, /^[a-z][a-z0-9_]*$/)
      let state
      try { state = spec.global.schema.parse(JSON.parse(readFileSync(registry, 'utf8'))) } catch (error) { if (error.code !== 'ENOENT') throw error; state = structuredClone(spec.global.initial) }
      return {
        global: { get: () => state, async set(next) { const tmp = registry + '.tmp'; writeFileSync(tmp, JSON.stringify(next)); renameSync(tmp, registry); state = structuredClone(next) } },
        async close() {},
      }
    },
  })
  services.set('workspaceRegistry', { async create(path, title) { workspaces.set(path, title) } })
  services.set('sessions', { get: id => sessions.get(id) })
  services.set('agents', { get: id => agents.get(id), list: () => [...agents.values()] })
  services.set('tools', { register(definition) { tools.set(definition.name, definition); return () => tools.delete(definition.name) } })
  services.set('workingDirectory', { get: () => app })
  services.set('sandboxPolicy', { resolve: () => ({ mode: 'workspace-write', workspaceRoot: app }) })
  const manager = new Products(context, root)
  async function agent(id, parentSession) {
    const scopedEvents = new Map()
    let contribution
    const session = { id, header: { parentSession }, events: [], snapshotEvents() { return this.events } }
    const value = { session, status: 'idle', inbox: { nextTurn: [], nextStep: [] }, ctx: {
      get(key) { return key === 'systemPrompt' ? { context(value) { contribution = value; return () => { contribution = undefined } } } : services.get(key) },
      on(name, listener) { scopedEvents.set(name, listener); return () => scopedEvents.delete(name) },
    } }
    sessions.set(id, session)
    agents.set(id, value)
    for (const listener of events.get('agent/created') ?? []) await listener({ agent: value })
    return {
      value, text: () => contribution?.text(),
      async step(turn) { return scopedEvents.get('agent/pre-step')({ turn, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [] })) },
    }
  }
  t.after(async () => { for (const dispose of cleanups.reverse()) await dispose() })
  return { root, app, registry, context, manager, tools, workspaces, writes, agent }
}

function manifest(name = 'Product', path = './app') { return JSON.stringify({ name, projects: [{ name: 'App', path }] }) }
function value(envelope) { assert.equal(envelope.ok, true, envelope.message); return envelope.value }

test('create starts an empty managed group and add appends canonical workspaces serially and idempotently', async t => {
  const f = fixture(t)
  const group = value(await f.manager.createProduct('  Product A  '))
  assert.equal(group.name, 'Product A')
  assert.deepEqual(group.projects, [])
  assert.equal(dirname(group.manifestPath), f.root)
  assert.match(group.manifestPath, /\/product-[a-f0-9-]+\.json$/)
  assert.deepEqual(JSON.parse(readFileSync(group.manifestPath, 'utf8')), { name: 'Product A', projects: [] })
  assert.equal(f.workspaces.size, 0)
  assert.equal(f.tools.size, 6)
  const count = f.writes.length
  assert.equal((await f.manager.createProduct('   ')).ok, false)
  assert.equal(f.writes.length, count)

  const other = join(f.root, 'server')
  mkdirSync(other)
  const additions = await Promise.all([
    f.manager.addProductWorkspace(group.id, f.app),
    f.manager.addProductWorkspace(group.id, other),
  ])
  assert.deepEqual(additions.map(result => value(result).added), [true, true])
  const latest = value(await f.manager.products()).products[0]
  assert.deepEqual(latest.projects.map(project => project.path), [f.app, other])
  assert.equal(f.workspaces.get(f.app), 'app')
  assert.equal(f.workspaces.get(other), 'server')
  const beforeDuplicate = f.writes.length
  assert.equal(value(await f.manager.addProductWorkspace(group.id, f.app)).added, false)
  const alias = join(f.root, 'app-link')
  symlinkSync(f.app, alias)
  const duplicate = value(await f.manager.addProductWorkspace(group.id, alias))
  assert.equal(duplicate.projects.length, 2)
  assert.equal(duplicate.added, false)
  assert.equal(f.writes.length, beforeDuplicate)

  const second = value(await f.manager.createProduct('Product B'))
  assert.notEqual(second.id, group.id)
  assert.notEqual(second.manifestPath, group.manifestPath)
  assert.equal(value(await f.manager.addProductWorkspace(second.id, f.app)).projects[0].path, f.app)
  assert.equal(value(await f.manager.products()).products[0].projects.length, 2)
  assert.equal((await f.manager.addProductWorkspace('missing-product', f.app)).ok, false)
  assert.equal((await f.manager.addProductWorkspace(group.id, group.manifestPath)).ok, false)
})

test('concurrent additions of one canonical directory return one added result and never persist the response flag', async t => {
  const f = fixture(t)
  const group = value(await f.manager.createProduct('Concurrent group'))
  const before = f.writes.length
  const results = await Promise.all([
    f.manager.addProductWorkspace(group.id, f.app),
    f.manager.addProductWorkspace(group.id, f.app),
  ])
  assert.deepEqual(results.map(result => value(result).added), [true, false])
  assert.equal(f.writes.length, before + 1)
  const snapshot = value(await f.manager.products())
  assert.equal(snapshot.products[0].projects.length, 1)
  assert.equal('added' in snapshot.products[0], false)
  assert.equal('added' in JSON.parse(readFileSync(group.manifestPath, 'utf8')), false)
  assert.equal('added' in JSON.parse(readFileSync(f.registry, 'utf8')).products[0], false)
})

test('externally added directories report already present from the latest manifest without rewriting it', async t => {
  const f = fixture(t)
  const group = value(await f.manager.createProduct('Before external edit'))
  const external = manifest('External product name', './app')
  writeFileSync(group.manifestPath, external)
  const before = f.writes.length
  const result = value(await f.manager.addProductWorkspace(group.id, f.app))
  assert.equal(result.added, false)
  assert.equal(result.name, 'External product name')
  assert.equal(result.projects.length, 1)
  assert.equal(result.projects[0].path, f.app)
  assert.equal(f.writes.length, before)
  assert.equal(readFileSync(group.manifestPath, 'utf8'), external)
  assert.equal('added' in value(await f.manager.products()).products[0], false)
})

test('UI manifest writes use the chosen parent while backend workspace restrictions remain active', async t => {
  const f = fixture(t)
  const fs = f.context.get('fs')
  const outside = await fs.resolve(join(f.root, 'default-denied.json'))
  await assert.rejects(fs.writeText(outside, '{}', { kind: 'createIfAbsent' }), /sandbox denied manifest write/)
  const group = value(await f.manager.createProduct('UI group'))
  assert.equal(dirname(group.manifestPath), f.root)
  assert.deepEqual(f.writes.at(-1).policy, { mode: 'workspace-write', workspaceRoot: f.root })
  value(await f.manager.addProductWorkspace(group.id, f.app))
  assert.equal(JSON.parse(readFileSync(group.manifestPath, 'utf8')).projects[0].path, f.app)
  assert.deepEqual(f.writes.at(-1).policy, { mode: 'workspace-write', workspaceRoot: f.root })
  await assert.rejects(fs.writeText(outside, '{}', { kind: 'createIfAbsent' }), /sandbox denied manifest write/)
})

test('add loads external edits, preserves relative entries, rejects malformed manifests and concurrent external writes', async t => {
  const f = fixture(t)
  const group = value(await f.manager.createProduct('Before external edit'))
  const server = join(f.root, 'server')
  mkdirSync(server)
  writeFileSync(group.manifestPath, manifest('External product name', './app'))
  const added = value(await f.manager.addProductWorkspace(group.id, server))
  assert.equal(added.name, 'External product name')
  assert.equal(added.added, true)
  const disk = JSON.parse(readFileSync(group.manifestPath, 'utf8'))
  assert.deepEqual(disk.projects, [{ name: 'App', path: './app' }, { name: 'server', path: server }])

  writeFileSync(group.manifestPath, '{ broken external JSON')
  const writesBefore = f.writes.length
  assert.equal((await f.manager.addProductWorkspace(group.id, server)).ok, false)
  assert.equal(f.writes.length, writesBefore)
  assert.equal(readFileSync(group.manifestPath, 'utf8'), '{ broken external JSON')

  writeFileSync(group.manifestPath, manifest('External before competing write', './app'))
  const fs = f.context.get('fs')
  const write = fs.writeText
  const competing = manifest('Competing writer preserves its own data and project entry', './app')
  fs.writeText = async function (...args) {
    writeFileSync(group.manifestPath, competing)
    return write.apply(this, args)
  }
  assert.equal((await f.manager.addProductWorkspace(group.id, server)).ok, false)
  assert.equal(readFileSync(group.manifestPath, 'utf8'), competing)
})

test('group creation and addition tools share Host operations and preserve agent sandbox checks', async t => {
  const f = fixture(t)
  const actor = (await f.agent('creator')).value
  const exec = { agent: actor, signal: new AbortController().signal }
  assert.equal((await f.tools.get('product_create').execute({ name: 'Outside workspace' }, exec)).ok, false)
  assert.deepEqual(value(await f.manager.products()).products, [])
  f.context.get('sandboxPolicy').resolve = () => ({ mode: 'danger-full-access' })
  const group = value(await f.tools.get('product_create').execute({ name: 'Tool group' }, exec))
  assert.deepEqual(group.projects, [])
  assert.equal(value(await f.tools.get('product_add_workspace').execute({ productId: group.id, path: f.app }, exec)).added, true)
  const writesAfterAdd = f.writes.length
  assert.equal(value(await f.tools.get('product_add_workspace').execute({ productId: group.id, path: f.app }, exec)).added, false)
  assert.equal(f.writes.length, writesAfterAdd)
  assert.equal(JSON.parse(readFileSync(group.manifestPath, 'utf8')).projects.length, 1)

  const server = join(f.root, 'server')
  mkdirSync(server)
  f.context.get('sandboxPolicy').resolve = () => ({ mode: 'workspace-write', workspaceRoot: f.app })
  const original = readFileSync(group.manifestPath, 'utf8')
  assert.equal((await f.tools.get('product_add_workspace').execute({ productId: group.id, path: server }, exec)).ok, false)
  assert.equal(readFileSync(group.manifestPath, 'utf8'), original)
  f.context.get('sandboxPolicy').resolve = () => ({ mode: 'read-only', workspaceRoot: f.app })
  assert.equal((await f.tools.get('product_create').execute({ name: 'Read only' }, exec)).ok, false)
  assert.equal((await f.tools.get('product_add_workspace').execute({ productId: group.id, path: server }, exec)).ok, false)
  assert.equal(readFileSync(group.manifestPath, 'utf8'), original)
})

test('save/import canonicalizes directories, keeps stable id, registers projects, and retains invalid manifest data after reload', async t => {
  const f = fixture(t)
  symlinkSync(f.app, join(f.root, 'alias'))
  const path = join(f.root, 'product.json')
  const product = value(await f.manager.saveProduct(path, manifest('Suite', './alias')))
  assert.equal(product.projects[0].path, f.app)
  assert.equal(f.workspaces.get(f.app), 'App')
  assert.equal(value(await f.manager.saveProduct(path)).id, product.id)
  for (const custom of [
    { ...JSON.parse(manifest()), custom: 'Preserve user data' },
    { name: 'Product', projects: [{ name: 'App', path: './app', custom: 'Preserve user data' }] },
  ]) {
    const text = JSON.stringify(custom)
    writeFileSync(path, text)
    assert.match(value(await f.manager.products()).products[0].error, /fields must be/)
    assert.equal((await f.manager.saveProduct(path)).ok, false)
    assert.equal(readFileSync(path, 'utf8'), text)
  }
  writeFileSync(path, '{ broken')
  const broken = value(await f.manager.products()).products[0]
  assert.match(broken.error, /JSON|property|Expected/i)
  assert.equal(broken.name, 'Suite')
  assert.deepEqual(broken.projects, product.projects)
  const reopened = new Products(f.context, f.root)
  assert.deepEqual(value(await reopened.products()).products[0].projects, product.projects)
  assert.equal((await f.manager.saveProduct(path, manifest('Bad', './missing'))).ok, false)
  assert.equal(readFileSync(path, 'utf8'), '{ broken')
  writeFileSync(path, manifest('Repaired', f.app))
  assert.equal(value(await f.manager.products()).products[0].error, undefined)
  assert.equal(value(await f.manager.products()).products[0].name, 'Repaired')
})

test('save rejects stale or absent versions without overwriting external changes', async t => {
  const f = fixture(t)
  const path = join(f.root, 'product.json')
  const first = value(await f.manager.saveProduct(path, manifest('Original')))
  assert.equal(typeof first.version, 'string')
  const external = manifest('Externally changed longer name')
  writeFileSync(path, external)
  for (const version of [undefined, first.version]) {
    const rejected = await f.manager.saveProduct(path, manifest('Old draft'), version)
    assert.equal(rejected.ok, false)
    assert.match(rejected.message, /import\/reload first/)
    assert.equal(readFileSync(path, 'utf8'), external)
  }
  const current = value(await f.manager.saveProduct(path))
  f.context.get('sandboxPolicy').resolve = () => ({ mode: 'danger-full-access' })
  const next = value(await f.tools.get('product_save').execute({ manifestPath: path, text: manifest('Saved after reload'), version: current.version }, {
    agent: (await f.agent('writer')).value,
  }))
  assert.equal(next.name, 'Saved after reload')
  assert.notEqual(next.version, current.version)
  assert.equal(next.version, value(await f.manager.saveProduct(path)).version)
  rmSync(path)
  assert.equal((await f.manager.saveProduct(path, manifest('Must not recreate'), next.version)).ok, false)
  assert.throws(() => statSync(path), /ENOENT/)
})

test('refresh registers newly referenced project directories after a manual JSON edit', async t => {
  const f = fixture(t)
  const path = join(f.root, 'product.json')
  const first = value(await f.manager.saveProduct(path, manifest()))
  const added = join(f.root, 'new-project')
  mkdirSync(added)
  writeFileSync(path, JSON.stringify({ name: 'Changed', projects: [
    { name: 'App', path: './app' }, { name: 'New project', path: './new-project' },
  ] }))
  assert.equal(f.workspaces.has(added), false)
  const refreshed = value(await f.manager.products()).products[0]
  assert.equal(refreshed.id, first.id)
  assert.equal(refreshed.error, undefined)
  assert.equal(f.workspaces.get(added), 'New project')
  assert.equal(refreshed.projects[1].path, added)
})

test('loading rejects a manifest changed during the read and keeps the last valid view', async t => {
  const f = fixture(t)
  const path = join(f.root, 'product.json')
  const first = value(await f.manager.saveProduct(path, manifest('Original')))
  const fs = f.context.get('fs')
  const originalRead = fs.readText
  fs.readText = async target => {
    const text = await originalRead(target)
    if (target.displayPath === path) writeFileSync(path, manifest('Changed while loading longer name'))
    return text
  }
  const refreshed = value(await f.manager.products()).products[0]
  assert.match(refreshed.error, /changed while loading/)
  assert.equal(refreshed.name, first.name)
  assert.equal(refreshed.version, first.version)
})

test('bindings persist, reject nonblank/running/invalid changes; removal keeps files and session identity', async t => {
  const f = fixture(t)
  const path = join(f.root, 'product.json')
  const product = value(await f.manager.saveProduct(path, manifest()))
  const first = await f.agent('first')
  value(await f.manager.bindProduct('first', product.id))
  value(await f.manager.bindProduct('first', product.id))
  const old = await f.agent('old')
  old.value.session.events.push({ type: 'user/message' })
  assert.equal((await f.manager.bindProduct('old', product.id)).ok, false)
  const running = await f.agent('running')
  running.value.status = 'running'
  assert.equal((await f.manager.bindProduct('running', product.id)).ok, false)
  const other = value(await f.manager.saveProduct(join(f.root, 'other.json'), manifest('Other')))
  assert.equal((await f.manager.bindProduct('first', other.id)).ok, false)
  const invalid = await f.agent('invalid')
  writeFileSync(path, '{}')
  assert.equal((await f.manager.bindProduct(invalid.value.session.id, product.id)).ok, false)
  value(await f.manager.removeProduct(product.id))
  assert.equal(value(await f.manager.products()).sessionProducts.first, product.id)
  assert.equal(statSync(f.app).isDirectory(), true)
  assert.equal(readFileSync(path, 'utf8'), '{}')
  await first.step(1)
  assert.match(first.text(), /removed/)
  const restored = new Products(f.context, f.root)
  assert.equal(value(await restored.products()).sessionProducts.first, product.id)
})

test('context refreshes once per turn, reports errors without stale paths, inherits lineage, and disposes', async t => {
  const f = fixture(t)
  const path = join(f.root, 'product.json')
  const product = value(await f.manager.saveProduct(path, manifest('One')))
  const parent = await f.agent('parent')
  value(await f.manager.bindProduct('parent', product.id))
  assert.equal((await parent.step(1)).kind, 'enter')
  assert.match(parent.text(), /One/)
  writeFileSync(path, manifest('Two'))
  await parent.step(1)
  assert.match(parent.text(), /One/)
  await parent.step(2)
  assert.match(parent.text(), /Two/)
  const child = await f.agent('child', 'parent')
  await child.step(1)
  assert.match(child.text(), /Two/)
  assert.equal(value(await f.manager.products()).sessionProducts.child, product.id)
  writeFileSync(path, '{')
  await parent.step(3)
  assert.match(parent.text(), /invalid manifest/)
  assert.equal(parent.text().includes(f.app), false)
})

test('agent manifest writes pass resolved sandbox policy; read-only and outside-workspace writes fail', async t => {
  const f = fixture(t)
  const a = await f.agent('writer')
  const inside = join(f.app, 'product.json')
  const text = manifest('Inside', '.')
  const saved = value(await f.tools.get('product_save').execute({ manifestPath: inside, text }, { agent: a.value }))
  assert.equal(f.writes.at(-1).policy.workspaceRoot, f.app)
  const outside = join(f.root, 'outside.json')
  assert.equal((await f.tools.get('product_save').execute({ manifestPath: outside, text: manifest() }, { agent: a.value })).ok, false)
  assert.throws(() => statSync(outside), /ENOENT/)
  f.context.get('sandboxPolicy').resolve = () => ({ mode: 'read-only', workspaceRoot: f.app })
  const count = f.writes.length
  assert.equal((await f.tools.get('product_save').execute({ manifestPath: inside, text: manifest('Denied', '.'), version: saved.version }, { agent: a.value })).ok, false)
  assert.equal(f.writes.length, count)
  assert.equal(JSON.parse(readFileSync(inside, 'utf8')).name, 'Inside')
})
