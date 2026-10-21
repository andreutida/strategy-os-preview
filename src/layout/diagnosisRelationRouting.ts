/** Deterministic, orthogonal routing for derived diagnosis relations. */
export interface RelationPoint { x: number; y: number }
export interface RelationObstacle { left: number; top: number; right: number; bottom: number }
export interface RelationSegment { start: RelationPoint; end: RelationPoint }

const clear = (a: RelationPoint, b: RelationPoint, obstacles: RelationObstacle[]) => obstacles.every((rect) => {
  if (a.x === b.x) {
    const low = Math.min(a.y, b.y), high = Math.max(a.y, b.y);
    return a.x <= rect.left || a.x >= rect.right || high <= rect.top || low >= rect.bottom;
  }
  const low = Math.min(a.x, b.x), high = Math.max(a.x, b.x);
  return a.y <= rect.top || a.y >= rect.bottom || high <= rect.left || low >= rect.right;
});

const compact = (route: RelationPoint[]) => route.filter((point, index) => {
  const before = route[index - 1], after = route[index + 1];
  return !before || !after || !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
});

/** Uses obstacle borders as a small deterministic visibility graph. It always returns a finite route. */
export function routeDiagnosisRelation(start: RelationPoint, end: RelationPoint, rawObstacles: RelationObstacle[], reserved: RelationSegment[] = []): RelationPoint[] {
  const padding = 12;
  const obstacles = rawObstacles.map((item) => ({ left: item.left - padding, top: item.top - padding, right: item.right + padding, bottom: item.bottom + padding }));
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((item) => [item.left, item.right])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap((item) => [item.top, item.bottom])])].sort((a, b) => a - b);
  const points: RelationPoint[] = [];
  for (const x of xs) for (const y of ys) if (!obstacles.some((item) => x > item.left && x < item.right && y > item.top && y < item.bottom)) points.push({ x, y });
  const index = new Map(points.map((point, position) => [`${point.x}:${point.y}`, position]));
  const source = index.get(`${start.x}:${start.y}`), target = index.get(`${end.x}:${end.y}`);
  if (source === undefined || target === undefined) return compact([start, { x: start.x, y: end.y }, end]);
  const graph = points.map(() => [] as Array<{ to: number; cost: number }>);
  const connect = (ids: number[]) => ids.sort((a, b) => points[a].x - points[b].x || points[a].y - points[b].y).forEach((from, position) => {
    const to = ids[position + 1];
    if (to === undefined || !clear(points[from], points[to], obstacles)) return;
    const base = Math.abs(points[from].x - points[to].x) + Math.abs(points[from].y - points[to].y);
    const overlapsReserved = reserved.some((segment) => (segment.start.x === segment.end.x) === (points[from].x === points[to].x) && (segment.start.x === segment.end.x ? segment.start.x === points[from].x : segment.start.y === points[from].y));
    graph[from].push({ to, cost: base + (overlapsReserved ? 80 : 0) }); graph[to].push({ to: from, cost: base + (overlapsReserved ? 80 : 0) });
  });
  xs.forEach((x) => connect(points.map((point, i) => point.x === x ? i : -1).filter((i) => i >= 0)));
  ys.forEach((y) => connect(points.map((point, i) => point.y === y ? i : -1).filter((i) => i >= 0)));
  const distances = points.map(() => Infinity), previous = points.map(() => -1), pending = new Set(points.map((_p, i) => i)); distances[source] = 0;
  while (pending.size) {
    let current = -1; pending.forEach((i) => { if (current < 0 || distances[i] < distances[current]) current = i; });
    if (current < 0 || !Number.isFinite(distances[current]) || current === target) break;
    pending.delete(current);
    graph[current].forEach(({ to, cost }) => { if (pending.has(to) && distances[current] + cost < distances[to]) { distances[to] = distances[current] + cost; previous[to] = current; } });
  }
  if (!Number.isFinite(distances[target])) return compact([start, { x: start.x, y: end.y }, end]);
  const route: RelationPoint[] = [];
  for (let cursor = target; cursor >= 0; cursor = previous[cursor]) { route.unshift(points[cursor]); if (cursor === source) break; }
  return compact(route);
}
