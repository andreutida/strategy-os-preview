import { auditHistoryByOperation, auditHistoryForBusinessUnit, auditHistoryForDiagnosis, chronologicalAuditHistory, relationAuditHistoryForDiagnosis } from "../domain/auditHistory";
import type { AuditEvent, AuditEventType, AuditProjection, CoverageIntersection, DiagnosisAuditProjection, DiagnosticDocument, EntityId, SemanticRelationType } from "../domain/model";

/**
 * Read-only presentation of the audit history. Everything here is a pure function of a document snapshot:
 * querying never creates events nor touches the document, and no visual preference (zoom, pan, widths,
 * ordering, collapse) is ever part of the history.
 */

export interface AuditNames {
  diagnosis(id: EntityId): string;
  unit(id: EntityId): string;
  measure(id: EntityId): string;
  /** True when the entity is still in the document (a transferred BU, for example, is not). */
  hasUnit(id: EntityId): boolean;
  hasDiagnosis(id: EntityId): boolean;
}

/** Current names win; entities removed or renamed later fall back to the names recorded in the events themselves. */
export function createAuditNames(document: DiagnosticDocument): AuditNames {
  const diagnoses = new Map<EntityId, string>();
  const units = new Map<EntityId, string>();
  chronologicalAuditHistory(document).forEach((event) => [event.before, event.after].forEach((projection) => {
    if (projection?.entityType === "diagnosis") diagnoses.set(projection.id, projection.title);
    if (projection?.entityType === "business-unit") units.set(projection.id, projection.name);
  }));
  const currentDiagnoses = new Set(document.diagnoses.map((diagnosis) => diagnosis.id));
  const currentUnits = new Set(document.organizationalUnits.map((unit) => unit.id));
  document.diagnoses.forEach((diagnosis) => diagnoses.set(diagnosis.id, diagnosis.title));
  document.organizationalUnits.forEach((unit) => units.set(unit.id, unit.name));
  const measures = new Map(document.measures.map((measure) => [measure.id, measure.name]));
  return {
    diagnosis: (id) => diagnoses.get(id) ?? id,
    unit: (id) => units.get(id) ?? id,
    measure: (id) => measures.get(id) ?? id,
    hasUnit: (id) => currentUnits.has(id),
    hasDiagnosis: (id) => currentDiagnoses.has(id),
  };
}

const EVENT_TITLES: Record<AuditEventType, string> = {
  "diagnosis.created": "Diagnóstico criado",
  "diagnosis.updated": "Diagnóstico editado",
  "diagnosis.coverage-changed": "Abrangência alterada",
  "diagnosis.ambition-governance-changed": "Origem ou status da Ambição alterados",
  "diagnosis.deleted": "Diagnóstico excluído",
  "hierarchy.created": "Vínculo hierárquico criado",
  "hierarchy.removed": "Vínculo hierárquico removido",
  "hierarchy.parent-replaced": "Superior substituído",
  "semantic.created": "Associação criada",
  "semantic.type-changed": "Tipo da associação alterado",
  "semantic.deleted": "Associação excluída",
  "business-unit.created": "BU criada",
  "business-unit.renamed": "BU renomeada",
  "business-unit.coverage-transferred": "Abrangências da BU transferidas",
  "business-unit.deactivated": "BU desativada",
  "business-unit.reactivated": "BU reativada",
};
export const auditEventTitle = (type: AuditEventType) => EVENT_TITLES[type];

const KIND = { ambition: "Ambição", objection: "Objeção" } as const;
const ORIGIN = { shareholders: "Acionistas", "diagnostic-proposal": "Proposta do Diagnóstico" } as const;
const STATUS = { pending: "Pendente", validated: "Validada", rejected: "Rejeitada" } as const;
const SEMANTIC_VERB: Record<SemanticRelationType, string> = { hinders: "dificulta", "contributes-to": "contribui para", "depends-on": "depende de" };
const SEMANTIC_NAME: Record<SemanticRelationType, string> = { hinders: "Dificulta", "contributes-to": "Contribui para", "depends-on": "Depende de" };
const REASONS: Record<string, string> = { "diagnosis-deleted": "Consequência da exclusão de um diagnóstico" };
const NONE = "—";

export interface AuditFieldChange {
  label: string;
  before?: string;
  after?: string;
}

export interface AuditEventView {
  id: EntityId;
  occurredAt: string;
  type: AuditEventType;
  title: string;
  /** Human sentence naming the affected entities. */
  entity: string;
  changes: AuditFieldChange[];
  reason?: string;
  /** Titles of the diagnoses touched by a BU transfer. */
  affectedDiagnoses: string[];
  /** Present for editing-session events. `occurredAt` is then the first change of the session. */
  session?: "open" | "confirmed";
  operation: { id: EntityId; shortId: string; size: number; composite: boolean };
}

const list = (values: string[] | undefined) => values?.length ? values.join(" • ") : NONE;
const cellLabel = (names: AuditNames, cell: CoverageIntersection) => `${names.measure(cell.measureId)} × ${names.unit(cell.organizationalUnitId)}`;
const cellKey = (cell: CoverageIntersection) => `${cell.measureId}\u0000${cell.organizationalUnitId}`;

function diagnosisChanges(before: DiagnosisAuditProjection | undefined, after: DiagnosisAuditProjection | undefined, names: AuditNames): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  const push = (label: string, previous: string | undefined, next: string | undefined) => { if (previous !== next) changes.push({ label, ...(before ? { before: previous ?? NONE } : {}), ...(after ? { after: next ?? NONE } : {}) }); };
  const view = (projection: DiagnosisAuditProjection | undefined) => projection && ({
    kind: KIND[projection.kind], title: projection.title, description: projection.description || undefined,
    evidence: projection.evidence?.length ? list(projection.evidence) : undefined, causes: projection.causes?.length ? list(projection.causes) : undefined, consequences: projection.consequences?.length ? list(projection.consequences) : undefined,
    origin: projection.kind === "ambition" ? (projection.ambitionOrigin ? ORIGIN[projection.ambitionOrigin] : "Não informada") : undefined,
    status: projection.kind === "ambition" ? STATUS[projection.validationStatus ?? "pending"] : undefined,
  });
  const previous = view(before);
  const next = view(after);
  if (!before && next) {
    // Creation: show what was recorded, not a diff against nothing.
    changes.push({ label: "Tipo", after: next.kind }, { label: "Título", after: next.title });
    if (next.description) changes.push({ label: "Descrição", after: next.description });
    if (next.origin) changes.push({ label: "Origem", after: next.origin }, { label: "Status de validação", after: next.status });
    if (next.evidence) changes.push({ label: "Evidências", after: next.evidence });
    if (next.causes) changes.push({ label: "Causas", after: next.causes });
    if (next.consequences) changes.push({ label: "Consequências", after: next.consequences });
    changes.push({ label: "Abrangência", after: list(after!.coverage.map((cell) => cellLabel(names, cell))) });
    return changes;
  }
  if (!after && previous) {
    changes.push({ label: "Tipo", before: previous.kind }, { label: "Título", before: previous.title }, { label: "Abrangência", before: list(before!.coverage.map((cell) => cellLabel(names, cell))) });
    return changes;
  }
  if (!previous || !next) return changes;
  push("Tipo", previous.kind, next.kind);
  push("Título", previous.title, next.title);
  push("Descrição", previous.description, next.description);
  push("Evidências", previous.evidence, next.evidence);
  push("Causas", previous.causes, next.causes);
  push("Consequências", previous.consequences, next.consequences);
  push("Origem", previous.origin, next.origin);
  push("Status de validação", previous.status, next.status);
  const beforeKeys = new Set(before!.coverage.map(cellKey));
  const afterKeys = new Set(after!.coverage.map(cellKey));
  const added = after!.coverage.filter((cell) => !beforeKeys.has(cellKey(cell)));
  const removed = before!.coverage.filter((cell) => !afterKeys.has(cellKey(cell)));
  if (added.length) changes.push({ label: "Abrangência — interseções adicionadas", after: list(added.map((cell) => cellLabel(names, cell))) });
  if (removed.length) changes.push({ label: "Abrangência — interseções removidas", before: list(removed.map((cell) => cellLabel(names, cell))) });
  return changes;
}

function unitChanges(event: AuditEvent, names: AuditNames): AuditFieldChange[] {
  const before = event.before?.entityType === "business-unit" ? event.before : undefined;
  const after = event.after?.entityType === "business-unit" ? event.after : undefined;
  if (event.type === "business-unit.created" && after) return [{ label: "Nome", after: after.name }, { label: "Situação", after: after.active ? "Ativa" : "Inativa" }];
  if (event.type === "business-unit.renamed" && before && after) return [{ label: "Nome", before: before.name, after: after.name }];
  if ((event.type === "business-unit.deactivated" || event.type === "business-unit.reactivated") && before && after) return [{ label: "Situação", before: before.active ? "Ativa" : "Inativa", after: after.active ? "Ativa" : "Inativa" }];
  if (event.type === "business-unit.coverage-transferred" && before && after) return [{ label: "BU de origem (removida)", before: before.name }, { label: "BU de destino", after: names.unit(after.id) }];
  return [];
}

function relationChanges(event: AuditEvent, names: AuditNames): AuditFieldChange[] {
  const before = event.before;
  const after = event.after;
  if (before?.entityType === "hierarchy" || after?.entityType === "hierarchy") {
    const parent = (projection: AuditProjection | undefined) => projection?.entityType === "hierarchy" ? names.diagnosis(projection.parentId) : undefined;
    const child = (projection: AuditProjection | undefined) => projection?.entityType === "hierarchy" ? names.diagnosis(projection.childId) : undefined;
    if (event.type === "hierarchy.parent-replaced") return [{ label: "Superior", before: parent(before), after: parent(after) }, { label: "Filho", after: child(after) }];
    return [{ label: "Superior", ...(before ? { before: parent(before) } : { after: parent(after) }) }, { label: "Filho", ...(before ? { before: child(before) } : { after: child(after) }) }];
  }
  if (before?.entityType === "semantic-relation" || after?.entityType === "semantic-relation") {
    const type = (projection: AuditProjection | undefined) => projection?.entityType === "semantic-relation" ? SEMANTIC_NAME[projection.type] : undefined;
    if (event.type === "semantic.type-changed") return [{ label: "Tipo", before: type(before), after: type(after) }];
    return [{ label: "Tipo", ...(before ? { before: type(before) } : { after: type(after) }) }];
  }
  return [];
}

function entityOf(event: AuditEvent, names: AuditNames): string {
  const projection = event.after ?? event.before;
  switch (projection?.entityType) {
    case "diagnosis": return `${KIND[projection.kind]} «${names.diagnosis(projection.id)}»`;
    case "business-unit": {
      if (event.type === "business-unit.coverage-transferred" && event.before?.entityType === "business-unit" && event.after?.entityType === "business-unit") return `BU «${event.before.name}» → BU «${names.unit(event.after.id)}»`;
      return `BU «${names.unit(projection.id)}»`;
    }
    case "hierarchy": return `Superior «${names.diagnosis(projection.parentId)}» → Filho «${names.diagnosis(projection.childId)}»`;
    case "semantic-relation": return `«${names.diagnosis(projection.sourceDiagnosisId)}» ${SEMANTIC_VERB[projection.type]} «${names.diagnosis(projection.targetDiagnosisId)}»`;
    default: return NONE;
  }
}

export function describeAuditEvent(event: AuditEvent, names: AuditNames, operationSize: number): AuditEventView {
  const changes = event.type.startsWith("diagnosis.")
    ? diagnosisChanges(event.before?.entityType === "diagnosis" ? event.before : undefined, event.after?.entityType === "diagnosis" ? event.after : undefined, names)
    : event.type.startsWith("business-unit.") ? unitChanges(event, names) : relationChanges(event, names);
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    type: event.type,
    title: auditEventTitle(event.type),
    entity: entityOf(event, names),
    changes,
    ...(event.metadata?.reason ? { reason: REASONS[event.metadata.reason] ?? event.metadata.reason } : {}),
    affectedDiagnoses: (event.metadata?.affectedDiagnosisIds ?? []).map((id) => names.diagnosis(id)),
    ...(event.metadata?.session ? { session: event.metadata.session.state } : {}),
    operation: { id: event.operationId, shortId: event.operationId.slice(0, 8), size: operationSize, composite: operationSize > 1 },
  };
}

export type AuditOrder = "newest-first" | "oldest-first";

/** Describes events using the size of their whole operation, even when the list shown is filtered. */
export function auditEventViews(document: DiagnosticDocument, events: AuditEvent[], order: AuditOrder = "newest-first"): AuditEventView[] {
  const names = createAuditNames(document);
  const sizes = new Map([...auditHistoryByOperation(document)].map(([operationId, group]) => [operationId, group.length]));
  const views = events.map((event) => describeAuditEvent(event, names, sizes.get(event.operationId) ?? 1));
  return order === "newest-first" ? views.reverse() : views;
}

export type AuditHistoryScope = "chronological" | "diagnosis" | "business-unit" | "relations" | "operations";

export interface AuditHistoryQuery {
  scope: AuditHistoryScope;
  /** Diagnosis (scopes `diagnosis`, `relations`) or business unit (scope `business-unit`). Empty means "all". */
  entityId?: EntityId;
}

const isRelationEvent = (event: AuditEvent) => event.type.startsWith("hierarchy.") || event.type.startsWith("semantic.");

/** Chronological (oldest first) events for a general-history filter. Pure: never mutates the document. */
export function queryAuditHistory(document: DiagnosticDocument, query: AuditHistoryQuery): AuditEvent[] {
  switch (query.scope) {
    case "diagnosis": return query.entityId ? auditHistoryForDiagnosis(document, query.entityId) : [];
    case "business-unit": return query.entityId ? auditHistoryForBusinessUnit(document, query.entityId) : [];
    case "relations": return query.entityId ? relationAuditHistoryForDiagnosis(document, query.entityId) : chronologicalAuditHistory(document).filter(isRelationEvent);
    case "operations": {
      const composite = new Set([...auditHistoryByOperation(document)].filter(([, group]) => group.length > 1).map(([operationId]) => operationId));
      return chronologicalAuditHistory(document).filter((event) => composite.has(event.operationId));
    }
    default: return chronologicalAuditHistory(document);
  }
}

export interface AuditEntityOption { id: EntityId; label: string }

/** Diagnoses known to the history or the document, including logically deleted ones. */
export function auditDiagnosisOptions(document: DiagnosticDocument): AuditEntityOption[] {
  const names = createAuditNames(document);
  const ids = new Set<EntityId>(document.diagnoses.map((diagnosis) => diagnosis.id));
  (document.history ?? []).forEach((event) => event.subjects.forEach((subject) => { if (subject.kind === "diagnosis") ids.add(subject.id); }));
  const deleted = new Set(document.diagnoses.filter((diagnosis) => diagnosis.deletedAt).map((diagnosis) => diagnosis.id));
  return [...ids].map((id) => ({ id, label: `${names.diagnosis(id)}${deleted.has(id) ? " (excluído)" : names.hasDiagnosis(id) ? "" : " (removido)"}` })).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

/** Business units in the document plus the ones that only survive in the history (transferred). Grupo has no trail. */
export function auditUnitOptions(document: DiagnosticDocument): AuditEntityOption[] {
  const names = createAuditNames(document);
  const ids = new Set<EntityId>(document.organizationalUnits.filter((unit) => unit.kind === "business-unit").map((unit) => unit.id));
  (document.history ?? []).forEach((event) => event.subjects.forEach((subject) => { if (subject.kind === "business-unit") ids.add(subject.id); }));
  return [...ids].map((id) => ({ id, label: `${names.unit(id)}${names.hasUnit(id) ? "" : " (removida)"}` })).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}
