declare module '@deepseek-ai/cordis' {
  export interface Context {
    fs: {
      resolve(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<{ displayPath: string; targetKey: string }>
      processPath(target: { displayPath: string; targetKey: string }): string
      contains(parent: { displayPath: string; targetKey: string }, child: { displayPath: string; targetKey: string }): boolean
      lstat(path: string, options?: unknown, signal?: AbortSignal): Promise<unknown>
      readText(target: { displayPath: string; targetKey: string }, options?: unknown): Promise<string>
      writeText(target: { displayPath: string; targetKey: string }, content: string): Promise<void>
    }
    effect(setup: () => (() => unknown) | void, label?: string): void
  }

  export class Service {
    protected readonly ctx: Context
    readonly name: string
    constructor(ctx: Context, name: string)
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  import type { Context } from '@deepseek-ai/cordis'
  import { Service } from '@deepseek-ai/cordis'

  export class TypertRemoteService extends Service {
    readonly typertRemote: unknown
    constructor(ctx: Context, serviceKey: string, options?: { namespace?: string })
  }

  export function Remote(
    nameOrOptions?: string | { name?: string; mode?: 'stream'; resources?: Record<string, (args: unknown) => unknown> },
  ): (method: unknown, context: ClassMethodDecoratorContext) => void
}

declare module '@deepseek-ai/dsh-fs' {}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  export interface ClientContext {
    effect(setup: () => (() => unknown) | void, label?: string): void
    locale: {
      register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
      bind(namespace: string): (key: string, params?: Record<string, string | number>) => string
    }
  }
}

declare module '@deepseek-ai/dsh-client-locale/client' {}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  export interface LocaleNamespaceMap {}
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ComponentType } from 'react'

  export interface FileTypeIconProps {
    /** File path — the host classifies the type from the extension. */
    path?: string
    /** Explicit kind for entries without a classifiable path (directories). */
    kind?: 'folder' | string
    size?: number
    className?: string
  }

  export const FileTypeIcon: ComponentType<FileTypeIconProps>
}

/**
 * The client bundle is CJS inside `window.__ModuleLoader__.load(…, factory(require))`;
 * bare `require` resolves through the shell's frozen module table. Only for the
 * guarded seed-module probe in `src/client/icons.tsx` — never in the node half.
 */
declare function require(id: string): unknown
