import assert from 'node:assert/strict'
import test from 'node:test'
import { editorLaunchArgv } from '../lib/index.js'

test('editorLaunchArgv — darwin Launch Services, IDEA falls back to CE', () => {
  assert.deepEqual(editorLaunchArgv('vscode', 'darwin', '/tmp/wt'), [
    ['open', '-a', 'Visual Studio Code', '/tmp/wt'],
  ])
  assert.deepEqual(editorLaunchArgv('idea', 'darwin', '/tmp/wt'), [
    ['open', '-a', 'IntelliJ IDEA', '/tmp/wt'],
    ['open', '-a', 'IntelliJ IDEA CE', '/tmp/wt'],
  ])
})

test('editorLaunchArgv — non-darwin CLI fallback', () => {
  assert.deepEqual(editorLaunchArgv('vscode', 'linux', '/tmp/wt'), [['code', '/tmp/wt']])
  assert.deepEqual(editorLaunchArgv('idea', 'linux', '/tmp/wt'), [['idea', '/tmp/wt']])
})
