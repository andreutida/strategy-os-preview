import type {
  AuditEventType,
  BusinessUnitAuditProjection,
  CoverageIntersection,
  Diagnosis,
  DiagnosisAuditProjection,
  HierarchyAuditProjection,
  HierarchyRelation,
  OrganizationalUnit,
  SemanticRelation,
  SemanticRelationAuditProjection,
} from "./model";

/**
 * Pure helpers that turn domain records into the serializable projections stored in the history.
 * Projections omit presentation noise (`updatedAt`, empty optional fields) so that two states that
 * only differ by bookkeeping compare as equal and never produce an event.
 */

const cellKey = (cell: CoverageIntersection) => `${cell.measureId}\u0000${cell.organizationalUnitId}`;
const sortedCoverageKeys = (coverage: CoverageIntersection[]) => coverage.map(cellKey).sort();
const sameList = (left: string[] | undefined, right: string[] | undefined) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []);

export function projectDiagnosis(diagnosis: Diagnosis): DiagnosisAuditProjection {
  return {
    entityType: "diagnosis",
    id: diagnosis.id,
    kind: diagnosis.kind,
    title: diagnosis.title,
    ...(diagnosis.description ? { description: diagnosis.description } : {}),
    ...(diagnosis.evidence?.length ? { evidence: [...diagnosis.evidence] } : {}),
    ...(diagnosis.causes?.length ? { causes: [...diagnosis.causes] } : {}),
    ...(diagnosis.consequences?.length ? { consequences: [...diagnosis.consequences] } : {}),
    ...(diagnosis.ambitionOrigin ? { ambitionOrigin: diagnosis.ambitionOrigin } : {}),
    ...(diagnosis.validationStatus ? { validationStatus: diagnosis.validationStatus } : {}),
    coverage: diagnosis.coverage.map((cell) => ({ measureId: cell.measureId, organizationalUnitId: cell.organizationalUnitId })),
    ...(diagnosis.deletedAt ? { deletedAt: diagnosis.deletedAt } : {}),
  };
}

export const projectBusinessUnit = (unit: OrganizationalUnit): BusinessUnitAuditProjection => ({ entityType: "business-unit", id: unit.id, name: unit.name, active: unit.active });
export const projectHierarchy = (relation: HierarchyRelation): HierarchyAuditProjection => ({ entityType: "hierarchy", parentId: relation.parentId, childId: relation.childId });
export const projectSemanticRelation = (relation: SemanticRelation): SemanticRelationAuditProjection => ({
  entityType: "semantic-relation", id: relation.id, sourceDiagnosisId: relation.sourceDiagnosisId, targetDiagnosisId: relation.targetDiagnosisId, type: relation.type,
});

export const hierarchySubjectId = (relation: HierarchyRelation) => `${relation.parentId}:${relation.childId}`;

export interface DiagnosisChangeSet {
  content: boolean;
  coverage: boolean;
  governance: boolean;
}

/** Ambição governance is origin + validation status; a missing status on an Ambição means "pending". Objections have none. */
const governanceOf = (projection: DiagnosisAuditProjection) => projection.kind === "ambition" ? { origin: projection.ambitionOrigin, status: projection.validationStatus ?? "pending" } : {};

export function diagnosisChangeSet(before: DiagnosisAuditProjection, after: DiagnosisAuditProjection): DiagnosisChangeSet {
  const governance = JSON.stringify(governanceOf(before)) !== JSON.stringify(governanceOf(after));
  return {
    content: before.kind !== after.kind || before.title !== after.title || (before.description ?? "") !== (after.description ?? "") || !sameList(before.evidence, after.evidence) || !sameList(before.causes, after.causes) || !sameList(before.consequences, after.consequences) || (before.deletedAt ?? "") !== (after.deletedAt ?? ""),
    coverage: JSON.stringify(sortedCoverageKeys(before.coverage)) !== JSON.stringify(sortedCoverageKeys(after.coverage)),
    governance,
  };
}

/**
 * Event type of one logical change to a diagnosis. A single category maps to its specific type; a mix
 * (for example title + coverage in the same editing session) is `diagnosis.updated`, whose before/after
 * projections always carry the full detail. `undefined` means the net change is empty.
 */
export function classifyDiagnosisChange(before: DiagnosisAuditProjection, after: DiagnosisAuditProjection): AuditEventType | undefined {
  if (!before.deletedAt && after.deletedAt) return "diagnosis.deleted";
  const changes = diagnosisChangeSet(before, after);
  const categories = [changes.content, changes.coverage, changes.governance].filter(Boolean).length;
  if (categories === 0) return undefined;
  if (categories > 1 || changes.content) return "diagnosis.updated";
  return changes.coverage ? "diagnosis.coverage-changed" : "diagnosis.ambition-governance-changed";
}
