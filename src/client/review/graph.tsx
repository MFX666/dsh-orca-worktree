/**
 * Commit-graph lane layout + SVG cell, ported from dsh-ide-git v0.34.3
 * (MIT, © KannaKuron) `buildRows` / `laneSegments` / `GraphCell`. The lane
 * pass is pure so it stays testable without a browser: a lane is a slot that
 * carries one pending commit downwards until that commit's own row consumes
 * it. The three upstream invariants are kept:
 * - no ghost lanes: a parent past the loaded window ends its lane instead of
 *   parking a hash that can never be consumed;
 * - a parent already on ANOTHER lane merges across (its own lane ends here);
 * - HEAD keeps the leftmost lane via pre-seeding.
 * @module dsh-git-review-plugin/client/graph
 */
import { memo, type ReactElement } from 'react'
import type { GitCommitRow } from '../../review/protocol.ts'

export const LANE_WIDTH = 14
/** Hard cap on drawn lanes; lanes beyond the cap collapse into the last column. */
export const GRAPH_MAX_LANES = 7
export const LANE_COLORS = ['#4d6bfe', '#e2a03f', '#3fb950', '#d2679b', '#59b0d6', '#b083f0', '#d2694a', '#8a9aa8'] as const

/** One row of the precomputed layout (`commit` + lane geometry around it). */
export interface GraphRow {
  readonly commit: GitCommitRow
  readonly lane: number
  readonly parentLanes: readonly number[]
  /** Lane occupancy before/after this row; `null` = empty slot. */
  readonly before: readonly (string | null)[]
  readonly after: readonly (string | null)[]
  readonly width: number
}

/** Layout the whole (windowed) log in one pass. Newest commit first. */
export function buildGraphRows(commits: readonly GitCommitRow[]): GraphRow[] {
  const present = new Set<string>()
  for (const commit of commits) present.add(commit.hash)
  const lanes: (string | null)[] = []
  // Pre-seed HEAD so the current branch keeps the leftmost column.
  const headCommit = commits.find(commit => commit.refs.some(ref => ref.indexOf('HEAD') >= 0))
  if (headCommit !== undefined) lanes.push(headCommit.hash)
  const rows: GraphRow[] = []
  for (const commit of commits) {
    const before = lanes.slice()
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) {
      lane = lanes.indexOf(null)
      if (lane === -1) {
        lanes.push(null)
        lane = lanes.length - 1
      }
    }
    const parents = Array.isArray(commit.parents) ? commit.parents : []
    const parentLanes: number[] = []
    if (parents.length > 0) {
      const first = lanes.indexOf(parents[0]!)
      if (first !== -1 && first !== lane) {
        // First parent already sits on another lane: merge across, end own lane.
        lanes[lane] = null
        parentLanes.push(first)
      } else if (present.has(parents[0]!)) {
        lanes[lane] = parents[0]!
      } else {
        // Parent beyond the loaded window: end the lane, never park a ghost.
        lanes[lane] = null
      }
    } else {
      lanes[lane] = null
    }
    for (let index = 1; index < parents.length; index += 1) {
      const parent = parents[index]!
      if (!present.has(parent)) continue
      let slot = lanes.indexOf(parent)
      if (slot === -1) {
        slot = lanes.indexOf(null)
        if (slot === -1) {
          lanes.push(parent)
          slot = lanes.length - 1
        } else {
          lanes[slot] = parent
        }
      }
      parentLanes.push(slot)
    }
    rows.push({ commit, lane, parentLanes, before, after: lanes.slice(), width: 1 })
  }
  return rows
}

interface LaneSegment {
  readonly lane: number
  readonly y1: number
  readonly y2: number
}

/** Vertical lane segments for one row. A lane opened by an edge curve must not
    also get a centre vertical (the two overlapped into a floating hook). */
function laneSegments(row: GraphRow, height: number): LaneSegment[] {
  const middle = height / 2
  const depth = Math.max(row.before.length, row.after.length)
  const segments: LaneSegment[] = []
  for (let lane = 0; lane < depth; lane += 1) {
    const above = lane < row.before.length ? row.before[lane] : null
    const below = lane < row.after.length ? row.after[lane] : null
    const hasTop = above !== null
    const hasBottom = below !== null
    if (!hasTop && !hasBottom) continue
    if (!hasTop && row.parentLanes.indexOf(lane) >= 0) continue
    const y1 = hasTop ? 0 : middle
    const y2 = hasBottom ? height : middle
    if (y1 === y2) continue
    segments.push({ lane, y1, y2 })
  }
  return segments
}

const laneColor = (lane: number): string => LANE_COLORS[lane % LANE_COLORS.length]!

/** SVG cell drawing one row's lanes, merge edges and commit dot (HEAD hollow). */
export const GraphCell = memo(
  function GraphCell(props: { row: GraphRow; height: number }): ReactElement {
    const { row, height } = props
    const width = Math.min(Math.max(1, row.width), GRAPH_MAX_LANES) * LANE_WIDTH + 8
    const middle = height / 2
    const children: ReactElement[] = []
    const x = (lane: number): number => 8 + Math.min(lane, GRAPH_MAX_LANES - 1) * LANE_WIDTH
    for (const segment of laneSegments(row, height)) {
      children.push(
        <line
          key={'lane-' + String(segment.lane)}
          data-lane={String(segment.lane)}
          x1={x(segment.lane)}
          y1={segment.y1}
          x2={x(segment.lane)}
          y2={segment.y2}
          stroke={laneColor(segment.lane)}
          strokeWidth={2}
          strokeLinecap="round"
        />,
      )
    }
    for (const parentLane of row.parentLanes) {
      if (parentLane === row.lane) continue
      children.push(
        <path
          key={'edge-' + String(parentLane)}
          data-lane={String(parentLane)}
          d={
            'M ' + x(row.lane) + ' ' + middle +
            ' C ' + x(row.lane) + ' ' + height + ', ' + x(parentLane) + ' ' + middle + ', ' + x(parentLane) + ' ' + height
          }
          fill="none"
          stroke={laneColor(parentLane)}
          strokeWidth={2}
          strokeLinecap="round"
        />,
      )
    }
    const isHead = row.commit.refs.some(ref => ref.indexOf('HEAD') >= 0)
    children.push(
      isHead ? (
        <circle key="dot" data-lane={String(row.lane)} cx={x(row.lane)} cy={middle} r={3.8} fill="none" stroke={laneColor(row.lane)} strokeWidth={2} />
      ) : (
        <circle key="dot" data-lane={String(row.lane)} cx={x(row.lane)} cy={middle} r={3.6} fill={laneColor(row.lane)} />
      ),
    )
    return (
      <svg className="owt-gp-graph-cell" width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
        {children}
      </svg>
    )
  },
  (prev, next) => prev.row === next.row && prev.height === next.height,
)

export type RefKind = 'head' | 'local' | 'remote' | 'tag'

export interface RefDecoration {
  readonly kind: RefKind
  readonly name: string
}

/** Parse one `%d` decoration entry into the kind that drives badge colour. */
export function decorationOf(value: string): RefDecoration {
  if (value.indexOf('HEAD -> ') === 0) return { name: value.slice(8), kind: 'head' }
  if (value === 'HEAD') return { name: 'HEAD', kind: 'head' }
  if (value.indexOf('tag: ') === 0) return { name: value.slice(5), kind: 'tag' }
  return { name: value, kind: value.indexOf('/') >= 0 ? 'remote' : 'local' }
}

/** Badge text: a HEAD decoration names the branch it points at. */
export function refLabel(decoration: RefDecoration): string {
  if (decoration.kind !== 'head') return decoration.name
  return decoration.name === 'HEAD' ? 'HEAD' : 'HEAD → ' + decoration.name
}
