import type { CoverageIntersection, DiagnosticDocument, EntityId, SemanticRelationType } from "../domain/model";
import type { MatrixPresentation } from "./economicMatrix";

/**
 * Presentation-only state for the hierarchy cascade. It intentionally lives
 * outside MatrixPresentation because it refers to diagnoses, not economics.
 */
export interface DiagnosisVisibilityPresentation {
  collapsedDiagnosisIds: EntityId[];
}

export const defaultDiagnosisVisibilityPresentation = (): DiagnosisVisibilityPresentation => ({
  collapsedDiagnosisIds: [],
});

export type VisibilityReason =
  | { kind: "hierarchy"; collapsedDiagnosisId: EntityId }
  | { kind: "structure"; structureId: EntityId }
  | { kind: "measure"; measureId: EntityId }
  | { kind: "unit"; organizationalUnitId: EntityId };

export interface VisibleCoverageIntersection extends CoverageIntersection {
  structureId: EntityId;
  visible: boolean;
  reasons: VisibilityReason[];
}

export interface DiagnosisVisibility {
  diagnosisId: EntityId;
  cardVisible: boolean;
  coverage: VisibleCoverageIntersection[];
  visibleCoverage: VisibleCoverageIntersection[];
  hiddenCoverage: VisibleCoverageIntersection[];
  reasons: VisibilityReason[];
  directChildIds: EntityId[];
  /** Direct children hidden specifically by this controller's collapse. */
  collapsedDirectChildIds: EntityId[];
  /** All hierarchical descendants hidden specifically by this controller. */
  collapsedDescendantIds: EntityId[];
}

export interface RelationVisibility {
  id: string;
  kind: "hierarchy" | SemanticRelationType;
  sourceDiagnosisId: EntityId;
  targetDiagnosisId: EntityId;
  visible: boolean;
  hiddenEndpointIds: EntityId[];
}

export interface HiddenRelationIndicator {
  diagnosisId: EntityId;
  relatedDiagnosisId: EntityId;
  relationId: string;
  kind: "hierarchy" | SemanticRelationType;
  direction: "incoming" | "outgoing";
  reasons: VisibilityReason[];
}

export interface DiagnosisVisibilityResult {
  diagnoses: DiagnosisVisibility[];
  relations: RelationVisibility[];
  visibleDiagnosisIds: EntityId[];
  hiddenDiagnosisIdsByMeasure: Record<EntityId, EntityId[]>;
  hiddenDiagnosisIdsByStructure: Record<EntityId, EntityId[]>;
  hiddenRelationIndicators: HiddenRelationIndicator[];
}

export interface DiagnosisRevealPlan {
  diagnosisId: EntityId;
  canReveal: boolean;
  /** Only collapsed ancestors on the direct hierarchy path are opened. */
  expandDiagnosisIds: EntityId[];
  /** Exactly one least-cost visible coverage path is opened, when needed. */
  expandMeasureIds: EntityId[];
  expandStructureIds: EntityId[];
}

const coverageKey = (coverage: CoverageIntersection) => `${coverage.measureId}\u0000${coverage.organizationalUnitId}`;
const uniqueSorted = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => a.localeCompare(b));
const reasonKey = (reason: VisibilityReason) => reason.kind === "hierarchy"
  ? `${reason.kind}:${reason.collapsedDiagnosisId}`
  : reason.kind === "structure"
    ? `${reason.kind}:${reason.structureId}`
    : reason.kind === "measure"
      ? `${reason.kind}:${reason.measureId}`
      : `${reason.kind}:${reason.organizationalUnitId}`;
const uniqueReasons = (reasons: VisibilityReason[]) => {
  const seen = new Set<string>();
  return reasons.filter((reason) => !seen.has(reasonKey(reason)) && (seen.add(reasonKey(reason)), true));
};

function activeDiagnosisIds(document: DiagnosticDocument) {
  return new Set(document.diagnoses.filter((item) => !item.deletedAt).map((item) => item.id));
}

function hierarchyIndex(document: DiagnosticDocument, activeIds: Set<EntityId>) {
  const children = new Map<EntityId, EntityId[]>();
  const parent = new Map<EntityId, EntityId>();
  document.hierarchies.forEach((relation) => {
    if (!activeIds.has(relation.parentId) || !activeIds.has(relation.childId)) return;
    const values = children.get(relation.parentId) ?? [];
    values.push(relation.childId);
    children.set(relation.parentId, values);
    parent.set(relation.childId, relation.parentId);
  });
  children.forEach((values, id) => children.set(id, uniqueSorted(values)));
  return { children, parent };
}

function descendantsOf(root: EntityId, children: Map<EntityId, EntityId[]>) {
  const discovered: EntityId[] = [];
  const queue = [...(children.get(root) ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    discovered.push(next);
    queue.push(...(children.get(next) ?? []));
  }
  return uniqueSorted(discovered);
}

/**
 * Resolves visibility from immutable domain data and presentation state. This
 * does not calculate card coordinates or mutate any persisted collection.
 */
export function resolveDiagnosisVisibility(
  document: DiagnosticDocument,
  matrix: MatrixPresentation,
  presentation: DiagnosisVisibilityPresentation = defaultDiagnosisVisibilityPresentation(),
): DiagnosisVisibilityResult {
  const activeIds = activeDiagnosisIds(document);
  const activeUnits = new Set(document.organizationalUnits.filter((item) => item.active).map((item) => item.id));
  const structureByMeasure = new Map(document.measures.map((item) => [item.id, item.structureId]));
  const collapsedStructures = new Set(matrix.collapsedStructureIds);
  const collapsedMeasures = new Set(matrix.collapsedMeasureIds);
  const collapsedControllers = new Set(presentation.collapsedDiagnosisIds.filter((id) => activeIds.has(id)));
  const { children, parent } = hierarchyIndex(document, activeIds);
  const hiddenBy = new Map<EntityId, EntityId[]>();
  collapsedControllers.forEach((controllerId) => descendantsOf(controllerId, children).forEach((descendantId) => {
    hiddenBy.set(descendantId, uniqueSorted([...(hiddenBy.get(descendantId) ?? []), controllerId]));
  }));

  const diagnoses = document.diagnoses
    .filter((item) => activeIds.has(item.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((diagnosis): DiagnosisVisibility => {
      const seenCoverage = new Set<string>();
      const coverage = diagnosis.coverage
        .filter((cell) => !seenCoverage.has(coverageKey(cell)) && (seenCoverage.add(coverageKey(cell)), true))
        .map((cell): VisibleCoverageIntersection => {
          const structureId = structureByMeasure.get(cell.measureId) ?? "";
          const reasons: VisibilityReason[] = [];
          if (!structureId || collapsedStructures.has(structureId)) reasons.push({ kind: "structure", structureId });
          if (collapsedMeasures.has(cell.measureId)) reasons.push({ kind: "measure", measureId: cell.measureId });
          if (!activeUnits.has(cell.organizationalUnitId)) reasons.push({ kind: "unit", organizationalUnitId: cell.organizationalUnitId });
          return { ...cell, structureId, visible: reasons.length === 0, reasons: uniqueReasons(reasons) };
        });
      const hierarchyReasons = (hiddenBy.get(diagnosis.id) ?? []).map((collapsedDiagnosisId): VisibilityReason => ({ kind: "hierarchy", collapsedDiagnosisId }));
      const economicVisible = coverage.filter((cell) => cell.visible);
      const cardVisible = hierarchyReasons.length === 0 && economicVisible.length > 0;
      const hiddenCoverage = coverage.filter((cell) => !cell.visible);
      // Keep simultaneous causes. A branch may be collapsed while part (or all)
      // of the same diagnosis is also hidden economically; callers need both to
      // explain a reveal action without guessing.
      const reasons = uniqueReasons([
        ...hierarchyReasons,
        ...hiddenCoverage.flatMap((cell) => cell.reasons),
      ]);
      return {
        diagnosisId: diagnosis.id,
        cardVisible,
        coverage,
        visibleCoverage: cardVisible ? economicVisible : [],
        hiddenCoverage,
        reasons,
        directChildIds: children.get(diagnosis.id) ?? [],
        collapsedDirectChildIds: collapsedControllers.has(diagnosis.id)
          ? (children.get(diagnosis.id) ?? [])
          : [],
        collapsedDescendantIds: collapsedControllers.has(diagnosis.id)
          ? descendantsOf(diagnosis.id, children)
          : [],
      };
    });
  const byId = new Map(diagnoses.map((item) => [item.diagnosisId, item]));
  const hiddenDiagnosisIdsByMeasure: Record<string, string[]> = {};
  const hiddenDiagnosisIdsByStructure: Record<string, string[]> = {};
  diagnoses.forEach((diagnosis) => diagnosis.coverage.forEach((cell) => {
    if (cell.reasons.some((reason) => reason.kind === "measure")) {
      hiddenDiagnosisIdsByMeasure[cell.measureId] = uniqueSorted([...(hiddenDiagnosisIdsByMeasure[cell.measureId] ?? []), diagnosis.diagnosisId]);
    }
    if (cell.reasons.some((reason) => reason.kind === "structure")) {
      hiddenDiagnosisIdsByStructure[cell.structureId] = uniqueSorted([...(hiddenDiagnosisIdsByStructure[cell.structureId] ?? []), diagnosis.diagnosisId]);
    }
  }));
  const relations: RelationVisibility[] = [
    ...document.hierarchies.map((relation) => ({ id: `${relation.parentId}:${relation.childId}`, kind: "hierarchy" as const, sourceDiagnosisId: relation.parentId, targetDiagnosisId: relation.childId })),
    ...document.semanticRelations.map((relation) => ({ id: relation.id, kind: relation.type, sourceDiagnosisId: relation.sourceDiagnosisId, targetDiagnosisId: relation.targetDiagnosisId })),
  ].filter((relation) => byId.has(relation.sourceDiagnosisId) && byId.has(relation.targetDiagnosisId))
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
    .map((relation) => {
      const hiddenEndpointIds = [relation.sourceDiagnosisId, relation.targetDiagnosisId].filter((id) => !byId.get(id)!.cardVisible);
      return { ...relation, visible: hiddenEndpointIds.length === 0, hiddenEndpointIds };
    });
  const hiddenRelationIndicators = relations.flatMap((relation) => {
    if (relation.visible) return [];
    return [relation.sourceDiagnosisId, relation.targetDiagnosisId].flatMap((diagnosisId) => {
      const relatedDiagnosisId = diagnosisId === relation.sourceDiagnosisId ? relation.targetDiagnosisId : relation.sourceDiagnosisId;
      if (!byId.get(diagnosisId)!.cardVisible || byId.get(relatedDiagnosisId)!.cardVisible) return [];
      return [{ diagnosisId, relatedDiagnosisId, relationId: relation.id, kind: relation.kind, direction: diagnosisId === relation.sourceDiagnosisId ? "outgoing" as const : "incoming" as const, reasons: byId.get(relatedDiagnosisId)!.reasons }];
    });
  });
  void parent; // Used by planDiagnosisReveal; keeping hierarchy construction centralized here is intentional.
  return { diagnoses, relations, visibleDiagnosisIds: diagnoses.filter((item) => item.cardVisible).map((item) => item.diagnosisId), hiddenDiagnosisIdsByMeasure, hiddenDiagnosisIdsByStructure, hiddenRelationIndicators };
}

/**
 * Produces the smallest deterministic expansion set: collapsed ancestors on
 * the direct hierarchy path plus one least-cost visible coverage intersection.
 * Ties use measure ID then organizational-unit ID, making the result stable.
 */
export function planDiagnosisReveal(
  document: DiagnosticDocument,
  matrix: MatrixPresentation,
  presentation: DiagnosisVisibilityPresentation,
  diagnosisId: EntityId,
): DiagnosisRevealPlan {
  const diagnosis = document.diagnoses.find((item) => item.id === diagnosisId && !item.deletedAt);
  if (!diagnosis) return { diagnosisId, canReveal: false, expandDiagnosisIds: [], expandMeasureIds: [], expandStructureIds: [] };
  const activeIds = activeDiagnosisIds(document);
  const { parent } = hierarchyIndex(document, activeIds);
  const collapsedControllers = new Set(presentation.collapsedDiagnosisIds.filter((id) => activeIds.has(id)));
  const expandDiagnosisIds: string[] = [];
  let current = parent.get(diagnosisId);
  while (current) {
    if (collapsedControllers.has(current)) expandDiagnosisIds.push(current);
    current = parent.get(current);
  }
  const activeUnits = new Set(document.organizationalUnits.filter((item) => item.active).map((item) => item.id));
  const structureByMeasure = new Map(document.measures.map((item) => [item.id, item.structureId]));
  const candidates = diagnosis.coverage
    .map((cell) => ({ ...cell, structureId: structureByMeasure.get(cell.measureId) }))
    .filter((cell): cell is CoverageIntersection & { structureId: string } => Boolean(cell.structureId) && activeUnits.has(cell.organizationalUnitId))
    .map((cell) => ({
      ...cell,
      cost: (matrix.collapsedStructureIds.includes(cell.structureId) ? 1 : 0) + (matrix.collapsedMeasureIds.includes(cell.measureId) ? 1 : 0),
    }))
    .sort((a, b) => a.cost - b.cost || a.measureId.localeCompare(b.measureId) || a.organizationalUnitId.localeCompare(b.organizationalUnitId));
  const chosen = candidates[0];
  if (!chosen) return { diagnosisId, canReveal: false, expandDiagnosisIds: uniqueSorted(expandDiagnosisIds), expandMeasureIds: [], expandStructureIds: [] };
  return {
    diagnosisId,
    canReveal: true,
    expandDiagnosisIds: uniqueSorted(expandDiagnosisIds),
    expandMeasureIds: matrix.collapsedMeasureIds.includes(chosen.measureId) ? [chosen.measureId] : [],
    expandStructureIds: matrix.collapsedStructureIds.includes(chosen.structureId) ? [chosen.structureId] : [],
  };
}
