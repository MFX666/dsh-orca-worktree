// Lane-layout invariants for the commit graph (ported from dsh-ide-git):
// HEAD keeps the leftmost lane, a merge opens a lane for its second parent,
// and a parent past the loaded window ends its lane instead of parking a
// ghost hash. Style mirrors diffInline.test.mjs (pure logic, no browser).
// @module test/graphLanes
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGraphRows, decorationOf, refLabel } from '../lib/graph.js'

/** Minimal GitCommitRow carrying only the fields the layout reads. */
function c(hash, parents = [], refs = []) {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    author: 'a',
    date: '2026-01-01T00:00:00Z',
    subject: hash,
    parents,
    refs,
  }
}

test('linear history stays on one lane', () => {
  const rows = buildGraphRows([c('c2', ['c1']), c('c1', [])])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(r => r.lane), [0, 0])
  // c1's lane ends on its own row — no downward stub.
  assert.equal(rows[1].after[0], null)
})

test('HEAD commit keeps the leftmost lane', () => {
  const rows = buildGraphRows([c('b', ['a'], ['HEAD -> main']), c('a', [])])
  assert.equal(rows[0].lane, 0)
})

test('merge commit opens a lane for its second parent and joins back', () => {
  const rows = buildGraphRows([
    c('m', ['base', 'feat'], ['HEAD -> main']),
    c('feat', ['base'], ['feature']),
    c('base', []),
  ])
  const [m, feat, base] = rows
  assert.equal(m.lane, 0)
  assert.equal(feat.lane, 1)
  // Merge draws an edge to the second parent's lane.
  assert.ok(m.parentLanes.includes(1))
  // Feature lane merges across into base's lane 0, then ends.
  assert.deepEqual(feat.parentLanes, [0])
  assert.equal(base.lane, 0)
})

test('parent past the loaded window ends its lane (no ghost)', () => {
  const rows = buildGraphRows([c('tip', [' unseen'])])
  assert.equal(rows[0].lane, 0)
  assert.equal(rows[0].after[0], null)
  assert.deepEqual(rows[0].parentLanes, [])
})

test('decoration parsing and labels', () => {
  assert.deepEqual(decorationOf('HEAD -> main'), { kind: 'head', name: 'main' })
  assert.deepEqual(decorationOf('HEAD'), { kind: 'head', name: 'HEAD' })
  assert.deepEqual(decorationOf('tag: v1.0'), { kind: 'tag', name: 'v1.0' })
  assert.deepEqual(decorationOf('origin/dev'), { kind: 'remote', name: 'origin/dev' })
  assert.deepEqual(decorationOf('feat'), { kind: 'local', name: 'feat' })
  assert.equal(refLabel(decorationOf('HEAD -> main')), 'HEAD → main')
  assert.equal(refLabel(decorationOf('origin/dev')), 'origin/dev')
})
