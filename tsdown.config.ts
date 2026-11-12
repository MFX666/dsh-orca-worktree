/**
 * Two artifacts from one package (mirrors dsh-file-tree-plugin):
 *
 * 1. `lib/index.js` — the node half (ESM, node platform). The cordis loader
 *    imports it when the profile row references this package by name. The
 *    framework and the typert protocol stay external and MUST resolve to the
 *    same physical modules the harness runtime uses (decorator metadata and
 *    the gateway's SRC claims share module identity), so they are never
 *    bundled.
 * 2. `lib/client.js` — the browser half, wrapped in the
 *    `window.__ModuleLoader__.load({ id, factory })` handoff the shell's
 *    module table consumes. React and the shared UI packages are answered by
 *    the frozen module table (externals); local code is inlined.
 */
import { fileURLToPath } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'

const ID = 'dsh-worktree-plugin'

const here = (path: string) => resolvePath(fileURLToPath(new URL('.', import.meta.url)), path)

/** The module specifiers the browser shell shares through its module table. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  // Documented harness exemption: the snapshot-store engine module a plugin
  // bundle may require through the lazy CJS table.
  '@deepseek-ai/dsh-client-runtime/client',
] as const

const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES]

const nodeLibrary: UserConfig = {
  // Entry is the tsc pre-pass output: TypeScript lowers the TC39 decorators
  // (@Remote) to __decorateElement helpers — tsdown/oxc emits decorators raw,
  // which Node cannot parse.
  name: ID,
  entry: [here('.tsc-out/index.js')],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  // package.json is "type": "module": plain .js matches the exports map.
  fixedExtension: false,
  dts: false,
  sourcemap: false,
  clean: false,
  // Identity-critical externals: the framework and the typert protocol must
  // resolve to the harness runtime's own modules. Everything else (the local
  // protocol module) inlines.
  external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol'],
}

const clientBundle: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  // The frozen module table can only answer the ids above; every other
  // require must inline or it would throw at boot.
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

const diffParserBundle: UserConfig = {
  // Node-safe copy of the pure parser so unit tests can import it without the
  // browser handoff wrapper. The client bundle still inlines its own copy.
  name: `${ID}/diffParser`,
  entry: { diffParser: 'src/client/diffParser.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  sourcemap: false,
  clean: false,
}

export default [nodeLibrary, clientBundle, diffParserBundle]
