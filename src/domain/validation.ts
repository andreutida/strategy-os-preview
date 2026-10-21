import type { DiagnosticDocument, DomainIssue, EntityId, HierarchyRelation } from "./model";

const unique = (values: string[]) => new Set(values).size === values.length;
const pairKey = (measureId: string, organizationalUnitId: string) => `${measureId}\u0000${organizationalUnitId}`;
const semanticRelationTypes = new Set(["hinders", "contributes-to", "depends-on"]);
export const semanticRelationKey = (sourceDiagnosisId: string, targetDiagnosisId: string, type: string) => `${sourceDiagnosisId}\u0000${targetDiagnosisId}\u0000${type}`;

export function validateDiagnosticDocument(document: DiagnosticDocument, options: { allowLegacyPendingAmbitions?: boolean } = {}): DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (document.version !== 3) issues.push({ code: "unsupported-version", message: "A versão do documento de Diagnóstico deve ser 3." });

  const diagnosisDrafts = document.diagnosisDrafts ?? [];
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["estrutura", document.structures], ["medida", document.measures], ["unidade organizacional", document.organizationalUnits], ["diagnóstico", document.diagnoses], ["rascunho de diagnóstico", diagnosisDrafts],
  ];
  collections.forEach(([name, values]) => {
    if (!values.every((value) => typeof value.id === "string" && value.id.trim())) issues.push({ code: "empty-id", message: `Há ${name} sem identificador.` });
    if (!unique(values.map((value) => value.id))) issues.push({ code: "duplicate-id", message: `Há identificadores duplicados de ${name}.` });
  });
  if (!unique([...document.diagnoses, ...diagnosisDrafts].map((value) => value.id))) {
    issues.push({ code: "duplicate-diagnosis-id", message: "Diagnósticos e rascunhos não podem reutilizar o mesmo identificador." });
  }

  const structureIds = new Set(document.structures.map((value) => value.id));
  const measureIds = new Set(document.measures.map((value) => value.id));
  const unitIds = new Set(document.organizationalUnits.map((value) => value.id));

  document.measures.forEach((measure) => {
    if (!structureIds.has(measure.structureId)) issues.push({ code: "missing-measure-structure", message: `A medida ${measure.id} referencia uma estrutura inexistente.`, path: `measures.${measure.id}.structureId` });
  });
  document.organizationalUnits.forEach((unit) => {
    if (unit.kind !== "group" && unit.kind !== "business-unit") issues.push({ code: "invalid-organizational-unit-kind", message: `A unidade organizacional ${unit.id} possui tipo inválido.` });
  });
  if (document.organizationalUnits.filter((unit) => unit.kind === "group").length > 1) issues.push({ code: "multiple-groups", message: "O documento pode ter somente uma unidade organizacional Grupo." });

  document.diagnoses.forEach((diagnosis) => {
    if (diagnosis.kind !== "ambition" && diagnosis.kind !== "objection") issues.push({ code: "invalid-diagnosis-kind", message: `O diagnóstico ${diagnosis.id} possui tipo inválido.` });
    if (typeof diagnosis.title !== "string" || !diagnosis.title.trim()) issues.push({ code: "empty-diagnosis-title", message: `O diagnóstico ${diagnosis.id} precisa de título.` });
    const coverage = Array.isArray(diagnosis.coverage) ? diagnosis.coverage : [];
    if (!coverage.length) issues.push({ code: "empty-coverage", message: `O diagnóstico ${diagnosis.id} precisa de ao menos uma interseção.` });
    const pairs = coverage.map((cell) => pairKey(cell.measureId, cell.organizationalUnitId));
    if (!unique(pairs)) issues.push({ code: "duplicate-coverage", message: `O diagnóstico ${diagnosis.id} contém interseções repetidas.` });
    coverage.forEach((cell) => {
      if (!measureIds.has(cell.measureId)) issues.push({ code: "missing-coverage-measure", message: `O diagnóstico ${diagnosis.id} referencia uma medida inexistente.`, path: `diagnoses.${diagnosis.id}.coverage` });
      if (!unitIds.has(cell.organizationalUnitId)) issues.push({ code: "missing-coverage-unit", message: `O diagnóstico ${diagnosis.id} referencia uma unidade organizacional inexistente.`, path: `diagnoses.${diagnosis.id}.coverage` });
    });
    const isLegacyPendingAmbition = diagnosis.kind === "ambition" && !diagnosis.ambitionOrigin && diagnosis.validationStatus === "pending";
    if (diagnosis.kind === "ambition" && !diagnosis.ambitionOrigin && !(options.allowLegacyPendingAmbitions && isLegacyPendingAmbition)) issues.push({ code: "missing-ambition-origin", message: `A ambição ${diagnosis.id} precisa de origem.` });
    if (diagnosis.kind === "objection" && diagnosis.ambitionOrigin) issues.push({ code: "invalid-objection-origin", message: `A objeção ${diagnosis.id} não pode possuir origem de ambição.` });
  });

  const activeDiagnosisIds = new Set(document.diagnoses.filter((diagnosis) => !diagnosis.deletedAt).map((diagnosis) => diagnosis.id));
  validateHierarchies(document.hierarchies, activeDiagnosisIds, issues);
  document.semanticRelations.forEach((relation) => {
    if (!semanticRelationTypes.has(relation.type)) issues.push({ code: "invalid-semantic-relation-type", message: `A relação ${relation.id} possui tipo desconhecido.` });
    if (!activeDiagnosisIds.has(relation.sourceDiagnosisId) || !activeDiagnosisIds.has(relation.targetDiagnosisId)) issues.push({ code: "inactive-semantic-endpoint", message: `A relação ${relation.id} aponta para diagnóstico inexistente ou excluído.` });
    if (relation.sourceDiagnosisId === relation.targetDiagnosisId) issues.push({ code: "semantic-self-reference", message: `A relação ${relation.id} não pode referenciar o mesmo diagnóstico.` });
  });
  if (!unique(document.semanticRelations.map((relation) => relation.id))) issues.push({ code: "duplicate-semantic-relation-id", message: "Há identificadores de relação semântica duplicados." });
  if (!unique(document.semanticRelations.map((relation) => semanticRelationKey(relation.sourceDiagnosisId, relation.targetDiagnosisId, relation.type)))) issues.push({ code: "duplicate-semantic-relation", message: "A mesma relação semântica não pode ser registrada mais de uma vez." });
  return issues;
}

function validateHierarchies(relations: HierarchyRelation[], diagnosisIds: Set<EntityId>, issues: DomainIssue[]) {
  const parentByChild = new Map<EntityId, EntityId>();
  const pairs = new Set<string>();
  relations.forEach((relation) => {
    if (!diagnosisIds.has(relation.parentId) || !diagnosisIds.has(relation.childId)) issues.push({ code: "inactive-hierarchy-endpoint", message: "A hierarquia aponta para diagnóstico inexistente ou excluído." });
    if (relation.parentId === relation.childId) issues.push({ code: "hierarchy-self-reference", message: "Um diagnóstico não pode ser superior de si próprio." });
    const pair = `${relation.parentId}\u0000${relation.childId}`;
    if (pairs.has(pair)) issues.push({ code: "duplicate-hierarchy", message: "A mesma relação hierárquica foi registrada mais de uma vez." });
    pairs.add(pair);
    const existing = parentByChild.get(relation.childId);
    if (existing && existing !== relation.parentId) issues.push({ code: "multiple-hierarchy-parents", message: `O diagnóstico ${relation.childId} possui mais de um superior.` });
    parentByChild.set(relation.childId, relation.parentId);
  });
  parentByChild.forEach((_parent, child) => {
    const visited = new Set<EntityId>();
    let current: EntityId | undefined = child;
    while (current) {
      if (visited.has(current)) { issues.push({ code: "hierarchy-cycle", message: "A hierarquia contém um ciclo." }); break; }
      visited.add(current);
      current = parentByChild.get(current);
    }
  });
}

export function coverageKey(measureId: string, organizationalUnitId: string) { return pairKey(measureId, organizationalUnitId); }
