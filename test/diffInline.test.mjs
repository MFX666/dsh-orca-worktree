/**
 * Unit checks for the pure diff parser: intra-line span pairing and its guards.
 * @module test/diffInline
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { parseStructuredDiff } = require('../lib/diffParser.js')

function parseRows(diffText) {
  const parsed = parseStructuredDiff(diffText)
  return [...parsed.values()][0].rows
}

test('parseStructuredDiff pairs equal-count del/add runs into inline spans', () => {
  const rows = parseRows(
    [
      'diff --git a/t.txt b/t.txt',
      '--- a/t.txt',
      '+++ b/t.txt',
      '@@ -1,3 +1,3 @@',
      ' context',
      '-foo',
      '+bar',
      ' tail',
    ].join('\n'),
  )
  assert.equal(rows[0].kind, 'hunk')
  assert.equal(rows[1].spans, undefined, 'leading context must stay untagged')
  const delRow = rows[2]
  const addRow = rows[3]
  assert.equal(delRow.kind, 'del')
  assert.equal(addRow.kind, 'add')
  assert.deepEqual(delRow.spans, [{ start: 0, end: 3 }])
  assert.deepEqual(addRow.spans, [{ start: 0, end: 3 }])
  assert.equal(rows[4].spans, undefined, 'trailing context must stay untagged')
})

test('parseStructuredDiff highlights only the changed middle of paired lines', () => {
  const rows = parseRows(
    ['diff --git a/t.txt b/t.txt', '@@ -1,2 +1,2 @@', '-one two three', '+one THREE three'].join('\n'),
  )
  const delRow = rows[1]
  const addRow = rows[2]
  const delText = delRow.spans.map(s => delRow.code.slice(s.start, s.end)).join('')
  const addText = addRow.spans.map(s => addRow.code.slice(s.start, s.end)).join('')
  assert.equal(delText, 'two')
  assert.equal(addText, 'THREE')
})

test('parseStructuredDiff skips pairs over the length guard and unequal runs', () => {
  const longA = 'x'.repeat(301)
  const longB = 'y'.repeat(301)
  const rows = parseRows(
    [
      'diff --git a/t.txt b/t.txt',
      '@@ -1,5 +1,5 @@',
      `-${longA}`,
      `+${longB}`,
      '-a1',
      '-a2',
      '+b1',
      '-drop',
      '+wxyz',
    ].join('\n'),
  )
  assert.equal(rows[1].spans, undefined, 'over-length lines must not be LCS-paired')
  assert.equal(rows[2].spans, undefined)
  assert.equal(rows[3].spans, undefined, '2 del vs 1 add run must not pair')
  assert.equal(rows[4].spans, undefined)
  assert.equal(rows[5].spans, undefined)
  assert.deepEqual(rows[6].spans, [{ start: 0, end: 4 }])
  assert.deepEqual(rows[7].spans, [{ start: 0, end: 4 }])})
