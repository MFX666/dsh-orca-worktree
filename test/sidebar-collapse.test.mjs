import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Exercise the toolbar handler without replacing React or creating a DOM renderer.
const source = ts.createSourceFile('OrcaSidebar.tsx', readFileSync(new URL('../src/client/OrcaSidebar.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
let toggleHandler
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'collapseAll') handler = node.initializer.getText(source)
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'toggleSetItem') toggleHandler = node.initializer.getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(handler, 'collapse-all handler exists')
const handlerJs = ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function collapse(overview, items) {
  const state = { query: 'find a chat', repos: new Set(['/previous']), lineage: new Set(['/previous/child']), chats: new Set(['/repo']), previews: new Set(['ungrouped']) }
  const stored = new Map()
  const bindings = {
    collapsedRepos: state.repos,
    collapsedLineage: state.lineage,
    overview,
    workspaceSnap: { items },
    normalizePath: p => p.length > 1 ? p.replace(/\/+$/, '') : p,
    setQuery: value => { state.query = value },
    setCollapsedRepos: value => { state.repos = value },
    setCollapsedLineage: value => { state.lineage = value },
    setExpandedChats: value => { state.chats = value },
    setExpandedChatLists: value => { state.previews = value },
    STORAGE_COLLAPSED_REPOS: 'repos',
    STORAGE_COLLAPSED_LINEAGE: 'lineage',
    STORAGE_EXPANDED_CHATS: 'chats',
    saveStoredSet: (key, values) => { stored.set(key, JSON.stringify([...values])) },
  }
  const run = new Function(...Object.keys(bindings), `return ${handlerJs}`)(...Object.values(bindings))
  run()
  return { state, stored, run }
}

test('collapse all covers projects, child worktrees, folders and ungrouped chats', () => {
  const { state, stored, run } = collapse({ repos: [
    { repositoryRoot: '/repo', rows: [{ path: '/repo' }, { path: '/repo-child/' }] },
    { repositoryRoot: '/other', rows: [{ path: '/other' }] },
  ] }, [{ path: '/repo' }, { path: '/folder/' }, { path: '/' }])
  for (const path of ['/repo', '/other', '/folder', '/', 'ungrouped', '/previous']) assert.ok(state.repos.has(path), path)
  for (const path of ['/repo', '/repo-child', '/other', '/previous/child']) assert.ok(state.lineage.has(path), path)
  assert.equal(state.query, '', 'search no longer forces groups open')
  assert.equal(state.chats.size, 0, 'reopened branches keep conversations folded')
  assert.equal(state.previews.size, 0)
  assert.deepEqual(new Set(JSON.parse(stored.get('repos'))), state.repos)
  assert.deepEqual(new Set(JSON.parse(stored.get('lineage'))), state.lineage)
  assert.deepEqual(JSON.parse(stored.get('chats')), [])
  const first = [...stored]
  run()
  assert.deepEqual([...stored], first, 'repeated collapse is idempotent')
})

test('collapse all works before overview loads and with no workspaces', () => {
  const { state } = collapse(null, [])
  assert.ok(state.repos.has('ungrouped'))
  assert.ok(state.repos.has('/previous'))
  assert.equal(state.query, '')
  assert.equal(state.chats.size, 0)
})

test('group toggles preserve search preferences and can reopen collapsed groups', () => {
  assert.ok(toggleHandler)
  const js = ts.transpileModule(`(${toggleHandler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const query of ['search', '']) {
    let groups = new Set(['/repo', 'ungrouped'])
    const writes = []
    const toggle = new Function('normalizedQuery', 'saveStoredSet', `return ${js}`)(query, (...args) => writes.push(args))
    const setter = updater => { groups = updater(groups) }
    toggle(setter, 'repos', '/repo')
    toggle(setter, 'repos', 'ungrouped')
    assert.equal(groups.has('/repo'), query !== '')
    assert.equal(groups.has('ungrouped'), query !== '')
    assert.equal(writes.length, query === '' ? 2 : 0)
  }
})
