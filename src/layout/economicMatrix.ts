import type { DiagnosticDocument } from "../domain/model";

/** Presentation data is independent from the economic domain and uses domain IDs. */
export interface MatrixPresentation { columnWidths: Record<string, number>; collapsedStructureIds: string[]; collapsedMeasureIds: string[]; structureOrder: string[]; measureOrderByStructure: Record<string, string[]>; unitOrder: string[]; }
export interface MatrixCell { id: string; kind: "structure" | "measure" | "unit"; x: number; y: number; width: number; height: number; label: string; parentId?: string; compact?: boolean; hiddenMeasureCount?: number; }
export interface MatrixLayout { cells: MatrixCell[]; width: number; height: number; rows: string[]; columns: string[]; rowHeights: Record<string, number>; hiddenMeasureCounts: Record<string, number>; }

export const MIN_COLUMN_WIDTH = 180;
export const DEFAULT_COLUMN_WIDTH = 260;
const ROW_GAP = 24;
const MATRIX_LEFT = 24;
const MEASURE_TOP = 86;
const COMPACT_STRUCTURE_HEIGHT = 58;
const COMPACT_MEASURE_HEIGHT = 48;
const columnWidth = (id: string, presentation: MatrixPresentation) => Math.max(MIN_COLUMN_WIDTH, presentation.columnWidths[id] ?? DEFAULT_COLUMN_WIDTH);
const orderIds = (ids: string[], order: string[]) => [...ids].sort((a, b) => (order.indexOf(a) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(a)) - (order.indexOf(b) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(b)) || a.localeCompare(b));
const measureHeight = (label: string, width: number) => Math.max(64, 44 + Math.ceil(label.length / Math.max(16, Math.floor((width - 32) / 7))) * 18);
export const defaultMatrixPresentation = (): MatrixPresentation => ({ columnWidths: {}, collapsedStructureIds: [], collapsedMeasureIds: [], structureOrder: [], measureOrderByStructure: {}, unitOrder: [] });

export function layoutEconomicMatrix(document: DiagnosticDocument, presentation: MatrixPresentation): MatrixLayout {
  const structures = orderIds(document.structures.map((item) => item.id), presentation.structureOrder);
  const measuresByStructure = new Map(structures.map((structureId) => [structureId, orderIds(document.measures.filter((item) => item.structureId === structureId).map((item) => item.id), presentation.measureOrderByStructure[structureId] ?? [])]));
  const measures = new Map(document.measures.map((item) => [item.id, item]));
  const group = document.organizationalUnits.find((item) => item.active && item.kind === "group");
  const businessUnits = orderIds(document.organizationalUnits.filter((item) => item.active && item.kind === "business-unit").map((item) => item.id), presentation.unitOrder);
  const units = [...(group ? [group.id] : []), ...businessUnits];
  const columns = ["structures", "measures", ...units];
  const xByColumn = new Map<string, number>();
  let width = MATRIX_LEFT;
  columns.forEach((column) => { xByColumn.set(column, width); width += columnWidth(column, presentation) + 20; });

  const cells: MatrixCell[] = [];
  const rows: string[] = [];
  const rowHeights: Record<string, number> = {};
  const hiddenMeasureCounts: Record<string, number> = {};
  let nextY = MEASURE_TOP;

  structures.forEach((structureId) => {
    const structure = document.structures.find((item) => item.id === structureId)!;
    const orderedMeasures = measuresByStructure.get(structureId) ?? [];
    const structureCollapsed = presentation.collapsedStructureIds.includes(structureId);
    if (structureCollapsed) {
      hiddenMeasureCounts[structureId] = orderedMeasures.length;
      cells.push({ id: structureId, kind: "structure", x: xByColumn.get("structures")!, y: nextY, width: columnWidth("structures", presentation), height: COMPACT_STRUCTURE_HEIGHT, label: structure.name, compact: true, hiddenMeasureCount: orderedMeasures.length });
      nextY += COMPACT_STRUCTURE_HEIGHT + ROW_GAP;
      return;
    }

    if (!orderedMeasures.length) {
      cells.push({ id: structureId, kind: "structure", x: xByColumn.get("structures")!, y: nextY, width: columnWidth("structures", presentation), height: 76, label: structure.name });
      nextY += 76 + ROW_GAP;
      return;
    }

    const structureY = nextY;
    orderedMeasures.forEach((measureId) => {
      const measure = measures.get(measureId)!;
      const compact = presentation.collapsedMeasureIds.includes(measureId);
      const height = compact ? COMPACT_MEASURE_HEIGHT : measureHeight(measure.name, columnWidth("measures", presentation));
      rowHeights[measureId] = height;
      rows.push(measureId);
      cells.push({ id: measureId, kind: "measure", parentId: structureId, x: xByColumn.get("measures")!, y: nextY, width: columnWidth("measures", presentation), height, label: measure.name, compact });
      nextY += height + ROW_GAP;
    });
    const lastMeasure = orderedMeasures.at(-1)!;
    const structureHeight = Math.max(76, nextY - ROW_GAP - structureY);
    cells.push({ id: structureId, kind: "structure", x: xByColumn.get("structures")!, y: structureY, width: columnWidth("structures", presentation), height: structureHeight, label: structure.name });
    // Keep the reference explicit for future diagnostic regions associated to each measure.
    void lastMeasure;
  });

  units.forEach((id) => {
    const item = document.organizationalUnits.find((value) => value.id === id)!;
    cells.push({ id, kind: "unit", x: xByColumn.get(id)!, y: 18, width: columnWidth(id, presentation), height: 48, label: item.name });
  });
  return { cells, columns, rows, rowHeights, hiddenMeasureCounts, width: width + 24, height: Math.max(180, nextY + 40) };
}
