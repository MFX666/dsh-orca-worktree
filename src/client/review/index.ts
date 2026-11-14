/**
 * Git review module — browser half (mounted by the package client entry).
 *
 * Mounts the git review panel (`CommitPanel`) as a `conversation.view` slot —
 * the "审查" tab next to 对话 / 轨迹 — wired to the `rGitReview` SRC namespace.
 * @module dsh-worktree-plugin/client/review
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { createGitApi, type GitApi } from './api.ts'
import { CommitPanel } from './GitPanel.tsx'
import { injectStyles, removeStyles } from './styles.ts'
import { en, NS, type GitReviewKey, zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    gitReview: GitReviewKey
  }
}

interface SlotsFace {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: unknown): unknown
}

export function applyGitReview(ctx: ClientContext): void {
  injectStyles()
  ctx.effect(() => () => { removeStyles() }, 'git-review: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'git-review: dictionaries')

  const api: GitApi = createGitApi(ctx)
  const t = ctx.locale.bind(NS)
  const slots = (ctx as unknown as { slots: SlotsFace }).slots

  // Git tab (review changes & commit) in the conversation view tab strip, next to 对话 / 轨迹 / AOCI.
  slots.inject('conversation.view', () =>
    slots.register(
      {
        name: 'conversation.view',
        id: 'git-review',
        order: 40,
        label: () => t('view.gitTab'),
        locale: NS,
        inject: (sessionId: string) => ({ api, t, sessionId }),
      },
      CommitPanel,
    ),
  )
}
