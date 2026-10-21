import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnNodeDrag,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { SectionBlock, StructuralBlock } from "./map/StrategicCard";
import { ObstacleEdge, routeAroundObstacles } from "./map/ObstacleEdge";
import type { SectionData, StrategyNode, StrategicMapDocument, StructuralBlockData, StructuralBlockNode } from "./map/model";
import { loadStrategicMap, parseStrategicMap, saveStrategicMap } from "./map/storage";

const nodeTypes = { section: SectionBlock, structural: StructuralBlock };
const edgeTypes = { routing: ObstacleEdge };
const DEFAULT_EDGE = {
  type: "routing",
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#344054" },
  style: { stroke: "#344054", strokeWidth: 1.6 },
  zIndex: 20,
};
type CreateKind = "economic-structure" | "economic-measure" | "business-unit" | "diagnostic";

function FlowchartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v3.5h11V8M12 11.5V16"/></svg>;
}

const relationId = () => `edge-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));

function absolutePosition(node: StrategyNode, nodeById: Map<string, StrategyNode>): XYPosition {
  if (!node.parentId) return node.position;
  const parent = nodeById.get(node.parentId);
  if (!parent) return node.position;
  const parentPosition = absolutePosition(parent, nodeById);
  return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y };
}

function smartHandles(_source: StrategyNode, target: StrategyNode, _nodeById: Map<string, StrategyNode>) {
  return { sourceHandle: "right", targetHandle: target.type === "structural" && target.data.matrixType === "business-unit" ? "top" : "left" };
}

function preserveEdgeHandles(nodes: StrategyNode[], edges: Edge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return edge;
    return { ...edge, ...smartHandles(source, target, byId) };
  });
}

function handlePoint(node: StrategyNode, handle: string, nodeById: Map<string, StrategyNode>) {
  const position = absolutePosition(node, nodeById);
  const size = nodeDimensions(node);
  if (handle === "right") return { x: position.x + size.width, y: position.y + size.height / 2 };
  if (handle === "left") return { x: position.x, y: position.y + size.height / 2 };
  if (handle === "bottom") return { x: position.x + size.width / 2, y: position.y + size.height };
  return { x: position.x + size.width / 2, y: position.y };
}

function handleLead(point: { x: number; y: number }, handle: string, distance = 24) {
  if (handle === "right") return { x: point.x + distance, y: point.y };
  if (handle === "left") return { x: point.x - distance, y: point.y };
  if (handle === "bottom") return { x: point.x, y: point.y + distance };
  return { x: point.x, y: point.y - distance };
}

function orderNodes(nodes: StrategyNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = (node: StrategyNode) => {
    let result = 0;
    let parentId = node.parentId;
    while (parentId && result < 20) { result += 1; parentId = byId.get(parentId)?.parentId; }
    return result;
  };
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "section" ? -1 : 1;
    if (a.type === "section" && b.type === "section") return depth(a) - depth(b) || Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0);
    return 0;
  });
}

function nodeDimensions(node: StrategyNode) {
  if (node.type === "section") return { width: Number(node.style?.width ?? node.measured?.width ?? 760), height: Number(node.style?.height ?? node.measured?.height ?? 440) };
  return { width: Number(node.measured?.width ?? 270), height: Number(node.measured?.height ?? (node.data.collapsed ? 68 : 150)) };
}

function nodesOverlap(a: StrategyNode, b: StrategyNode, gap = 16) {
  const aSize = nodeDimensions(a);
  const bSize = nodeDimensions(b);
  return a.position.x < b.position.x + bSize.width + gap &&
    a.position.x + aSize.width + gap > b.position.x &&
    a.position.y < b.position.y + bSize.height + gap &&
    a.position.y + aSize.height + gap > b.position.y;
}

function findFreePosition(parentId: string | undefined, width: number, height: number, nodes: StrategyNode[]) {
  const parent = nodes.find((node) => node.id === parentId);
  const parentWidth = Number(parent?.style?.width ?? 760);
  const siblings = nodes.filter((node) => (node.parentId ?? undefined) === parentId);
  const xPositions: number[] = [];
  for (let x = 24; x + width <= Math.max(parentWidth - 24, width + 24); x += width + 24) xPositions.push(x);
  if (!xPositions.length) xPositions.push(24);
  for (let row = 0; row < 100; row += 1) {
    for (const x of xPositions) {
      const candidate = { id: "candidate", type: "section", position: { x, y: 62 + row * (height + 24) }, data: { kind: "section", title: "", description: "", createdAt: "" }, style: { width, height } } as StrategyNode;
      if (!siblings.some((sibling) => nodesOverlap(candidate, sibling))) return candidate.position;
    }
  }
  const bottom = Math.max(62, ...siblings.map((sibling) => sibling.position.y + nodeDimensions(sibling).height + 24));
  return { x: 24, y: bottom };
}

function expandParentToFit(nodes: StrategyNode[], parentId: string) {
  const children = nodes.filter((node) => node.parentId === parentId);
  if (!children.length) return nodes;
  const requiredHeight = Math.max(...children.map((child) => child.position.y + nodeDimensions(child).height + 24));
  const requiredWidth = Math.max(...children.map((child) => child.position.x + nodeDimensions(child).width + 24));
  return nodes.map((node) => node.id === parentId && node.type === "section" ? {
    ...node,
    style: { ...node.style, width: Math.max(Number(node.style?.width ?? 760), requiredWidth), height: Math.max(Number(node.style?.height ?? 440), requiredHeight) },
  } : node);
}

function resolveResizeCollisions(nodes: StrategyNode[], anchorId: string) {
  let result = [...nodes];
  const queue = [anchorId];
  const visited = new Set<string>();
  while (queue.length) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const anchor = result.find((node) => node.id === currentId);
    if (!anchor) continue;
    const anchorSize = nodeDimensions(anchor);
    result = result.map((node) => {
      if (node.id === anchor.id || node.parentId !== anchor.parentId || !nodesOverlap(anchor, node)) return node;
      queue.push(node.id);
      return { ...node, position: { ...node.position, y: anchor.position.y + anchorSize.height + 24 } };
    });
    if (anchor.parentId) result = expandParentToFit(result, anchor.parentId);
  }
  return orderNodes(result);
}

function normalizeSiblingLayout(nodes: StrategyNode[]) {
  let result = [...nodes];
  const byId = new Map(result.map((node) => [node.id, node]));
  const depth = (id: string | undefined) => {
    let value = 0;
    let current = id;
    while (current && value < 20) { value += 1; current = byId.get(current)?.parentId; }
    return value;
  };
  const parentIds = [...new Set<string | undefined>(result.map((node) => node.parentId))].sort((a, b) => depth(b) - depth(a));
  parentIds.forEach((parentId) => {
    const siblings = result
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const placed: StrategyNode[] = [];
    siblings.forEach((sibling) => {
      let next = result.find((node) => node.id === sibling.id)!;
      if (placed.some((candidate) => nodesOverlap(next, candidate))) {
        const size = nodeDimensions(next);
        const available = result.filter((node) => node.parentId !== parentId || placed.some((candidate) => candidate.id === node.id));
        next = { ...next, position: findFreePosition(parentId, size.width, size.height, available) };
        result = result.map((node) => node.id === next.id ? next : node);
      }
      placed.push(next);
    });
    if (parentId) result = expandParentToFit(result, parentId);
  });
  return orderNodes(result);
}

function layoutCascadeColumns(nodes: StrategyNode[]) {
  let result = [...nodes];
  const sections = result.filter((node) => node.type === "section");
  sections.forEach((section) => {
    const blocks = result.filter((node): node is StructuralBlockNode => node.type === "structural" && node.parentId === section.id);
    const matrixBlocks = blocks.filter((node) => Boolean(node.data.matrixType));
    if (matrixBlocks.length) {
      const structures = matrixBlocks.filter((node) => node.data.matrixType === "economic-structure").sort((a, b) => a.data.cascadeOrder - b.data.cascadeOrder);
      const measures = matrixBlocks.filter((node) => node.data.matrixType === "economic-measure").sort((a, b) => a.data.cascadeOrder - b.data.cascadeOrder);
      const businessUnits = matrixBlocks.filter((node) => node.data.matrixType === "business-unit").sort((a, b) => a.data.cascadeOrder - b.data.cascadeOrder);
      const diagnostics = matrixBlocks.filter((node) => node.data.matrixType === "diagnostic");
      const placement = new Map<string, { level: number; order: number; x: number; y: number }>();
      const rowStep = 124;
      const firstRowY = 76;
      let nextRow = 0;
      const placedMeasures = new Set<string>();
      structures.forEach((structure, structureIndex) => {
        const children = measures.filter((measure) => measure.data.parentBlockId === structure.id);
        const visibleChildren = structure.data.childrenCollapsed ? [] : children;
        const span = Math.max(1, visibleChildren.length);
        const startRow = nextRow;
        placement.set(structure.id, { level: 1, order: structureIndex, x: 36, y: firstRowY + (startRow + (span - 1) / 2) * rowStep });
        children.forEach((measure, childIndex) => {
          placement.set(measure.id, { level: 2, order: startRow + childIndex, x: 354, y: firstRowY + (startRow + childIndex) * rowStep });
          placedMeasures.add(measure.id);
        });
        nextRow += span;
      });
      measures.filter((measure) => !placedMeasures.has(measure.id)).forEach((measure) => {
        placement.set(measure.id, { level: 2, order: nextRow, x: 354, y: firstRowY + nextRow * rowStep });
        nextRow += 1;
      });
      businessUnits.forEach((node, index) => placement.set(node.id, { level: index + 3, order: index, x: 36 + (index + 2) * 318, y: firstRowY }));
      diagnostics.forEach((node, index) => {
        const measureIndex = measures.findIndex((measure) => measure.id === node.data.measureId);
        const unitIndex = businessUnits.findIndex((unit) => unit.id === node.data.businessUnitId);
        const measurePlace = placement.get(node.data.measureId ?? "");
        if (measureIndex >= 0 && unitIndex >= 0 && measurePlace) placement.set(node.id, { level: unitIndex + 3, order: index, x: 36 + (unitIndex + 2) * 318, y: measurePlace.y + (measurePlace.y === firstRowY ? 48 : 0) });
      });
      result = result.map((node) => {
        const place = placement.get(node.id);
        return place && node.type === "structural" ? { ...node, draggable: true, position: { x: place.x, y: place.y }, data: { ...node.data, cascadeLevel: place.level, cascadeOrder: place.order } } : node;
      });
      const columns = Math.max(2, businessUnits.length + 2);
      const rows = Math.max(1, nextRow);
      result = result.map((node) => node.id === section.id ? { ...node, style: { ...node.style, width: Math.max(Number(node.style?.width ?? 760), 72 + columns * 318), height: Math.max(Number(node.style?.height ?? 440), 112 + rows * rowStep) } } as StrategyNode : node);
      return;
    }
    const byId = new Map(blocks.map((node) => [node.id, node]));
    const memo = new Map<string, number>();
    const levelOf = (node: StructuralBlockNode, trail = new Set<string>()): number => {
      const saved = memo.get(node.id);
      if (saved) return saved;
      const parentId = node.data.parentBlockId;
      if (!parentId || trail.has(parentId) || !byId.has(parentId)) { const level = Math.max(1, node.data.cascadeLevel || 1); memo.set(node.id, level); return level; }
      const nextTrail = new Set(trail).add(node.id);
      const level = levelOf(byId.get(parentId)!, nextTrail) + 1;
      memo.set(node.id, level);
      return level;
    };
    const columns = new Map<number, typeof blocks>();
    blocks.forEach((block) => {
      const level = levelOf(block);
      const column = columns.get(level) ?? [];
      column.push(block);
      columns.set(level, column);
    });
    columns.forEach((column, level) => {
      column.sort((a, b) => a.data.cascadeOrder - b.data.cascadeOrder || a.position.y - b.position.y || a.data.title.localeCompare(b.data.title));
      column.forEach((block, index) => {
        result = result.map((node) => node.id === block.id ? {
          ...node,
          draggable: true,
          position: { x: 36 + (level - 1) * 318, y: 76 + index * 182 },
          data: { ...node.data, cascadeLevel: level, cascadeOrder: index },
        } as StrategyNode : node);
      });
    });
    const maxLevel = Math.max(1, ...columns.keys());
    const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
    result = result.map((node) => node.id === section.id ? {
      ...node,
      style: {
        ...node.style,
        width: Math.max(Number(node.style?.width ?? 760), 72 + maxLevel * 318),
        height: Math.max(Number(node.style?.height ?? 440), 112 + maxRows * 182),
      },
    } as StrategyNode : node);
  });
  return normalizeSiblingLayout(result);
}

function AppContent() {
  const initial = useMemo(() => {
    const loaded = loadStrategicMap();
    const preparedNodes = layoutCascadeColumns(normalizeSiblingLayout(loaded.nodes));
    const preparedEdges = preserveEdgeHandles(preparedNodes, loaded.edges);
    return { ...loaded, nodes: preparedNodes, edges: preparedEdges };
  }, []);
  const [nodes, setNodes] = useState<StrategyNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [nextId, setNextId] = useState(initial.nextId);
  const [instance, setInstance] = useState<ReactFlowInstance<StrategyNode, Edge> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [showUnaligned, setShowUnaligned] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Mapa salvo automaticamente neste navegador.");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>("economic-structure");
  const [visibleCascadeLevel, setVisibleCascadeLevel] = useState(Number.MAX_SAFE_INTEGER);
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem("strategyos-sidebar-pinned") === "true");
  const [sectionDraft, setSectionDraft] = useState({ title: "", description: "", parentId: "" });
  const [blockDraft, setBlockDraft] = useState({ title: "", description: "", owner: "", sectionId: "", cascadeLevel: 1, parentBlockId: "" });
  const [diagnosticDraft, setDiagnosticDraft] = useState({ title: "", category: "ambition" as "ambition" | "objection", measureId: "", businessUnitId: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const dragOrigin = useRef(new Map<string, XYPosition>());

  const sections = useMemo(() => nodes.filter((node) => node.type === "section"), [nodes]);
  const structuralBlocks = useMemo(() => nodes.filter((node) => node.type === "structural"), [nodes]);
  const maxCascadeLevel = useMemo(() => Math.max(1, ...structuralBlocks.map((node) => node.data.cascadeLevel || 1)), [structuralBlocks]);
  const shownCascadeLevel = Math.min(visibleCascadeLevel, maxCascadeLevel);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedNodes = useMemo(() => nodes.filter((node) => selectedNodeIds.includes(node.id)), [nodes, selectedNodeIds]);
  const selectedBlocks = useMemo(() => selectedNodes.filter((node) => node.type === "structural"), [selectedNodes]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const connectedIds = useMemo(() => new Set(edges.flatMap((edge) => [edge.source, edge.target])), [edges]);
  const cascadeChildren = useMemo(() => {
    const result = new Map<string, Set<string>>();
    const add = (sourceId: string, targetId: string) => {
      const source = nodeById.get(sourceId);
      const target = nodeById.get(targetId);
      if (source?.type !== "structural" || target?.type !== "structural" || source.parentId !== target.parentId || target.data.cascadeLevel !== source.data.cascadeLevel + 1) return;
      if (!result.has(sourceId)) result.set(sourceId, new Set());
      result.get(sourceId)!.add(targetId);
    };
    edges.forEach((edge) => add(edge.source, edge.target));
    structuralBlocks.forEach((node) => { if (node.data.parentBlockId) add(node.data.parentBlockId, node.id); });
    return result;
  }, [edges, nodeById, structuralBlocks]);
  const collapsedDescendantIds = useMemo(() => {
    const hidden = new Set<string>();
    const visit = (id: string) => cascadeChildren.get(id)?.forEach((childId) => {
      if (hidden.has(childId)) return;
      hidden.add(childId);
      visit(childId);
    });
    structuralBlocks.filter((node) => node.data.childrenCollapsed).forEach((node) => visit(node.id));
    return hidden;
  }, [cascadeChildren, structuralBlocks]);
  const visibleNodes = useMemo(() => orderNodes(nodes.filter((node) => {
    if (node.type === "section") return true;
    if (collapsedDescendantIds.has(node.id)) return false;
    const matchesSearch = !query || [node.data.title, node.data.description, node.data.owner].join(" ").toLowerCase().includes(query.toLowerCase());
    return node.data.cascadeLevel <= shownCascadeLevel && matchesSearch && (showUnaligned || connectedIds.has(node.id));
  }).map((node) => node.type === "structural" ? {
    ...node,
    className: node.id === connectionSource ? "connection-source" : node.className,
    data: {
      ...node.data,
      childCount: cascadeChildren.get(node.id)?.size ?? 0,
      onToggleChildren: () => {
        setNodes((current) => layoutCascadeColumns(current.map((candidate) => candidate.id === node.id && candidate.type === "structural" ? { ...candidate, data: { ...candidate.data, childrenCollapsed: !candidate.data.childrenCollapsed } } : candidate)));
        setStatus(node.data.childrenCollapsed ? "Próximo nível expandido." : "Próximo nível recolhido.");
      },
    },
  } : node)), [cascadeChildren, collapsedDescendantIds, connectedIds, connectionSource, nodes, query, showUnaligned, shownCascadeLevel]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    return edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return edge;
      const handles = smartHandles(source, target, nodeById);
      const obstacles = visibleNodes.filter((node) => node.type === "structural" && node.id !== source.id && node.id !== target.id).map((node) => {
        const position = absolutePosition(node, nodeById);
        const size = nodeDimensions(node);
        return { left: position.x, top: position.y, right: position.x + size.width, bottom: position.y + size.height };
      });
      const start = handlePoint(source, handles.sourceHandle, nodeById);
      const end = handlePoint(target, handles.targetHandle, nodeById);
      const routedMiddle = routeAroundObstacles(handleLead(start, handles.sourceHandle), handleLead(end, handles.targetHandle), obstacles);
      const route = [start, ...routedMiddle, end].filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
      return { ...edge, ...DEFAULT_EDGE, ...handles, data: { ...edge.data, obstacles, route } };
    });
  }, [edges, nodeById, visibleIds, visibleNodes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const map: StrategicMapDocument = { version: 2, nextId, nodes, edges };
      setStatus(saveStrategicMap(map) ? "Alterações salvas neste navegador." : "Não foi possível salvar neste navegador.");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [edges, nextId, nodes]);

  useEffect(() => { localStorage.setItem("strategyos-sidebar-pinned", String(sidebarPinned)); }, [sidebarPinned]);

  const onNodesChange = useCallback((changes: NodeChange<StrategyNode>[]) => setNodes((current) => {
    let next = applyNodeChanges(changes, current);
    changes.forEach((change) => {
      if (change.type === "dimensions" && change.resizing === false) next = resolveResizeCollisions(next, change.id);
    });
    return changes.some((change) => change.type === "position") ? next : normalizeSiblingLayout(next);
  }), []);
  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => setEdges((current) => applyEdgeChanges(changes, current)), []);

  const onNodeDragStart = useCallback<OnNodeDrag<StrategyNode>>((_event, node) => {
    dragOrigin.current.set(node.id, { ...node.position });
  }, []);

  const onNodeDragStop = useCallback<OnNodeDrag<StrategyNode>>((_event, node) => {
    setNodes((current) => {
      const moved = current.find((candidate) => candidate.id === node.id);
      const origin = dragOrigin.current.get(node.id);
      dragOrigin.current.delete(node.id);
      if (!moved || !origin) return current;
      if (moved.type === "structural") {
        const peers = current
          .filter((candidate): candidate is StructuralBlockNode => candidate.type === "structural" && candidate.parentId === moved.parentId && candidate.data.matrixType === moved.data.matrixType)
          .sort((a, b) => moved.data.matrixType === "business-unit" ? a.position.x - b.position.x : a.position.y - b.position.y);
        const ordered = current.map((candidate) => {
          const index = peers.findIndex((peer) => peer.id === candidate.id);
          return index >= 0 && candidate.type === "structural" ? { ...candidate, data: { ...candidate.data, cascadeOrder: index } } : candidate;
        });
        setStatus("Ordem da coluna atualizada.");
        return layoutCascadeColumns(ordered);
      }
      const collides = current.some((candidate) => candidate.id !== moved.id && candidate.parentId === moved.parentId && nodesOverlap(moved, candidate));
      if (!collides) return normalizeSiblingLayout(moved.parentId ? expandParentToFit(current, moved.parentId) : current);
      setStatus("Elementos da mesma seção não podem se sobrepor. A posição anterior foi restaurada.");
      return current.map((candidate) => candidate.id === moved.id ? { ...candidate, position: origin } : candidate);
    });
  }, []);

  const createConnection = useCallback((source: string, target: string, supplied?: Connection) => {
    if (source === target) {
      setStatus("Escolha dois blocos diferentes.");
      return false;
    }
    if (nodeById.get(source)?.type !== "structural" || nodeById.get(target)?.type !== "structural") {
      setStatus("As relações são permitidas somente entre blocos da Camada 2.");
      return false;
    }
    if (edges.some((edge) => edge.source === source && edge.target === target)) {
      setStatus("Essa relação já existe.");
      return false;
    }
    const sourceNode = nodeById.get(source)!;
    const targetNode = nodeById.get(target)!;
    setEdges((current) => addEdge({ id: relationId(), source, target, ...smartHandles(sourceNode, targetNode, nodeById), ...DEFAULT_EDGE }, current));
    setStatus("Relação criada.");
    return true;
  }, [edges, nodeById]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) createConnection(connection.source, connection.target, connection);
  }, [createConnection]);

  const openCreate = () => {
    setCreateKind("economic-structure");
    setSectionDraft({ title: "", description: "", parentId: "" });
    setBlockDraft({ title: "", description: "", owner: "", sectionId: sections[0]?.id ?? "", cascadeLevel: 1, parentBlockId: "" });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setCreateOpen(true);
  };

  const openDiagnosticCreate = () => {
    const firstMeasure = structuralBlocks.find((node) => node.data.matrixType === "economic-measure");
    const firstUnit = structuralBlocks.find((node) => node.data.matrixType === "business-unit" && (!firstMeasure || node.parentId === firstMeasure.parentId));
    setCreateKind("diagnostic");
    setDiagnosticDraft({ title: "", category: "ambition", measureId: firstMeasure?.id ?? "", businessUnitId: firstUnit?.id ?? "" });
    setSelectedNodeId(null); setSelectedNodeIds([]); setSelectedEdgeId(null); setCreateOpen(true);
  };

  const createSection = () => {
    const id = `section-${nextId}`;
    const parent = sectionDraft.parentId ? nodeById.get(sectionDraft.parentId) : undefined;
    const rootSections = sections.filter((section) => !section.parentId);
    const siblingSections = sections.filter((section) => section.parentId === parent?.id);
    const firstPosition = instance ? instance.screenToFlowPosition({ x: 330, y: 210 }) : { x: 80, y: 80 };
    const width = parent?.type === "section" ? Math.max(300, Number(parent.style?.width ?? 760) - 48) : 760;
    const height = parent?.type === "section" ? 220 : 440;
    const position = parent?.type === "section"
      ? findFreePosition(parent.id, width, height, nodes)
      : rootSections.length ? {
        x: Math.max(...rootSections.map((section) => section.position.x + Number(section.style?.width ?? 760))) + 80,
        y: Math.min(...rootSections.map((section) => section.position.y)),
      } : firstPosition;
    const data: SectionData = { kind: "section", title: sectionDraft.title.trim(), description: sectionDraft.description.trim(), createdAt: new Date().toISOString() };
    const node: StrategyNode = { id, type: "section", position, data, style: { width, height }, parentId: parent?.type === "section" ? parent.id : undefined, extent: parent?.type === "section" ? "parent" : undefined, expandParent: parent?.type === "section", zIndex: parent?.type === "section" ? 10 + siblingSections.length : rootSections.length };
    setNodes((current) => {
      const next = orderNodes([...current, node]);
      return normalizeSiblingLayout(parent?.type === "section" ? expandParentToFit(next, parent.id) : next);
    });
    setNextId((value) => value + 1);
    setSectionDraft({ title: "", description: "", parentId: parent?.type === "section" ? parent.id : "" });
    setStatus("Seção criada. O cadastro continua aberto para adicionar outra.");
  };

  const createStructuralBlock = () => {
    if (createKind === "diagnostic") {
      const measure = structuralBlocks.find((node) => node.id === diagnosticDraft.measureId && node.data.matrixType === "economic-measure");
      const unit = structuralBlocks.find((node) => node.id === diagnosticDraft.businessUnitId && node.data.matrixType === "business-unit" && node.parentId === measure?.parentId);
      if (!measure || !unit || structuralBlocks.some((node) => node.data.matrixType === "diagnostic" && node.data.measureId === measure.id && node.data.businessUnitId === unit.id)) { setStatus("Selecione uma interseção livre entre medida e unidade de negócio."); return; }
      const data: StructuralBlockData = { kind: "structural", matrixType: "diagnostic", diagnosticCategory: diagnosticDraft.category, measureId: measure.id, businessUnitId: unit.id, title: diagnosticDraft.title.trim(), description: "", owner: "", createdAt: new Date().toISOString(), collapsed: false, cascadeLevel: unit.data.cascadeLevel, cascadeOrder: structuralBlocks.filter((node) => node.data.matrixType === "diagnostic").length, childrenCollapsed: false };
      const node: StrategyNode = { id: `block-${nextId}`, type: "structural", position: { x: 36, y: 258 }, parentId: measure.parentId, extent: "parent", expandParent: true, data, zIndex: 10 };
      setNodes((current) => layoutCascadeColumns([...current, node]));
      setNextId((value) => value + 1);
      setDiagnosticDraft((value) => ({ ...value, title: "" }));
      setStatus("Bloco de diagnóstico criado na matriz.");
      return;
    }
    const existingSection = nodeById.get(blockDraft.sectionId) ?? sections[0];
    const createsSection = existingSection?.type !== "section";
    const sectionId = createsSection ? `section-${nextId}` : existingSection.id;
    const id = `block-${nextId + (createsSection ? 1 : 0)}`;
    const parentBlock = createKind === "economic-measure" ? structuralBlocks.find((node) => node.id === blockDraft.parentBlockId && node.parentId === sectionId && node.data.matrixType === "economic-structure") : undefined;
    if (createKind === "economic-measure" && !parentBlock) return;
    const sameType = structuralBlocks.filter((candidate) => candidate.parentId === sectionId && candidate.data.matrixType === createKind);
    const cascadeOrder = sameType.length;
    const cascadeLevel = createKind === "economic-structure" ? 1 : createKind === "economic-measure" ? 2 : cascadeOrder + 3;
    const data: StructuralBlockData = { kind: "structural", matrixType: createKind, title: blockDraft.title.trim(), description: blockDraft.description.trim(), owner: blockDraft.owner.trim(), createdAt: new Date().toISOString(), collapsed: false, cascadeLevel, cascadeOrder, parentBlockId: parentBlock?.id, childrenCollapsed: false };
    const node: StrategyNode = { id, type: "structural", position: { x: 36, y: 76 }, parentId: sectionId, extent: "parent", expandParent: true, data, zIndex: 10 };
    setNodes((current) => {
      const additions: StrategyNode[] = [];
      if (createsSection) additions.push({ id: sectionId, type: "section", position: instance ? instance.screenToFlowPosition({ x: 330, y: 210 }) : { x: 80, y: 80 }, data: { kind: "section", title: "Matriz do Sistema Econômico", description: "Estruturas, medidas e unidades de negócio", createdAt: new Date().toISOString() }, style: { width: 760, height: 440 }, zIndex: 0 });
      return layoutCascadeColumns([...current, ...additions, node]);
    });
    setEdges((current) => {
      const additions: Edge[] = [];
      if (parentBlock && !current.some((edge) => edge.source === parentBlock.id && edge.target === id)) additions.push({ id: relationId(), source: parentBlock.id, target: id, sourceHandle: "right", targetHandle: "left", ...DEFAULT_EDGE });
      return [...current, ...additions];
    });
    setNextId((value) => value + (createsSection ? 2 : 1));
    setVisibleCascadeLevel((current) => current === Number.MAX_SAFE_INTEGER ? current : Math.max(current, cascadeLevel));
    setBlockDraft({ title: "", description: "", owner: "", sectionId, cascadeLevel, parentBlockId: parentBlock?.id ?? "" });
    setStatus("Elemento da matriz criado. O cadastro continua aberto para adicionar outro.");
  };

  const removeSelection = useCallback(() => {
    const nodeIds = selectedNodeIds.length ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    if (nodeIds.length) {
      const removedIds = new Set(nodeIds);
      if (nodeIds.some((id) => nodeById.get(id)?.type === "section")) {
        let changed = true;
        while (changed) {
          changed = false;
          nodes.forEach((node) => { if (node.parentId && removedIds.has(node.parentId) && !removedIds.has(node.id)) { removedIds.add(node.id); changed = true; } });
        }
      }
      setNodes((current) => current.filter((node) => !removedIds.has(node.id)));
      setEdges((current) => current.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)));
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setStatus(removedIds.size > 1 ? `${removedIds.size} elementos excluídos.` : "Elemento excluído.");
    } else if (selectedEdgeId) {
      setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setStatus("Relação excluída.");
    }
  }, [nodeById, nodes, selectedEdgeId, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (event.key === "Delete" || event.key === "Backspace") removeSelection();
      if (event.key === "Escape") { setConnectMode(false); setConnectionSource(null); setCreateOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelection]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: StrategyNode) => {
    if (!connectMode) {
      if (_event.metaKey || _event.ctrlKey || _event.shiftKey) return;
      setSelectedNodeId(node.id); setSelectedNodeIds([node.id]); setSelectedEdgeId(null); return;
    }
    if (node.type !== "structural") { setStatus("Selecione um bloco da Camada 2."); return; }
    if (!connectionSource) { setConnectionSource(node.id); setStatus("Origem escolhida. Selecione o bloco de destino."); return; }
    if (createConnection(connectionSource, node.id)) { setConnectMode(false); setConnectionSource(null); }
  }, [connectMode, connectionSource, createConnection]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
    if (!connectMode) {
      const ids = selectedNodes.map((node) => node.id);
      setSelectedNodeIds(ids);
      setSelectedNodeId(ids.length === 1 ? ids[0] : null);
      setSelectedEdgeId(selectedEdges[0]?.id ?? null);
    }
  }, [connectMode]);

  const updateSelected = (patch: Partial<SectionData | StructuralBlockData>) => {
    if (!selectedNodeId) return;
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } as StrategyNode : node));
  };

  const moveSelectedToSection = (sectionId: string) => {
    if (!selectedNodeId) return;
    setNodes((current) => {
      const selected = current.find((node) => node.id === selectedNodeId);
      if (!selected || selected.type !== "structural") return current;
      const position = findFreePosition(sectionId, nodeDimensions(selected).width, nodeDimensions(selected).height, current.filter((node) => node.id !== selected.id));
      return layoutCascadeColumns(expandParentToFit(current.map((node) => node.id === selected.id && node.type === "structural" ? { ...node, parentId: sectionId, extent: "parent", expandParent: true, position, data: { ...node.data, parentBlockId: undefined, cascadeLevel: 1, cascadeOrder: structuralBlocks.filter((candidate) => candidate.parentId === sectionId && candidate.data.cascadeLevel === 1).length } } : node), sectionId));
    });
  };

  const setCascadeParent = (blockId: string, parentBlockId: string) => {
    const block = structuralBlocks.find((node) => node.id === blockId);
    if (!block) return;
    const descendants = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      structuralBlocks.forEach((node) => { if (node.data.parentBlockId && (node.data.parentBlockId === blockId || descendants.has(node.data.parentBlockId)) && !descendants.has(node.id)) { descendants.add(node.id); changed = true; } });
    }
    if (parentBlockId === blockId || descendants.has(parentBlockId)) return;
    const previousParent = block.data.parentBlockId;
    const parent = structuralBlocks.find((node) => node.id === parentBlockId);
    setNodes((current) => layoutCascadeColumns(current.map((node) => node.id === blockId && node.type === "structural" ? { ...node, data: { ...node.data, parentBlockId: parentBlockId || undefined, cascadeLevel: parent ? parent.data.cascadeLevel + 1 : node.data.cascadeLevel } } : node)));
    setEdges((current) => {
      const withoutPrevious = previousParent ? current.filter((edge) => !(edge.source === previousParent && edge.target === blockId)) : current;
      return parentBlockId && !withoutPrevious.some((edge) => edge.source === parentBlockId && edge.target === blockId)
        ? [...withoutPrevious, { id: relationId(), source: parentBlockId, target: blockId, sourceHandle: "right", targetHandle: "left", ...DEFAULT_EDGE }]
        : withoutPrevious;
    });
    setStatus(parentBlockId ? "Bloco reposicionado na cascata." : "Vínculo superior removido; o nível foi mantido.");
  };

  const setCascadeLevel = (blockId: string, cascadeLevel: number) => {
    setNodes((current) => layoutCascadeColumns(current.map((node) => node.id === blockId && node.type === "structural" ? { ...node, data: { ...node.data, cascadeLevel, parentBlockId: undefined } } : node)));
    setEdges((current) => {
      const block = structuralBlocks.find((node) => node.id === blockId);
      return block?.data.parentBlockId ? current.filter((edge) => !(edge.source === block.data.parentBlockId && edge.target === blockId)) : current;
    });
    setVisibleCascadeLevel((current) => current === Number.MAX_SAFE_INTEGER ? current : Math.max(current, cascadeLevel));
    setStatus(`Bloco movido para o nível ${cascadeLevel}.`);
  };

  const moveCascadeOrder = (blockId: string, direction: -1 | 1) => {
    const block = structuralBlocks.find((node) => node.id === blockId);
    if (!block) return;
    const peers = structuralBlocks
      .filter((node) => node.parentId === block.parentId && node.data.matrixType === block.data.matrixType)
      .sort((a, b) => a.data.cascadeOrder - b.data.cascadeOrder);
    const index = peers.findIndex((node) => node.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= peers.length) return;
    [peers[index], peers[target]] = [peers[target], peers[index]];
    const orderById = new Map(peers.map((node, order) => [node.id, order]));
    setNodes((current) => layoutCascadeColumns(current.map((node) => node.type === "structural" && orderById.has(node.id) ? { ...node, data: { ...node.data, cascadeOrder: orderById.get(node.id)! } } : node)));
    setStatus("Ordem da coluna atualizada.");
  };

  const sectionDescendants = (sectionId: string) => {
    const result = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      sections.forEach((section) => { if (section.parentId && (section.parentId === sectionId || result.has(section.parentId)) && !result.has(section.id)) { result.add(section.id); changed = true; } });
    }
    return result;
  };

  const moveSelectedSection = (parentId: string) => {
    if (!selectedNode || selectedNode.type !== "section") return;
    const descendants = sectionDescendants(selectedNode.id);
    if (parentId === selectedNode.id || descendants.has(parentId)) return;
    const absolute = absolutePosition(selectedNode, nodeById);
    setNodes((current) => {
      const parent = parentId ? current.find((node) => node.id === parentId) : undefined;
      const withoutSelected = current.filter((node) => node.id !== selectedNode.id);
      const size = nodeDimensions(selectedNode);
      const position = parent?.type === "section" ? findFreePosition(parent.id, size.width, size.height, withoutSelected) : absolute;
      const next = orderNodes(current.map((node) => node.id !== selectedNode.id || node.type !== "section" ? node : parent?.type === "section"
        ? { ...node, parentId: parent.id, extent: "parent", expandParent: true, position }
        : { ...node, parentId: undefined, extent: undefined, expandParent: false, position }));
      return normalizeSiblingLayout(parent?.type === "section" ? expandParentToFit(next, parent.id) : next);
    });
  };

  const setRelation = (direction: "incoming" | "outgoing", otherId: string, checked: boolean) => {
    if (!selectedNodeId) return;
    const source = direction === "incoming" ? otherId : selectedNodeId;
    const target = direction === "incoming" ? selectedNodeId : otherId;
    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    const handles = sourceNode && targetNode ? smartHandles(sourceNode, targetNode, nodeById) : {};
    setEdges((current) => checked
      ? current.some((edge) => edge.source === source && edge.target === target) ? current : [...current, { id: relationId(), source, target, ...handles, ...DEFAULT_EDGE }]
      : current.filter((edge) => !(edge.source === source && edge.target === target)));
  };

  const setEdgeHandle = (side: "sourceHandle" | "targetHandle", value: string) => {
    if (!selectedEdgeId) return;
    setEdges((current) => current.map((edge) => edge.id === selectedEdgeId ? { ...edge, [side]: value } : edge));
    setStatus("Bordas da seta atualizadas e preservadas.");
  };

  const exportMap = () => {
    const map: StrategicMapDocument = { version: 2, nextId, nodes, edges };
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(map, null, 2)], { type: "application/json" }));
    anchor.download = "strategy-os-mapa-estrategico.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setStatus("Mapa exportado.");
  };

  const importMap = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const map = parseStrategicMap(JSON.parse(await file.text()));
      const preparedNodes = layoutCascadeColumns(map.nodes);
      setNodes(preparedNodes); setEdges(preserveEdgeHandles(preparedNodes, map.edges)); setNextId(map.nextId); setSelectedNodeId(null); setSelectedNodeIds([]); setSelectedEdgeId(null); setStatus("Mapa importado.");
      window.setTimeout(() => instance?.fitView({ padding: 0.12, duration: 500 }), 30);
    } catch { setStatus("Arquivo inválido. Importe um mapa exportado pelo Strategy OS."); }
  };

  const clearMap = () => {
    if (nodes.length && !window.confirm("Apagar todas as seções, blocos e relações deste mapa?")) return;
    setNodes([]); setEdges([]); setNextId(1); setSelectedNodeId(null); setSelectedNodeIds([]); setSelectedEdgeId(null); setStatus("Mapa limpo.");
  };

  const validDraft = createKind === "diagnostic" ? Boolean(diagnosticDraft.title.trim() && diagnosticDraft.measureId && diagnosticDraft.businessUnitId) : Boolean(blockDraft.title.trim() && (createKind !== "economic-measure" || blockDraft.parentBlockId));
  const selectedStructural = selectedNode?.type === "structural" ? selectedNode : null;

  return <main className={`app-shell${sidebarPinned ? " sidebar-pinned" : ""}`}>
    <aside className="side-navigation">
      <div className="brand"><span className="brand-symbol">S</span><strong>strategyOS</strong><button className="sidebar-pin" type="button" aria-pressed={sidebarPinned} aria-label={sidebarPinned ? "Recolher menu lateral" : "Fixar menu lateral aberto"} onClick={() => setSidebarPinned((value) => !value)}>{sidebarPinned ? "‹" : "⌖"}</button></div>
      <nav aria-label="Áreas do Strategy OS"><button className="is-current" type="button" aria-label="Diagnóstico"><FlowchartIcon/><span>Diagnóstico</span></button></nav>
      <div className="side-navigation__footer"><span>AU</span><small>Workspace</small></div>
    </aside>

    <section className="app-frame">
      <header className="app-header">
        <div className="app-header__title"><span><FlowchartIcon/></span><div><strong>Diagnóstico</strong><small>Strategy OS</small></div></div>
        <div className="app-header__actions"><label className="search-field"><span>⌕</span><input aria-label="Buscar no mapa" placeholder="Buscar" value={query} onChange={(event) => setQuery(event.target.value)}/></label><button className="icon-button primary" type="button" onClick={openCreate} aria-label="Criar elemento">+</button><button className="icon-button" type="button" onClick={() => window.location.reload()} aria-label="Atualizar página">↻</button><span className="profile-avatar">AU</span></div>
      </header>

      <div className="map-toolbar" aria-label="Ferramentas do mapa">
        <button className="primary" type="button" onClick={openCreate}>+ Criar estrutura</button>
        <button type="button" onClick={openDiagnosticCreate}>+ Criar diagnóstico</button>
        <button className={connectMode ? "active" : ""} type="button" onClick={() => { setConnectMode((value) => !value); setConnectionSource(null); setSelectedNodeId(null); setSelectedNodeIds([]); setSelectedEdgeId(null); setStatus(connectMode ? "Conexão cancelada." : "Selecione o bloco de origem da Camada 2."); }}>Conectar</button>
        <button type="button" disabled={!selectedNodeIds.length && !selectedEdgeId} onClick={removeSelection}>Excluir</button>
        <button type="button" onClick={() => instance?.fitView({ padding: 0.12, duration: 500 })}>Centralizar</button>
        {selectedBlocks.length >= 2 && <div className="selection-tools" aria-label="Blocos selecionados"><strong>{selectedBlocks.length} selecionados</strong><button type="button" onClick={() => instance?.fitView({ nodes: selectedBlocks, padding: 0.35, duration: 450 })}>Enquadrar seleção</button></div>}
        <div className="cascade-level-tools" aria-label="Níveis visíveis da cascata"><button type="button" disabled={shownCascadeLevel <= 1} onClick={() => setVisibleCascadeLevel(Math.max(1, shownCascadeLevel - 1))}>− Recolher nível</button><span>Níveis 1–{shownCascadeLevel}</span><button type="button" disabled={shownCascadeLevel >= maxCascadeLevel} onClick={() => setVisibleCascadeLevel(shownCascadeLevel + 1)}>+ Próximo nível</button></div>
        <label className="toolbar-check"><input type="checkbox" checked={showUnaligned} onChange={(event) => setShowUnaligned(event.target.checked)}/> Mostrar não conectados</label><span className="toolbar-spacer"/>
        <button type="button" onClick={exportMap}>Exportar</button><button type="button" onClick={() => fileInput.current?.click()}>Importar</button><button className="danger" type="button" onClick={clearMap}>Limpar</button>
        <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importMap}/>
      </div>

      <div className={`map-body${selectedNode || selectedEdge ? " has-properties" : ""}`}>
        <section className="map-canvas" aria-label="Editor do mapa estratégico">
          <ReactFlow<StrategyNode, Edge> nodes={visibleNodes} edges={visibleEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={setInstance} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop} onSelectionChange={onSelectionChange} connectionMode={ConnectionMode.Loose} defaultEdgeOptions={DEFAULT_EDGE} nodesConnectable={!connectMode} isValidConnection={(connection) => nodeById.get(connection.source)?.type === "structural" && nodeById.get(connection.target)?.type === "structural"} selectionOnDrag selectionMode={SelectionMode.Full} panOnDrag={[1, 2]} multiSelectionKeyCode={["Meta", "Control"]} minZoom={0.2} maxZoom={2} fitView={nodes.length > 0} fitViewOptions={{ padding: 0.12 }} deleteKeyCode={null}>
            <Background variant={BackgroundVariant.Dots} color="#cbd3df" gap={24} size={1.2}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={(node) => node.type === "section" ? "#d9e2ec" : "#26354d"} maskColor="rgb(245 247 251 / 78%)"/>
          </ReactFlow>
          {nodes.length === 0 && <div className="empty-map"><span><FlowchartIcon/></span><h2>Crie a matriz do sistema econômico</h2><p>Adicione estruturas, medidas e unidades de negócio. A matriz será organizada automaticamente.</p><button className="primary" type="button" onClick={openCreate}>Criar estrutura</button></div>}
          {connectMode && <div className="connection-hint">{connectionSource ? "Agora selecione o destino" : "Selecione a origem na Camada 2"}<button type="button" onClick={() => { setConnectMode(false); setConnectionSource(null); }}>Cancelar</button></div>}
          <div className="save-status" role="status">{status}</div>
        </section>

        {selectedNode && <aside className="properties-panel" aria-label={selectedNode.type === "section" ? "Editar seção" : "Editar bloco estrutural"}>
          <header><div><small>{selectedNode.type === "section" ? "Camada 1" : "Camada 2"}</small><h2>{selectedNode.type === "section" ? "Editar seção" : "Editar bloco estrutural"}</h2></div><button type="button" aria-label="Fechar painel" onClick={() => { setSelectedNodeId(null); setSelectedNodeIds([]); setNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node)); }}>×</button></header>
          <label>Nome<input id="node-title" value={selectedNode.data.title} onChange={(event) => updateSelected({ title: event.target.value })}/></label>
          {(selectedNode.type === "section" || selectedNode.data.matrixType === "economic-structure") && <label>Descrição<textarea id="node-description" rows={4} value={selectedNode.data.description} onChange={(event) => updateSelected({ description: event.target.value })}/></label>}
          {selectedNode.type === "section" && <label>Data de criação<input value={formatDate(selectedNode.data.createdAt)} readOnly/></label>}
          {selectedStructural && <>
            <label>Seção<select id="node-section" value={selectedStructural.parentId ?? ""} onChange={(event) => moveSelectedToSection(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.data.title}</option>)}</select></label>
            <label>Tipo na matriz<input value={selectedStructural.data.matrixType === "diagnostic" ? selectedStructural.data.diagnosticCategory === "objection" ? "Diagnóstico · Objeção" : "Diagnóstico · Ambição" : selectedStructural.data.matrixType === "economic-measure" ? "Medida do Sistema Econômico · coluna 2" : selectedStructural.data.matrixType === "business-unit" ? "Unidade de Negócio · linha 1" : "Estrutura do Sistema Econômico · coluna 1"} readOnly/></label>
            {selectedStructural.data.matrixType === "economic-measure" && <label>Estrutura relacionada<select id="node-cascade-parent" value={selectedStructural.data.parentBlockId ?? ""} onChange={(event) => setCascadeParent(selectedStructural.id, event.target.value)}>{structuralBlocks.filter((node) => node.id !== selectedStructural.id && node.parentId === selectedStructural.parentId && node.data.matrixType === "economic-structure").map((node) => <option key={node.id} value={node.id}>{node.data.title}</option>)}</select><small>A medida sempre permanece ligada a uma estrutura econômica.</small></label>}
            <div className="cascade-order"><span>{selectedStructural.data.matrixType === "business-unit" ? "Ordem das colunas" : "Ordem das linhas"}</span><div><button type="button" onClick={() => moveCascadeOrder(selectedStructural.id, -1)}>← Anterior</button><button type="button" onClick={() => moveCascadeOrder(selectedStructural.id, 1)}>Próximo →</button></div><small>A matriz reposiciona automaticamente os elementos.</small></div>
            {structuralBlocks.length > 1 && <div className="relation-editor"><strong>Relações com a Camada 2</strong><div><fieldset><legend>Recebe seta de</legend>{structuralBlocks.filter((node) => node.id !== selectedStructural.id).map((node) => <label key={node.id}><input type="checkbox" checked={edges.some((edge) => edge.source === node.id && edge.target === selectedStructural.id)} onChange={(event) => setRelation("incoming", node.id, event.target.checked)}/>{node.data.title}</label>)}</fieldset><fieldset><legend>Saída para</legend>{structuralBlocks.filter((node) => node.id !== selectedStructural.id).map((node) => <label key={node.id}><input type="checkbox" checked={edges.some((edge) => edge.source === selectedStructural.id && edge.target === node.id)} onChange={(event) => setRelation("outgoing", node.id, event.target.checked)}/>{node.data.title}</label>)}</fieldset></div></div>}
            <label className="panel-check"><input type="checkbox" checked={selectedStructural.data.collapsed} onChange={(event) => updateSelected({ collapsed: event.target.checked })}/> Recolher este bloco</label>
          </>}
          {selectedNode.type === "section" && <>
            <label>Dentro da seção<select id="section-parent" value={selectedNode.parentId ?? ""} onChange={(event) => moveSelectedSection(event.target.value)}><option value="">Nenhuma — nível principal</option>{sections.filter((section) => section.id !== selectedNode.id && !sectionDescendants(selectedNode.id).has(section.id)).map((section) => <option key={section.id} value={section.id}>{section.data.title}</option>)}</select></label>
            <p className="section-rule">Seções dentro do mesmo contêiner são organizadas sem sobreposição.</p>
            <p className="section-summary">{sections.filter((section) => section.parentId === selectedNode.id).length} subseção(ões) e {structuralBlocks.filter((node) => node.parentId === selectedNode.id).length} bloco(s) estrutural(is).</p>
          </>}
          <button className="danger panel-delete" type="button" onClick={removeSelection}>Excluir {selectedNode.type === "section" ? "seção e blocos" : "bloco"}</button>
        </aside>}

        {selectedEdge && !selectedNode && <aside className="properties-panel" aria-label="Editar seta">
          <header><div><small>Conexão</small><h2>Editar seta</h2></div><button type="button" aria-label="Fechar painel" onClick={() => { setSelectedEdgeId(null); setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge)); }}>×</button></header>
          <label>Bloco de origem<input value={nodeById.get(selectedEdge.source)?.data.title ?? selectedEdge.source} readOnly/></label>
          <label>Borda de saída<input value="Direita" readOnly/></label>
          <label>Bloco de destino<input value={nodeById.get(selectedEdge.target)?.data.title ?? selectedEdge.target} readOnly/></label>
          <label>Borda de entrada<input value={nodeById.get(selectedEdge.target)?.type === "structural" && nodeById.get(selectedEdge.target)?.data.matrixType === "business-unit" ? "Topo" : "Esquerda"} readOnly/></label>
          <div className="form-notice">As setas saem pela direita. Entram pelo topo nas Unidades de Negócio e pela esquerda nos demais blocos.</div>
        </aside>}
      </div>

      {createOpen && <form className="create-drawer" aria-label={createKind === "diagnostic" ? "Criar diagnóstico na matriz" : "Criar estrutura da matriz"} onSubmit={(event) => { event.preventDefault(); if (validDraft) createStructuralBlock(); }}>
          <header><div><small>{createKind === "diagnostic" ? "Diagnóstico na matriz" : "Definição da matriz"}</small><h2 id="create-title">{createKind === "diagnostic" ? "Criar bloco de Diagnóstico" : createKind === "economic-structure" ? "Criar Estrutura do Sistema Econômico" : createKind === "economic-measure" ? "Criar Medida do Sistema Econômico" : "Criar Unidade de Negócio"}</h2></div><button type="button" aria-label="Fechar cadastro" onClick={() => setCreateOpen(false)}>×</button></header>
          <div className={`create-layout${createKind === "diagnostic" ? " diagnostic-layout" : ""}`}>
            {createKind !== "diagnostic" && <nav className="create-type-nav" aria-label="Tipos da matriz"><button type="button" className={createKind === "economic-structure" ? "is-current" : ""} onClick={() => { setCreateKind("economic-structure"); setBlockDraft((value) => ({ ...value, parentBlockId: "" })); }}><span>Coluna 1</span><strong>Estrutura do Sistema Econômico</strong><small>Uma estrutura por linha</small></button><button type="button" className={createKind === "economic-measure" ? "is-current" : ""} onClick={() => setCreateKind("economic-measure")}><span>Coluna 2</span><strong>Medida do Sistema Econômico</strong><small>Relacionada a uma estrutura</small></button><button type="button" className={createKind === "business-unit" ? "is-current" : ""} onClick={() => { setCreateKind("business-unit"); setBlockDraft((value) => ({ ...value, parentBlockId: "" })); }}><span>Linha 1 · colunas 3+</span><strong>Unidade de Negócio</strong><small>Uma unidade por coluna</small></button></nav>}
            <div className="create-fields">
              {createKind === "diagnostic" ? <>
                <div className="layer-intro layer-intro--structural"><b>DX</b><div><strong>Interseção da matriz</strong><p>O bloco ocupará a célula entre uma medida e uma unidade de negócio.</p></div></div>
                <label>Categoria<select id="new-diagnostic-category" value={diagnosticDraft.category} onChange={(event) => setDiagnosticDraft((value) => ({ ...value, category: event.target.value as "ambition" | "objection" }))}><option value="ambition">Ambição · amarelo pastel</option><option value="objection">Objeção · vermelho pastel</option></select></label>
                <label>Medida do Sistema Econômico<select id="new-diagnostic-measure" required value={diagnosticDraft.measureId} onChange={(event) => { const measure = structuralBlocks.find((node) => node.id === event.target.value); const unit = structuralBlocks.find((node) => node.data.matrixType === "business-unit" && node.parentId === measure?.parentId); setDiagnosticDraft((value) => ({ ...value, measureId: event.target.value, businessUnitId: unit?.id ?? "" })); }}><option value="">Selecione a medida</option>{structuralBlocks.filter((node) => node.data.matrixType === "economic-measure").map((node) => <option key={node.id} value={node.id}>{node.data.title}</option>)}</select></label>
                <label>Unidade de Negócio<select id="new-diagnostic-unit" required value={diagnosticDraft.businessUnitId} onChange={(event) => setDiagnosticDraft((value) => ({ ...value, businessUnitId: event.target.value }))}><option value="">Selecione a unidade</option>{structuralBlocks.filter((node) => node.data.matrixType === "business-unit" && node.parentId === structuralBlocks.find((measure) => measure.id === diagnosticDraft.measureId)?.parentId).map((node) => <option key={node.id} value={node.id}>{node.data.title}</option>)}</select></label>
                <label>Diagnóstico<input autoFocus id="new-diagnostic-title" required placeholder={diagnosticDraft.category === "ambition" ? "Ex.: Liderar o mercado regional" : "Ex.: Baixa capacidade instalada"} value={diagnosticDraft.title} onChange={(event) => setDiagnosticDraft((value) => ({ ...value, title: event.target.value }))}/></label>
              </> : <>
              <div className="layer-intro layer-intro--structural"><b>{createKind === "economic-structure" ? "C1" : createKind === "economic-measure" ? "C2" : "L1"}</b><div><strong>{createKind === "economic-structure" ? "Estrutura do Sistema Econômico" : createKind === "economic-measure" ? "Medida do Sistema Econômico" : "Unidade de Negócio"}</strong><p>{createKind === "business-unit" ? "Será posicionada na primeira linha, a partir da coluna 3." : `Será posicionada na coluna ${createKind === "economic-structure" ? 1 : 2}, a partir da linha 2.`}</p></div></div>
              {sections.length > 1 && <label>Matriz<select id="new-block-section" value={blockDraft.sectionId || sections[0]?.id} onChange={(event) => setBlockDraft((value) => ({ ...value, sectionId: event.target.value, parentBlockId: "" }))}>{sections.map((section) => <option key={section.id} value={section.id}>{section.data.title}</option>)}</select></label>}
              {createKind === "economic-measure" && <label>Estrutura relacionada<select id="new-block-parent" required value={blockDraft.parentBlockId} onChange={(event) => setBlockDraft((value) => ({ ...value, parentBlockId: event.target.value }))}><option value="">Selecione a estrutura</option>{structuralBlocks.filter((node) => node.data.matrixType === "economic-structure" && (!blockDraft.sectionId || node.parentId === blockDraft.sectionId)).map((node) => <option key={node.id} value={node.id}>{node.data.title}</option>)}</select><small>Obrigatório. A seta será criada da borda direita da estrutura para a borda esquerda da medida.</small></label>}
              <label>Nome<input autoFocus id="new-block-title" required placeholder={createKind === "economic-structure" ? "Ex.: Alocação de capital" : createKind === "economic-measure" ? "Ex.: ROIC incremental" : "Ex.: Unidade Brasil"} value={blockDraft.title} onChange={(event) => setBlockDraft((value) => ({ ...value, title: event.target.value }))}/></label>
              {createKind === "economic-structure" && <label>Descrição<textarea id="new-block-description" rows={3} placeholder="Descreva esta estrutura" value={blockDraft.description} onChange={(event) => setBlockDraft((value) => ({ ...value, description: event.target.value }))}/></label>}
              </>}
            </div>
          </div>
          <footer><button type="button" onClick={() => setCreateOpen(false)}>Fechar</button><button className="primary" type="submit" disabled={!validDraft}>Criar elemento</button></footer>
        </form>}
    </section>
  </main>;
}

export function App() {
  return <ReactFlowProvider><AppContent/></ReactFlowProvider>;
}
