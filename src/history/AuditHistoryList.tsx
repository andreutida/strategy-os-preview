import { useState } from "react";
import type { AuditEventView } from "./auditPresentation";

const PAGE = 100;
const formatDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/** Read-only list of already persisted events. It has no controls that change the document. */
export function AuditHistoryList({ views, label, emptyText = "Nenhum evento registrado." }: { views: AuditEventView[]; label: string; emptyText?: string }) {
  const [limit, setLimit] = useState(PAGE);
  if (!views.length) return <p className="audit-empty">{emptyText}</p>;
  return (
    <>
      <ol className="audit-list" aria-label={label}>
        {views.slice(0, limit).map((view) => (
          <li key={view.id} className="audit-event" data-event-type={view.type}>
            <div className="audit-event-head">
              <strong>{view.title}</strong>
              <time dateTime={view.occurredAt}>{view.session ? "Primeira alteração: " : ""}{formatDate(view.occurredAt)}</time>
            </div>
            <p className="audit-entity">{view.entity}</p>
            <div className="audit-badges">
              {view.session && <span className={`audit-badge session-${view.session}`}>{view.session === "open" ? "Sessão de edição em andamento" : "Sessão de edição concluída"}</span>}
              {view.operation.composite && <span className="audit-badge composite" title={`Código da operação: ${view.operation.id}`}>Operação composta · {view.operation.size} eventos · {view.operation.shortId}</span>}
            </div>
            {view.reason && <p className="audit-reason">{view.reason}</p>}
            {view.changes.length > 0 && (
              <dl className="audit-changes">
                {view.changes.map((change) => (
                  <div key={change.label} className="audit-change">
                    <dt>{change.label}</dt>
                    <dd>
                      {change.before !== undefined && <span className="audit-before"><span className="visually-hidden">Antes: </span>{change.before}</span>}
                      {change.before !== undefined && change.after !== undefined && <span aria-hidden="true" className="audit-arrow"> → </span>}
                      {change.after !== undefined && <span className="audit-after"><span className="visually-hidden">Depois: </span>{change.after}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {view.affectedDiagnoses.length > 0 && <p className="audit-affected">Diagnósticos afetados: {view.affectedDiagnoses.join(", ")}</p>}
          </li>
        ))}
      </ol>
      {views.length > limit && <button type="button" className="audit-more" onClick={() => setLimit((value) => value + PAGE)}>Mostrar mais ({views.length - limit})</button>}
    </>
  );
}
