import type { Edge } from "@xyflow/react";
import type { DiagnosticDocument, SemanticRelationType } from "../domain/model";
import type { MatrixPresentation } from "../layout/economicMatrix";
import { routeDiagnosisRelation, type RelationObstacle, type RelationPoint, type RelationSegment } from "../layout/diagnosisRelationRouting";
import { diagnosisVisualRepresentations, type DiagnosisVisualRepresentation, DIAGNOSIS_CARD_PREFIX } from "./diagnosisVisualAdapter";
import type { DiagnosisVisibilityResult } from "../layout/diagnosisVisibility";

export const DIAGNOSIS_RELATION_PREFIX = "diagnosis-relation:";
export type DiagnosisRelationVisualKind = "hierarchy" | SemanticRelationType;
export interface DiagnosisRelationEdgeData extends Record<string, unknown> { relationId: string; kind: DiagnosisRelationVisualKind; route: RelationPoint[]; label: string }

const relationLabel = (kind: DiagnosisRelationVisualKind) => ({ hierarchy: "Hierarquia", hinders: "Dificulta", "contributes-to": "Contribui para", "depends-on": "Depende de" }[kind]);
const edgeId = (kind: DiagnosisRelationVisualKind, id: string) => `${DIAGNOSIS_RELATION_PREFIX}${kind}:${id}`;
const relationStroke = (kind: DiagnosisRelationVisualKind) => ({ hierarchy: "#6539d9", hinders: "#c2413d", "contributes-to": "#198754", "depends-on": "#2779bd" }[kind]);
const active = (document: DiagnosticDocument, id: string) => document.diagnoses.some((item) => item.id === id && !item.deletedAt);

export function selectRelationAnchors(source: DiagnosisVisualRepresentation, target: DiagnosisVisualRepresentation, offset = 0) {
  const sourceCenter = { x: source.bounds.x + source.bounds.width / 2, y: source.bounds.y + source.bounds.height / 2 };
  const targetCenter = { x: target.bounds.x + target.bounds.width / 2, y: target.bounds.y + target.bounds.height / 2 };
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  if (horizontal) {
    const forward = targetCenter.x >= sourceCenter.x;
    return {
      start: { x: forward ? source.bounds.x + source.bounds.width : source.bounds.x, y: sourceCenter.y + offset },
      end: { x: forward ? target.bounds.x : target.bounds.x + target.bounds.width, y: targetCenter.y + offset },
    };
  }
  const down = targetCenter.y >= sourceCenter.y;
  return {
    start: { x: sourceCenter.x + offset, y: down ? source.bounds.y + source.bounds.height : source.bounds.y },
    end: { x: targetCenter.x + offset, y: down ? target.bounds.y : target.bounds.y + target.bounds.height },
  };
}

/** Projects domain relations once, even if future UX-004 supplies several representations per diagnosis. */
export function diagnosisRelationEdges(document: DiagnosticDocument, presentation: MatrixPresentation, visibility?: DiagnosisVisibilityResult): Edge<DiagnosisRelationEdgeData>[] {
  const representations = diagnosisVisualRepresentations(document, presentation, visibility);
  const byDiagnosis = new Map<string, DiagnosisVisualRepresentation>();
  representations.forEach((representation) => { if (!byDiagnosis.has(representation.diagnosisId)) byDiagnosis.set(representation.diagnosisId, representation); });
  const obstacles = representations.map((item) => ({ diagnosisId: item.diagnosisId, left: item.bounds.x, top: item.bounds.y, right: item.bounds.x + item.bounds.width, bottom: item.bounds.y + item.bounds.height }));
  const candidates = [
    ...document.hierarchies.map((relation) => ({ id: `${relation.parentId}:${relation.childId}`, kind: "hierarchy" as const, sourceId: relation.parentId, targetId: relation.childId })),
    ...document.semanticRelations.map((relation) => ({ id: relation.id, kind: relation.type, sourceId: relation.sourceDiagnosisId, targetId: relation.targetDiagnosisId })),
  ].filter((relation) => active(document, relation.sourceId) && active(document, relation.targetId) && byDiagnosis.has(relation.sourceId) && byDiagnosis.has(relation.targetId) && (visibility?.relations.find((item) => item.id === relation.id && item.kind === relation.kind)?.visible ?? true));
  const reserved: RelationSegment[] = [];
  return candidates.sort((a, b) => edgeId(a.kind, a.id).localeCompare(edgeId(b.kind, b.id))).map((relation, index) => {
    const source = byDiagnosis.get(relation.sourceId)!; const target = byDiagnosis.get(relation.targetId)!;
    const parallel = ((index % 5) - 2) * 4;
    const anchors = selectRelationAnchors(source, target, parallel);
    const route = routeDiagnosisRelation(anchors.start, anchors.end, obstacles.filter((item) => item.diagnosisId !== relation.sourceId && item.diagnosisId !== relation.targetId), reserved);
    for (let position = 1; position < route.length; position += 1) reserved.push({ start: route[position - 1], end: route[position] });
    return { id: edgeId(relation.kind, relation.id), source: `${DIAGNOSIS_CARD_PREFIX}${relation.sourceId}`, target: `${DIAGNOSIS_CARD_PREFIX}${relation.targetId}`, type: "diagnosisRelation", selectable: false, focusable: true, data: { relationId: relation.id, kind: relation.kind, route, label: relationLabel(relation.kind) }, ariaLabel: `${relationLabel(relation.kind)}: ${relation.sourceId} para ${relation.targetId}`, markerEnd: { type: "arrowclosed", color: relationStroke(relation.kind) }, style: { stroke: relationStroke(relation.kind) }, zIndex: 3 };
  });
}
