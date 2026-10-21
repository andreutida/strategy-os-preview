import { DomainValidationError, type CoverageIntersection, type Diagnosis, type DiagnosisDraft, type DiagnosticDocument, type EntityId, type HierarchyRelation, type OrganizationalUnit, type SemanticRelation } from "./model";
import { coverageKey, validateDiagnosticDocument } from "./validation";

const clone = <T>(value: T): T => structuredClone(value);
const assertValid = (document: DiagnosticDocument) => {
  const issues = validateDiagnosticDocument(document, { allowLegacyPendingAmbitions: true });
  if (issues.length) throw new DomainValidationError(issues);
  return document;
};

const assertNewAmbitionOrigin = (diagnosis: Diagnosis, canKeepLegacyPending = false) => {
  const mayKeepPending = canKeepLegacyPending && diagnosis.kind === "ambition" && !diagnosis.ambitionOrigin && diagnosis.validationStatus === "pending";
  if (diagnosis.kind === "ambition" && !diagnosis.ambitionOrigin && !mayKeepPending) throw new DomainValidationError([{ code: "missing-ambition-origin", message: "Novas Ambições precisam informar a origem." }]);
};

export function createDiagnosis(document: DiagnosticDocument, diagnosis: Diagnosis) {
  assertNewAmbitionOrigin(diagnosis);
  const next = clone(document);
  if ([...next.diagnoses, ...(next.diagnosisDrafts ?? [])].some((item) => item.id === diagnosis.id)) throw new DomainValidationError([{ code: "duplicate-diagnosis-id", message: "O ID do diagnóstico já está em uso." }]);
  next.diagnoses.push(diagnosis);
  return assertValid(next);
}
export function createDiagnosisDraft(document: DiagnosticDocument, draft: DiagnosisDraft) { const next = clone(document); if ([...next.diagnoses, ...(next.diagnosisDrafts ?? [])].some((item) => item.id === draft.id)) throw new DomainValidationError([{ code: "duplicate-diagnosis-id", message: "O ID do diagnóstico já está em uso." }]); (next.diagnosisDrafts ??= []).push(draft); return assertValid(next); }
export function updateDiagnosisDraft(document: DiagnosticDocument, draft: DiagnosisDraft) { const next = clone(document); const current = (next.diagnosisDrafts ?? []).find((item) => item.id === draft.id); if (!current || current.deletedAt) throw new DomainValidationError([{ code: "missing-diagnosis-draft", message: "O rascunho não existe." }]); next.diagnosisDrafts = (next.diagnosisDrafts ?? []).map((item) => item.id === draft.id ? { ...draft, id: item.id, createdAt: item.createdAt } : item); return assertValid(next); }
export function promoteDiagnosisDraft(document: DiagnosticDocument, draftId: EntityId) { const draft = (document.diagnosisDrafts ?? []).find((item) => item.id === draftId && !item.deletedAt); if (!draft) throw new DomainValidationError([{ code: "missing-diagnosis-draft", message: "O rascunho não existe." }]); const diagnosis: Diagnosis = { id: draft.id, kind: draft.kind!, title: draft.title!, description: draft.description, evidence: draft.evidence, causes: draft.causes, consequences: draft.consequences, ambitionOrigin: draft.ambitionOrigin, validationStatus: draft.validationStatus, coverage: draft.coverage ?? [], createdAt: draft.createdAt, updatedAt: draft.updatedAt }; const next = clone(document); next.diagnosisDrafts = (next.diagnosisDrafts ?? []).filter((item) => item.id !== draftId); next.diagnoses.push(diagnosis); assertNewAmbitionOrigin(diagnosis); return assertValid(next); }
export function deleteDiagnosisDraft(document: DiagnosticDocument, draftId: EntityId, deletedAt: string) { const next = clone(document); next.diagnosisDrafts = (next.diagnosisDrafts ?? []).map((item) => item.id === draftId ? { ...item, deletedAt, updatedAt: deletedAt } : item); return assertValid(next); }

export function createEconomicStructure(document: DiagnosticDocument, structure: import("./model").EconomicStructure) { const next = clone(document); next.structures.push(structure); return assertValid(next); }
export function createEconomicMeasure(document: DiagnosticDocument, measure: import("./model").EconomicMeasure) { const next = clone(document); next.measures.push(measure); return assertValid(next); }
export function createOrganizationalUnit(document: DiagnosticDocument, unit: import("./model").OrganizationalUnit) { const next = clone(document); next.organizationalUnits.push(unit); return assertValid(next); }
export function updateEconomicStructure(document: DiagnosticDocument, value: import("./model").EconomicStructure) { const next = clone(document); if (!next.structures.some((item) => item.id === value.id)) throw new DomainValidationError([{ code: "missing-structure", message: "A estrutura não existe." }]); next.structures = next.structures.map((item) => item.id === value.id ? value : item); return assertValid(next); }
export function updateEconomicMeasure(document: DiagnosticDocument, value: import("./model").EconomicMeasure) { const next = clone(document); if (!next.measures.some((item) => item.id === value.id)) throw new DomainValidationError([{ code: "missing-measure", message: "A medida não existe." }]); next.measures = next.measures.map((item) => item.id === value.id ? value : item); return assertValid(next); }
export function updateOrganizationalUnit(document: DiagnosticDocument, value: OrganizationalUnit) { const next = clone(document); const current = next.organizationalUnits.find((item) => item.id === value.id); if (!current) throw new DomainValidationError([{ code: "missing-organizational-unit", message: "A unidade não existe." }]); if (current.kind === "group" && value.kind !== "group") throw new DomainValidationError([{ code: "group-kind-immutable", message: "Grupo não pode ser convertido em BU." }]); next.organizationalUnits = next.organizationalUnits.map((item) => item.id === value.id ? value : item); return assertValid(next); }

/** Updates an active diagnosis without allowing a valid Ambição to lose its origin. */
export function updateDiagnosis(document: DiagnosticDocument, diagnosis: Diagnosis) {
  const current = document.diagnoses.find((item) => item.id === diagnosis.id);
  if (!current) throw new DomainValidationError([{ code: "missing-diagnosis", message: "O diagnóstico a editar não existe." }]);
  if (current.deletedAt) throw new DomainValidationError([{ code: "inactive-diagnosis", message: "O diagnóstico excluído precisa ser recuperado antes de ser editado." }]);
  const canKeepLegacyPending = current.kind === "ambition" && !current.ambitionOrigin && current.validationStatus === "pending";
  assertNewAmbitionOrigin(diagnosis, canKeepLegacyPending);
  const next = clone(document);
  next.diagnoses = next.diagnoses.map((item) => item.id === diagnosis.id ? diagnosis : item);
  return assertValid(next);
}

function assertActiveDiagnosisEndpoints(document: DiagnosticDocument, ids: EntityId[], relationKind: "hierarchy" | "semantic") {
  if (ids.some((id) => !document.diagnoses.some((diagnosis) => diagnosis.id === id && !diagnosis.deletedAt))) {
    throw new DomainValidationError([{ code: relationKind === "hierarchy" ? "inactive-hierarchy-endpoint" : "inactive-semantic-endpoint", message: relationKind === "hierarchy" ? "Hierarquias ativas não podem referenciar diagnósticos inexistentes ou excluídos." : "Relações ativas não podem referenciar diagnósticos inexistentes ou excluídos." }]);
  }
}

/** Creates or preserves a superior → child relation. Parent replacement always requires an explicit option. */
export function setHierarchy(document: DiagnosticDocument, relation: HierarchyRelation, options: { replaceExistingParent?: boolean } = {}) {
  const next = clone(document);
  assertActiveDiagnosisEndpoints(next, [relation.parentId, relation.childId], "hierarchy");
  if (relation.parentId === relation.childId) throw new DomainValidationError([{ code: "hierarchy-self-reference", message: "Um diagnóstico não pode ser superior de si próprio." }]);
  const current = next.hierarchies.find((entry) => entry.childId === relation.childId);
  if (current && current.parentId !== relation.parentId && !options.replaceExistingParent) throw new DomainValidationError([{ code: "hierarchy-parent-replacement-required", message: "A substituição de superior exige confirmação." }]);
  next.hierarchies = next.hierarchies.filter((entry) => entry.childId !== relation.childId);
  next.hierarchies.push({ parentId: relation.parentId, childId: relation.childId });
  return assertValid(next);
}

/** Explicit name for clients that are creating, rather than replacing, a hierarchy. */
export function createHierarchy(document: DiagnosticDocument, relation: HierarchyRelation, options: { replaceExistingParent?: boolean } = {}) {
  return setHierarchy(document, relation, options);
}

/** Removes exactly one superior → child relation and leaves both diagnoses and all other relations intact. */
export function removeHierarchy(document: DiagnosticDocument, relation: HierarchyRelation) {
  const next = clone(document);
  const exists = next.hierarchies.some((entry) => entry.parentId === relation.parentId && entry.childId === relation.childId);
  if (!exists) throw new DomainValidationError([{ code: "missing-hierarchy", message: "A relação hierárquica não existe." }]);
  next.hierarchies = next.hierarchies.filter((entry) => !(entry.parentId === relation.parentId && entry.childId === relation.childId));
  return assertValid(next);
}

export function createSemanticRelation(document: DiagnosticDocument, relation: SemanticRelation) {
  const next = clone(document);
  assertActiveDiagnosisEndpoints(next, [relation.sourceDiagnosisId, relation.targetDiagnosisId], "semantic");
  next.semanticRelations.push({ ...relation });
  return assertValid(next);
}

/** Updates only an existing semantic relation; its stable ID is the lookup key and is never replaced. */
export function updateSemanticRelation(document: DiagnosticDocument, relation: SemanticRelation) {
  const next = clone(document);
  const current = next.semanticRelations.find((entry) => entry.id === relation.id);
  if (!current) throw new DomainValidationError([{ code: "missing-semantic-relation", message: "A relação semântica não existe." }]);
  assertActiveDiagnosisEndpoints(next, [relation.sourceDiagnosisId, relation.targetDiagnosisId], "semantic");
  next.semanticRelations = next.semanticRelations.map((entry) => entry.id === current.id ? { ...relation, id: current.id } : entry);
  return assertValid(next);
}

export function deleteSemanticRelation(document: DiagnosticDocument, relationId: EntityId) {
  const next = clone(document);
  if (!next.semanticRelations.some((entry) => entry.id === relationId)) throw new DomainValidationError([{ code: "missing-semantic-relation", message: "A relação semântica não existe." }]);
  next.semanticRelations = next.semanticRelations.filter((entry) => entry.id !== relationId);
  return assertValid(next);
}

export function deleteDiagnosis(document: DiagnosticDocument, diagnosisId: EntityId, deletedAt: string) {
  const next = clone(document);
  const diagnosis = next.diagnoses.find((item) => item.id === diagnosisId);
  if (!diagnosis || diagnosis.deletedAt) return next;
  // Keep the record for future recovery/history; active relations are removed.
  next.diagnoses = next.diagnoses.map((diagnosis) => diagnosis.id === diagnosisId ? { ...diagnosis, deletedAt, updatedAt: deletedAt } : diagnosis);
  next.hierarchies = next.hierarchies.filter((relation) => relation.parentId !== diagnosisId && relation.childId !== diagnosisId);
  next.semanticRelations = next.semanticRelations.filter((relation) => relation.sourceDiagnosisId !== diagnosisId && relation.targetDiagnosisId !== diagnosisId);
  next.legacyReviewItems.push({ id: `deletion:${diagnosisId}:${deletedAt}`, reason: "diagnosis-deleted", raw: { diagnosisId, deletedAt } });
  return assertValid(next);
}

export function deleteMeasure(document: DiagnosticDocument, measureId: EntityId) {
  const next = clone(document);
  if (next.diagnoses.some((diagnosis) => diagnosis.coverage.some((cell) => cell.measureId === measureId))) throw new DomainValidationError([{ code: "measure-has-diagnoses", message: "Não é possível excluir uma medida com diagnósticos associados." }]);
  next.measures = next.measures.filter((measure) => measure.id !== measureId);
  return assertValid(next);
}

export function transferStructureMeasuresAndDelete(document: DiagnosticDocument, structureId: EntityId, destinationStructureId: EntityId) {
  const next = clone(document);
  if (structureId === destinationStructureId) throw new DomainValidationError([{ code: "same-structure-transfer", message: "Escolha outra estrutura para transferência." }]);
  if (!next.structures.some((structure) => structure.id === structureId) || !next.structures.some((structure) => structure.id === destinationStructureId)) throw new DomainValidationError([{ code: "missing-structure", message: "A estrutura de origem ou destino não existe." }]);
  next.measures = next.measures.map((measure) => measure.structureId === structureId ? { ...measure, structureId: destinationStructureId } : measure);
  next.structures = next.structures.filter((structure) => structure.id !== structureId);
  return assertValid(next);
}

export function deleteEmptyStructure(document: DiagnosticDocument, structureId: EntityId) { const next = clone(document); if (next.measures.some((item) => item.structureId === structureId)) throw new DomainValidationError([{ code: "structure-has-measures", message: "Transfira as Medidas antes de excluir esta Estrutura." }]); next.structures = next.structures.filter((item) => item.id !== structureId); return assertValid(next); }

export function transferBusinessUnit(document: DiagnosticDocument, sourceUnitId: EntityId, destinationUnitId: EntityId) {
  const next = clone(document);
  const source = next.organizationalUnits.find((unit) => unit.id === sourceUnitId);
  const destination = next.organizationalUnits.find((unit) => unit.id === destinationUnitId);
  if (!source || !destination || source.kind !== "business-unit" || destination.kind !== "business-unit" || sourceUnitId === destinationUnitId) throw new DomainValidationError([{ code: "invalid-business-unit-transfer", message: "A transferência exige duas unidades de negócio distintas." }]);
  next.diagnoses = next.diagnoses.map((diagnosis) => {
    const seen = new Set<string>();
    const coverage = diagnosis.coverage.reduce<CoverageIntersection[]>((cells, cell) => {
      const moved = cell.organizationalUnitId === sourceUnitId ? { ...cell, organizationalUnitId: destinationUnitId } : cell;
      const key = coverageKey(moved.measureId, moved.organizationalUnitId);
      if (!seen.has(key)) { seen.add(key); cells.push(moved); }
      return cells;
    }, []);
    return { ...diagnosis, coverage };
  });
  next.organizationalUnits = next.organizationalUnits.filter((unit) => unit.id !== sourceUnitId);
  return assertValid(next);
}

export function deactivateBusinessUnit(document: DiagnosticDocument, unitId: EntityId) {
  const next = clone(document);
  const unit = next.organizationalUnits.find((value) => value.id === unitId);
  if (!unit || unit.kind !== "business-unit") throw new DomainValidationError([{ code: "missing-business-unit", message: "A unidade de negócio não existe." }]);
  next.organizationalUnits = next.organizationalUnits.map((value): OrganizationalUnit => value.id === unitId ? { ...value, active: false } : value);
  return assertValid(next);
}
export function reactivateBusinessUnit(document: DiagnosticDocument, unitId: EntityId) { const next = clone(document); const unit = next.organizationalUnits.find((value) => value.id === unitId); if (!unit || unit.kind !== "business-unit") throw new DomainValidationError([{ code: "missing-business-unit", message: "A unidade de negócio não existe." }]); next.organizationalUnits = next.organizationalUnits.map((value) => value.id === unitId ? { ...value, active: true } : value); return assertValid(next); }
