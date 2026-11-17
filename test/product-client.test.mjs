import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function initializer(path, name) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let result
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) result = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(result, name)
  return { node: result, source }
}
function evaluate(node, source, bindings) {
  const js = ts.transpileModule(`(${node.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(bindings), `return ${js}`)(...Object.values(bindings))
}

test('new product conversations bind before navigation; failures never expose an unbound chat', async () => {
  const { node, source } = initializer('../src/client/index.ts', 'startSession')
  const calls = []
  const navigation = new AbortController()
  let finish
  const start = evaluate(node, source, {
    activeProductId: 'product-a', layout: { beginNavigation: () => navigation.signal },
    ctx: { sessions: { create: async input => { calls.push(['create', input]); return 'new-chat' } } },
    api: { bindProduct: async (...args) => { calls.push(['bind', ...args]); await new Promise(resolve => { finish = resolve }) } },
    uiWorkspace: { openSession: id => calls.push(['open', id]), startSession: () => calls.push(['native']) },
    window: new EventTarget(),
  })
  const pending = start('repo', 'product-a')
  await Promise.resolve()
  assert.deepEqual(calls, [['create', { workspaceId: 'repo' }], ['bind', 'new-chat', 'product-a']])
  finish()
  await pending
  assert.deepEqual(calls.at(-1), ['open', 'new-chat'])

  const failed = evaluate(node, source, {
    activeProductId: 'broken', layout: { beginNavigation: () => new AbortController().signal },
    ctx: { sessions: { create: async () => 'failed-chat' } },
    api: { bindProduct: async () => { throw new Error('invalid manifest') } },
    uiWorkspace: { openSession: () => assert.fail('must not open before successful binding') },
    window: new EventTarget(),
  })
  await assert.rejects(failed('repo', 'broken'), /invalid manifest/)
})

test('superseded product creation completes binding without taking over later navigation', async () => {
  const { node, source } = initializer('../src/client/index.ts', 'startSession')
  const navigation = new AbortController()
  let finish
  let bound = false
  const start = evaluate(node, source, {
    activeProductId: 'product-a', layout: { beginNavigation: () => navigation.signal },
    ctx: { sessions: { create: async () => { await new Promise(resolve => { finish = resolve }); return 'late-chat' } } },
    api: { bindProduct: async () => { bound = true } },
    uiWorkspace: { openSession: () => assert.fail('superseded creation must not open') },
    window: new EventTarget(),
  })
  const pending = start('repo', 'product-a')
  navigation.abort()
  finish()
  await pending
  assert.equal(bound, true)
  const earlierTab = start('repo', 'product-b')
  finish()
  await earlierTab
})

test('new groups submit only their name without a manifest path or preselected workspaces', async () => {
  const { node, source } = initializer('../src/client/ProductDialog.tsx', 'run')
  const calls = []
  const created = { id: 'empty', name: 'New group', projects: [] }
  const run = evaluate(node, source, {
    busy: false, product: undefined, manifestPath: '', name: ' New group ',
    api: { createProduct: async name => { calls.push(name); return created } },
    setError: error => { assert.equal(error, null) }, setBusy: () => {},
    onSaved: product => { assert.equal(product, created) },
  })
  await run('create')
  assert.deepEqual(calls, ['New group'])
})

test('adding a workspace captures its group through directory selection and binds the new chat', async () => {
  const { node, source } = initializer('../src/client/index.ts', 'pickAndAddWorkspace')
  const calls = []
  let pick
  const makeAdd = activeProductId => evaluate(node, source, {
    activeProductId, layout: { beginNavigation: () => new AbortController().signal },
    uiWorkspace: { pickDirectory: () => new Promise(resolve => { pick = resolve }) },
    api: { addProductWorkspace: async (...args) => { calls.push(['add', ...args]) } },
    workspaces: { create: async input => { calls.push(['workspace', input]); return { workspaceId: 'workspace' } } },
    startSession: async (...args) => { calls.push(['chat', ...args]) },
    window: new EventTarget(),
  })
  const add = makeAdd('group-a')
  const pending = add('group-a')
  pick('/later-project')
  await pending
  assert.deepEqual(calls, [
    ['add', 'group-a', '/later-project'], ['workspace', { path: '/later-project' }], ['chat', 'workspace', 'group-a'],
  ])
  const cancelled = add('group-b')
  pick(null)
  await cancelled
  assert.equal(calls.length, 3)
  const all = makeAdd()()
  pick('/ungrouped')
  await all
  assert.deepEqual(calls.slice(3), [['workspace', { path: '/ungrouped' }], ['chat', 'workspace', undefined]])
})

test('navigation during a slow workspace addition keeps membership without opening another chat', async () => {
  const { node, source } = initializer('../src/client/index.ts', 'pickAndAddWorkspace')
  const navigation = new AbortController()
  let finish
  let registered = false
  const add = evaluate(node, source, {
    activeProductId: 'group-a', layout: { beginNavigation: () => navigation.signal },
    uiWorkspace: { pickDirectory: async () => '/project' },
    api: { addProductWorkspace: () => new Promise(resolve => { finish = resolve }) },
    workspaces: { create: async () => { registered = true; return { workspaceId: 'workspace' } } },
    startSession: () => assert.fail('later navigation must win'),
    window: new EventTarget(),
  })
  const pending = add('group-a')
  await Promise.resolve()
  navigation.abort()
  finish()
  await pending
  assert.equal(registered, true)
})

test('failed group additions do not create or open a conversation', async () => {
  const { node, source } = initializer('../src/client/index.ts', 'pickAndAddWorkspace')
  const add = evaluate(node, source, {
    activeProductId: 'broken', layout: { beginNavigation: () => new AbortController().signal },
    uiWorkspace: { pickDirectory: async () => '/project' },
    api: { addProductWorkspace: async () => { throw new Error('manifest changed') } },
    workspaces: { create: () => assert.fail('must save group membership first') },
    startSession: () => assert.fail('must not open a chat on failure'),
  })
  await assert.rejects(add('broken'), /manifest changed/)
})

test('product tabs share workspace history while keeping unrelated projects out', () => {
  const sidebar = '../src/client/OrcaSidebar.tsx'
  const sessions = ['a', 'b', 'old', 'archived', 'subagent', 'blank'].map(id => ({ id, cwd: '/same-repo', updatedAt: 1 }))
  sessions.find(s => s.id === 'subagent').origin = 'subagent'
  sessions.find(s => s.id === 'blank').blank = true
  sessions.push({ id: 'child', cwd: '/pool/child' }, { id: 'folder', cwd: '/folder/subdir' }, { id: 'explicit' }, { id: 'other', cwd: '/other' })
  const bindings = {
    sessionList: { ids: sessions.map(s => s.id), byId: Object.fromEntries(sessions.map(s => [s.id, s])) },
    archivedSet: new Set(['archived']), activeSessionId: '', pinnedSessionSet: new Set(['old']),
    products: { sessionProducts: { a: 'product-a', b: 'product-b' } },
    overview: { repos: [
      { repositoryRoot: '/same-repo', rows: [{ path: '/same-repo' }, { path: '/pool/child' }] },
      { repositoryRoot: '/other', rows: [{ path: '/other' }] },
    ] },
    workspaceSnap: { items: [{ path: '/same-repo', sessionIds: [] }, { path: '/folder', sessionIds: ['explicit'] }] },
  }
  const visible = initializer(sidebar, 'visibleSessions')
  const bucket = initializer(sidebar, '{ sessionsByPath, ungroupedSessions }')
  const repos = initializer(sidebar, 'renderedRepos')
  const folders = initializer(sidebar, 'filteredNonGit')
  const histories = []
  for (const productId of [undefined, 'product-a', 'product-b']) {
    const visibleSessions = evaluate(visible.node.arguments[0], visible.source, { ...bindings, productId })()
    const { sessionsByPath } = evaluate(bucket.node.arguments[0], bucket.source, { ...bindings, visibleSessions, normalizePath: path => path })()
    const scope = { ...bindings, productId, productPaths: new Set(['/same-repo', '/folder']), sessionsByPath, normalizePath: path => path }
    const renderedRepos = evaluate(repos.node, repos.source, { ...scope, renderRepo: repo => repo })
    const filteredNonGit = evaluate(folders.node, folders.source, { ...scope,
      nonGitWorkspaces: [{ path: '/folder' }, { path: '/unrelated-folder' }], normalizedQuery: '', normalizePath: path => path,
    })
    assert.deepEqual(renderedRepos.map(repo => repo.repositoryRoot), productId ? ['/same-repo'] : ['/same-repo', '/other'])
    assert.deepEqual(filteredNonGit.map(ws => ws.path), productId ? ['/folder'] : ['/folder', '/unrelated-folder'])
    const history = sessionsByPath.get('/same-repo').map(s => s.id)
    assert.deepEqual(history, ['old', 'a', 'b'])
    assert.deepEqual(sessionsByPath.get('/pool/child').map(s => s.id), ['child'])
    assert.deepEqual(sessionsByPath.get('/folder').map(s => s.id), ['folder', 'explicit'])
    histories.push(history)
  }
  assert.deepEqual(histories[0], histories[1])
  assert.deepEqual(histories[1], histories[2])
})

test('sessions without a workspace stay scoped to their bound product and remain searchable', () => {
  const { node, source } = initializer('../src/client/OrcaSidebar.tsx', 'filteredUngrouped')
  const bindings = { ungroupedSessions: ['a', 'b', 'old'].map(id => ({ id })),
    products: { sessionProducts: { a: 'product-a', b: 'product-b' } }, sessionLabel: s => s.id, t: () => '',
  }
  const run = (productId, normalizedQuery = '') => evaluate(node, source, { ...bindings, productId, normalizedQuery }).map(s => s.id)
  assert.deepEqual(run(undefined), ['a', 'b', 'old'])
  assert.deepEqual(run('product-a'), ['a'])
  assert.deepEqual(run('product-b'), ['b'])
  assert.deepEqual(run('empty'), [])
  assert.deepEqual(run('product-a', 'b'), [])
})

test('dragging a workspace onto a group copies membership without changing navigation or clearing a later drag', async () => {
  const sidebar = '../src/client/OrcaSidebar.tsx'
  const draggedWorkspacePath = { current: null }
  const highlights = []
  const calls = []
  const feedback = []
  const dragging = []
  let finish
  let finishRefresh
  const bindings = { draggedWorkspacePath, setDropProductId: id => highlights.push(id),
    setDraggingWorkspace: value => dragging.push(value),
    setDropFeedback: value => { feedback.push(value); calls.push(['feedback', value]) },
  }
  const expanded = initializer(sidebar, 'showAllProducts')
  const showAll = productsExpanded => evaluate(expanded.node, expanded.source, { productsExpanded, draggingWorkspace: dragging.at(-1) ?? false })
  assert.equal(showAll(false), false)
  assert.equal(showAll(true), true)
  const end = initializer(sidebar, 'endWorkspaceDrag')
  const endWorkspaceDrag = evaluate(end.node, end.source, bindings)
  const start = initializer(sidebar, 'startWorkspaceDrag')
  const startWorkspaceDrag = evaluate(start.node, start.source, bindings)
  const over = initializer(sidebar, 'dragWorkspaceOverProduct')
  const dragOver = evaluate(over.node, over.source, bindings)
  const drop = initializer(sidebar, 'dropWorkspaceOnProduct')
  const dropWorkspace = evaluate(drop.node, drop.source, { ...bindings, endWorkspaceDrag,
    api: { addProductWorkspace: (...args) => { calls.push(['add', ...args]); return new Promise(resolve => { finish = resolve }) } },
    refreshProducts: () => { calls.push(['refresh']); return new Promise(resolve => { finishRefresh = resolve }) },
    showToast: (...args) => calls.push(['toast', ...args]),
    t: (key, params) => `${key}:${params.name}`,
  })
  let prevented = 0
  const event = { preventDefault() { prevented++ }, stopPropagation() {}, dataTransfer: { setData: (...args) => calls.push(['data', ...args]) } }
  startWorkspaceDrag(event, '/workspace')
  assert.equal(dragging.at(-1), true)
  assert.equal(showAll(false), true, 'drag temporarily reveals groups even when manually collapsed')
  assert.equal(draggedWorkspacePath.current, '/workspace')
  assert.equal(event.dataTransfer.effectAllowed, 'copy')
  assert.deepEqual(calls.shift(), ['data', 'application/x-dsh-workspace-path', '/workspace'])
  dragOver(event, 'target-group')
  assert.equal(event.dataTransfer.dropEffect, 'copy')
  assert.equal(prevented, 1)
  assert.equal(highlights.at(-1), 'target-group')
  const pending = dropWorkspace(event, 'target-group')
  assert.equal(prevented, 2)
  assert.deepEqual(calls, [['add', 'target-group', '/workspace']])
  assert.deepEqual(feedback, [], 'pending additions must not report successful membership')
  assert.equal(draggedWorkspacePath.current, null)
  assert.equal(highlights.at(-1), undefined)
  assert.equal(dragging.at(-1), false)
  assert.equal(showAll(false), false, 'drop restores the collapsed preference')
  assert.equal(showAll(true), true, 'drop preserves the expanded preference')
  startWorkspaceDrag(event, '/next-workspace')
  finish({ name: 'Target', added: true })
  await Promise.resolve()
  assert.deepEqual(feedback, [], 'membership feedback waits for refreshed product data')
  assert.equal(calls.some(([kind]) => kind === 'toast'), false)
  finishRefresh()
  await pending
  assert.equal(draggedWorkspacePath.current, '/next-workspace')
  assert.equal(dragging.at(-1), true, 'an earlier completion must not collapse a later drag')
  assert.deepEqual(feedback, [{ path: '/workspace', productId: 'target-group' }])
  assert.deepEqual(calls.slice(-3), [['refresh'], ['feedback', { path: '/workspace', productId: 'target-group' }], ['toast', 'info', 'product.workspaceAdded:Target']])
  endWorkspaceDrag()
  assert.equal(draggedWorkspacePath.current, null)
  assert.equal(dragging.at(-1), false)
  assert.equal(showAll(false), false)
  assert.equal(showAll(true), true)
})

test('foreign and cancelled drags cannot add workspaces or highlight group tabs', async () => {
  const sidebar = '../src/client/OrcaSidebar.tsx'
  const bindings = { draggedWorkspacePath: { current: null }, setDropProductId: () => assert.fail('foreign drag must not highlight'),
    setDraggingWorkspace: () => assert.fail('foreign drag must not change group expansion'),
    setDropFeedback: () => assert.fail('foreign or cancelled drag must not report successful membership'),
  }
  const event = { preventDefault: () => assert.fail('foreign drag must not be accepted'), dataTransfer: { getData: () => '/foreign' } }
  const over = initializer(sidebar, 'dragWorkspaceOverProduct')
  evaluate(over.node, over.source, bindings)(event, 'target')
  const drop = initializer(sidebar, 'dropWorkspaceOnProduct')
  await evaluate(drop.node, drop.source, { ...bindings, api: { addProductWorkspace: () => assert.fail('no workspace was dragged') } })(event, 'target')
})

test('failed workspace drops clear drag state and show the Host error', async () => {
  const sidebar = '../src/client/OrcaSidebar.tsx'
  const draggedWorkspacePath = { current: '/workspace' }
  const highlights = []
  const notices = []
  const feedback = []
  const dragging = []
  const bindings = { draggedWorkspacePath, setDropProductId: id => highlights.push(id), setDropFeedback: value => feedback.push(value),
    setDraggingWorkspace: value => dragging.push(value),
  }
  const end = initializer(sidebar, 'endWorkspaceDrag')
  const drop = initializer(sidebar, 'dropWorkspaceOnProduct')
  await evaluate(drop.node, drop.source, { ...bindings, endWorkspaceDrag: evaluate(end.node, end.source, bindings),
    api: { addProductWorkspace: async () => { throw new Error('Manifest changed') } },
    refreshProducts: () => assert.fail('failed additions must not refresh as success'), showToast: (...args) => notices.push(args),
  })({ preventDefault() {}, stopPropagation() {} }, 'target')
  assert.equal(draggedWorkspacePath.current, null)
  assert.equal(highlights.at(-1), undefined)
  assert.deepEqual(notices, [['error', 'Manifest changed']])
  assert.equal(dragging.at(-1), false, 'failed drops restore the manual group expansion preference')
  assert.deepEqual(feedback, [], 'failed additions must not report successful membership')
})

test('duplicate drops refresh membership but show already-exists without announcing an addition', async () => {
  const sidebar = '../src/client/OrcaSidebar.tsx'
  const draggedWorkspacePath = { current: '/workspace' }
  const calls = []
  const bindings = { draggedWorkspacePath, setDropProductId: () => {}, setDraggingWorkspace: value => calls.push(['dragging', value]) }
  const end = initializer(sidebar, 'endWorkspaceDrag')
  const drop = initializer(sidebar, 'dropWorkspaceOnProduct')
  await evaluate(drop.node, drop.source, { ...bindings, endWorkspaceDrag: evaluate(end.node, end.source, bindings),
    api: { addProductWorkspace: async (...args) => { calls.push(['add', ...args]); return { name: 'Target', added: false } } },
    refreshProducts: async () => { calls.push(['refresh']) },
    setDropFeedback: () => assert.fail('an existing membership must not flash as newly added'),
    showToast: (...args) => calls.push(['toast', ...args]), t: (key, params) => `${key}:${params.name}`,
  })({ preventDefault() {}, stopPropagation() {} }, 'target-group')
  assert.equal(draggedWorkspacePath.current, null)
  assert.deepEqual(calls, [['dragging', false], ['add', 'target-group', '/workspace'], ['refresh'], ['toast', 'info', 'product.workspaceExists:Target']])
})

test('chip delete requires two clicks then unlinks, leaves All selected, keeps files', async () => {
  const { node, source } = initializer('../src/client/OrcaSidebar.tsx', 'deleteProductChip')
  const calls = []
  let confirmed
  const bindings = {
    setConfirmDeleteProductId: value => { confirmed = value; calls.push(['confirm', value]) },
    products: { products: [{ id: 'g1', name: 'dsh插件' }, { id: 'g2', name: '其他' }] },
    productId: 'g1', setProductId: id => calls.push(['select', id]),
    api: { removeProduct: async id => { calls.push(['remove', id]); return { productId: id } } },
    refreshProducts: async () => calls.push(['refresh']),
    showToast: (...args) => calls.push(['toast', ...args]),
    t: (key, params) => `${key}:${params.name}`,
  }
  await evaluate(node, source, { ...bindings, confirmDeleteProductId: undefined })('g1')
  assert.deepEqual(calls, [['confirm', 'g1']], 'first click only arms the confirmation')
  await evaluate(node, source, { ...bindings, confirmDeleteProductId: 'g1' })('g2')
  assert.deepEqual(calls.at(-1), ['confirm', 'g2'], 'clicking another chip moves the armed confirmation')
  await evaluate(node, source, { ...bindings, confirmDeleteProductId: 'g1' })('g1')
  assert.deepEqual(calls, [
    ['confirm', 'g1'], ['confirm', 'g2'], ['confirm', undefined],
    ['remove', 'g1'], ['select', undefined], ['refresh'], ['toast', 'info', 'product.deleted:dsh插件'],
  ])
  await evaluate(node, source, { ...bindings, confirmDeleteProductId: 'g1', productId: 'g2' })('g1')
  assert.deepEqual(calls.filter(entry => entry[0] === 'select'), [['select', undefined]], 'only the deleted group resigns selection')
})

test('failed chip deletes report the error without leaving the group selected', async () => {
  const { node, source } = initializer('../src/client/OrcaSidebar.tsx', 'deleteProductChip')
  const calls = []
  await evaluate(node, source, {
    setConfirmDeleteProductId: () => calls.push(['confirm']),
    products: { products: [{ id: 'g1', name: 'dsh插件' }] },
    productId: 'g1', setProductId: () => calls.push(['select']),
    api: { removeProduct: async () => { throw new Error('Manifest changed') } },
    refreshProducts: () => assert.fail('failed removals must not refresh as success'),
    showToast: (...args) => calls.push(['toast', ...args]),
    t: (key, params) => `${key}:${params.name}`,
    confirmDeleteProductId: 'g1',
  })('g1')
  assert.deepEqual(calls, [['confirm'], ['toast', 'error', 'Manifest changed']], 'failure skips selection and refresh')
})

test('workspace memberships return matching names only in All for short labels and full tooltips', () => {
  const { node, source } = initializer('../src/client/OrcaSidebar.tsx', 'workspaceMembership')
  const normalizer = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'normalizePath')
  assert.ok(normalizer, 'use the sidebar path normalizer')
  const normalizePath = evaluate(normalizer, source, {})
  const products = { products: [
    { name: '分组 A', projects: [{ path: '/workspace/' }] },
    { name: '分组 B', projects: [{ path: '/workspace' }] },
    { name: '其他分组', projects: [{ path: '/workspace-other' }] },
    { name: '工作树分组', projects: [{ path: '/pool/feature' }] },
  ] }
  const run = (paths, productId) => evaluate(node, source, { productId, products, normalizePath })(paths)
  assert.deepEqual(run(['/workspace']), ['分组 A', '分组 B'])
  assert.deepEqual(run(['/workspace/']), ['分组 A', '分组 B'])
  assert.deepEqual(run(['/root', '/pool/feature']), ['工作树分组'])
  assert.deepEqual(run(['/root']), [])
  assert.deepEqual(run(['/unrelated']), [])
  assert.deepEqual(run(['/workspace'], 'group-a'), [])
})

test('group overflow measurement uses the two-row threshold and disconnects on cleanup', () => {
  const path = '../src/client/OrcaSidebar.tsx'
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('new ResizeObserver')) callback = node.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(callback, 'group overflow effect exists')
  const tabs = { scrollHeight: 66 }
  const overflow = []
  let resize
  let observed = 0
  let disconnected = 0
  const ResizeObserver = class {
    constructor(changed) { resize = changed }
    observe(target) { assert.equal(target, tabs); observed++ }
    disconnect() { disconnected++ }
  }
  const setup = evaluate(callback, source, { productTabsRef: { current: tabs }, ResizeObserver, setProductsOverflow: value => overflow.push(value) })
  const cleanup = setup()
  assert.deepEqual(overflow, [false])
  tabs.scrollHeight = 67
  resize()
  tabs.scrollHeight = 64
  resize()
  assert.deepEqual(overflow, [false, true, false])
  assert.equal(observed, 1)
  cleanup()
  assert.equal(disconnected, 1)
  evaluate(callback, source, { productTabsRef: { current: null }, ResizeObserver, setProductsOverflow: () => assert.fail('an unmounted group list must not measure') })()
  assert.equal(observed, 1)
})
