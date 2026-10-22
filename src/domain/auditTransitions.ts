import type { AuditEvent, DiagnosticDocument, EntityId } from "./model";
import { DomainValidationError } from "./model";
import { validateDiagnosticDocument } from "./validation";

/** Facts of one change; identity, ordering and time are assigned when the event is appended. */
export type AuditEventDraft = Omit<AuditEvent, "id" | "operationId" | "occurredAt">;

export interface AuditOperationContext {
  /** Groups every event produced by one atomic business operation (or one editing session). */
  operationId: EntityId;
  occurredAt: string;
  /** Source of uniqueness for event IDs; injectable so tests are deterministic. */
  entropy?: () => string;
}

export const defaultAuditEntropy = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const instantOf = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
const EVENT_SEQUENCE = /^audit-(\d{10})-/;

/**
 * History must stay ordered by (occurredAt, id). A clock that moved backwards would otherwise make the
 * whole document invalid, so a new event is never stamped earlier than the latest recorded one.
 */
export function auditInstant(history: AuditEvent[] | undefined, requested: string): string {
  const instant = instantOf(requested);
  if (!instant) throw new DomainValidationError([{ code: "invalid-audit-date", message: "A data do evento de histórico é inválida." }]);
  const latest = (history ?? []).reduce((max, event) => { const value = instantOf(event.occurredAt); return value > max ? value : max; }, "");
  return latest > instant ? latest : instant;
}

/**
 * IDs carry a zero-padded, ever-increasing sequence so events created inside the same millisecond (the
 * normal case for the several events of one operation) still sort in append order. Uniqueness comes
 * from the entropy suffix.
 */
export function nextAuditEventId(history: AuditEvent[] | undefined, occurredAt: string, entropy: () => string = defaultAuditEntropy): EntityId {
  const events = history ?? [];
  const sequence = events.reduce((max, event) => { const match = EVENT_SEQUENCE.exec(event.id); return match ? Math.max(max, Number(match[1])) : max; }, 0) + 1;
  let candidate = `audit-${String(sequence).padStart(10, "0")}-${entropy()}`;
  const floor = events.filter((event) => instantOf(event.occurredAt) === occurredAt).reduce((max, event) => event.id > max ? event.id : max, "");
  // Foreign IDs (imported histories) may sort after ours inside the same instant; stay after them.
  if (floor >= candidate) candidate = `${floor}.${entropy()}`;
  return candidate;
}

/**
 * Appends all drafts to one snapshot and validates the whole document once. Returns the same reference
 * when there is nothing to record, so callers can tell "no change" from "changed" without comparing.
 */
export function appendAuditEvents(document: DiagnosticDocument, drafts: AuditEventDraft[], context: AuditOperationContext): DiagnosticDocument {
  if (!drafts.length) return document;
  const next = structuredClone(document);
  const history = [...(next.history ?? [])];
  const occurredAt = auditInstant(history, context.occurredAt);
  drafts.forEach((draft) => history.push({ ...draft, id: nextAuditEventId(history, occurredAt, context.entropy), operationId: context.operationId, occurredAt }));
  next.history = history;
  const issues = validateDiagnosticDocument(next, { allowLegacyPendingAmbitions: true });
  if (issues.length) throw new DomainValidationError(issues);
  return next;
}

/**
 * Pure 7C-ready transaction primitive. The returned snapshot contains both the
 * domain mutation supplied by the caller and its event, ready for one persistence write.
 */
export function appendAuditEvent(document: DiagnosticDocument, event: AuditEvent): DiagnosticDocument {
  const next = structuredClone(document);
  next.history = [...(next.history ?? []), event];
  const issues = validateDiagnosticDocument(next, { allowLegacyPendingAmbitions: true });
  if (issues.length) throw new DomainValidationError(issues);
  return next;
}

/**
 * Coalesces an in-progress editor session into one event. It never writes storage:
 * 7C will persist the valid snapshot and report success only after that write succeeds.
 */
export function upsertOpenAuditEvent(document: DiagnosticDocument, event: AuditEvent): DiagnosticDocument {
  if (event.metadata?.session?.state !== "open") return appendAuditEvent(document, event);
  const next = structuredClone(document);
  const index = (next.history ?? []).findIndex((item) => item.operationId === event.operationId && item.metadata?.session?.state === "open");
  if (index < 0) return appendAuditEvent(next, event);
  const current = next.history![index];
  // The event keeps its original position in time: events appended after it must never end up out of order.
  next.history![index] = { ...event, id: current.id, occurredAt: current.occurredAt, before: current.before ?? event.before };
  const issues = validateDiagnosticDocument(next, { allowLegacyPendingAmbitions: true });
  if (issues.length) throw new DomainValidationError(issues);
  return next;
}
