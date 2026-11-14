/**
 * Crisp VS Code Codicon-inspired inline SVGs (16x16 grid, clean 1.35px–1.45px strokes).
 * @module dsh-worktree-plugin/client/icons
 */
import type { ReactElement } from 'react'

/** VS Code Explorer twistie chevron (`>` collapsed, `v` expanded). */
export function IconChevron({ open, size = 13 }: { open: boolean; size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 120ms ease' }}
      aria-hidden
    >
      <path d="M4.5 6.25 8 9.75l3.5-3.5" />
    </svg>
  )
}

/** Classic VS Code `codicon-git-branch` / `codicon-source-control` glyph. */
export function IconGitBranch({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={4.5} cy={3.5} r={1.75} />
      <circle cx={4.5} cy={12.5} r={1.75} />
      <circle cx={11.5} cy={5.5} r={1.75} />
      <path d="M4.5 5.25v5.5" />
      <path d="M11.5 7.25c0 2.1-1.4 3.15-3.8 3.15H4.5" />
    </svg>
  )
}

/** Subtree / derived worktree glyph (`⑂`). */
export function IconLineage({ size = 11.5 }: { size?: number }): ReactElement {
  return <IconGitBranch size={size} />
}

export function IconPlus({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </svg>
  )
}

export function IconClose({ size = 12 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" aria-hidden>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

export function IconDots({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
      <circle cx={3.6} cy={8} r={1.05} />
      <circle cx={8} cy={8} r={1.05} />
      <circle cx={12.4} cy={8} r={1.05} />
    </svg>
  )
}

export function IconStar({ filled, size = 12 }: { filled: boolean; size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m8 2.15 1.72 3.49 3.85.56-2.78 2.71.66 3.84L8 10.94l-3.45 1.81.66-3.84L2.43 6.2l3.85-.56L8 2.15Z" />
    </svg>
  )
}

export function IconSearch({ size = 13.5 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <circle cx={7.1} cy={7.1} r={4.3} />
      <path d="m10.35 10.35 3 3" />
    </svg>
  )
}

export function IconChat({ size = 11.5 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.1 3.5h9.8a1.1 1.1 0 0 1 1.1 1.1v5.8a1.1 1.1 0 0 1-1.1 1.1H6.3L3.1 13.9v-2.4A1.1 1.1 0 0 1 2 10.4V4.6a1.1 1.1 0 0 1 1.1-1.1Z" />
    </svg>
  )
}

export function IconCreate(): ReactElement {
  return <IconPlus size={14} />
}

export function IconRemove(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" aria-hidden>
      <path d="M3 4.5h10M6.2 4.5V3.2h3.6v1.3M4.5 4.5l.6 8.3h5.8l.6-8.3" />
    </svg>
  )
}

export function IconRefresh({ size = 13, spinning = false }: { size?: number; spinning?: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={spinning ? { animation: 'owt-spin 0.8s linear infinite' } : undefined}
      aria-hidden
    >
      <path d="M13.25 8a5.25 5.25 0 1 1-1.35-3.52M13.25 2.75v2.5h-2.5" />
    </svg>
  )
}

export function IconFile({ size = 13 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2.25h5.2L12.5 5.5v8.25a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V3.25a1 1 0 0 1 1-1Z" />
      <path d="M9 2.25v3.25h3.5" />
    </svg>
  )
}

/* The host's per-type file icon (ui-primitives FileTypeIcon — the seed module,
   answered by the shell's frozen module table, same channel dsh-ide-git uses).
   Resolved through a GUARDED require at load: a shell without the module keeps
   this plugin alive and the glyph falls back to the generic file outline. */
let uiPrimitives: { FileTypeIcon?: (props: { path?: string; kind?: string; size?: number; className?: string }) => ReactElement | null } | null = null
try {
  uiPrimitives = require('@deepseek-ai/dsh-client-ui-primitives') as typeof uiPrimitives
} catch {
  uiPrimitives = null
}

