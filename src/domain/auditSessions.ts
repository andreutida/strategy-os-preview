import { classifyDiagnosisChange, projectDiagnosis } from "./auditProjections";
import { appendAuditEvents, upsertOpenAuditEvent, type AuditOperationContext } from "./auditTransitions";
import type { AuditEvent, DiagnosisAuditProjection, DiagnosticDocument, EntityId } from "./model";

/**
 * A logical editing session of one diagnosis (the editor panel open on it). All the autosaves of the
 * session are folded into a single history event, so the history records the operation and not each key.
 *
 * Policy:
 * - `before` is the state when the session began and never changes; `after` is the last state written
 *   into the document, so event and snapshot always agree.
 * - A diagnosis created in the session (a draft promoted) keeps `diagnosis.created` for the whole session.
 * - The event type is recomputed after each autosave; a net-empty change removes the open event.
 * - `occurredAt` is when the event first existed; later autosaves never move it.
 * - Closing the session (panel closed, other diagnosis selected, deletion, reload) seals the event; sealed
 *   events are never rewritten, and a later edit starts a new session with a new operation ID.
 */
export interface DiagnosisEditSession {
  /** Operation ID of the event; also the session ID stored in the event metadata. */
  operationId: EntityId;
  diagnosisId: EntityId;
  /** Projection when the session began. `undefined` while the item was still a draft. */
  baseline?: DiagnosisAuditProjection;
}

export function beginDiagnosisEditSession(document: DiagnosticDocument, diagnosisId: EntityId, operationId: EntityId): DiagnosisEditSession {
  const current = document.diagnoses.find((diagnosis) => diagnosis.id === diagnosisId && !diagnosis.deletedAt);
  return { operationId, diagnosisId, baseline: current ? projectDiagnosis(current) : undefined };
}

const isOpenSessionEvent = (event: AuditEvent, operationId: EntityId) => event.operationId === operationId && event.metadata?.session?.state === "open";

/**
 * Folds the diagnosis' current state into the session event. Pure: returns the same reference when
 * nothing changes. Call it with the document produced by the edit so both are persisted together.
 */
export function recordDiagnosisEditSession(document: DiagnosticDocument, session: DiagnosisEditSession, context: Pick<AuditOperationContext, "occurredAt" | "entropy">): DiagnosticDocument {
  const diagnosis = document.diagnoses.find((item) => item.id === session.diagnosisId && !item.deletedAt);
  const history = document.history ?? [];
  const index = history.findIndex((event) => isOpenSessionEvent(event, session.operationId));
  if (!diagnosis) return document; // still a draft: drafts have no history
  const after = projectDiagnosis(diagnosis);
  const type = session.baseline ? classifyDiagnosisChange(session.baseline, after) : "diagnosis.created";
  if (!type || type === "diagnosis.deleted") {
    if (index < 0) return document;
    const next = structuredClone(document);
    next.history = history.filter((_, position) => position !== index);
    return next;
  }
  const draft = {
    type,
    subjects: [{ kind: "diagnosis" as const, id: session.diagnosisId }],
    ...(session.baseline ? { before: session.baseline } : {}),
    after,
    metadata: { session: { id: session.operationId, state: "open" as const } },
  };
  if (index < 0) return appendAuditEvents(document, [draft], { ...context, operationId: session.operationId });
  const current = history[index];
  if (current.type === type && JSON.stringify(current.after) === JSON.stringify(after)) return document;
  return upsertOpenAuditEvent(document, { ...draft, id: current.id, operationId: session.operationId, occurredAt: current.occurredAt });
}

function sealWhere(document: DiagnosticDocument, matches: (event: AuditEvent) => boolean): DiagnosticDocument {
  const history = document.history ?? [];
  if (!history.some(matches)) return document;
  const next = structuredClone(document);
  next.history = history.map((event) => matches(event) ? { ...event, metadata: { ...event.metadata, session: { id: event.metadata!.session!.id, state: "confirmed" as const } } } : event);
  return next;
}

/** Finalizes the session event. Returns the same reference when the session recorded nothing. */
export const sealDiagnosisEditSession = (document: DiagnosticDocument, session: Pick<DiagnosisEditSession, "operationId">) => sealWhere(document, (event) => isOpenSessionEvent(event, session.operationId));

/** Seals every open session, for events left open by a reload or a closed tab. */
export const sealOpenAuditSessions = (document: DiagnosticDocument) => sealWhere(document, (event) => event.metadata?.session?.state === "open");
