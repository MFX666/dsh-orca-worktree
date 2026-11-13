// Tests for assemblePatch / filterCommits (P0 git review client).
// Runs on Node >= 23.6 (native TS type-stripping imports the .ts source directly),
// mirroring the node:test style of test/diffInline.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { assemblePatch, filterCommits, parseStructuredDiff } from '../src/client/diffParser.ts'

const LF = String.fromCharCode(10)
const BS = String.fromCharCode(92)

const TWO_HUNK = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,4 +1,5 @@ function a() {',
  ' const a = 1',
  '+const a2 = 2',
  ' const b = 3',
  ' const c = 4',
  ' const d = 5',
  '@@ -10,4 +11,4 @@ function z() {',
  ' const y = 1',
  ' const x = 2',
  '-const w = 3',
  '+const w = 33',
  ' const v = 4',
].join(LF)

const RENAME = [
  'diff --git a/old.ts b/new.ts',
  'similarity index 90%',
  'rename from old.ts',
  'rename to new.ts',
  '--- a/old.ts',
  '+++ b/new.ts',
  '@@ -1,2 +1,2 @@',
  ' const q = 1',
  '-const r = 2',
  '+const r = 20',
].join(LF)

const DELETE = [
  'diff --git a/gone.ts b/gone.ts',
  'index aaaaaaa..bbbbbbb 100644',
  '--- a/gone.ts',
  '+++ /dev/null',
  '@@ -1,1 +0,0 @@',
  '-const g = 1',
].join(LF)

const NO_NEWLINE = [
  'diff --git a/n.ts b/n.ts',
  'index 1111111..2222222 100644',
  '--- a/n.ts',
  '+++ b/n.ts',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
  BS + ' No newline at end of file',
].join(LF)

test('assemblePatch round-trips the full diff when every hunk is selected', () => {
  const parsed = parseStructuredDiff(TWO_HUNK).get('src/a.ts')
  assert.ok(parsed)
  assert.equal(parsed.hunks.length, 2)
  const bannerIdx = parsed.hunks.map(h => h.bannerIdx)
  const out = assemblePatch(parsed, bannerIdx)
  assert.equal(out, TWO_HUNK + LF)
})

test('assemblePatch emits only the selected hunk, keeping context lines', () => {
  const parsed = parseStructuredDiff(TWO_HUNK).get('src/a.ts')
  assert.ok(parsed)
  const second = parsed.hunks[1]
  const out = assemblePatch(parsed, [second.bannerIdx])
  const lines = out.split(LF)
  // header preserved verbatim
  assert.equal(lines[0], 'diff --git a/src/a.ts b/src/a.ts')
  assert.equal(lines[1], 'index 1111111..2222222 100644')
  assert.equal(lines[2], '--- a/src/a.ts')
  assert.equal(lines[3], '+++ b/src/a.ts')
  // second hunk block intact incl. its context lines
  assert.equal(lines[4], '@@ -10,4 +11,4 @@ function z() {')
  assert.ok(lines.includes(' const y = 1'))
  assert.ok(lines.includes(' const x = 2'))
  assert.ok(lines.includes('-const w = 3'))
  assert.ok(lines.includes('+const w = 33'))
  assert.ok(lines.includes(' const v = 4'))
  // first hunk excluded
  assert.ok(!out.includes('+const a2 = 2'))
  assert.ok(!out.includes('@@ -1,4 +1,5'))
  // valid patch: ends with newline
  assert.ok(out.endsWith(LF))
})

test('assemblePatch keeps rename headers', () => {
  const parsed = parseStructuredDiff(RENAME).get('new.ts')
  assert.ok(parsed)
  assert.equal(parsed.file, 'new.ts')
  const out = assemblePatch(parsed, [parsed.hunks[0].bannerIdx])
  assert.ok(out.startsWith('diff --git a/old.ts b/new.ts' + LF))
  assert.ok(out.includes('similarity index 90%'))
  assert.ok(out.includes('rename from old.ts'))
  assert.ok(out.includes('rename to new.ts'))
  assert.ok(out.includes('+++ b/new.ts'))
  assert.ok(out.includes('+const r = 20'))
})

test('assemblePatch keeps delete headers with /dev/null target', () => {
  const parsed = parseStructuredDiff(DELETE).get('gone.ts')
  assert.ok(parsed)
  const out = assemblePatch(parsed, [parsed.hunks[0].bannerIdx])
  assert.ok(out.includes('+++ /dev/null'))
  assert.ok(out.includes('-const g = 1'))
})

test('assemblePatch re-emits the no-newline marker after the marked row', () => {
  const parsed = parseStructuredDiff(NO_NEWLINE).get('n.ts')
  assert.ok(parsed)
  const addRow = parsed.rows.find(r => r.sign === '+')
  assert.ok(addRow)
  assert.equal(addRow.noNewlineAfter, true)
  const out = assemblePatch(parsed, [parsed.hunks[0].bannerIdx])
  assert.ok(out.includes('+new' + LF + BS + ' No newline at end of file' + LF))
})

test('assemblePatch returns an empty string for an empty hunk selection', () => {
  const parsed = parseStructuredDiff(TWO_HUNK).get('src/a.ts')
  assert.ok(parsed)
  assert.equal(assemblePatch(parsed, []), '')
})

test('filterCommits matches subject, author and shortHash case-insensitively', () => {
  const commits = [
    { shortHash: 'abc1234', author: 'Linus Torvalds', subject: 'Fix renderer bug' },
    { shortHash: 'def5678', author: 'Ada Lovelace', subject: 'Add blame view' },
    { shortHash: '9abcdea', author: 'linus', subject: 'docs: readme' },
  ]
  assert.equal(filterCommits(commits, 'fix').length, 1)
  assert.equal(filterCommits(commits, 'LOVELACE').length, 1)
  assert.equal(filterCommits(commits, 'DEF5').length, 1)
  // empty / whitespace query returns everything
  assert.equal(filterCommits(commits, '').length, 3)
  assert.equal(filterCommits(commits, '   ').length, 3)
  assert.equal(filterCommits(commits, 'no-match-at-all').length, 0)
})
