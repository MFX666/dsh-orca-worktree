/**
 * Crisp inline SVGs matching the Orca sidebar screenshot & DSH icon weights.
 * @module dsh-worktree-plugin/client/icons
 */
import type { ReactElement } from 'react'

export function IconFolder({ size = 15 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round" aria-hidden>
      <path d="M1.75 4.25A1.25 1.25 0 0 1 3 3h3.1l1.35 1.5H13A1.25 1.25 0 0 1 14.25 5.75v6.25A1.25 1.25 0 0 1 13 13.25H3a1.25 1.25 0 0 1-1.25-1.25V4.25Z" />
    </svg>
  )
}

export function IconChevron({ open, size = 13 }: { open: boolean; size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 140ms ease' }}
      aria-hidden
    >
      <path d="M4.25 6.25 8 10l3.75-3.75" />
    </svg>
  )
}

export function IconPlus({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </svg>
  )
}

export function IconDots({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
      <circle cx={3.5} cy={8} r={1.15} />
      <circle cx={8} cy={8} r={1.15} />
      <circle cx={12.5} cy={8} r={1.15} />
    </svg>
  )
}

export function IconStar({ filled, size = 13 }: { filled: boolean; size?: number }): ReactElement {
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
      <path d="m8 2.1 1.76 3.57 3.94.57-2.85 2.78.67 3.92L8 11.09l-3.52 1.85.67-3.92L2.3 6.24l3.94-.57L8 2.1Z" />
    </svg>
  )
}

/** Subtree/fork glyph inside the `[⑂ 2 | ● 1 ● 1 ⌄]` lineage capsule. */
export function IconLineage({ size = 11 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={2} y={2} width={3.6} height={3.6} rx={0.8} />
      <rect x={9.8} y={10.2} width={3.6} height={3.6} rx={0.8} />
      <path d="M3.8 5.8v3.4a2.8 2.8 0 0 0 2.8 2.8h3.2" />
    </svg>
  )
}

export function IconSearch({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" aria-hidden>
      <circle cx={7.2} cy={7.2} r={4.4} />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}

export function IconChat({ size = 12 }: { size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6.2L3 14v-2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

export function IconCreate(): ReactElement {
  return <IconPlus size={14} />
}

export function IconRemove(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
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
      strokeWidth={1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={spinning ? { animation: 'owt-spin 0.8s linear infinite' } : undefined}
      aria-hidden
    >
      <path d="M13.25 8a5.25 5.25 0 1 1-1.35-3.52M13.25 2.75v2.5h-2.5" />
    </svg>
  )
}
