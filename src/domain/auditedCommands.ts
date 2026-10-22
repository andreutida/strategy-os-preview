import {
  createDiagnosis,
  createOrganizationalUnit,
  createSemanticRelation,
  deactivateBusinessUnit,
  deleteDiagnosis,
  deleteSemanticRelation,
  promoteDiagnosisDraft,
  reactivateBusinessUnit,
  removeHierarchy,
  setHierarchy,
  transferBusinessUnit,
  updateDiagnosis,
  updateOrganizationalUnit,
  updateSemanticRelation,
} from "./commands";
import { classifyDiagnosisChange, hierarchySubjectId, projectBusinessUnit, projectDiagnosis, projectHierarchy, projectSemanticRelation } from "./auditProjections";
import { appendAuditEvents, type AuditEventDraft, type AuditOperationContext } from "./auditTransitions";
import { DomainValidationError, type Diagnosis, type DiagnosticDocument, type EntityId, type HierarchyRelation, type OrganizationalUnit, type SemanticRelation } from "./model";

export type { AuditOperationContext } from "./auditTransitions";

/** Mirrors the validated metadata cap; beyond it the per-diagnosis events already carry the detail. */
const MAX_AFFECTED_DIAGNOSES = 1_000;
const DIAGNOSIS_DELETED = "diagnosis-deleted";

export interface AuditDerivationOptions {
  /** Declares that removing `sourceUnitId` is the transfer of its coverage to `destinationUnitId`. */
  transfer?: { sourceUnitId: EntityId; destinationUnitId: EntityId };
}

const unaudited = (code: string, message: string) => new DomainValidationError([{ code, message }]);
const businessUnits = (document: DiagnosticDocument) => new Map(document.organizationalUnits.filter((unit) => unit.kind === "business-unit").map((unit) => [unit.id, unit]));

/**
 * Derives the events of a completed domain transition by comparing the exact before/after snapshots.
 * Because the events are computed from the very document the command produced, they cannot disagree with it.
 * Groups, Estruturas, Medidas, drafts and visual state are intentionally not audited (docs/DIAGNOSTICO.md §7).
 */
export function deriveAuditEvents(before: DiagnosticDocument, after: DiagnosticDocument, options: AuditDerivationOptions = {}): AuditEventDraft[] {
  const events: AuditEventDraft[] = [];
  const deletedNow = new Set<EntityId>();
  const diagnosesBefore = new Map(before.diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]));
  const diagnosesAfter = new Map(after.diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]));
  diagnosesBefore.forEach((diagnosis, id) => { if (!diagnosesAfter.has(id)) throw unaudited("unaudited-diagnosis-removal", `O diagnóstico ${diagnosis.id} foi removido sem trilha de histórico.`); });
  after.diagnoses.forEach((diagnosis) => {
    const previous = diagnosesBefore.get(diagnosis.id);
    const subjects = [{ kind: "diagnosis" as const, id: diagnosis.id }];
    if (!previous) { events.push({ type: "diagnosis.created", subjects, after: projectDiagnosis(diagnosis) }); return; }
    const beforeProjection = projectDiagnosis(previous);
    const afterProjection = projectDiagnosis(diagnosis);
    const type = classifyDiagnosisChange(beforeProjection, afterProjection);
    if (!type) return;
    if (type === "diagnosis.deleted") { deletedNow.add(diagnosis.id); events.push({ type, subjects, before: beforeProjection }); return; }
    events.push({ type, subjects, before: beforeProjection, after: afterProjection });
  });

  // Business units: Grupo is protected and has no trail of its own.
  const unitsBefore = businessUnits(before);
  const unitsAfter = businessUnits(after);
  const unitEvents: AuditEventDraft[] = [];
  unitsAfter.forEach((unit, id) => {
    const previous = unitsBefore.get(id);
    const subjects = [{ kind: "business-unit" as const, id }];
    if (!previous) { unitEvents.push({ type: "business-unit.created", subjects, after: projectBusinessUnit(unit) }); return; }
    if (previous.name !== unit.name) unitEvents.push({ type: "business-unit.renamed", subjects, before: projectBusinessUnit(previous), after: projectBusinessUnit(unit) });
    if (previous.active !== unit.active) unitEvents.push({ type: unit.active ? "business-unit.reactivated" : "business-unit.deactivated", subjects, before: projectBusinessUnit(previous), after: projectBusinessUnit(unit) });
  });
  unitsBefore.forEach((unit, id) => {
    if (unitsAfter.has(id)) return;
    const destination = options.transfer?.sourceUnitId === id ? unitsAfter.get(options.transfer.destinationUnitId) : undefined;
    if (!destination) throw unaudited("unaudited-business-unit-removal", `A unidade ${unit.id} foi removida sem transferência registrada.`);
    const affected = before.diagnoses.filter((diagnosis) => diagnosis.coverage.some((cell) => cell.organizationalUnitId === id)).map((diagnosis) => diagnosis.id);
    unitEvents.push({
      type: "business-unit.coverage-transferred",
      subjects: [{ kind: "business-unit", id }, { kind: "business-unit", id: destination.id }],
      before: projectBusinessUnit(unit),
      after: projectBusinessUnit(destination),
      ...(affected.length && affected.length <= MAX_AFFECTED_DIAGNOSES ? { metadata: { affectedDiagnosisIds: affected } } : {}),
    });
  });

  // Hierarchy: one superior per child, so the child identifies the slot that was created, replaced or freed.
  const parentsBefore = new Map(before.hierarchies.map((relation) => [relation.childId, relation]));
  const parentsAfter = new Map(after.hierarchies.map((relation) => [relation.childId, relation]));
  const hierarchyEvents: AuditEventDraft[] = [];
  const hierarchySubjects = (...relations: HierarchyRelation[]) => {
    const ids = [...new Set(relations.flatMap((relation) => [relation.parentId, relation.childId]))];
    return [...ids.map((id) => ({ kind: "diagnosis" as const, id })), { kind: "hierarchy" as const, id: hierarchySubjectId(relations[relations.length - 1]) }];
  };
  const endpointDeleted = (...ids: EntityId[]) => ids.some((id) => deletedNow.has(id));
  after.hierarchies.forEach((relation) => {
    const previous = parentsBefore.get(relation.childId);
    if (!previous) hierarchyEvents.push({ type: "hierarchy.created", subjects: hierarchySubjects(relation), after: projectHierarchy(relation) });
    else if (previous.parentId !== relation.parentId) hierarchyEvents.push({ type: "hierarchy.parent-replaced", subjects: hierarchySubjects(previous, relation), before: projectHierarchy(previous), after: projectHierarchy(relation) });
  });
  before.hierarchies.forEach((relation) => {
    if (parentsAfter.has(relation.childId)) return;
    hierarchyEvents.push({ type: "hierarchy.removed", subjects: hierarchySubjects(relation), before: projectHierarchy(relation), ...(endpointDeleted(relation.parentId, relation.childId) ? { metadata: { reason: DIAGNOSIS_DELETED } } : {}) });
  });

  // Semantic associations are identified by their stable ID.
  const semanticBefore = new Map(before.semanticRelations.map((relation) => [relation.id, relation]));
  const semanticAfter = new Map(after.semanticRelations.map((relation) => [relation.id, relation]));
  const semanticEvents: AuditEventDraft[] = [];
  const semanticSubjects = (relation: SemanticRelation) => [{ kind: "diagnosis" as const, id: relation.sourceDiagnosisId }, { kind: "diagnosis" as const, id: relation.targetDiagnosisId }, { kind: "semantic-relation" as const, id: relation.id }];
  const semanticDeleted = (relation: SemanticRelation): AuditEventDraft => ({ type: "semantic.deleted", subjects: semanticSubjects(relation), before: projectSemanticRelation(relation), ...(endpointDeleted(relation.sourceDiagnosisId, relation.targetDiagnosisId) ? { metadata: { reason: DIAGNOSIS_DELETED } } : {}) });
  const semanticCreated = (relation: SemanticRelation): AuditEventDraft => ({ type: "semantic.created", subjects: semanticSubjects(relation), after: projectSemanticRelation(relation) });
  after.semanticRelations.forEach((relation) => {
    const previous = semanticBefore.get(relation.id);
    if (!previous) { semanticEvents.push(semanticCreated(relation)); return; }
    if (previous.sourceDiagnosisId !== relation.sourceDiagnosisId || previous.targetDiagnosisId !== relation.targetDiagnosisId) {
      // Different endpoints are a different association, even if the stable ID is reused by the caller.
      semanticEvents.push(semanticDeleted(previous), semanticCreated(relation));
    } else if (previous.type !== relation.type) {
      semanticEvents.push({ type: "semantic.type-changed", subjects: semanticSubjects(relation), before: projectSemanticRelation(previous), after: projectSemanticRelation(relation) });
    }
  });
  before.semanticRelations.forEach((relation) => { if (!semanticAfter.has(relation.id)) semanticEvents.push(semanticDeleted(relation)); });

  return [...unitEvents, ...events, ...hierarchyEvents, ...semanticEvents];
}

/**
 * Runs an existing domain command and records its events in the same snapshot. The command is the only
 * place that mutates the domain; if it or the final validation throws, nothing is returned and no event
 * exists. Persisting the returned document is a single write, so state and history are saved together.
 */
export function runAuditedOperation(document: DiagnosticDocument, context: AuditOperationContext, command: (document: DiagnosticDocument) => DiagnosticDocument, options: AuditDerivationOptions = {}): DiagnosticDocument {
  const after = command(document);
  return appendAuditEvents(after, deriveAuditEvents(document, after, options), context);
}

// Diagnoses
export const auditedCreateDiagnosis = (document: DiagnosticDocument, diagnosis: Diagnosis, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => createDiagnosis(source, diagnosis));
export const auditedPromoteDiagnosisDraft = (document: DiagnosticDocument, draftId: EntityId, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => promoteDiagnosisDraft(source, draftId));
export const auditedUpdateDiagnosis = (document: DiagnosticDocument, diagnosis: Diagnosis, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => updateDiagnosis(source, diagnosis));
export const auditedDeleteDiagnosis = (document: DiagnosticDocument, diagnosisId: EntityId, deletedAt: string, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => deleteDiagnosis(source, diagnosisId, deletedAt));

// Relations
export const auditedSetHierarchy = (document: DiagnosticDocument, relation: HierarchyRelation, context: AuditOperationContext, options: { replaceExistingParent?: boolean } = {}) => runAuditedOperation(document, context, (source) => setHierarchy(source, relation, options));
export const auditedRemoveHierarchy = (document: DiagnosticDocument, relation: HierarchyRelation, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => removeHierarchy(source, relation));
export const auditedCreateSemanticRelation = (document: DiagnosticDocument, relation: SemanticRelation, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => createSemanticRelation(source, relation));
export const auditedUpdateSemanticRelation = (document: DiagnosticDocument, relation: SemanticRelation, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => updateSemanticRelation(source, relation));
export const auditedDeleteSemanticRelation = (document: DiagnosticDocument, relationId: EntityId, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => deleteSemanticRelation(source, relationId));

// Business units
export const auditedCreateOrganizationalUnit = (document: DiagnosticDocument, unit: OrganizationalUnit, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => createOrganizationalUnit(source, unit));
export const auditedUpdateOrganizationalUnit = (document: DiagnosticDocument, unit: OrganizationalUnit, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => updateOrganizationalUnit(source, unit));
export const auditedDeactivateBusinessUnit = (document: DiagnosticDocument, unitId: EntityId, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => deactivateBusinessUnit(source, unitId));
export const auditedReactivateBusinessUnit = (document: DiagnosticDocument, unitId: EntityId, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => reactivateBusinessUnit(source, unitId));
export const auditedTransferBusinessUnit = (document: DiagnosticDocument, sourceUnitId: EntityId, destinationUnitId: EntityId, context: AuditOperationContext) => runAuditedOperation(document, context, (source) => transferBusinessUnit(source, sourceUnitId, destinationUnitId), { transfer: { sourceUnitId, destinationUnitId } });
