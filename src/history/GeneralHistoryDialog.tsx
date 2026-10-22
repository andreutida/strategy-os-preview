import { useId, useMemo, useState } from "react";
import type { DiagnosticDocument } from "../domain/model";
import { Modal } from "../ui/Modal";
import { AuditHistoryList } from "./AuditHistoryList";
import { auditDiagnosisOptions, auditEventViews, auditUnitOptions, queryAuditHistory, type AuditHistoryScope, type AuditOrder } from "./auditPresentation";

const SCOPES: Array<{ value: AuditHistoryScope; label: string }> = [
  { value: "chronological", label: "Cronologia" },
  { value: "diagnosis", label: "Diagnóstico" },
  { value: "business-unit", label: "Unidade de negócio" },
  { value: "relations", label: "Relações estratégicas" },
  { value: "operations", label: "Operações compostas" },
];

/**
 * General history: a read-only lens over the persisted history. Filters are local view state; nothing here
 * writes the document, and no visual preference (zoom, pan, widths...) is ever recorded.
 */
export function GeneralHistoryDialog({ document, onClose }: { document: DiagnosticDocument; onClose: () => void }) {
  const ids = { scope: useId(), entity: useId(), order: useId() };
  const [scope, setScope] = useState<AuditHistoryScope>("chronological");
  const [entityId, setEntityId] = useState("");
  const [order, setOrder] = useState<AuditOrder>("newest-first");
  const diagnosisOptions = useMemo(() => auditDiagnosisOptions(document), [document]);
  const unitOptions = useMemo(() => auditUnitOptions(document), [document]);
  const options = scope === "business-unit" ? unitOptions : diagnosisOptions;
  const needsEntity = scope === "diagnosis" || scope === "business-unit";
  const views = useMemo(() => auditEventViews(document, queryAuditHistory(document, { scope, entityId: entityId || undefined }), order), [document, scope, entityId, order]);
  const total = document.history?.length ?? 0;
  return (
    <Modal title="Histórico geral" onClose={onClose} wide>
      <p className="audit-note">Somente leitura. Mostra apenas alterações já gravadas de diagnósticos, relações e BUs; preferências visuais não são registradas. {total} evento(s) no total.</p>
      <div className="audit-filters">
        <div><label htmlFor={ids.scope}>Visão</label>
          <select id={ids.scope} data-autofocus value={scope} onChange={(event) => { setScope(event.target.value as AuditHistoryScope); setEntityId(""); }}>
            {SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></div>
        {(needsEntity || scope === "relations") && <div><label htmlFor={ids.entity}>{scope === "business-unit" ? "Unidade" : "Diagnóstico"}</label>
          <select id={ids.entity} value={entityId} onChange={(event) => setEntityId(event.target.value)}>
            <option value="">{needsEntity ? (scope === "business-unit" ? "Selecione a unidade" : "Selecione o diagnóstico") : "Todas as relações"}</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select></div>}
        <div><label htmlFor={ids.order}>Ordem</label>
          <select id={ids.order} value={order} onChange={(event) => setOrder(event.target.value as AuditOrder)}>
            <option value="newest-first">Mais recentes primeiro</option>
            <option value="oldest-first">Mais antigos primeiro</option>
          </select></div>
      </div>
      <div className="audit-result" role="region" aria-label="Resultado do histórico" aria-live="polite">
        <p className="audit-count">{needsEntity && !entityId ? "Escolha uma entidade para consultar." : `${views.length} evento(s)`}</p>
        {(!needsEntity || entityId) && <AuditHistoryList views={views} label="Eventos do histórico" emptyText={scope === "operations" ? "Nenhuma operação composta registrada." : "Nenhum evento para este filtro."} />}
      </div>
    </Modal>
  );
}
