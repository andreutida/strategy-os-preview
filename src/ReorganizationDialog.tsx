import { Fragment, useId, useState, type ReactNode } from "react";
import { diagnosesWithoutActiveRegionAfterDeactivation, measureUsage, structureUsage, transferConsolidations, unitUsage } from "./domain/economicImpact";
import type { DiagnosticDocument, EntityId } from "./domain/model";
import { Modal } from "./ui/Modal";

export type ReorganizationRequest =
  | { kind: "rename"; targetId: EntityId }
  | { kind: "business-unit-transfer"; unitId: EntityId }
  | { kind: "business-unit-status"; unitId: EntityId }
  | { kind: "structure-remove"; structureId: EntityId }
  | { kind: "measure-transfer"; measureId: EntityId }
  | { kind: "measure-remove"; measureId: EntityId };

export interface ReorganizationParams { destinationId?: EntityId; name?: string }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Confirmation step of every economic reorganization. It only describes the operation and its impact
 * (computed by the domain's own impact queries) and hands the choice back; the operation itself is always
 * executed by the existing domain / audited commands, never by logic in this component.
 */
export function ReorganizationDialog({ request, document, busy, error, onCancel, onConfirm }: {
  request: ReorganizationRequest;
  document: DiagnosticDocument;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (params: ReorganizationParams) => void;
}) {
  const ids = { destination: useId(), name: useId() };
  const [destinationId, setDestinationId] = useState("");
  const [name, setName] = useState(() => {
    if (request.kind !== "rename") return "";
    return document.structures.find((item) => item.id === request.targetId)?.name ?? document.measures.find((item) => item.id === request.targetId)?.name ?? document.organizationalUnits.find((item) => item.id === request.targetId)?.name ?? "";
  });
  const title = (id: EntityId) => document.diagnoses.find((item) => item.id === id)?.title ?? id;
  const draftTitle = (id: EntityId) => (document.diagnosisDrafts ?? []).find((item) => item.id === id)?.title?.trim() || "Rascunho sem título";

  const view = ((): { heading: string; summary: Array<[string, string]>; destinations?: Array<{ id: EntityId; label: string }>; destinationLabel?: string; impact?: ReactNode; consequences?: string[]; blocked?: ReactNode; confirm?: string; needsName?: boolean } | undefined => {
    switch (request.kind) {
      case "rename": {
        const structure = document.structures.find((item) => item.id === request.targetId);
        const measure = document.measures.find((item) => item.id === request.targetId);
        const unit = document.organizationalUnits.find((item) => item.id === request.targetId);
        const current = structure?.name ?? measure?.name ?? unit?.name;
        if (current === undefined) return undefined;
        const type = structure ? "Estrutura Econômica" : measure ? "Medida Econômica" : unit?.kind === "group" ? "Grupo" : "Unidade de Negócio";
        return { heading: `Renomear ${type}`, summary: [["Elemento", current], ["Tipo", type]], needsName: true, confirm: "Renomear", consequences: [unit?.kind === "business-unit" ? "O novo nome é registrado no histórico da BU." : "Vínculos, diagnósticos e IDs não são alterados."] };
      }
      case "business-unit-transfer": {
        const source = document.organizationalUnits.find((item) => item.id === request.unitId && item.kind === "business-unit");
        if (!source) return undefined;
        const options = document.organizationalUnits.filter((item) => item.kind === "business-unit" && item.id !== source.id).map((item) => ({ id: item.id, label: item.active ? item.name : `${item.name} (inativa)` }));
        const usage = unitUsage(document, source.id);
        const selected = destinationId || options[0]?.id;
        const consolidated = selected ? transferConsolidations(document, source.id, selected) : 0;
        const destinationName = options.find((item) => item.id === selected)?.label;
        return {
          heading: "Transferir BU",
          summary: [["Operação", "Transferir as abrangências da BU e removê-la"], ["Origem", source.name], ["Destino", destinationName ?? "—"]],
          destinations: options, destinationLabel: "BU de destino",
          blocked: options.length ? undefined : "Não há outra Unidade de Negócio para receber as abrangências. Crie a BU de destino antes de transferir.",
          impact: <ul>
            <li><strong>{plural(usage.diagnosisIds.length, "diagnóstico válido afetado", "diagnósticos válidos afetados")}</strong></li>
            <li><strong>{plural(usage.draftIds.length, "rascunho afetado", "rascunhos afetados")}</strong> (as interseções provisórias acompanham a transferência; nenhum rascunho é promovido)</li>
            {usage.deletedDiagnosisIds.length > 0 && <li>{plural(usage.deletedDiagnosisIds.length, "diagnóstico excluído logicamente também é ajustado", "diagnósticos excluídos logicamente também são ajustados")}</li>}
            {consolidated > 0 && <li>{plural(consolidated, "interseção repetida será consolidada", "interseções repetidas serão consolidadas")} sem duplicar registros</li>}
          </ul>,
          consequences: ["A BU de origem é removida da matriz após a transferência.", "IDs de diagnósticos e rascunhos são preservados; o Grupo não é afetado.", "A transferência fica registrada no histórico, inclusive para a BU removida."],
          confirm: "Transferir BU",
        };
      }
      case "business-unit-status": {
        const unit = document.organizationalUnits.find((item) => item.id === request.unitId && item.kind === "business-unit");
        if (!unit) return undefined;
        const usage = unitUsage(document, unit.id);
        const hidden = diagnosesWithoutActiveRegionAfterDeactivation(document, unit.id);
        return unit.active ? {
          heading: "Desativar BU",
          summary: [["Operação", "Desativar a BU (descontinuação)"], ["Unidade", unit.name]],
          impact: <ul>
            <li><strong>{plural(usage.diagnosisIds.length, "diagnóstico válido afetado", "diagnósticos válidos afetados")}</strong>{hidden.length > 0 && <> — {plural(hidden.length, "ficará sem região visível", "ficarão sem região visível")}: {hidden.map(title).join(", ")}</>}</li>
            <li><strong>{plural(usage.draftIds.length, "rascunho afetado", "rascunhos afetados")}</strong></li>
          </ul>,
          consequences: ["A BU deixa de aparecer na matriz ativa.", "Abrangências, diagnósticos, rascunhos e histórico são preservados.", "Pode ser reativada a qualquer momento; as duas operações ficam registradas no histórico."],
          confirm: "Desativar BU",
        } : {
          heading: "Reativar BU",
          summary: [["Operação", "Reativar a BU"], ["Unidade", unit.name]],
          impact: <ul>
            <li><strong>{plural(usage.diagnosisIds.length, "diagnóstico válido volta a ser exibido", "diagnósticos válidos voltam a ser exibidos")}</strong> nesta unidade</li>
            <li><strong>{plural(usage.draftIds.length, "rascunho afetado", "rascunhos afetados")}</strong></li>
          </ul>,
          consequences: ["A BU volta a aparecer na matriz ativa com suas abrangências exatas.", "A reativação fica registrada no histórico."],
          confirm: "Reativar BU",
        };
      }
      case "structure-remove": {
        const structure = document.structures.find((item) => item.id === request.structureId);
        if (!structure) return undefined;
        const usage = structureUsage(document, structure.id);
        const destinations = document.structures.filter((item) => item.id !== structure.id).map((item) => ({ id: item.id, label: item.name }));
        const selected = destinationId || destinations[0]?.id;
        if (!usage.measureIds.length) return { heading: "Excluir Estrutura", summary: [["Operação", "Excluir Estrutura vazia"], ["Estrutura", structure.name]], impact: <ul><li><strong>0 Medidas</strong>, 0 diagnósticos e 0 rascunhos afetados</li></ul>, consequences: ["A Estrutura não possui Medidas e será excluída."], confirm: "Excluir Estrutura" };
        return {
          heading: "Excluir Estrutura",
          summary: [["Operação", "Transferir as Medidas e excluir a Estrutura"], ["Origem", structure.name], ["Destino", destinations.find((item) => item.id === selected)?.label ?? "—"]],
          destinations, destinationLabel: "Estrutura de destino",
          blocked: destinations.length ? undefined : "Não há outra Estrutura para receber as Medidas. Crie a Estrutura de destino antes de excluir esta.",
          impact: <ul>
            <li><strong>{plural(usage.measureIds.length, "Medida será transferida", "Medidas serão transferidas")}</strong></li>
            <li><strong>{plural(usage.diagnosisIds.length, "diagnóstico válido afetado", "diagnósticos válidos afetados")}</strong>, <strong>{plural(usage.draftIds.length, "rascunho afetado", "rascunhos afetados")}</strong></li>
          </ul>,
          consequences: ["A operação é atômica e pede confirmação única.", "Abrangências exatas, associações e diagnósticos são preservados; apenas a Estrutura das Medidas muda.", "A Estrutura de origem é excluída."],
          confirm: "Transferir e excluir",
        };
      }
      case "measure-transfer": {
        const measure = document.measures.find((item) => item.id === request.measureId);
        if (!measure) return undefined;
        const usage = measureUsage(document, measure.id);
        const destinations = document.structures.filter((item) => item.id !== measure.structureId).map((item) => ({ id: item.id, label: item.name }));
        const selected = destinationId || destinations[0]?.id;
        return {
          heading: "Transferir Medida",
          summary: [["Operação", "Transferir a Medida para outra Estrutura"], ["Medida", measure.name], ["Origem", document.structures.find((item) => item.id === measure.structureId)?.name ?? "—"], ["Destino", destinations.find((item) => item.id === selected)?.label ?? "—"]],
          destinations, destinationLabel: "Estrutura de destino",
          blocked: destinations.length ? undefined : "Crie outra Estrutura antes de transferir a Medida.",
          impact: <ul><li><strong>{plural(usage.diagnosisIds.length, "diagnóstico válido afetado", "diagnósticos válidos afetados")}</strong>, <strong>{plural(usage.draftIds.length, "rascunho afetado", "rascunhos afetados")}</strong></li></ul>,
          consequences: ["As interseções exatas dos diagnósticos e rascunhos são preservadas; apenas a Estrutura que agrupa a Medida muda."],
          confirm: "Transferir Medida",
        };
      }
      case "measure-remove": {
        const measure = document.measures.find((item) => item.id === request.measureId);
        if (!measure) return undefined;
        const usage = measureUsage(document, measure.id);
        const summary: Array<[string, string]> = [["Operação", "Excluir a Medida"], ["Medida", measure.name]];
        if (usage.blocked) {
          return {
            heading: "Exclusão bloqueada", summary,
            blocked: <>
              <p>A Medida «{measure.name}» está vinculada a {plural(usage.diagnosisIds.length, "diagnóstico válido", "diagnósticos válidos")}, {plural(usage.deletedDiagnosisIds.length, "diagnóstico excluído logicamente", "diagnósticos excluídos logicamente")} e {plural(usage.draftIds.length, "rascunho", "rascunhos")}, ainda que por abrangência parcial. Nada foi alterado.</p>
              <p>Registros vinculados:</p>
              <ul aria-label="Registros vinculados">
                {usage.diagnosisIds.map((id) => <li key={id}>{title(id)}</li>)}
                {usage.deletedDiagnosisIds.map((id) => <li key={id}>{title(id)} (excluído logicamente)</li>)}
                {usage.draftIds.map((id) => <li key={id}>{draftTitle(id)} (rascunho)</li>)}
              </ul>
              <p>Remova a Medida da abrangência desses registros antes de excluí-la.</p>
            </>,
          };
        }
        return { heading: "Excluir Medida", summary, impact: <ul><li><strong>0 diagnósticos e 0 rascunhos afetados</strong></li></ul>, consequences: ["A Medida não está vinculada a nenhum diagnóstico nem rascunho e será excluída."], confirm: "Excluir Medida" };
      }
    }
  })();

  if (!view) return null;
  const effectiveDestination = destinationId || view.destinations?.[0]?.id;
  const blocked = Boolean(view.blocked);
  const nameUnchanged = request.kind === "rename" && name.trim() === view.summary[0][1];
  const canConfirm = !busy && !blocked && !!view.confirm && (!view.needsName || (name.trim().length > 0 && !nameUnchanged)) && (!view.destinations || !!effectiveDestination);

  return (
    <Modal title={view.heading} onClose={onCancel}>
      <dl className="reorg-summary">{view.summary.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>
      {view.needsName && <label htmlFor={ids.name}>Novo nome<input id={ids.name} data-autofocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && canConfirm) onConfirm({ name: name.trim() }); }} /></label>}
      {view.destinations && view.destinations.length > 0 && <label htmlFor={ids.destination}>{view.destinationLabel}
        <select id={ids.destination} data-autofocus value={effectiveDestination} onChange={(event) => setDestinationId(event.target.value)}>{view.destinations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {view.blocked && <div className="reorg-blocked" role="alert">{view.blocked}</div>}
      {view.impact && <div className="reorg-impact"><strong className="reorg-label">Impacto</strong>{view.impact}</div>}
      {view.consequences && <div><strong className="reorg-label">Consequências</strong><ul>{view.consequences.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" onClick={onCancel} data-autofocus={view.confirm ? undefined : ""}>{view.confirm ? "Cancelar" : "Fechar"}</button>
        {view.confirm && <button type="button" className="primary" disabled={!canConfirm} onClick={() => onConfirm({ destinationId: effectiveDestination, name: name.trim() })}>{busy ? "Salvando…" : view.confirm}</button>}
      </div>
    </Modal>
  );
}
