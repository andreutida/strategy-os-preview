import type { DiagnosticDocument, EntityId, HierarchyRelation, SemanticRelation } from "./model";

/** Pure read APIs for relation panels and future visual adapters. They never expose drafts or deleted diagnoses as endpoints. */
const isActiveDiagnosis = (document: DiagnosticDocument, id: EntityId) => document.diagnoses.some((diagnosis) => diagnosis.id === id && !diagnosis.deletedAt);

export function directParentOf(document: DiagnosticDocument, diagnosisId: EntityId): HierarchyRelation | undefined {
  return document.hierarchies.find((relation) => relation.childId === diagnosisId && isActiveDiagnosis(document, relation.parentId) && isActiveDiagnosis(document, relation.childId));
}

export function directChildrenOf(document: DiagnosticDocument, diagnosisId: EntityId): HierarchyRelation[] {
  return document.hierarchies.filter((relation) => relation.parentId === diagnosisId && isActiveDiagnosis(document, relation.parentId) && isActiveDiagnosis(document, relation.childId));
}

export function outgoingSemanticRelationsOf(document: DiagnosticDocument, diagnosisId: EntityId): SemanticRelation[] {
  return document.semanticRelations.filter((relation) => relation.sourceDiagnosisId === diagnosisId && isActiveDiagnosis(document, relation.sourceDiagnosisId) && isActiveDiagnosis(document, relation.targetDiagnosisId));
}

export function incomingSemanticRelationsOf(document: DiagnosticDocument, diagnosisId: EntityId): SemanticRelation[] {
  return document.semanticRelations.filter((relation) => relation.targetDiagnosisId === diagnosisId && isActiveDiagnosis(document, relation.sourceDiagnosisId) && isActiveDiagnosis(document, relation.targetDiagnosisId));
}

export function semanticRelationsOf(document: DiagnosticDocument, diagnosisId: EntityId): SemanticRelation[] {
  return document.semanticRelations.filter((relation) => (relation.sourceDiagnosisId === diagnosisId || relation.targetDiagnosisId === diagnosisId) && isActiveDiagnosis(document, relation.sourceDiagnosisId) && isActiveDiagnosis(document, relation.targetDiagnosisId));
}

export function hierarchyConflictForChild(document: DiagnosticDocument, parentId: EntityId, childId: EntityId): HierarchyRelation | undefined {
  const current = directParentOf(document, childId);
  return current?.parentId !== parentId ? current : undefined;
}
