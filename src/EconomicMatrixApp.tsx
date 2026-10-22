import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DomainValidationError, type Diagnosis, type DiagnosisDraft, type DiagnosticDocument, type EconomicMeasure, type EconomicStructure, type OrganizationalUnit, type SemanticRelationType } from "./domain/model";
import {
  createDiagnosisDraft,
  createEconomicMeasure,
  createEconomicStructure,
  deleteMeasure,
  deleteEmptyStructure,
  transferStructureMeasuresAndDelete,
  updateDiagnosis,
  deleteDiagnosisDraft,
  promoteDiagnosisDraft,
  updateDiagnosisDraft,
  updateEconomicMeasure,
  updateEconomicStructure,
} from "./domain/commands";
import {
  auditedCreateOrganizationalUnit,
  auditedCreateSemanticRelation,
  auditedDeactivateBusinessUnit,
  auditedDeleteDiagnosis,
  auditedDeleteSemanticRelation,
  auditedReactivateBusinessUnit,
  auditedRemoveHierarchy,
  auditedSetHierarchy,
  auditedTransferBusinessUnit,
  auditedUpdateOrganizationalUnit,
  auditedUpdateSemanticRelation,
  type AuditOperationContext,
} from "./domain/auditedCommands";
import { economicMatrixNodes } from "./flow/economicMatrixAdapter";
import { diagnosisIdFromNodeId, diagnosisNodeTypes, diagnosisVisibleDocument, diagnosisVisualNodes } from "./flow/diagnosisVisualAdapter";
import { diagnosisRelationEdges } from "./flow/diagnosisRelationAdapter";
import { diagnosisEdgeTypes } from "./flow/DiagnosisRelationEdge";
import { DEFAULT_COLUMN_WIDTH, layoutEconomicMatrix, MIN_COLUMN_WIDTH, type MatrixPresentation } from "./layout/economicMatrix";
import { layoutDiagnosisCoverage } from "./layout/diagnosisCoverageGeometry";
import { planDiagnosisReveal, resolveDiagnosisVisibility, type DiagnosisVisibilityPresentation } from "./layout/diagnosisVisibility";
import { loadDiagnosisVisibilityPresentation, sanitizeDiagnosisVisibilityPresentation, saveDiagnosisVisibilityPresentation } from "./layout/visibilityPresentationStorage";
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
import { beginDiagnosisEditSession, recordDiagnosisEditSession, sealDiagnosisEditSession, sealOpenAuditSessions, type DiagnosisEditSession } from "./domain/auditSessions";
import { exportDiagnosticDocument, loadDiagnosticDocument } from "./persistence/diagnosticStorage";
import { GuardedDocumentStore, STALE_DOCUMENT_MESSAGE, StaleDocumentError, type LockManagerLike } from "./persistence/documentStore";
import { StaleDocumentBanner } from "./StaleDocumentBanner";
import { DiagnosisForm, type DiagnosisEditorValue } from "./DiagnosisForm";
import { directParentOf } from "./domain/relations";
import { auditHistoryForBusinessUnit } from "./domain/auditHistory";
import { AuditHistorySection } from "./history/AuditHistorySection";
import { GeneralHistoryDialog } from "./history/GeneralHistoryDialog";
import { ReorganizationDialog, type ReorganizationParams, type ReorganizationRequest } from "./ReorganizationDialog";

const id = () => crypto.randomUUID?.() ?? `v3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nameFor = (document: DiagnosticDocument, itemId: string) =>
  document.structures.find((item) => item.id === itemId)?.name ??
  document.measures.find((item) => item.id === itemId)?.name ??
  document.organizationalUnits.find((item) => item.id === itemId)?.name ??
  itemId;
/** One business operation = one operation ID and one timestamp for every event it produces. */
const auditContext = (): AuditOperationContext => ({ operationId: id(), occurredAt: new Date().toISOString() });
const diagnosisNameFor = (document: DiagnosticDocument, itemId: string) => document.diagnoses.find((item) => item.id === itemId)?.title ?? itemId;

function Matrix() {
  // Editing sessions left open by a reload or closed tab are sealed in memory; the next write persists it.
  // The store remembers the exact stored version this tab is based on and refuses to overwrite a newer one saved by another tab.
  const [loaded] = useState(() => { const result = loadDiagnosticDocument(localStorage); return { ...result, document: sealOpenAuditSessions(result.document), store: new GuardedDocumentStore(localStorage, result.raw, (typeof navigator !== "undefined" ? navigator.locks : undefined) as unknown as LockManagerLike | undefined) }; });
  const documentStore = loaded.store;
  const [stale, setStale] = useState(false);
  const [staleDownloadError, setStaleDownloadError] = useState("");
  const unloading = useRef(false);
  const [document, setDocument] = useState<DiagnosticDocument>(loaded.document);
  const [presentation, setPresentation] = useState<MatrixPresentation>(() =>
    loadMatrixPresentation(localStorage, loaded.document),
  );
  const [visibilityPresentation, setVisibilityPresentation] = useState<DiagnosisVisibilityPresentation>(() =>
    loadDiagnosisVisibilityPresentation(localStorage, loaded.document),
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
  const [hiddenRelationsFor, setHiddenRelationsFor] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reorganization, setReorganization] = useState<ReorganizationRequest | null>(null);
  const [reorganizationBusy, setReorganizationBusy] = useState(false);
  // The history UI reads only what was actually written: updated after each successful write, never ahead of storage.
  const [persistedDocument, setPersistedDocument] = useState<DiagnosticDocument>(loaded.document);
  const documentRef = useRef(document);
  const persistedVisibilityPresentation = useRef(visibilityPresentation);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const editTimers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());
  const editSessions = useRef(new Map<string, DiagnosisEditSession>());
  const closeAllSessions = useRef(() => {});
  const wasConfirmed = useRef(confirmed);
  const flow = useReactFlow();

  useEffect(() => { documentRef.current = document; }, [document]);
  const persistDocument = (snapshot: DiagnosticDocument): Promise<boolean> => {
    if (!confirmed) return Promise.resolve(false);
    const revision = ++saveRevision.current;
    setDiagnosisSaveState("saving");
    const persist = async () => {
      try {
        // While the page is unloading the write must stay synchronous (a lock request could outlive the page).
        setPersistedDocument(await documentStore.save(snapshot, { exclusive: !unloading.current }));
        if (revision === saveRevision.current) { setDiagnosisSaveState("saved"); setDiagnosisSaveError(""); }
        return true;
      } catch (cause) {
        if (cause instanceof StaleDocumentError) setStale(true);
        if (revision === saveRevision.current) {
          setDiagnosisSaveState("error");
          setDiagnosisSaveError(cause instanceof StaleDocumentError ? STALE_DOCUMENT_MESSAGE : cause instanceof Error ? cause.message : "Não foi possível salvar no navegador.");
        }
        return false;
      }
    };
    const queued = saveQueue.current.then(persist, persist);
    saveQueue.current = queued.then(() => undefined);
    return queued;
  };
  /** A write refused because another tab saved a newer version must say so, not just "could not save". */
  const failureText = (fallback: string) => documentStore.stale ? STALE_DOCUMENT_MESSAGE : fallback;
  const applyDocument = (next: DiagnosticDocument) => {
    documentRef.current = next;
    setDocument(next);
    return persistDocument(next);
  };
  /**
   * Runs an audited operation as one transaction: the new document already carries its history events, so
   * a single write persists both. If the write fails the whole operation (change and events) is undone in
   * memory, which keeps the screen consistent with what was actually saved. Resolves to whether it persisted.
   */
  const commitOperation = (operation: (source: DiagnosticDocument) => DiagnosticDocument, failureMessage: string): Promise<boolean> => {
    const previous = documentRef.current;
    let next: DiagnosticDocument;
    try { next = operation(previous); } catch (cause) { setError(cause instanceof Error ? cause.message : "Operação bloqueada"); return Promise.resolve(false); }
    return applyDocument(next).then((persisted) => {
      if (persisted) setError("");
      else if (documentRef.current === next) { documentRef.current = previous; setDocument(previous); setError(failureText(failureMessage)); }
      return persisted;
    });
  };
  useEffect(() => { if (!wasConfirmed.current && confirmed) persistDocument(documentRef.current); wasConfirmed.current = confirmed; }, [confirmed]);
  useEffect(() => () => { editTimers.current.forEach(({ timer }) => clearTimeout(timer)); }, []);
  // A reload or closed tab must not lose the audited edit nor leave its session open.
  useEffect(() => {
    const flush = () => { unloading.current = true; closeAllSessions.current(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) unloading.current = false; };
    // Another tab saved the document: this tab is now outdated. Warn immediately, before the user even tries to save.
    const onStorage = (event: StorageEvent) => { if (documentStore.noteStorageEvent(event.key, event.newValue)) setStale(true); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("pageshow", restored);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("pageshow", restored); window.removeEventListener("storage", onStorage); };
  }, []);
  /** Safe recovery: export the in-memory document (including the edits that could not be saved) as a validated JSON file. */
  const downloadLocalChanges = () => {
    try {
      const blob = new Blob([exportDiagnosticDocument(documentRef.current)], { type: "application/json" });
      const link = window.document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `strategy-os-alteracoes-locais-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setStaleDownloadError("");
    } catch (cause) { setStaleDownloadError(cause instanceof Error ? `Não foi possível gerar o arquivo: ${cause.message}` : "Não foi possível gerar o arquivo."); }
  };
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

  useEffect(() => {
    const sanitized = sanitizeDiagnosisVisibilityPresentation(visibilityPresentation, document);
    if (JSON.stringify(sanitized) !== JSON.stringify(visibilityPresentation)) {
      setVisibilityPresentation(sanitized);
      return;
    }
    try {
      saveDiagnosisVisibilityPresentation(localStorage, sanitized);
      persistedVisibilityPresentation.current = sanitized;
    } catch {
      setVisibilityPresentation(persistedVisibilityPresentation.current);
      setError("Não foi possível salvar o recolhimento hierárquico.");
    }
  }, [document, visibilityPresentation]);

  const renderedPresentation = useMemo<MatrixPresentation>(() => ({ ...presentation, columnWidths: { ...presentation.columnWidths, ...widthPreview } }), [presentation, widthPreview]);
  const layout = useMemo(() => layoutEconomicMatrix(document, renderedPresentation), [document, renderedPresentation]);
  const nodes = useMemo(() => economicMatrixNodes(document, renderedPresentation), [document, renderedPresentation]);
  const visibility = useMemo(() => resolveDiagnosisVisibility(document, renderedPresentation, visibilityPresentation), [document, renderedPresentation, visibilityPresentation]);
  const visibleDocument = useMemo(() => diagnosisVisibleDocument(document, visibility), [document, visibility]);
  const coverageGeometry = useMemo(() => layoutDiagnosisCoverage(visibleDocument, renderedPresentation), [visibleDocument, renderedPresentation]);
  const diagnosisNodes = useMemo(() => diagnosisVisualNodes(document, renderedPresentation, selectedDiagnosis, visibility, {
    onToggleHierarchy: (diagnosisId) => setVisibilityPresentation((current) => ({ ...current, collapsedDiagnosisIds: current.collapsedDiagnosisIds.includes(diagnosisId) ? current.collapsedDiagnosisIds.filter((item) => item !== diagnosisId) : [...current.collapsedDiagnosisIds, diagnosisId] })),
    onOpenHiddenRelations: setHiddenRelationsFor,
  }), [document, renderedPresentation, selectedDiagnosis, visibility]);
  const diagnosisEdges = useMemo(() => diagnosisRelationEdges(document, renderedPresentation, visibility), [document, renderedPresentation, visibility]);
  const order = useMemo(
    () => (selected ? presentationOrderFor(document, presentation, selected) : undefined),
    [document, presentation, selected],
  );
  const selectedIndex = order?.ids.indexOf(selected) ?? -1;

  const create = () => {
    if (!name.trim()) return;
    if (kind === "unit" || kind === "group") {
      const unit = { id: id(), kind: kind === "group" ? "group" : "business-unit", name: name.trim(), active: true } as OrganizationalUnit;
      commitOperation((source) => auditedCreateOrganizationalUnit(source, unit, auditContext()), "Não foi possível salvar a unidade. A criação foi desfeita.").then((persisted) => { if (persisted) setName(""); });
      return;
    }
    try {
      const next =
        kind === "structure"
          ? createEconomicStructure(document, { id: id(), name: name.trim(), description: "" } as EconomicStructure)
          : parent
            ? createEconomicMeasure(document, { id: id(), name: name.trim(), structureId: parent } as EconomicMeasure)
            : (() => { throw new Error("Selecione uma Estrutura."); })();
      applyDocument(next);
      setName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o elemento.");
    }
  };

  /** Every economic reorganization is confirmed in a contextual dialog; the operation itself is the existing (audited) domain command. */
  const edit = () => { if (selected) openReorganization({ kind: "rename", targetId: selected }); };
  const toggleBu = () => { if (selectedUnit?.kind === "business-unit") openReorganization({ kind: "business-unit-status", unitId: selectedUnit.id }); };
  const removeStructure = () => { if (selected) openReorganization({ kind: "structure-remove", structureId: selected }); };
  const moveBu = () => { if (selectedUnit?.kind === "business-unit") openReorganization({ kind: "business-unit-transfer", unitId: selectedUnit.id }); };
  const transferMeasure = () => { if (selected) openReorganization({ kind: "measure-transfer", measureId: selected }); };
  const removeMeasure = () => { if (selected) openReorganization({ kind: "measure-remove", measureId: selected }); };
  const openReorganization = (request: ReorganizationRequest) => { setError(""); setReorganization(request); };
  const closeReorganization = () => { if (!reorganizationBusy) { setReorganization(null); setError(""); } };
  const confirmReorganization = (params: ReorganizationParams) => {
    if (!reorganization || reorganizationBusy) return;
    const request = reorganization;
    const failure = "Não foi possível salvar a alteração. Nada foi aplicado; revise e tente novamente.";
    const operation = (source: DiagnosticDocument): DiagnosticDocument => {
      switch (request.kind) {
        case "rename": {
          const structure = source.structures.find((item) => item.id === request.targetId);
          const measure = source.measures.find((item) => item.id === request.targetId);
          const unit = source.organizationalUnits.find((item) => item.id === request.targetId);
          if (structure) return updateEconomicStructure(source, { ...structure, name: params.name! });
          if (measure) return updateEconomicMeasure(source, { ...measure, name: params.name! });
          if (unit) return auditedUpdateOrganizationalUnit(source, { ...unit, name: params.name! }, auditContext());
          throw new Error("O elemento não existe mais.");
        }
        case "business-unit-transfer": return auditedTransferBusinessUnit(source, request.unitId, params.destinationId!, auditContext());
        case "business-unit-status": {
          const unit = source.organizationalUnits.find((item) => item.id === request.unitId);
          return unit?.active ? auditedDeactivateBusinessUnit(source, request.unitId, auditContext()) : auditedReactivateBusinessUnit(source, request.unitId, auditContext());
        }
        case "structure-remove": return source.measures.some((item) => item.structureId === request.structureId) ? transferStructureMeasuresAndDelete(source, request.structureId, params.destinationId!) : deleteEmptyStructure(source, request.structureId);
        case "measure-transfer": {
          const measure = source.measures.find((item) => item.id === request.measureId);
          if (!measure) throw new Error("A Medida não existe mais.");
          return updateEconomicMeasure(source, { ...measure, structureId: params.destinationId! });
        }
        case "measure-remove": return deleteMeasure(source, request.measureId);
      }
    };
    setReorganizationBusy(true);
    commitOperation(operation, failure).then((persisted) => {
      setReorganizationBusy(false);
      if (!persisted) return;
      setReorganization(null);
      if (request.kind !== "rename" && request.kind !== "business-unit-status") setSelected("");
    });
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
  const selectedUnit = document.organizationalUnits.find((item) => item.id === selected);
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
  const hiddenDiagnosisCountForMeasure = selectedMeasure ? (visibility.hiddenDiagnosisIdsByMeasure[selectedMeasure.id] ?? []).length : 0;
  const selectedDiagnosisItem = document.diagnoses.find((item) => item.id === selectedDiagnosis && !item.deletedAt) ?? (document.diagnosisDrafts ?? []).find((item) => item.id === selectedDiagnosis && !item.deletedAt);
  /** Folds an autosave into the diagnosis' editing session so the history gets one event per session. */
  const recordEditSession = (source: DiagnosticDocument, next: DiagnosticDocument, diagnosisId: string) => {
    let session = editSessions.current.get(diagnosisId);
    if (!session) { session = beginDiagnosisEditSession(source, diagnosisId, id()); editSessions.current.set(diagnosisId, session); }
    return recordDiagnosisEditSession(next, session, { occurredAt: new Date().toISOString() });
  };
  /** Ends the editing session: runs the pending autosave (unless discarded) and seals the session event. */
  const closeEditSession = (diagnosisId: string, options: { discardPending?: boolean } = {}) => {
    const pending = editTimers.current.get(diagnosisId);
    if (pending) { clearTimeout(pending.timer); editTimers.current.delete(diagnosisId); if (!options.discardPending) pending.run(); }
    const session = editSessions.current.get(diagnosisId);
    editSessions.current.delete(diagnosisId);
    if (!session) return;
    const source = documentRef.current;
    const sealed = sealDiagnosisEditSession(source, session);
    if (sealed !== source) applyDocument(sealed);
  };
  closeAllSessions.current = () => new Set([...editTimers.current.keys(), ...editSessions.current.keys()]).forEach((diagnosisId) => closeEditSession(diagnosisId));
  useEffect(() => { [...new Set([...editTimers.current.keys(), ...editSessions.current.keys()])].filter((diagnosisId) => diagnosisId !== selectedDiagnosis).forEach((diagnosisId) => closeEditSession(diagnosisId)); }, [selectedDiagnosis]);
  const updateDiagnosisEditor = (diagnosisId: string, value: DiagnosisEditorValue, mode: "debounced" | "immediate") => {
    const persistEdit = () => {
      try {
        const source = documentRef.current;
        const now = new Date().toISOString();
        const draft = (source.diagnosisDrafts ?? []).find((item) => item.id === diagnosisId && !item.deletedAt);
        const diagnosis = source.diagnoses.find((item) => item.id === diagnosisId && !item.deletedAt);
        if (!draft && !diagnosis) return;
        let next: DiagnosticDocument;
        let promotionRefusal = "";
        if (draft) {
          next = updateDiagnosisDraft(source, { ...draft, ...value, updatedAt: now } as DiagnosisDraft);
          const candidate = next.diagnosisDrafts?.find((item) => item.id === diagnosisId);
          const ready = candidate?.kind && candidate.title?.trim() && candidate.coverage?.length && (candidate.kind !== "ambition" || candidate.ambitionOrigin);
          if (ready) {
            // Only the promotion may be refused (for example legacy intersections pointing to a removed BU or Measure);
            // the edit itself is valid and must still be saved as a draft instead of being discarded.
            try { next = promoteDiagnosisDraft(next, diagnosisId); }
            catch (cause) { if (!(cause instanceof DomainValidationError)) throw cause; promotionRefusal = cause.message; }
          }
        } else {
          next = updateDiagnosis(source, { ...diagnosis!, ...value, updatedAt: now } as Diagnosis);
        }
        // Document change and its history event are produced together and persisted in one write.
        next = recordEditSession(source, next, diagnosisId);
        applyDocument(next);
        setError(promotionRefusal ? `Alterações salvas no rascunho, mas ele não pode ser posicionado na matriz: ${promotionRefusal} (dados antigos foram preservados).` : "");
      } catch (cause) {
        setDiagnosisSaveState("error");
        setDiagnosisSaveError(cause instanceof Error ? cause.message : "Não foi possível aplicar a alteração.");
      }
    };
    const pending = editTimers.current.get(diagnosisId);
    if (pending) clearTimeout(pending.timer);
    if (mode === "immediate") {
      editTimers.current.delete(diagnosisId);
      persistEdit();
      return;
    }
    editTimers.current.set(diagnosisId, { timer: setTimeout(() => { editTimers.current.delete(diagnosisId); persistEdit(); }, 320), run: persistEdit });
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
        next = auditedSetHierarchy(documentRef.current, { parentId: source, childId: target }, auditContext(), { replaceExistingParent: replacing });
      } else {
        next = auditedCreateSemanticRelation(documentRef.current, { id: id(), sourceDiagnosisId: source, targetDiagnosisId: target, type: relationType }, auditContext());
      }
      const previous = documentRef.current;
      applyDocument(next).then((persisted) => {
        if (persisted) { cancelConnect(); return; }
        if (documentRef.current === next) { documentRef.current = previous; setDocument(previous); }
        setRelationBusy(false);
        setError(failureText("Não foi possível salvar a relação. Revise e tente novamente."));
      });
    } catch (cause) { setRelationBusy(false); setError(cause instanceof Error ? cause.message : "Não foi possível criar a relação."); }
  };
  const mutateRelation = (operation: (source: DiagnosticDocument) => DiagnosticDocument) => { commitOperation(operation, "Não foi possível salvar a relação. A alteração foi desfeita."); };
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

  const revealDiagnosis = (diagnosisId: string) => {
    const plan = planDiagnosisReveal(documentRef.current, presentation, visibilityPresentation, diagnosisId);
    if (!plan.canReveal) {
      setError("Este diagnóstico não pode ser revelado porque não possui uma interseção organizacional ativa.");
      return;
    }
    setVisibilityPresentation((current) => ({ ...current, collapsedDiagnosisIds: current.collapsedDiagnosisIds.filter((item) => !plan.expandDiagnosisIds.includes(item)) }));
    setPresentation((current) => ({
      ...current,
      collapsedMeasureIds: current.collapsedMeasureIds.filter((item) => !plan.expandMeasureIds.includes(item)),
      collapsedStructureIds: current.collapsedStructureIds.filter((item) => !plan.expandStructureIds.includes(item)),
    }));
    setHiddenRelationsFor("");
    setSelectedDiagnosis(diagnosisId);
    setError("");
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => frameDiagnosis(diagnosisId))));
  };
  const hiddenRelationItems = hiddenRelationsFor ? visibility.hiddenRelationIndicators.filter((item) => item.diagnosisId === hiddenRelationsFor) : [];

  const deleteSelectedDiagnosis = () => {
    if (!selectedDiagnosisItem || !confirm("Excluir logicamente este diagnóstico?")) return;
    closeEditSession(selectedDiagnosisItem.id, { discardPending: true });
    const diagnosisId = selectedDiagnosisItem.id;
    const isDiagnosis = documentRef.current.diagnoses.some((item) => item.id === diagnosisId);
    // Drafts are not diagnoses and have no history; a diagnosis deletion is audited with the end of its relations.
    commitOperation(
      (source) => isDiagnosis ? auditedDeleteDiagnosis(source, diagnosisId, new Date().toISOString(), auditContext()) : deleteDiagnosisDraft(source, diagnosisId, new Date().toISOString()),
      "Não foi possível salvar a exclusão. O diagnóstico foi mantido.",
    ).then((persisted) => { if (persisted) setSelectedDiagnosis(""); });
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
        <button className="audit-open" onClick={() => setHistoryOpen(true)} disabled={connectOrigin !== ""}>Histórico geral</button>
        <button className={connectOrigin ? "primary" : ""} aria-pressed={Boolean(connectOrigin)} onClick={connectOrigin ? cancelConnect : activateConnect}>{connectOrigin ? "Cancelar conexão" : "Conectar"}</button>
        <button onClick={() => selectedDiagnosisItem ? frameDiagnosis(selectedDiagnosisItem.id) : flow.fitView({ padding: 0.15 })}>{selectedDiagnosisItem ? "Enquadrar abrangência" : "Enquadrar"}</button>
      </header>
      {stale && <StaleDocumentBanner onDownload={downloadLocalChanges} onReload={() => window.location.reload()} downloadError={staleDownloadError} />}
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
        auditDocument={persistedDocument}
        relations={{
          onRemoveHierarchy: (parentId) => mutateRelation((source) => auditedRemoveHierarchy(source, { parentId, childId: selectedDiagnosisItem.id }, auditContext())),
          onUpdateSemantic: (relationId, type) => { const relation = documentRef.current.semanticRelations.find((item) => item.id === relationId); if (relation) mutateRelation((source) => auditedUpdateSemanticRelation(source, { ...relation, type }, auditContext())); },
          onDeleteSemantic: (relationId) => { if (confirm("Excluir esta relação semântica?")) mutateRelation((source) => auditedDeleteSemanticRelation(source, relationId, auditContext())); },
        }}
      />}
      {(document.diagnosisDrafts ?? []).filter((item) => !item.deletedAt).length > 0 && <aside className="diagnosis-list diagnosis-drafts" aria-label="Diagnósticos não posicionados"><span>Não posicionados</span>{(document.diagnosisDrafts ?? []).filter((item) => !item.deletedAt).map((item) => <button key={item.id} className="diagnosis-chip draft" onClick={() => { setSelectedDiagnosis(item.id); setSelected(""); }}><strong>{item.title?.trim() || "Diagnóstico sem título"}</strong><small>{item.kind === "ambition" ? "Ambição" : item.kind === "objection" ? "Objeção" : "Tipo não definido"}</small></button>)}</aside>}
      {document.diagnoses.filter(item => !item.deletedAt).length > 0 && <aside className="diagnosis-list diagnoses-ready" aria-label="Diagnósticos prontos para posicionamento"><span>Prontos para posicionamento</span>{document.diagnoses.filter(item => !item.deletedAt).map(item => <button key={item.id} className={`diagnosis-chip ${item.kind}`} onClick={() => { setSelectedDiagnosis(item.id); setSelected(""); }}><strong>{item.title}</strong><small>{item.kind === "ambition" ? "Ambição" : "Objeção"} · {item.coverage.length} interseção(ões)</small></button>)}</aside>}
      {selected && <aside className="matrix-context" aria-label="Painel contextual">
        <header><div><strong>{nameFor(document, selected)}</strong><small>{selectedStructure ? "Estrutura Econômica" : selectedMeasure ? "Medida Econômica" : "Unidade de Negócio ou Grupo"}</small></div><button aria-label="Fechar painel" title="Fechar painel" onClick={() => { setSelected(""); setMoreActionsOpen(false); }}>Fechar painel</button></header>
        <section className="matrix-toolbar matrix-context-section" aria-label="Ações principais"><h2>Ações principais</h2>
        <button onClick={edit}>Editar</button>
        {selectedStructure && <button onClick={() => toggleCollapsed("structure")}>{presentation.collapsedStructureIds.includes(selectedStructure.id) ? `Expandir Estrutura (${hiddenMeasureCount} Medidas)` : "Recolher Estrutura"}</button>}
        {selectedMeasure && <button onClick={() => toggleCollapsed("measure")}>{presentation.collapsedMeasureIds.includes(selectedMeasure.id) ? `Expandir Medida${hiddenDiagnosisCountForMeasure ? ` (${hiddenDiagnosisCountForMeasure} diagnóstico${hiddenDiagnosisCountForMeasure === 1 ? "" : "s"} oculto${hiddenDiagnosisCountForMeasure === 1 ? "" : "s"})` : ""}` : "Recolher Medida"}</button>}
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
      </section>
      {selectedUnit?.kind === "business-unit" && <AuditHistorySection document={persistedDocument} events={auditHistoryForBusinessUnit(persistedDocument, selectedUnit.id)} emptyText="Nenhuma alteração gravada para esta unidade." />}
      </aside>}
      {reorganization && <ReorganizationDialog request={reorganization} document={document} busy={reorganizationBusy} error={error} onCancel={closeReorganization} onConfirm={confirmReorganization} />}
      {historyOpen && <GeneralHistoryDialog document={persistedDocument} onClose={() => setHistoryOpen(false)} />}
      {connectTarget && <aside className="relation-choice" aria-label="Escolher tipo de relação"><strong>Criar relação</strong><p><b>{diagnosisNameFor(document, connectOrigin)}</b> → <b>{diagnosisNameFor(document, connectTarget)}</b></p><label>Tipo<select aria-label="Tipo da relação" value={relationType} onChange={(event) => setRelationType(event.target.value as "hierarchy" | SemanticRelationType)}><option value="">Selecione o tipo</option><option value="hierarchy">Hierarquia — Superior → Filho</option><option value="hinders">Dificulta</option><option value="contributes-to">Contribui para</option><option value="depends-on">Depende de</option></select></label><div><button onClick={cancelConnect}>Cancelar</button><button className="primary" disabled={!relationType || relationBusy} onClick={saveRelation}>{relationBusy ? "Salvando…" : "Confirmar relação"}</button></div></aside>}
      {hiddenRelationsFor && <aside className="hidden-relations-list" aria-label="Relações ocultas"><header><strong>Relações ocultas</strong><button aria-label="Fechar relações ocultas" onClick={() => setHiddenRelationsFor("")}>Fechar</button></header>{hiddenRelationItems.length ? <ul>{hiddenRelationItems.map((item) => <li key={`${item.kind}:${item.relationId}`}><strong>{diagnosisNameFor(document, item.relatedDiagnosisId)}</strong><small>{item.kind === "hierarchy" ? "Hierarquia" : item.kind === "hinders" ? "Dificulta" : item.kind === "contributes-to" ? "Contribui para" : "Depende de"} · {item.direction === "outgoing" ? "saída" : "entrada"}</small><span>{item.reasons.map((reason) => reason.kind === "hierarchy" ? "ramo recolhido" : reason.kind === "measure" ? "Medida recolhida" : reason.kind === "structure" ? "Estrutura recolhida" : "unidade inativa").join(", ")}</span><button onClick={() => revealDiagnosis(item.relatedDiagnosisId)}>Revelar</button></li>)}</ul> : <p>Não há relações ocultas para este diagnóstico.</p>}</aside>}
      {connectOrigin && !connectTarget && <p className="connect-status" role="status">{connectOrigin === "pending" ? "Conectar: selecione a origem." : `Conectar: ${diagnosisNameFor(document, connectOrigin)} selecionado. Selecione o destino.`}</p>}
      {error && !reorganization && <p className="matrix-error">{error}</p>}
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
