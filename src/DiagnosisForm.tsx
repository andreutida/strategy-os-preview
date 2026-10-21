import { useEffect, useState } from "react";
import type { AmbitionOrigin, CoverageIntersection, Diagnosis, DiagnosisDraft, DiagnosisKind, DiagnosticDocument, SemanticRelationType, ValidationStatus } from "./domain/model";
import { directChildrenOf, directParentOf, incomingSemanticRelationsOf, outgoingSemanticRelationsOf } from "./domain/relations";

export interface DiagnosisEditorValue {
  kind?: DiagnosisKind;
  title?: string;
  description?: string;
  evidence?: string[];
  causes?: string[];
  consequences?: string[];
  ambitionOrigin?: AmbitionOrigin;
  validationStatus?: ValidationStatus;
  coverage?: CoverageIntersection[];
}

const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const key = (cell: CoverageIntersection) => `${cell.measureId}:${cell.organizationalUnitId}`;
const toEditorValue = (item: Diagnosis | DiagnosisDraft): DiagnosisEditorValue => ({
  kind: item.kind,
  title: item.title ?? "",
  description: item.description ?? "",
  evidence: item.evidence ?? [],
  causes: item.causes ?? [],
  consequences: item.consequences ?? [],
  ambitionOrigin: item.ambitionOrigin,
  validationStatus: item.validationStatus ?? "pending",
  coverage: item.coverage ?? [],
});

export function DiagnosisForm({
  document,
  item,
  saveState,
  saveError,
  onChange,
  onClose,
  onDelete,
  onRetry,
  relations,
}: {
  document: DiagnosticDocument;
  item: Diagnosis | DiagnosisDraft;
  saveState: "saving" | "saved" | "error" | "idle";
  saveError: string;
  onChange: (value: DiagnosisEditorValue, mode: "debounced" | "immediate") => void;
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
  relations?: { onRemoveHierarchy: (parentId: string) => void; onUpdateSemantic: (relationId: string, type: SemanticRelationType) => void; onDeleteSemantic: (relationId: string) => void; };
}) {
  const [value, setValue] = useState<DiagnosisEditorValue>(() => toEditorValue(item));
  useEffect(() => setValue(toEditorValue(item)), [item.id, "coverage" in item ? item.coverage : undefined, item.updatedAt]);
  const update = (patch: Partial<DiagnosisEditorValue>, mode: "debounced" | "immediate" = "debounced") => {
    setValue((current) => {
      const next = { ...current, ...patch };
      onChange(next, mode);
      return next;
    });
  };
  const coverage = value.coverage ?? [];
  const toggle = (cell: CoverageIntersection) => update({ coverage: coverage.some((entry) => key(entry) === key(cell)) ? coverage.filter((entry) => key(entry) !== key(cell)) : [...coverage, cell] }, "immediate");
  const activeUnits = document.organizationalUnits.filter((unit) => unit.active);
  const pending = [
    !value.kind && "Defina o tipo.",
    !value.title?.trim() && "Informe o título.",
    value.kind === "ambition" && !value.ambitionOrigin && "Informe a origem da Ambição.",
    !coverage.length && "Selecione ao menos uma interseção.",
  ].filter(Boolean) as string[];
  const isDraft = (document.diagnosisDrafts ?? []).some((draft) => draft.id === item.id && !draft.deletedAt);

  return <aside className="matrix-context diagnosis-form" aria-label="Editor de diagnóstico">
    <header>
      <div><strong>{value.title?.trim() || "Diagnóstico sem título"}</strong><small>{isDraft ? "Não posicionado" : "Pronto para posicionamento"}</small></div>
      <button aria-label="Fechar painel" title="Fechar painel" onClick={onClose}>Fechar painel</button>
    </header>
    <p className={`diagnosis-save-status ${saveState}`} aria-live="polite">{saveState === "saving" ? "Salvando" : saveState === "error" ? "Erro ao salvar" : saveState === "saved" ? "Alterações salvas" : ""}</p>
    {saveState === "error" && <div className="matrix-error" role="alert">{saveError || "Não foi possível salvar. Seus dados continuam abertos."}<button onClick={onRetry}>Tentar novamente</button></div>}
    <section className="matrix-context-section"><h2>Requisitos para posicionamento</h2>{pending.length ? <ul className="diagnosis-pending">{pending.map((message) => <li key={message}>{message}</li>)}</ul> : <p>Diagnóstico completo. Ele será posicionado na Matriz Econômica.</p>}</section>
    <section className="matrix-context-section"><h2>Identificação</h2>
      <label>Tipo<select aria-label="Tipo do diagnóstico" value={value.kind ?? ""} onChange={(event) => update({ kind: event.target.value as DiagnosisKind || undefined, ambitionOrigin: event.target.value === "ambition" ? value.ambitionOrigin : undefined }, "immediate")}><option value="">Selecione o tipo</option><option value="objection">Objeção</option><option value="ambition">Ambição</option></select></label>
      <label>Título<input aria-label="Título do diagnóstico" value={value.title ?? ""} onChange={(event) => update({ title: event.target.value })}/></label>
      <label>Descrição <small>Opcional</small><textarea aria-label="Descrição do diagnóstico" value={value.description ?? ""} onChange={(event) => update({ description: event.target.value })}/></label>
    </section>
    {value.kind === "ambition" && <section className="matrix-context-section"><h2>Origem e validação</h2>
      <label>Origem<select aria-label="Origem da Ambição" value={value.ambitionOrigin ?? ""} onChange={(event) => update({ ambitionOrigin: event.target.value as AmbitionOrigin || undefined }, "immediate")}><option value="">Selecione a origem</option><option value="shareholders">Acionistas</option><option value="diagnostic-proposal">Proposta do Diagnóstico</option></select></label>
      <label>Status de validação<select aria-label="Status de validação" value={value.validationStatus ?? "pending"} onChange={(event) => update({ validationStatus: event.target.value as ValidationStatus }, "immediate")}><option value="pending">Pendente</option><option value="validated">Validada</option><option value="rejected">Rejeitada</option></select></label>
    </section>}
    {!isDraft && relations && <section className="matrix-context-section diagnosis-relations"><h2>Relações</h2>{(() => { const parent = directParentOf(document, item.id); const children = directChildrenOf(document, item.id); const incoming = incomingSemanticRelationsOf(document, item.id); const outgoing = outgoingSemanticRelationsOf(document, item.id); const title = (id: string) => document.diagnoses.find((diagnosis) => diagnosis.id === id)?.title ?? id; return <><div><strong>Superior direto</strong>{parent ? <p>{title(parent.parentId)} <button onClick={() => relations.onRemoveHierarchy(parent.parentId)}>Remover vínculo</button></p> : <p>Sem superior.</p>}</div><div><strong>Filhos diretos</strong>{children.length ? <ul>{children.map((relation) => <li key={relation.childId}>{title(relation.childId)}</li>)}</ul> : <p>Sem filhos.</p>}</div><div><strong>Associações de saída</strong>{outgoing.length ? <ul>{outgoing.map((relation) => <li key={relation.id}>{relation.type} → {title(relation.targetDiagnosisId)} <select aria-label={`Tipo da relação ${relation.id}`} value={relation.type} onChange={(event) => relations.onUpdateSemantic(relation.id, event.target.value as SemanticRelationType)}><option value="hinders">Dificulta</option><option value="contributes-to">Contribui para</option><option value="depends-on">Depende de</option></select><button onClick={() => relations.onDeleteSemantic(relation.id)}>Excluir</button></li>)}</ul> : <p>Sem associações de saída.</p>}</div><div><strong>Associações de entrada</strong>{incoming.length ? <ul>{incoming.map((relation) => <li key={relation.id}>{title(relation.sourceDiagnosisId)} → {relation.type}</li>)}</ul> : <p>Sem associações de entrada.</p>}</div></>; })()}</section>}
    <section className="matrix-context-section"><h2>Fundamentação</h2>{([['Evidências', 'evidence'], ['Causas', 'causes'], ['Consequências', 'consequences']] as const).map(([label, field]) => <label key={field}>{label} <small>Uma por linha, opcional</small><textarea aria-label={label} value={(value[field] ?? []).join("\n")} onChange={(event) => update({ [field]: lines(event.target.value) })}/></label>)}</section>
    <section className="matrix-context-section"><h2>Abrangência</h2><p>Selecione exatamente as células que fazem parte deste diagnóstico.</p><div className="coverage-grid" role="grid">{document.structures.map((structure) => <div key={structure.id} className="coverage-structure"><strong>{structure.name}</strong>{document.measures.filter((measure) => measure.structureId === structure.id).map((measure) => <div className="coverage-row" key={measure.id}><span>{measure.name}</span>{activeUnits.map((unit) => { const cell = { measureId: measure.id, organizationalUnitId: unit.id }; const selected = coverage.some((entry) => key(entry) === key(cell)); return <button key={unit.id} aria-label={`${measure.name} × ${unit.name}`} aria-pressed={selected} onClick={() => toggle(cell)}>{unit.name}</button>; })}</div>)}</div>)}</div></section>
    <section className="matrix-context-section diagnosis-delete"><h2>Mais ações</h2><button className="danger" onClick={onDelete}>Excluir diagnóstico</button></section>
  </aside>;
}
