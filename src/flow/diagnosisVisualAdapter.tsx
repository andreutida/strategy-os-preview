import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { SyntheticEvent } from "react";
import type { DiagnosticDocument } from "../domain/model";
import { layoutDiagnosisCoverage, type CoverageSegment } from "../layout/diagnosisCoverageGeometry";
import type { MatrixPresentation } from "../layout/economicMatrix";
import type { DiagnosisVisibilityResult, HiddenRelationIndicator } from "../layout/diagnosisVisibility";

export const DIAGNOSIS_CARD_PREFIX = "diagnosis-card:";
const REGION_PREFIX = "diagnosis-region:";
const CONTINUITY_PREFIX = "diagnosis-continuity:";
const CARD_HEIGHT = 64;
const CARD_GAP = 10;

export const diagnosisIdFromNodeId = (id: string) => id.startsWith(DIAGNOSIS_CARD_PREFIX) ? id.slice(DIAGNOSIS_CARD_PREFIX.length) : undefined;

type Rectangle = { x: number; y: number; width: number; height: number };
export interface DiagnosisVisualRepresentation { representationId: string; diagnosisId: string; bounds: Rectangle; }
const overlaps = (a: Rectangle, b: Rectangle) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const segmentCenter = (segment: CoverageSegment) => ({ x: segment.bounds.x + segment.bounds.width / 2, y: segment.bounds.y + segment.bounds.height / 2 });

function cardPosition(anchor: Rectangle, occupied: Rectangle[]) {
  const width = Math.max(150, Math.min(230, anchor.width - 16));
  const x = anchor.x + Math.max(8, (anchor.width - width) / 2);
  let y = anchor.y + 8;
  let candidate = { x, y, width, height: CARD_HEIGHT };
  while (occupied.some((item) => overlaps(candidate, item))) {
    y += CARD_HEIGHT + CARD_GAP;
    candidate = { x, y, width, height: CARD_HEIGHT };
  }
  occupied.push(candidate);
  return candidate;
}

/** A visual representation is distinct from diagnosis identity and can later support UX-004. */
export function diagnosisVisibleDocument(document: DiagnosticDocument, visibility?: DiagnosisVisibilityResult): DiagnosticDocument {
  if (!visibility) return document;
  const byId = new Map(visibility.diagnoses.map((item) => [item.diagnosisId, item]));
  return {
    ...document,
    diagnoses: document.diagnoses.flatMap((diagnosis) => {
      const state = byId.get(diagnosis.id);
      return state?.cardVisible ? [{ ...diagnosis, coverage: state.visibleCoverage.map(({ measureId, organizationalUnitId }) => ({ measureId, organizationalUnitId })) }] : [];
    }),
  };
}

export function diagnosisVisualRepresentations(document: DiagnosticDocument, presentation: MatrixPresentation, visibility?: DiagnosisVisibilityResult): DiagnosisVisualRepresentation[] {
  const occupiedCards: Rectangle[] = [];
  return layoutDiagnosisCoverage(diagnosisVisibleDocument(document, visibility), presentation).flatMap((geometry) => {
    if (!geometry.segments.length) return [];
    const anchor = geometry.segments[0].rectangles[0];
    const bounds = cardPosition(anchor, occupiedCards);
    return [{ representationId: `${DIAGNOSIS_CARD_PREFIX}${geometry.diagnosisId}`, diagnosisId: geometry.diagnosisId, bounds }];
  });
}

/** React Flow projection of the pure coverage geometry. No output is persisted. */
export interface DiagnosisVisualCallbacks {
  onToggleHierarchy?: (diagnosisId: string) => void;
  onOpenHiddenRelations?: (diagnosisId: string) => void;
}

export function diagnosisVisualNodes(document: DiagnosticDocument, presentation: MatrixPresentation, selectedDiagnosisId = "", visibility?: DiagnosisVisibilityResult, callbacks: DiagnosisVisualCallbacks = {}): Node[] {
  const nodes: Node[] = [];
  const renderedDocument = diagnosisVisibleDocument(document, visibility);
  const representations = new Map(diagnosisVisualRepresentations(document, presentation, visibility).map((item) => [item.diagnosisId, item]));
  const visibilityById = new Map(visibility?.diagnoses.map((item) => [item.diagnosisId, item]) ?? []);
  const indicatorsById = new Map<string, HiddenRelationIndicator[]>();
  visibility?.hiddenRelationIndicators.forEach((indicator) => indicatorsById.set(indicator.diagnosisId, [...(indicatorsById.get(indicator.diagnosisId) ?? []), indicator]));
  layoutDiagnosisCoverage(renderedDocument, presentation).forEach((geometry) => {
    const diagnosis = document.diagnoses.find((item) => item.id === geometry.diagnosisId)!;
    if (!geometry.segments.length) return;
    if (geometry.diagnosisId === selectedDiagnosisId) {
      geometry.segments.forEach((segment) => segment.rectangles.forEach((rectangle, index) => {
        nodes.push({ id: `${REGION_PREFIX}${geometry.diagnosisId}:${segment.id}:${index}`, type: "diagnosisRegion", position: { x: rectangle.x, y: rectangle.y }, draggable: false, selectable: false, data: {}, style: { width: rectangle.width, height: rectangle.height, zIndex: 0 } });
      }));
    }
    geometry.segments.slice(1).forEach((segment, index) => {
      const from = segmentCenter(geometry.segments[index]); const to = segmentCenter(segment);
      const x = Math.min(from.x, to.x), y = Math.min(from.y, to.y) - 14;
      nodes.push({ id: `${CONTINUITY_PREFIX}${geometry.diagnosisId}:${index}`, type: "diagnosisContinuity", position: { x, y }, draggable: false, selectable: false, data: { from: { x: from.x - x, y: from.y - y }, to: { x: to.x - x, y: to.y - y } }, style: { width: Math.abs(to.x - from.x) || 1, height: Math.abs(to.y - from.y) + 28, zIndex: 1 } });
    });
    const representation = representations.get(geometry.diagnosisId)!;
    const state = visibilityById.get(diagnosis.id);
    const hiddenRelations = indicatorsById.get(diagnosis.id) ?? [];
    nodes.push({ id: representation.representationId, type: "diagnosisCard", position: { x: representation.bounds.x, y: representation.bounds.y }, draggable: false, data: { diagnosisId: diagnosis.id, title: diagnosis.title, kind: diagnosis.kind, selected: diagnosis.id === selectedDiagnosisId, coverageCount: diagnosis.coverage.length, directChildCount: state?.directChildIds.length ?? 0, hierarchyCollapsed: Boolean(state?.collapsedDescendantIds.length), hiddenRelationCount: hiddenRelations.length, onToggleHierarchy: callbacks.onToggleHierarchy, onOpenHiddenRelations: callbacks.onOpenHiddenRelations }, style: { width: representation.bounds.width, height: representation.bounds.height, zIndex: 2 } });
  });
  return nodes;
}

export function DiagnosisCardNode({ data }: NodeProps) {
  const value = data as { diagnosisId: string; title: string; kind: "ambition" | "objection"; selected: boolean; coverageCount: number; directChildCount: number; hierarchyCollapsed: boolean; hiddenRelationCount: number; onToggleHierarchy?: (id: string) => void; onOpenHiddenRelations?: (id: string) => void };
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  return <div className={`diagnosis-matrix-card ${value.kind}${value.selected ? " is-selected" : ""}`} role="button" aria-label={`Diagnóstico: ${value.title}`}><Handle type="target" position={Position.Left} id="left" className="diagnosis-handle" /><Handle type="source" position={Position.Right} id="right" className="diagnosis-handle" /><Handle type="target" position={Position.Top} id="top" className="diagnosis-handle" /><Handle type="source" position={Position.Bottom} id="bottom" className="diagnosis-handle" /><span>{value.kind === "ambition" ? "Ambição" : "Objeção"}</span><strong>{value.title}</strong><small>{value.coverageCount} interseção(ões)</small>{value.directChildCount > 0 && <button className="diagnosis-hierarchy-toggle nodrag nowheel nopan" aria-label={`${value.hierarchyCollapsed ? "Expandir" : "Recolher"} ${value.directChildCount} filho${value.directChildCount === 1 ? "" : "s"} direto${value.directChildCount === 1 ? "" : "s"}`} aria-pressed={value.hierarchyCollapsed} onPointerDown={stop} onClick={(event) => { stop(event); value.onToggleHierarchy?.(value.diagnosisId); }}>{value.directChildCount}</button>}{value.hiddenRelationCount > 0 && <button className="diagnosis-hidden-relations nodrag nowheel nopan" aria-label={`${value.hiddenRelationCount} relação(ões) oculta(s)`} onPointerDown={stop} onClick={(event) => { stop(event); value.onOpenHiddenRelations?.(value.diagnosisId); }}>↗{value.hiddenRelationCount}</button>}</div>;
}

export function DiagnosisRegionNode() { return <div className="diagnosis-coverage-region" aria-hidden="true" />; }

export function DiagnosisContinuityNode({ data }: NodeProps) {
  const value = data as { from: { x: number; y: number }; to: { x: number; y: number } };
  const elbowY = Math.min(value.from.y, value.to.y) - 10;
  const width = Math.max(value.from.x, value.to.x) + 1;
  const height = Math.max(value.from.y, value.to.y) + 1;
  return <svg className="diagnosis-continuity" width={width} height={height} aria-hidden="true"><polyline points={`${value.from.x},${value.from.y} ${value.from.x},${elbowY} ${value.to.x},${elbowY} ${value.to.x},${value.to.y}`} /></svg>;
}

export const diagnosisNodeTypes = { diagnosisCard: DiagnosisCardNode, diagnosisRegion: DiagnosisRegionNode, diagnosisContinuity: DiagnosisContinuityNode };
