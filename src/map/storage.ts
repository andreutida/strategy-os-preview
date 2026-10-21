import { EMPTY_STRATEGIC_MAP, type StrategicMapDocument, type StrategyNode } from "./model";

export const STRATEGIC_MAP_STORAGE_KEY = "strategyos-strategic-map-v1";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

export function parseStrategicMap(value: unknown): StrategicMapDocument {
  if (!isRecord(value) || ![1, 2].includes(Number(value.version)) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("invalid strategic map");
  }

  const nodes: StrategyNode[] = value.nodes.filter(isRecord).map((node) => {
    if (typeof node.id !== "string" || !isRecord(node.position) || !isRecord(node.data) || typeof node.data.title !== "string") {
      throw new Error("invalid strategic node");
    }
    const position = { x: Number(node.position.x) || 0, y: Number(node.position.y) || 0 };
    const createdAt = stringValue(node.data.createdAt, new Date().toISOString());
    if (node.data.kind === "section") {
      const parentId = typeof node.parentId === "string" ? node.parentId : undefined;
      return {
        id: node.id,
        type: "section",
        position,
        data: {
          kind: "section",
          title: node.data.title,
          description: stringValue(node.data.description),
          createdAt,
        },
        style: {
          width: Math.max(240, Number(isRecord(node.style) ? node.style.width : 0) || 760),
          height: Math.max(120, Number(isRecord(node.style) ? node.style.height : 0) || 440),
        },
        parentId,
        extent: parentId ? "parent" : undefined,
        expandParent: Boolean(parentId),
        zIndex: Number(node.zIndex) || 0,
      };
    }
    const legacyNotes = Array.isArray(node.data.notes) ? node.data.notes.filter((note): note is string => typeof note === "string").join(" · ") : "";
    return {
      id: node.id,
      type: "structural",
      position,
      parentId: typeof node.parentId === "string" ? node.parentId : undefined,
      extent: typeof node.parentId === "string" ? "parent" : undefined,
      expandParent: typeof node.parentId === "string",
      data: {
        kind: "structural",
        title: node.data.title,
        description: stringValue(node.data.description, legacyNotes),
        owner: stringValue(node.data.owner),
        createdAt,
        collapsed: Boolean(node.data.collapsed),
        cascadeLevel: Math.max(1, Number(node.data.cascadeLevel) || 1),
        cascadeOrder: Math.max(0, Number(node.data.cascadeOrder) || 0),
        parentBlockId: stringValue(node.data.parentBlockId) || undefined,
        childrenCollapsed: Boolean(node.data.childrenCollapsed),
        matrixType: node.data.matrixType === "economic-structure" || node.data.matrixType === "economic-measure" || node.data.matrixType === "business-unit" || node.data.matrixType === "diagnostic"
          ? node.data.matrixType
          : (Math.max(1, Number(node.data.cascadeLevel) || 1) === 1 ? "economic-structure" : Math.max(1, Number(node.data.cascadeLevel) || 1) === 2 ? "economic-measure" : "business-unit"),
        diagnosticCategory: node.data.diagnosticCategory === "objection" ? "objection" : node.data.matrixType === "diagnostic" ? "ambition" : undefined,
        measureId: stringValue(node.data.measureId) || undefined,
        businessUnitId: stringValue(node.data.businessUnitId) || undefined,
      },
      zIndex: Number(node.zIndex) || 100,
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let sanitizedNodes = nodes.map((node) => node.parentId && (nodeById.get(node.parentId)?.type !== "section" || node.parentId === node.id)
    ? { ...node, parentId: undefined, extent: undefined, expandParent: false }
    : node);
  const sanitizedById = new Map(sanitizedNodes.map((node) => [node.id, node]));
  sanitizedNodes = sanitizedNodes.map((node) => {
    if (node.type !== "section" || !node.parentId) return node;
    const visited = new Set([node.id]);
    let parentId: string | undefined = node.parentId;
    while (parentId) {
      if (visited.has(parentId)) return { ...node, parentId: undefined, extent: undefined, expandParent: false };
      visited.add(parentId);
      parentId = sanitizedById.get(parentId)?.parentId;
    }
    return node;
  });
  const structuralIds = new Set(sanitizedNodes.filter((node) => node.type === "structural").map((node) => node.id));
  const structuralById = new Map(sanitizedNodes.filter((node) => node.type === "structural").map((node) => [node.id, node]));
  sanitizedNodes = sanitizedNodes.map((node) => {
    if (node.type !== "structural" || !node.data.parentBlockId) return node;
    const parent = structuralById.get(node.data.parentBlockId);
    return !parent || parent.id === node.id || parent.parentId !== node.parentId
      ? { ...node, data: { ...node.data, parentBlockId: undefined, cascadeLevel: 1 } }
      : node;
  });
  const edges = value.edges.filter((edge): edge is StrategicMapDocument["edges"][number] =>
    isRecord(edge) && typeof edge.id === "string" && typeof edge.source === "string" && typeof edge.target === "string" && structuralIds.has(edge.source) && structuralIds.has(edge.target)
  );

  return {
    version: 2,
    nextId: Math.max(Number(value.nextId) || 1, sanitizedNodes.length + 1),
    nodes: sanitizedNodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "section" ? -1 : 1;
      const depth = (node: StrategyNode) => {
        let result = 0;
        let parentId = node.parentId;
        while (parentId && result < 20) { result += 1; parentId = sanitizedById.get(parentId)?.parentId; }
        return result;
      };
      return depth(a) - depth(b);
    }),
    edges,
  };
}

export function loadStrategicMap(): StrategicMapDocument {
  try {
    const raw = localStorage.getItem(STRATEGIC_MAP_STORAGE_KEY);
    return raw ? parseStrategicMap(JSON.parse(raw)) : structuredClone(EMPTY_STRATEGIC_MAP);
  } catch {
    return structuredClone(EMPTY_STRATEGIC_MAP);
  }
}

export function saveStrategicMap(map: StrategicMapDocument) {
  try {
    localStorage.setItem(STRATEGIC_MAP_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}
