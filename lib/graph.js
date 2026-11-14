import { memo } from "react";
import { jsx } from "react/jsx-runtime";
// src/client/graph.tsx
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
* @module dsh-worktree-plugin/client/graph
*/
const LANE_WIDTH = 14;
/** Hard cap on drawn lanes; lanes beyond the cap collapse into the last column. */
const GRAPH_MAX_LANES = 7;
const LANE_COLORS = [
	"#4d6bfe",
	"#e2a03f",
	"#3fb950",
	"#d2679b",
	"#59b0d6",
	"#b083f0",
	"#d2694a",
	"#8a9aa8"
];
/** Layout the whole (windowed) log in one pass. Newest commit first. */
function buildGraphRows(commits) {
	const present = /* @__PURE__ */ new Set();
	for (const commit of commits) present.add(commit.hash);
	const lanes = [];
	const headCommit = commits.find((commit) => commit.refs.some((ref) => ref.indexOf("HEAD") >= 0));
	if (headCommit !== void 0) lanes.push(headCommit.hash);
	const rows = [];
	for (const commit of commits) {
		const before = lanes.slice();
		let lane = lanes.indexOf(commit.hash);
		if (lane === -1) {
			lane = lanes.indexOf(null);
			if (lane === -1) {
				lanes.push(null);
				lane = lanes.length - 1;
			}
		}
		const parents = Array.isArray(commit.parents) ? commit.parents : [];
		const parentLanes = [];
		if (parents.length > 0) {
			const first = lanes.indexOf(parents[0]);
			if (first !== -1 && first !== lane) {
				lanes[lane] = null;
				parentLanes.push(first);
			} else if (present.has(parents[0])) lanes[lane] = parents[0];
			else lanes[lane] = null;
		} else lanes[lane] = null;
		for (let index = 1; index < parents.length; index += 1) {
			const parent = parents[index];
			if (!present.has(parent)) continue;
			let slot = lanes.indexOf(parent);
			if (slot === -1) {
				slot = lanes.indexOf(null);
				if (slot === -1) {
					lanes.push(parent);
					slot = lanes.length - 1;
				} else lanes[slot] = parent;
			}
			parentLanes.push(slot);
		}
		rows.push({
			commit,
			lane,
			parentLanes,
			before,
			after: lanes.slice(),
			width: 1
		});
	}
	return rows;
}
/** Vertical lane segments for one row. A lane opened by an edge curve must not
also get a centre vertical (the two overlapped into a floating hook). */
function laneSegments(row, height) {
	const middle = height / 2;
	const depth = Math.max(row.before.length, row.after.length);
	const segments = [];
	for (let lane = 0; lane < depth; lane += 1) {
		const above = lane < row.before.length ? row.before[lane] : null;
		const below = lane < row.after.length ? row.after[lane] : null;
		const hasTop = above !== null;
		const hasBottom = below !== null;
		if (!hasTop && !hasBottom) continue;
		if (!hasTop && row.parentLanes.indexOf(lane) >= 0) continue;
		const y1 = hasTop ? 0 : middle;
		const y2 = hasBottom ? height : middle;
		if (y1 === y2) continue;
		segments.push({
			lane,
			y1,
			y2
		});
	}
	return segments;
}
const laneColor = (lane) => LANE_COLORS[lane % LANE_COLORS.length];
/** SVG cell drawing one row's lanes, merge edges and commit dot (HEAD hollow). */
const GraphCell = memo(function GraphCell(props) {
	const { row, height } = props;
	const width = Math.min(Math.max(1, row.width), 7) * 14 + 8;
	const middle = height / 2;
	const children = [];
	const x = (lane) => 8 + Math.min(lane, 6) * 14;
	for (const segment of laneSegments(row, height)) children.push(/* @__PURE__ */ jsx("line", {
		"data-lane": String(segment.lane),
		x1: x(segment.lane),
		y1: segment.y1,
		x2: x(segment.lane),
		y2: segment.y2,
		stroke: laneColor(segment.lane),
		strokeWidth: 2,
		strokeLinecap: "round"
	}, "lane-" + String(segment.lane)));
	for (const parentLane of row.parentLanes) {
		if (parentLane === row.lane) continue;
		children.push(/* @__PURE__ */ jsx("path", {
			"data-lane": String(parentLane),
			d: "M " + x(row.lane) + " " + middle + " C " + x(row.lane) + " " + height + ", " + x(parentLane) + " " + middle + ", " + x(parentLane) + " " + height,
			fill: "none",
			stroke: laneColor(parentLane),
			strokeWidth: 2,
			strokeLinecap: "round"
		}, "edge-" + String(parentLane)));
	}
	const isHead = row.commit.refs.some((ref) => ref.indexOf("HEAD") >= 0);
	children.push(isHead ? /* @__PURE__ */ jsx("circle", {
		"data-lane": String(row.lane),
		cx: x(row.lane),
		cy: middle,
		r: 3.8,
		fill: "none",
		stroke: laneColor(row.lane),
		strokeWidth: 2
	}, "dot") : /* @__PURE__ */ jsx("circle", {
		"data-lane": String(row.lane),
		cx: x(row.lane),
		cy: middle,
		r: 3.6,
		fill: laneColor(row.lane)
	}, "dot"));
	return /* @__PURE__ */ jsx("svg", {
		className: "owt-gp-graph-cell",
		width,
		height,
		viewBox: "0 0 " + width + " " + height,
		"aria-hidden": "true",
		children
	});
}, (prev, next) => prev.row === next.row && prev.height === next.height);
/** Parse one `%d` decoration entry into the kind that drives badge colour. */
function decorationOf(value) {
	if (value.indexOf("HEAD -> ") === 0) return {
		name: value.slice(8),
		kind: "head"
	};
	if (value === "HEAD") return {
		name: "HEAD",
		kind: "head"
	};
	if (value.indexOf("tag: ") === 0) return {
		name: value.slice(5),
		kind: "tag"
	};
	return {
		name: value,
		kind: value.indexOf("/") >= 0 ? "remote" : "local"
	};
}
/** Badge text: a HEAD decoration names the branch it points at. */
function refLabel(decoration) {
	if (decoration.kind !== "head") return decoration.name;
	return decoration.name === "HEAD" ? "HEAD" : "HEAD → " + decoration.name;
}
export { GRAPH_MAX_LANES, GraphCell, LANE_COLORS, LANE_WIDTH, buildGraphRows, decorationOf, refLabel };
