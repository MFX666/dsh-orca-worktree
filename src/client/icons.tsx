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

/** Whitespace toggle glyph: horizontal compress arrows. */
export function IconWhitespace({ size = 13.5 }: { size?: number }): ReactElement {
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
      aria-hidden
    >
      <path d="M6 5.5 3.5 8 6 10.5M10 5.5 12.5 8 10 10.5M3.5 8h9" />
    </svg>
  )
}

/** Push glyph: arrow up out of a tray. */
export function IconPush({ size = 13, spinning = false }: { size?: number; spinning?: boolean }): ReactElement {
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
      <path d="M8 9.75V2.5M5.25 5.25 8 2.5l2.75 2.75M2.75 10.5v2.75h10.5V10.5" />
    </svg>
  )
}

/** AI sparkle glyph for the commit-message generator button. */
export function IconSparkle({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" stroke="none" aria-hidden>
      <path d="M8 1.6c.5 2.6 1.6 3.7 4.2 4.2-2.6.5-3.7 1.6-4.2 4.2-.5-2.6-1.6-3.7-4.2-4.2C6.4 5.3 7.5 4.2 8 1.6z" />
      <path d="M12.6 9.4c.3 1.5.9 2.1 2.4 2.4-1.5.3-2.1.9-2.4 2.4-.3-1.5-.9-2.1-2.4-2.4 1.5-.3 2.1-.9 2.4-2.4z" opacity={0.75} />
    </svg>
  )
}

export function IconFolder({ size = 13 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.75 4.25a1.25 1.25 0 0 1 1.25-1.25h3.1l1.35 1.5H13a1.25 1.25 0 0 1 1.25 1.25v6a1.25 1.25 0 0 1-1.25 1.25H3a1.25 1.25 0 0 1-1.25-1.25v-7.5Z" />
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

export function IconCheck({ size = 13 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.25 8.25 3.1 3.1 6.4-6.5" />
    </svg>
  )
}

export function IconBack({ size = 12 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.75 3.5 5 8l4.75 4.5M5 8h8.5" />
    </svg>
  )
}
