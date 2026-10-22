import type { AuditEntityKind, AuditEvent, AuditEventMetadata, AuditEventType, AuditProjection, DiagnosticDocument, DomainIssue, EntityId } from "./model";

const EVENT_TYPES = new Set<AuditEventType>([
  "diagnosis.created", "diagnosis.updated", "diagnosis.coverage-changed", "diagnosis.ambition-governance-changed", "diagnosis.deleted",
  "hierarchy.created", "hierarchy.removed", "hierarchy.parent-replaced",
  "semantic.created", "semantic.type-changed", "semantic.deleted",
  "business-unit.created", "business-unit.renamed", "business-unit.coverage-transferred", "business-unit.deactivated", "business-unit.reactivated",
]);
const ENTITY_KINDS = new Set<AuditEntityKind>(["diagnosis", "business-unit", "hierarchy", "semantic-relation"]);
const SEMANTIC_TYPES = new Set(["hinders", "contributes-to", "depends-on"]);
const MAX_METADATA_REASON_LENGTH = 1_000;
const MAX_METADATA_AFFECTED_DIAGNOSES = 1_000;

const validId = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const validDate = (value: unknown) => typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
const validStringList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const issue = (code: string, message: string, path?: string): DomainIssue => ({ code, message, path });

function projectionKindFor(eventType: AuditEventType): AuditProjection["entityType"] {
  if (eventType.startsWith("diagnosis.")) return "diagnosis";
  if (eventType.startsWith("business-unit.")) return "business-unit";
  if (eventType.startsWith("hierarchy.")) return "hierarchy";
  return "semantic-relation";
}

function projectionIsValid(value: AuditProjection | undefined, expected: AuditProjection["entityType"], path: string, issues: DomainIssue[]) {
  if (!value || value.entityType !== expected) {
    issues.push(issue("invalid-audit-projection", `A projeção ${path} não é compatível com o evento.`, path));
    return;
  }
  switch (value.entityType) {
    case "diagnosis":
      if (!validId(value.id) || (value.kind !== "ambition" && value.kind !== "objection") || typeof value.title !== "string" || !Array.isArray(value.coverage) || (value.description !== undefined && typeof value.description !== "string") || (value.evidence !== undefined && !validStringList(value.evidence)) || (value.causes !== undefined && !validStringList(value.causes)) || (value.consequences !== undefined && !validStringList(value.consequences)) || (value.ambitionOrigin !== undefined && !["shareholders", "diagnostic-proposal"].includes(value.ambitionOrigin)) || (value.validationStatus !== undefined && !["pending", "validated", "rejected"].includes(value.validationStatus)) || (value.deletedAt !== undefined && !validDate(value.deletedAt))) {
        issues.push(issue("invalid-audit-projection", `A projeção ${path} do diagnóstico é inválida.`, path));
      } else if (!value.coverage.every((cell) => validId(cell.measureId) && validId(cell.organizationalUnitId))) {
        issues.push(issue("invalid-audit-projection", `A cobertura em ${path} é inválida.`, path));
      }
      break;
    case "business-unit":
      if (!validId(value.id) || typeof value.name !== "string" || typeof value.active !== "boolean") issues.push(issue("invalid-audit-projection", `A projeção ${path} da BU é inválida.`, path));
      break;
    case "hierarchy":
      if (!validId(value.parentId) || !validId(value.childId) || value.parentId === value.childId) issues.push(issue("invalid-audit-projection", `A projeção ${path} da hierarquia é inválida.`, path));
      break;
    case "semantic-relation":
      if (!validId(value.id) || !validId(value.sourceDiagnosisId) || !validId(value.targetDiagnosisId) || value.sourceDiagnosisId === value.targetDiagnosisId || !SEMANTIC_TYPES.has(value.type)) issues.push(issue("invalid-audit-projection", `A projeção ${path} da relação semântica é inválida.`, path));
      break;
  }
}
function validatesMetadata(metadata: AuditEventMetadata | undefined, path: string, issues: DomainIssue[]) {
  if (!metadata) return;
  if (typeof metadata !== "object" || Array.isArray(metadata)) { issues.push(issue("invalid-audit-metadata", "Os metadados do histórico são inválidos.", path)); return; }
  const keys = Object.keys(metadata);
  if (keys.some((key) => !["reason", "affectedDiagnosisIds", "session"].includes(key))) issues.push(issue("invalid-audit-metadata", "Os metadados do histórico possuem campo não permitido.", path));
  if (metadata.reason !== undefined && (typeof metadata.reason !== "string" || metadata.reason.length > MAX_METADATA_REASON_LENGTH)) issues.push(issue("invalid-audit-metadata", "A justificativa do histórico é inválida.", path));
  if (metadata.affectedDiagnosisIds !== undefined && (!Array.isArray(metadata.affectedDiagnosisIds) || metadata.affectedDiagnosisIds.length > MAX_METADATA_AFFECTED_DIAGNOSES || !metadata.affectedDiagnosisIds.every(validId) || new Set(metadata.affectedDiagnosisIds).size !== metadata.affectedDiagnosisIds.length)) issues.push(issue("invalid-audit-metadata", "As referências de diagnósticos afetados são inválidas.", path));
  if (metadata.session !== undefined && (!metadata.session || typeof metadata.session !== "object" || !validId(metadata.session.id) || !["open", "confirmed"].includes(metadata.session.state))) issues.push(issue("invalid-audit-metadata", "A sessão do histórico é inválida.", path));
}

function requiredProjectionSides(type: AuditEventType) {
  if (type.endsWith(".created")) return { before: false, after: true };
  if (type.endsWith(".deleted") || type.endsWith(".removed")) return { before: true, after: false };
  return { before: true, after: true };
}

/** Validates events without requiring the entities to remain active in the current document. */
export function validateAuditHistory(history: AuditEvent[] | undefined): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const events = history ?? [];
  const ids = new Set<string>();
  let previousKey = "";
  events.forEach((event, index) => {
    const path = `history.${index}`;
    if (!validId(event.id)) issues.push(issue("invalid-audit-event-id", "O evento de histórico precisa de identificador.", `${path}.id`));
    else if (ids.has(event.id)) issues.push(issue("duplicate-audit-event-id", "Os identificadores de eventos de histórico devem ser únicos.", `${path}.id`));
    else ids.add(event.id);
    if (!validId(event.operationId)) issues.push(issue("invalid-audit-operation-id", "O evento de histórico precisa de identificador de operação.", `${path}.operationId`));
    if (!validDate(event.occurredAt)) issues.push(issue("invalid-audit-date", "A data do evento de histórico é inválida.", `${path}.occurredAt`));
    if (!EVENT_TYPES.has(event.type)) issues.push(issue("invalid-audit-event-type", "O tipo de evento de histórico é inválido.", `${path}.type`));
    if (!Array.isArray(event.subjects) || event.subjects.length === 0) issues.push(issue("invalid-audit-subjects", "O evento de histórico precisa identificar entidades afetadas.", `${path}.subjects`));
    else {
      const subjectKeys = new Set<string>();
      event.subjects.forEach((subject, subjectIndex) => {
        if (!ENTITY_KINDS.has(subject.kind) || !validId(subject.id)) issues.push(issue("invalid-audit-subject", "A referência histórica é inválida.", `${path}.subjects.${subjectIndex}`));
        const key = `${subject.kind}\u0000${subject.id}`;
        if (subjectKeys.has(key)) issues.push(issue("duplicate-audit-subject", "O evento de histórico repete a mesma entidade afetada.", `${path}.subjects.${subjectIndex}`));
        subjectKeys.add(key);
      });
    }
    if (EVENT_TYPES.has(event.type)) {
      const expected = projectionKindFor(event.type);
      const required = requiredProjectionSides(event.type);
      if (required.before || event.before !== undefined) projectionIsValid(event.before, expected, `${path}.before`, issues);
      if (required.after || event.after !== undefined) projectionIsValid(event.after, expected, `${path}.after`, issues);
      if (!event.subjects?.some((subject) => subject.kind === expected || (expected === "business-unit" && subject.kind === "business-unit"))) issues.push(issue("missing-audit-primary-subject", "O evento de histórico não referencia sua entidade principal.", `${path}.subjects`));
    }
    validatesMetadata(event.metadata, `${path}.metadata`, issues);
    if (validDate(event.occurredAt) && validId(event.id)) {
      const key = `${new Date(event.occurredAt).toISOString()}\u0000${event.id}`;
      if (previousKey && key < previousKey) issues.push(issue("non-deterministic-audit-order", "Os eventos de histórico devem estar em ordem cronológica determinística.", path));
      previousKey = key;
    }
  });
  return issues;
}

export function chronologicalAuditHistory(document: Pick<DiagnosticDocument, "history">): AuditEvent[] {
  return [...(document.history ?? [])].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

export function auditHistoryForDiagnosis(document: Pick<DiagnosticDocument, "history">, diagnosisId: EntityId): AuditEvent[] {
  return chronologicalAuditHistory(document).filter((event) => event.subjects.some((subject) => subject.kind === "diagnosis" && subject.id === diagnosisId) || event.metadata?.affectedDiagnosisIds?.includes(diagnosisId) || [event.before, event.after].some((projection) => projection?.entityType === "hierarchy" && (projection.parentId === diagnosisId || projection.childId === diagnosisId) || projection?.entityType === "semantic-relation" && (projection.sourceDiagnosisId === diagnosisId || projection.targetDiagnosisId === diagnosisId)));
}

export function auditHistoryForBusinessUnit(document: Pick<DiagnosticDocument, "history">, unitId: EntityId): AuditEvent[] {
  return chronologicalAuditHistory(document).filter((event) => event.subjects.some((subject) => subject.kind === "business-unit" && subject.id === unitId) || [event.before, event.after].some((projection) => projection?.entityType === "business-unit" && projection.id === unitId));
}

export function relationAuditHistoryForDiagnosis(document: Pick<DiagnosticDocument, "history">, diagnosisId: EntityId): AuditEvent[] {
  return auditHistoryForDiagnosis(document, diagnosisId).filter((event) => event.type.startsWith("hierarchy.") || event.type.startsWith("semantic."));
}

export function auditHistoryByOperation(document: Pick<DiagnosticDocument, "history">): Map<EntityId, AuditEvent[]> {
  const groups = new Map<EntityId, AuditEvent[]>();
  chronologicalAuditHistory(document).forEach((event) => groups.set(event.operationId, [...(groups.get(event.operationId) ?? []), event]));
  return groups;
}

