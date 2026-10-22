import type { CoverageIntersection, DiagnosticDocument, EntityId } from "./model";

/**
 * Read-only impact queries over the exact intersections of diagnoses and drafts. They are the single
 * source for both the domain guards (for example `deleteMeasure`) and the reorganization dialogs, so
 * the numbers shown to the user are the ones the domain enforces. They never touch the document.
 */
export interface RecordsReferencing {
  /** Valid (not logically deleted) diagnoses. */
  diagnosisIds: EntityId[];
  /** Logically deleted diagnoses: still stored and still validated against the matrix. */
  deletedDiagnosisIds: EntityId[];
  /** Persistent drafts that were not discarded. Discarded (logically deleted) drafts are ignored. */
  draftIds: EntityId[];
}

export function recordsReferencing(document: DiagnosticDocument, references: (cell: CoverageIntersection) => boolean): RecordsReferencing {
  const matching = (coverage: CoverageIntersection[] | undefined) => (coverage ?? []).some(references);
  return {
    diagnosisIds: document.diagnoses.filter((diagnosis) => !diagnosis.deletedAt && matching(diagnosis.coverage)).map((diagnosis) => diagnosis.id),
    deletedDiagnosisIds: document.diagnoses.filter((diagnosis) => diagnosis.deletedAt && matching(diagnosis.coverage)).map((diagnosis) => diagnosis.id),
    draftIds: (document.diagnosisDrafts ?? []).filter((draft) => !draft.deletedAt && matching(draft.coverage)).map((draft) => draft.id),
  };
}

export interface MeasureUsage extends RecordsReferencing {
  /** A Measure with any diagnosis (even logically deleted) or persistent draft cannot be deleted. */
  blocked: boolean;
}

export function measureUsage(document: DiagnosticDocument, measureId: EntityId): MeasureUsage {
  const usage = recordsReferencing(document, (cell) => cell.measureId === measureId);
  return { ...usage, blocked: Boolean(usage.diagnosisIds.length || usage.deletedDiagnosisIds.length || usage.draftIds.length) };
}

export const unitUsage = (document: DiagnosticDocument, unitId: EntityId) => recordsReferencing(document, (cell) => cell.organizationalUnitId === unitId);

export function structureUsage(document: DiagnosticDocument, structureId: EntityId) {
  const measureIds = new Set(document.measures.filter((measure) => measure.structureId === structureId).map((measure) => measure.id));
  return { measureIds: [...measureIds], ...recordsReferencing(document, (cell) => measureIds.has(cell.measureId)) };
}

/** Pairs that would repeat after moving the coverage of `sourceUnitId` into `destinationUnitId` (they are consolidated). */
export function transferConsolidations(document: DiagnosticDocument, sourceUnitId: EntityId, destinationUnitId: EntityId): number {
  const repeated = (coverage: CoverageIntersection[] | undefined) => {
    const cells = coverage ?? [];
    return cells.filter((cell) => cell.organizationalUnitId === sourceUnitId && cells.some((other) => other.measureId === cell.measureId && other.organizationalUnitId === destinationUnitId)).length;
  };
  return document.diagnoses.reduce((sum, diagnosis) => sum + repeated(diagnosis.coverage), 0) + (document.diagnosisDrafts ?? []).reduce((sum, draft) => sum + repeated(draft.coverage), 0);
}

/** Valid diagnoses whose every intersection is in `unitId` or in an already inactive unit: they lose their last visible region when `unitId` is deactivated. */
export function diagnosesWithoutActiveRegionAfterDeactivation(document: DiagnosticDocument, unitId: EntityId): EntityId[] {
  const inactive = new Set(document.organizationalUnits.filter((unit) => !unit.active).map((unit) => unit.id));
  inactive.add(unitId);
  return document.diagnoses.filter((diagnosis) => !diagnosis.deletedAt && diagnosis.coverage.length > 0 && diagnosis.coverage.some((cell) => cell.organizationalUnitId === unitId) && diagnosis.coverage.every((cell) => inactive.has(cell.organizationalUnitId))).map((diagnosis) => diagnosis.id);
}
