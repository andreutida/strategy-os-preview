import { useMemo, useState } from "react";
import type { AuditEvent, DiagnosticDocument } from "../domain/model";
import { AuditHistoryList } from "./AuditHistoryList";
import { auditEventViews } from "./auditPresentation";

/**
 * Collapsible, read-only "Histórico" section of a contextual panel. `document` must be the persisted
 * snapshot, so a write that failed never shows up here.
 */
export function AuditHistorySection({ document, events, emptyText }: { document: DiagnosticDocument; events: AuditEvent[]; emptyText: string }) {
  const [open, setOpen] = useState(false);
  const views = useMemo(() => open ? auditEventViews(document, events) : [], [open, document, events]);
  return (
    <section className="matrix-context-section audit-history-section" aria-label="Histórico">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Histórico <small>({events.length})</small></summary>
        {open && <AuditHistoryList views={views} label="Histórico de alterações" emptyText={emptyText} />}
      </details>
    </section>
  );
}
