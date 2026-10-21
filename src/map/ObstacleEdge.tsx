import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

export interface ObstacleRect { left: number; top: number; right: number; bottom: number }
export interface Point { x: number; y: number }
export interface Segment { start: Point; end: Point }
export interface RoutingEdgeData extends Record<string, unknown> { obstacles?: ObstacleRect[]; reservedSegments?: Segment[]; route?: Point[] }
export type RoutingEdge = Edge<RoutingEdgeData, "routing">;

function segmentIsClear(a: Point, b: Point, obstacles: ObstacleRect[]) {
  return obstacles.every((rect) => {
    if (a.x === b.x) {
      const low = Math.min(a.y, b.y);
      const high = Math.max(a.y, b.y);
      return a.x <= rect.left || a.x >= rect.right || high <= rect.top || low >= rect.bottom;
    }
    const low = Math.min(a.x, b.x);
    const high = Math.max(a.x, b.x);
    return a.y <= rect.top || a.y >= rect.bottom || high <= rect.left || low >= rect.right;
  });
}

function segmentPenalty(a: Point, b: Point, reserved: Segment[]) {
  return reserved.reduce((penalty, segment) => {
    const verticalA = a.x === b.x;
    const verticalB = segment.start.x === segment.end.x;
    if (verticalA === verticalB) {
      if (verticalA && a.x === segment.start.x) {
        const overlap = Math.min(Math.max(a.y, b.y), Math.max(segment.start.y, segment.end.y)) - Math.max(Math.min(a.y, b.y), Math.min(segment.start.y, segment.end.y));
        return penalty + (overlap > 0 ? 1200 : 0);
      }
      if (!verticalA && a.y === segment.start.y) {
        const overlap = Math.min(Math.max(a.x, b.x), Math.max(segment.start.x, segment.end.x)) - Math.max(Math.min(a.x, b.x), Math.min(segment.start.x, segment.end.x));
        return penalty + (overlap > 0 ? 1200 : 0);
      }
      return penalty;
    }
    const vertical = verticalA ? { a, b } : { a: segment.start, b: segment.end };
    const horizontal = verticalA ? { a: segment.start, b: segment.end } : { a, b };
    const crosses = vertical.a.x > Math.min(horizontal.a.x, horizontal.b.x) && vertical.a.x < Math.max(horizontal.a.x, horizontal.b.x) && horizontal.a.y > Math.min(vertical.a.y, vertical.b.y) && horizontal.a.y < Math.max(vertical.a.y, vertical.b.y);
    return penalty + (crosses ? 500 : 0);
  }, 0);
}

export function routeAroundObstacles(start: Point, end: Point, rawObstacles: ObstacleRect[], reservedSegments: Segment[] = []) {
  const obstacles = rawObstacles.map((rect) => ({ left: rect.left - 14, top: rect.top - 14, right: rect.right + 14, bottom: rect.bottom + 14 }));
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((rect) => [rect.left, rect.right])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap((rect) => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  const points: Point[] = [];
  const index = new Map<string, number>();
  xs.forEach((x) => ys.forEach((y) => {
    const blocked = obstacles.some((rect) => x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
    if (!blocked) { index.set(`${x}:${y}`, points.length); points.push({ x, y }); }
  }));
  const graph = points.map(() => [] as Array<{ to: number; cost: number }>);
  const connect = (group: number[]) => group.sort((a, b) => points[a].x - points[b].x || points[a].y - points[b].y).forEach((from, position) => {
    const to = group[position + 1];
    if (to === undefined || !segmentIsClear(points[from], points[to], obstacles)) return;
    const cost = Math.abs(points[from].x - points[to].x) + Math.abs(points[from].y - points[to].y);
    graph[from].push({ to, cost }); graph[to].push({ to: from, cost });
  });
  xs.forEach((x) => connect(points.map((point, id) => ({ point, id })).filter(({ point }) => point.x === x).map(({ id }) => id)));
  ys.forEach((y) => connect(points.map((point, id) => ({ point, id })).filter(({ point }) => point.y === y).map(({ id }) => id)));
  const source = index.get(`${start.x}:${start.y}`);
  const target = index.get(`${end.x}:${end.y}`);
  if (source === undefined || target === undefined) return [start, end];
  const distance = points.map(() => Number.POSITIVE_INFINITY);
  const previous = points.map(() => -1);
  const pending = new Set(points.map((_point, id) => id));
  distance[source] = 0;
  while (pending.size) {
    let current = -1;
    pending.forEach((id) => { if (current < 0 || distance[id] < distance[current]) current = id; });
    if (current < 0 || !Number.isFinite(distance[current]) || current === target) break;
    pending.delete(current);
    graph[current].forEach(({ to, cost }) => {
      if (!pending.has(to)) return;
      const candidate = distance[current] + cost + segmentPenalty(points[current], points[to], reservedSegments);
      if (candidate < distance[to]) { distance[to] = candidate; previous[to] = current; }
    });
  }
  if (!Number.isFinite(distance[target])) return [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end];
  const route: Point[] = [];
  for (let current = target; current >= 0; current = previous[current]) { route.unshift(points[current]); if (current === source) break; }
  return route.filter((point, position) => {
    const before = route[position - 1];
    const after = route[position + 1];
    return !before || !after || !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

export function ObstacleEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data, interactionWidth }: EdgeProps<RoutingEdge>) {
  const route = data?.route ?? routeAroundObstacles({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, data?.obstacles ?? [], data?.reservedSegments ?? []);
  const path = route.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth}/>;
}
