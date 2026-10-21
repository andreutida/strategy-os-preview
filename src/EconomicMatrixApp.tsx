import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Diagnosis, DiagnosisDraft, DiagnosticDocument, EconomicMeasure, EconomicStructure, OrganizationalUnit, SemanticRelationType } from "./domain/model";
import {
  createDiagnosisDraft,
  createEconomicMeasure,
  createEconomicStructure,
  createOrganizationalUnit,
  deactivateBusinessUnit,
  deleteMeasure,
  deleteEmptyStructure,
  reactivateBusinessUnit,
  transferBusinessUnit,
  transferStructureMeasuresAndDelete,
  updateDiagnosis,
  deleteDiagnosis,
  deleteDiagnosisDraft,
  promoteDiagnosisDraft,
  updateDiagnosisDraft,
  updateEconomicMeasure,
  updateEconomicStructure,
  updateOrganizationalUnit,
  setHierarchy,
  createSemanticRelation,
  updateSemanticRelation,
  deleteSemanticRelation,
  removeHierarchy,
} from "./domain/commands";
import { economicMatrixNodes } from "./flow/economicMatrixAdapter";
import { diagnosisIdFromNodeId, diagnosisNodeTypes, diagnosisVisualNodes } from "./flow/diagnosisVisualAdapter";
import { diagnosisRelationEdges } from "./flow/diagnosisRelationAdapter";
import { diagnosisEdgeTypes } from "./flow/DiagnosisRelationEdge";
import { DEFAULT_COLUMN_WIDTH, layoutEconomicMatrix, MIN_COLUMN_WIDTH, type MatrixPresentation } from "./layout/economicMatrix";
import { layoutDiagnosisCoverage } from "./layout/diagnosisCoverageGeometry";
import {
  movePresentationItem,
  movePresentationItemBy,
  presentationOrderFor,
} from "./layout/presentationOrdering";
import {
  loadMatrixPresentation,
  resetMatrixColumnWidths,
  sanitizeMatrixPresentation,
  saveMatrixPresentation,
} from "./layout/presentationStorage";
import { loadDiagnosticDocument, saveDiagnosticDocument } from "./persistence/diagnosticStorage";
import { DiagnosisForm, type DiagnosisEditorValue } from "./DiagnosisForm";
import { directParentOf } from "./domain/relations";

const id = () => crypto.randomUUID?.() ?? `v3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nameFor = (document: DiagnosticDocument, itemId: string) =>
  document.structures.find((item) => item.id === itemId)?.name ??
  document.measures.find((item) => item.id === itemId)?.name ??
  document.organizationalUnits.find((item) => item.id === itemId)?.name ??
  itemId;
const diagnosisNameFor = (document: DiagnosticDocument, itemId: string) => document.diagnoses.find((item) => item.id === itemId)?.title ?? itemId;

function Matrix() {
  const [loaded] = useState(() => loadDiagnosticDocument(localStorage));
  const [document, setDocument] = useState<DiagnosticDocument>(loaded.document);
  const [presentation, setPresentation] = useState<MatrixPresentation>(() =>
    loadMatrixPresentation(localStorage, loaded.document),
  );
  const [confirmed, setConfirmed] = useState(loaded.source !== "legacy-migration");
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"structure" | "measure" | "unit" | "group">("structure");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [selected, setSelected] = useState("");
  const [draggedOrderItem, setDraggedOrderItem] = useState("");
  const [dropOrderItem, setDropOrderItem] = useState("");
  const [widthPreview, setWidthPreview] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [connectOrigin, setConnectOrigin] = useState("");
  const [connectTarget, setConnectTarget] = useState("");
  const [relationType, setRelationType] = useState<"hierarchy" | SemanticRelationType | "">("");
  const [relationBusy, setRelationBusy] = useState(false);
  const [diagnosisSaveState, setDiagnosisSaveState] = useState<"saving" | "saved" | "error" | "idle">("idle");
  const [diagnosisSaveError, setDiagnosisSaveError] = useState("");
  const documentRef = useRef(document);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const editTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const wasConfirmed = useRef(confirmed);
  const flow = useReactFlow();

  useEffect(() => { documentRef.current = document; }, [document]);
  const persistDocument = (snapshot: DiagnosticDocument): Promise<boolean> => {
    if (!confirmed) return Promise.resolve(false);
    const revision = ++saveRevision.current;
    setDiagnosisSaveState("saving");
    const persist = () => {
      try {
        saveDiagnosticDocument(localStorage, snapshot);
        if (revision === saveRevision.current) { setDiagnosisSaveState("saved"); setDiagnosisSaveError(""); }
        return true;
      } catch (cause) {
        if (revision === saveRevision.current) {
          setDiagnosisSaveState("error");
          setDiagnosisSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar no navegador.");
        }
        return false;
      }
    };
    const queued = saveQueue.current.then(persist, persist);
    saveQueue.current = queued.then(() => undefined);
    return queued;
  };
  const applyDocument = (next: DiagnosticDocument) => {
    documentRef.current = next;
    setDocument(next);
    return persistDocument(next);
  };
  useEffect(() => { if (!wasConfirmed.current && confirmed) persistDocument(documentRef.current); wasConfirmed.current = confirmed; }, [confirmed]);
  useEffect(() => () => { editTimers.current.forEach((timer) => clearTimeout(timer)); }, []);
  useEffect(() => { const cancel = (event: KeyboardEvent) => { if (event.key === "Escape" && connectOrigin) cancelConnect(); }; window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel); }, [connectOrigin]);

  useEffect(() => {
    const sanitized = sanitizeMatrixPresentation(presentation, document);
    if (JSON.stringify(sanitized) !== JSON.stringify(presentation)) {
      setPresentation(sanitized);
      return;
    }
    try {
      saveMatrixPresentation(localStorage, sanitized);
    } catch {
      setError("Não foi possível salvar as preferências visuais.");
    }
  }, [document, presentation]);

  const renderedPresentation = useMemo<MatrixPresentation>(() => ({ ...presentation, columnWidths: { ...presentation.columnWidths, ...widthPreview } }), [presentation, widthPreview]);
  const layout = useMemo(() => layoutEconomicMatrix(document, renderedPresentation), [document, renderedPresentation]);
  const nodes = useMemo(() => economicMatrixNodes(document, renderedPresentation), [document, renderedPresentation]);
  const coverageGeometry = useMemo(() => layoutDiagnosisCoverage(document, renderedPresentation), [document, renderedPresentation]);
  const diagnosisNodes = useMemo(() => diagnosisVisualNodes(document, renderedPresentation, selectedDiagnosis), [document, renderedPresentation, selectedDiagnosis]);
  const diagnosisEdges = useMemo(() => diagnosisRelationEdges(document, renderedPresentation), [document, renderedPresentation]);
  const order = useMemo(
    () => (selected ? presentationOrderFor(document, presentation, selected) : undefined),
    [document, presentation, selected],
  );
  const selectedIndex = order?.ids.indexOf(selected) ?? -1;

  const create = () => {
    if (!name.trim()) return;
    try {
      const next =
        kind === "structure"
          ? createEconomicStructure(document, { id: id(), name: name.trim(), description: "" } as EconomicStructure)
          : kind === "measure"
            ? parent
              ? createEconomicMeasure(document, { id: id(), name: name.trim(), structureId: parent } as EconomicMeasure)
              : (() => { throw new Error("Selecione uma Estrutura."); })()
            : createOrganizationalUnit(document, { id: id(), kind: kind === "group" ? "group" : "business-unit", name: name.trim(), active: true } as OrganizationalUnit);
      applyDocument(next);
      setName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o elemento.");
    }
  };

  const edit = () => {
    const value = prompt("Novo nome", nameFor(document, selected));
    if (!value?.trim()) return;
    try {
      const structure = document.structures.find((item) => item.id === selected);
      const measure = document.measures.find((item) => item.id === selected);
      const unit = document.organizationalUnits.find((item) => item.id === selected);
      applyDocument(
        structure
          ? updateEconomicStructure(document, { ...structure, name: value })
          : measure
            ? updateEconomicMeasure(document, { ...measure, name: value })
            : unit
              ? updateOrganizationalUnit(document, { ...unit, name: value })
              : document,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operação bloqueada");
    }
  };

  const toggleBu = () => {
    const unit = document.organizationalUnits.find((item) => item.id === selected);
    if (!unit || unit.kind !== "business-unit") return;
    applyDocument(unit.active ? deactivateBusinessUnit(document, unit.id) : reactivateBusinessUnit(document, unit.id));
  };

  const removeStructure = () => {
    const structure = document.structures.find((item) => item.id === selected);
    if (!structure) return;
    const measures = document.measures.filter((item) => item.structureId === structure.id);
    const destinations = document.structures.filter((item) => item.id !== structure.id);
    if (measures.length && !destinations.length) {
      setError("Não há outra Estrutura para receber as Medidas.");
      return;
    }
    const destination = measures.length
      ? prompt(`Transferir ${measures.length} Medida(s) para qual Estrutura?`, destinations[0]?.id)
      : "";
    if (measures.length && (!destination || !destinations.some((item) => item.id === destination))) return;
    if (!confirm(measures.length ? "Confirmar transferência conjunta e exclusão da Estrutura?" : "Confirmar exclusão da Estrutura vazia?")) return;
    try {
      applyDocument(
        measures.length
          ? transferStructureMeasuresAndDelete(document, structure.id, destination!)
          : deleteEmptyStructure(document, structure.id),
      );
      setSelected("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operação bloqueada");
    }
  };

  const moveBu = () => {
    const source = document.organizationalUnits.find((item) => item.id === selected);
    if (!source || source.kind !== "business-unit") return;
    const options = document.organizationalUnits.filter((item) => item.kind === "business-unit" && item.id !== source.id);
    if (!options.length) {
      setError("Crie outra BU antes de transferir associações.");
      return;
    }
    const affected = document.diagnoses.filter((diagnosis) =>
      diagnosis.coverage.some((cell) => cell.organizationalUnitId === source.id),
    ).length;
    const destination = prompt(`${affected} diagnóstico(s) terão abrangências transferidas. Informe a BU destino:`, options[0].id);
    if (!destination || !options.some((item) => item.id === destination) || !confirm("A BU de origem será removida após a transferência. Confirmar?")) return;
    try {
      applyDocument(transferBusinessUnit(document, source.id, destination));
      setSelected("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operação bloqueada");
    }
  };

  const transferMeasure = () => {
    const measure = document.measures.find((item) => item.id === selected);
    if (!measure) return;
    const destinations = document.structures.filter((item) => item.id !== measure.structureId);
    if (!destinations.length) { setError("Crie outra Estrutura antes de transferir a Medida."); return; }
    const destination = prompt("Informe a Estrutura de destino:", destinations[0].id);
    if (!destination || !destinations.some((item) => item.id === destination) || !confirm("Confirmar transferência da Medida?")) return;
    try { applyDocument(updateEconomicMeasure(document, { ...measure, structureId: destination })); setSelected(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operação bloqueada"); }
  };
  const removeMeasure = () => {
    const measure = document.measures.find((item) => item.id === selected);
    if (!measure || !confirm("Excluir esta Medida? A operação será bloqueada se houver diagnósticos associados.")) return;
    try { applyDocument(deleteMeasure(document, measure.id)); setSelected(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operação bloqueada"); }
  };

  const moveSelected = (delta: -1 | 1) => {
    if (!selected || !order) return;
    setPresentation((current) => movePresentationItemBy(document, current, selected, delta));
  };

  const completeOrderDrop = (targetId: string) => {
    if (!draggedOrderItem || !order || !order.ids.includes(targetId)) return;
    setPresentation((current) => movePresentationItem(document, current, draggedOrderItem, order.ids.indexOf(targetId)));
    setDraggedOrderItem("");
    setDropOrderItem("");
  };

  const previewWidth = (column: string, value: number) => {
    setWidthPreview((current) => ({ ...current, [column]: Math.max(MIN_COLUMN_WIDTH, value) }));
  };
  const commitWidth = (column: string, value: number) => {
    const width = Math.max(MIN_COLUMN_WIDTH, value);
    setPresentation((current) => ({ ...current, columnWidths: { ...current.columnWidths, [column]: width } }));
    setWidthPreview((current) => { const next = { ...current }; delete next[column]; return next; });
  };
  const cancelWidth = (column: string) => setWidthPreview((current) => { const next = { ...current }; delete next[column]; return next; });
  const resetWidths = () => { setWidthPreview({}); setPresentation((current) => resetMatrixColumnWidths(current)); };
  const columnLabel = (column: string) => column === "structures" ? "Estruturas" : column === "measures" ? "Medidas" : nameFor(document, column);
  const selectedStructure = document.structures.find((item) => item.id === selected);
  const selectedMeasure = document.measures.find((item) => item.id === selected);
  const toggleCollapsed = (kind: "structure" | "measure") => {
    const target = kind === "structure" ? selectedStructure?.id : selectedMeasure?.id;
    if (!target) return;
    setPresentation((current) => {
      const key = kind === "structure" ? "collapsedStructureIds" : "collapsedMeasureIds";
      const ids = current[key];
      return { ...current, [key]: ids.includes(target) ? ids.filter((id) => id !== target) : [...ids, target] };
    });
  };
  const hiddenMeasureCount = selectedStructure ? document.measures.filter((item) => item.structureId === selectedStructure.id).length : 0;
  const selectedDiagnosisItem = document.diagnoses.find((item) => item.id === selectedDiagnosis && !item.deletedAt) ?? (document.diagnosisDrafts ?? []).find((item) => item.id === selectedDiagnosis && !item.deletedAt);
  const updateDiagnosisEditor = (diagnosisId: string, value: DiagnosisEditorValue, mode: "debounced" | "immediate") => {
    const persistEdit = () => {
      try {
        const source = documentRef.current;
        const now = new Date().toISOString();
        const draft = (source.diagnosisDrafts ?? []).find((item) => item.id === diagnosisId && !item.deletedAt);
        const diagnosis = source.diagnoses.find((item) => item.id === diagnosisId && !item.deletedAt);
        if (!draft && !diagnosis) return;
        let next: DiagnosticDocument;
        if (draft) {
          next = updateDiagnosisDraft(source, { ...draft, ...value, updatedAt: now } as DiagnosisDraft);
          const candidate = next.diagnosisDrafts?.find((item) => item.id === diagnosisId);
          const ready = candidate?.kind && candidate.title?.trim() && candidate.coverage?.length && (candidate.kind !== "ambition" || candidate.ambitionOrigin);
          if (ready) next = promoteDiagnosisDraft(next, diagnosisId);
        } else {
          next = updateDiagnosis(source, { ...diagnosis!, ...value, updatedAt: now } as Diagnosis);
        }
        applyDocument(next);
        setError("");
      } catch (cause) {
        setDiagnosisSaveState("error");
        setDiagnosisSaveError(cause instanceof Error ? cause.message : "Não foi possível aplicar a alteração.");
      }
    };
    const pending = editTimers.current.get(diagnosisId);
    if (pending) clearTimeout(pending);
    if (mode === "immediate") {
      editTimers.current.delete(diagnosisId);
      persistEdit();
      return;
    }
    editTimers.current.set(diagnosisId, setTimeout(() => { editTimers.current.delete(diagnosisId); persistEdit(); }, 320));
  };
  const cancelConnect = () => { setConnectOrigin(""); setConnectTarget(""); setRelationType(""); setRelationBusy(false); };
  const activateConnect = () => { setSelected(""); setSelectedDiagnosis(""); setError(""); setConnectOrigin("pending"); };
  const chooseRelationEndpoint = (diagnosisId: string) => {
    if (!document.diagnoses.some((item) => item.id === diagnosisId && !item.deletedAt)) return;
    if (connectOrigin === "pending") { setConnectOrigin(diagnosisId); return; }
    if (connectOrigin && !connectTarget) {
      if (connectOrigin === diagnosisId) { setError("Uma relação precisa conectar dois diagnósticos diferentes."); return; }
      setConnectTarget(diagnosisId); return;
    }
  };
  const saveRelation = () => {
    if (!connectOrigin || connectOrigin === "pending" || !connectTarget || !relationType || relationBusy) return;
    try {
      setRelationBusy(true);
      const source = connectOrigin, target = connectTarget;
      let next: DiagnosticDocument;
      if (relationType === "hierarchy") {
        const existing = directParentOf(documentRef.current, target);
        const replacing = Boolean(existing && existing.parentId !== source);
        if (replacing && !confirm(`Este diagnóstico já possui superior. Substituir o vínculo atual por ${diagnosisNameFor(documentRef.current, source)}?`)) { setRelationBusy(false); return; }
        next = setHierarchy(documentRef.current, { parentId: source, childId: target }, { replaceExistingParent: replacing });
      } else {
        next = createSemanticRelation(documentRef.current, { id: id(), sourceDiagnosisId: source, targetDiagnosisId: target, type: relationType });
      }
      const previous = documentRef.current;
      applyDocument(next).then((persisted) => {
        if (persisted) { cancelConnect(); return; }
        if (documentRef.current === next) { documentRef.current = previous; setDocument(previous); }
        setRelationBusy(false);
        setError("Não foi possível salvar a relação. Revise e tente novamente.");
      });
    } catch (cause) { setRelationBusy(false); setError(cause instanceof Error ? cause.message : "Não foi possível criar a relação."); }
  };
  const mutateRelation = (operation: () => DiagnosticDocument) => {
    try {
      const previous = documentRef.current;
      const next = operation();
      applyDocument(next).then((persisted) => {
        if (!persisted && documentRef.current === next) { documentRef.current = previous; setDocument(previous); setError("Não foi possível salvar a relação. A alteração foi desfeita."); }
        else if (persisted) setError("");
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar a relação."); }
  };
  const createDiagnosis = () => {
    try {
      const now = new Date().toISOString();
      const draft = { id: id(), createdAt: now, updatedAt: now };
      applyDocument(createDiagnosisDraft(documentRef.current, draft));
      setSelected("");
      setSelectedDiagnosis(draft.id);
      setDiagnosisSaveError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o rascunho.");
    }
  };
  const frameDiagnosis = (diagnosisId: string) => {
    const geometry = coverageGeometry.find((item) => item.diagnosisId === diagnosisId);
    const rectangles = geometry?.segments.flatMap((segment) => segment.rectangles) ?? [];
    if (!rectangles.length) return;
    const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
    const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
    const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
    const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
    flow.fitBounds({ x, y, width: right - x, height: bottom - y }, { padding: 0.25, duration: 180 });
  };

  const deleteSelectedDiagnosis = () => {
    if (!selectedDiagnosisItem || !confirm("Excluir logicamente este diagnóstico?")) return;
    const timer = editTimers.current.get(selectedDiagnosisItem.id);
    if (timer) { clearTimeout(timer); editTimers.current.delete(selectedDiagnosisItem.id); }
    try {
      const next = document.diagnoses.some((item) => item.id === selectedDiagnosisItem.id)
        ? deleteDiagnosis(documentRef.current, selectedDiagnosisItem.id, new Date().toISOString())
        : deleteDiagnosisDraft(documentRef.current, selectedDiagnosisItem.id, new Date().toISOString());
      applyDocument(next);
      setSelectedDiagnosis("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir."); }
  };

  const orderTitle = order?.scope === "structure"
    ? "Estruturas Econômicas"
    : order?.scope === "measure"
      ? "Medidas desta Estrutura"
      : order?.scope === "business-unit"
        ? "Unidades de Negócio"
        : "Ordenação visual";

  return (
    <main className="matrix-v3">
      <header>
        <strong>Strategy OS · Matriz Econômica</strong>
        <span>{confirmed ? "Domínio v3" : "Prévia de migração v2"}</span>
        <button className="primary" onClick={() => { setCreateOpen((open) => !open); setSelected(""); }}>Novo elemento</button>
        <button onClick={createDiagnosis} disabled={connectOrigin !== ""}>Novo diagnóstico</button>
        <button className={connectOrigin ? "primary" : ""} aria-pressed={Boolean(connectOrigin)} onClick={connectOrigin ? cancelConnect : activateConnect}>{connectOrigin ? "Cancelar conexão" : "Conectar"}</button>
        <button onClick={() => selectedDiagnosisItem ? frameDiagnosis(selectedDiagnosisItem.id) : flow.fitView({ padding: 0.15 })}>{selectedDiagnosisItem ? "Enquadrar abrangência" : "Enquadrar"}</button>
      </header>
      {!confirmed && (
        <aside>
          <b>Prévia de migração</b>
          <p>{document.structures.length} estruturas, {document.measures.length} medidas e {document.legacyReviewItems.length} item(ns) para revisão. O v2 permanece intacto.</p>
          <button className="primary" onClick={() => setConfirmed(true)}>Confirmar transição para v3</button>
          <button onClick={() => window.location.reload()}>Cancelar migração</button>
        </aside>
      )}
      {createOpen && <section className="matrix-create" aria-label="Cadastrar elemento econômico">
        <header><strong>Criar elemento</strong><button onClick={() => setCreateOpen(false)}>Fechar</button></header>
        <p>Escolha o tipo pelo papel que ele cumpre no diagnóstico.</p>
        <div className="matrix-type-cards">
          <button className={kind === "structure" ? "active" : ""} onClick={() => setKind("structure")}><b>Estrutura Econômica</b><small>Grande dimensão do funcionamento da empresa. Ex.: Motor de crescimento.</small></button>
          <button className={kind === "measure" ? "active" : ""} onClick={() => setKind("measure")}><b>Medida Econômica</b><small>Aspecto analisado dentro de uma Estrutura. Ex.: Receita recorrente.</small></button>
          <button className={kind === "unit" ? "active" : ""} onClick={() => setKind("unit")}><b>Unidade de Negócio</b><small>Parte da empresa para a qual haverá diagnóstico. Ex.: Brasil.</small></button>
          <button className={kind === "group" ? "active" : ""} onClick={() => setKind("group")}><b>Grupo</b><small>Dimensão corporativa, distinta das Unidades de Negócio.</small></button>
        </div>
        <div className="matrix-create-form">
          {kind === "measure" && <select value={parent} onChange={(event) => setParent(event.target.value)} aria-label="Estrutura da Medida"><option value="">Selecione a Estrutura</option>{document.structures.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "structure" ? "Ex.: Crescimento sustentável" : kind === "measure" ? "Ex.: Receita recorrente" : "Nome"} />
          <button className="primary" onClick={() => { create(); setCreateOpen(false); }}>Criar</button>
        </div>
      </section>}
      {selectedDiagnosisItem && <DiagnosisForm
        key={`${selectedDiagnosisItem.id}:${document.diagnoses.some((item) => item.id === selectedDiagnosisItem.id) ? "diagnosis" : "draft"}`}
        document={document}
        item={selectedDiagnosisItem}
        saveState={diagnosisSaveState}
        saveError={diagnosisSaveError}
        onChange={(value, mode) => updateDiagnosisEditor(selectedDiagnosisItem.id, value, mode)}
        onClose={() => setSelectedDiagnosis("")}
        onDelete={deleteSelectedDiagnosis}
        onRetry={() => persistDocument(documentRef.current)}
        relations={{
          onRemoveHierarchy: (parentId) => mutateRelation(() => removeHierarchy(documentRef.current, { parentId, childId: selectedDiagnosisItem.id })),
          onUpdateSemantic: (relationId, type) => { const relation = documentRef.current.semanticRelations.find((item) => item.id === relationId); if (relation) mutateRelation(() => updateSemanticRelation(documentRef.current, { ...relation, type })); },
          onDeleteSemantic: (relationId) => { if (confirm("Excluir esta relação semântica?")) mutateRelation(() => deleteSemanticRelation(documentRef.current, relationId)); },
        }}
      />}
      {(document.diagnosisDrafts ?? []).filter((item) => !item.deletedAt).length > 0 && <aside className="diagnosis-list diagnosis-drafts" aria-label="Diagnósticos não posicionados"><span>Não posicionados</span>{(document.diagnosisDrafts ?? []).filter((item) => !item.deletedAt).map((item) => <button key={item.id} className="diagnosis-chip draft" onClick={() => { setSelectedDiagnosis(item.id); setSelected(""); }}><strong>{item.title?.trim() || "Diagnóstico sem título"}</strong><small>{item.kind === "ambition" ? "Ambição" : item.kind === "objection" ? "Objeção" : "Tipo não definido"}</small></button>)}</aside>}
      {document.diagnoses.filter(item => !item.deletedAt).length > 0 && <aside className="diagnosis-list diagnoses-ready" aria-label="Diagnósticos prontos para posicionamento"><span>Prontos para posicionamento</span>{document.diagnoses.filter(item => !item.deletedAt).map(item => <button key={item.id} className={`diagnosis-chip ${item.kind}`} onClick={() => { setSelectedDiagnosis(item.id); setSelected(""); }}><strong>{item.title}</strong><small>{item.kind === "ambition" ? "Ambição" : "Objeção"} · {item.coverage.length} interseção(ões)</small></button>)}</aside>}
      {selected && <aside className="matrix-context" aria-label="Painel contextual">
        <header><div><strong>{nameFor(document, selected)}</strong><small>{selectedStructure ? "Estrutura Econômica" : selectedMeasure ? "Medida Econômica" : "Unidade de Negócio ou Grupo"}</small></div><button aria-label="Fechar painel" title="Fechar painel" onClick={() => { setSelected(""); setMoreActionsOpen(false); }}>Fechar painel</button></header>
        <section className="matrix-toolbar matrix-context-section" aria-label="Ações principais"><h2>Ações principais</h2>
        <button onClick={edit}>Editar</button>
        {selectedStructure && <button onClick={() => toggleCollapsed("structure")}>{presentation.collapsedStructureIds.includes(selectedStructure.id) ? `Expandir Estrutura (${hiddenMeasureCount} Medidas)` : "Recolher Estrutura"}</button>}
        {selectedMeasure && <button onClick={() => toggleCollapsed("measure")}>{presentation.collapsedMeasureIds.includes(selectedMeasure.id) ? "Expandir Medida" : "Recolher Medida"}</button>}
        <button onClick={() => setMoreActionsOpen((open) => !open)}>Mais ações</button>
        {moreActionsOpen && <div className="matrix-more-actions">{selectedMeasure && <><button onClick={transferMeasure}>Transferir Medida</button><button onClick={removeMeasure}>Excluir Medida</button></>}{selectedStructure && <button onClick={removeStructure}>Excluir Estrutura</button>}{document.organizationalUnits.find((item) => item.id === selected && item.kind === "business-unit") && <><button onClick={moveBu}>Transferir BU</button><button onClick={toggleBu}>Ativar/desativar BU</button></>}</div>}
        </section>
      <section className="matrix-ordering matrix-context-section" aria-label="Organização">
        <div><strong>{orderTitle}</strong><span>{order ? " A ordem é visual e não altera vínculos econômicos." : " Selecione uma Estrutura, Medida ou BU para organizar."}</span></div>
        <div className="matrix-ordering-actions">
          <button disabled={!order || selectedIndex <= 0} onClick={() => moveSelected(-1)}>Mover acima</button>
          <button disabled={!order || selectedIndex < 0 || selectedIndex >= order.ids.length - 1} onClick={() => moveSelected(1)}>Mover abaixo</button>
        </div>
        {order && <ul aria-label={`Ordem: ${orderTitle}`}>
          {order.ids.map((itemId) => <li
            key={itemId}
            data-order-id={itemId}
            draggable
            className={`${itemId === selected ? "is-selected" : ""}${itemId === draggedOrderItem ? " is-dragging" : ""}${itemId === dropOrderItem ? " is-drop-target" : ""}`}
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", itemId); setDraggedOrderItem(itemId); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropOrderItem(itemId); }}
            onDrop={(event) => { event.preventDefault(); completeOrderDrop(itemId); }}
            onDragEnd={() => { setDraggedOrderItem(""); setDropOrderItem(""); }}
          >
            <button onClick={() => { setSelected(itemId); setMoreActionsOpen(false); }} aria-pressed={itemId === selected}>{nameFor(document, itemId)}</button>
          </li>)}
        </ul>}
      </section>
      <section className="matrix-sizing matrix-context-section" aria-label="Dimensões">
        <div><strong>Dimensões das colunas</strong><span>Arraste a alça para pré-visualizar; a largura é salva ao soltar.</span></div>
        <div className="matrix-sizing-controls">
          {layout.columns.map((column) => {
            const value = widthPreview[column] ?? presentation.columnWidths[column] ?? DEFAULT_COLUMN_WIDTH;
            return <label key={column} className={widthPreview[column] ? "is-resizing" : ""}>
              <span>{columnLabel(column)} <output>{value}px</output></span>
              <input
                aria-label={`Largura: ${columnLabel(column)}`}
                type="range" min={MIN_COLUMN_WIDTH} max="640" step="10" value={value}
                onPointerDown={() => previewWidth(column, value)}
                onChange={(event) => previewWidth(column, Number(event.target.value))}
                onPointerUp={(event) => commitWidth(column, Number(event.currentTarget.value))}
                onPointerCancel={() => cancelWidth(column)}
                onBlur={(event) => { if (widthPreview[column] !== undefined) commitWidth(column, Number(event.currentTarget.value)); }}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelWidth(column); event.currentTarget.blur(); } }}
                onKeyUp={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") commitWidth(column, Number(event.currentTarget.value)); }}
              />
            </label>;
          })}
          <button onClick={resetWidths}>Restaurar larguras padrão</button>
        </div>
      </section></aside>}
      {connectTarget && <aside className="relation-choice" aria-label="Escolher tipo de relação"><strong>Criar relação</strong><p><b>{diagnosisNameFor(document, connectOrigin)}</b> → <b>{diagnosisNameFor(document, connectTarget)}</b></p><label>Tipo<select aria-label="Tipo da relação" value={relationType} onChange={(event) => setRelationType(event.target.value as "hierarchy" | SemanticRelationType)}><option value="">Selecione o tipo</option><option value="hierarchy">Hierarquia — Superior → Filho</option><option value="hinders">Dificulta</option><option value="contributes-to">Contribui para</option><option value="depends-on">Depende de</option></select></label><div><button onClick={cancelConnect}>Cancelar</button><button className="primary" disabled={!relationType || relationBusy} onClick={saveRelation}>{relationBusy ? "Salvando…" : "Confirmar relação"}</button></div></aside>}
      {connectOrigin && !connectTarget && <p className="connect-status" role="status">{connectOrigin === "pending" ? "Conectar: selecione a origem." : `Conectar: ${diagnosisNameFor(document, connectOrigin)} selecionado. Selecione o destino.`}</p>}
      {error && <p className="matrix-error">{error}</p>}
      <div className={`matrix-flow${selectedDiagnosisItem ? " has-diagnosis-editor" : ""}`} onPointerCancel={() => { if (connectOrigin) cancelConnect(); }}>
        <ReactFlow nodes={[...nodes, ...diagnosisNodes]} nodeTypes={diagnosisNodeTypes} edgeTypes={diagnosisEdgeTypes} edges={diagnosisEdges} fitView nodesDraggable={false} onNodeClick={(_, node) => { const diagnosisId = diagnosisIdFromNodeId(node.id); if (diagnosisId) { if (connectOrigin) { chooseRelationEndpoint(diagnosisId); return; } setSelectedDiagnosis(diagnosisId); setSelected(""); requestAnimationFrame(() => requestAnimationFrame(() => frameDiagnosis(diagnosisId))); return; } if (!connectOrigin) { setSelected(node.id); setMoreActionsOpen(false); } }} onPaneClick={() => { if (connectOrigin) setError("Selecione um cartão de diagnóstico válido para conectar."); }} onKeyDown={(event) => { if (event.key === "Escape" && connectOrigin) cancelConnect(); }}>
          <Background /><Controls /><MiniMap />
        </ReactFlow>
      </div>
    </main>
  );
}

export function EconomicMatrixApp() {
  return <ReactFlowProvider><Matrix /></ReactFlowProvider>;
}
