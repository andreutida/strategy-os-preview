import type { CoverageIntersection, DiagnosticDocument } from "../domain/model";
import { layoutEconomicMatrix, type MatrixPresentation } from "./economicMatrix";

/** A single, exact intersection from the domain, projected onto the current matrix. */
export interface CoverageGeometryCell extends CoverageIntersection {
  structureId: string;
  rowIndex: number;
  columnIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/** Orthogonally-connected exact cells. Bounds are descriptive; rectangles remain authoritative. */
export interface CoverageComponent {
  id: string;
  structureId: string;
  cells: CoverageGeometryCell[];
}

/** A renderable connected part of a diagnosis. It never includes hidden cells or another structure. */
export interface CoverageSegment extends CoverageComponent {
  bounds: { x: number; y: number; width: number; height: number };
  rectangles: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface DiagnosisCoverageGeometry {
  diagnosisId: string;
  cardId: string;
  cells: CoverageGeometryCell[];
  hiddenCellCount: number;
  components: CoverageComponent[];
  segments: CoverageSegment[];
}

const cellKey = (cell: CoverageIntersection) => `${cell.measureId}\u0000${cell.organizationalUnitId}`;
const gridKey = (cell: Pick<CoverageGeometryCell, "rowIndex" | "columnIndex">) => `${cell.rowIndex}\u0000${cell.columnIndex}`;
const ordered = <T extends CoverageGeometryCell>(cells: T[]) => [...cells].sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex || a.measureId.localeCompare(b.measureId) || a.organizationalUnitId.localeCompare(b.organizationalUnitId));

function connectedComponents(cells: CoverageGeometryCell[], diagnosisId: string, prefix: string): CoverageComponent[] {
  const remaining = new Map(ordered(cells).map((cell) => [gridKey(cell), cell]));
  const components: CoverageComponent[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value as CoverageGeometryCell;
    const queue = [first];
    const connected: CoverageGeometryCell[] = [];
    remaining.delete(gridKey(first));
    while (queue.length) {
      const current = queue.shift()!;
      connected.push(current);
      [[-1, 0], [0, -1], [0, 1], [1, 0]].forEach(([row, column]) => {
        const neighbor = remaining.get(`${current.rowIndex + row}\u0000${current.columnIndex + column}`);
        if (neighbor) { remaining.delete(gridKey(neighbor)); queue.push(neighbor); }
      });
    }
    const sorted = ordered(connected);
    components.push({ id: `${diagnosisId}:${prefix}:${sorted[0].structureId}:${components.length}`, structureId: sorted[0].structureId, cells: sorted });
  }
  return components;
}

const boundsFor = (cells: CoverageGeometryCell[]) => {
  const x = Math.min(...cells.map((cell) => cell.x));
  const y = Math.min(...cells.map((cell) => cell.y));
  const right = Math.max(...cells.map((cell) => cell.x + cell.width));
  const bottom = Math.max(...cells.map((cell) => cell.y + cell.height));
  return { x, y, width: right - x, height: bottom - y };
};

/**
 * Derives coverage geometry from the v3 domain and current matrix presentation.
 * It intentionally does not persist any geometric output or include drafts/deleted diagnoses.
 */
export function layoutDiagnosisCoverage(document: DiagnosticDocument, presentation: MatrixPresentation): DiagnosisCoverageGeometry[] {
  const layout = layoutEconomicMatrix(document, presentation);
  const measureCells = new Map(layout.cells.filter((cell) => cell.kind === "measure").map((cell) => [cell.id, cell]));
  const unitCells = new Map(layout.cells.filter((cell) => cell.kind === "unit").map((cell) => [cell.id, cell]));
  const structureByMeasure = new Map(document.measures.map((measure) => [measure.id, measure.structureId]));
  const rowIndex = new Map(layout.rows.map((id, index) => [id, index]));
  const columnIndex = new Map(layout.columns.map((id, index) => [id, index]));
  const hiddenStructures = new Set(presentation.collapsedStructureIds);
  const hiddenMeasures = new Set(presentation.collapsedMeasureIds);

  return document.diagnoses.filter((diagnosis) => !diagnosis.deletedAt).map((diagnosis) => {
    const deduplicated = new Map<string, CoverageIntersection>();
    diagnosis.coverage.forEach((coverage) => deduplicated.set(cellKey(coverage), coverage));
    const cells = ordered([...deduplicated.values()].flatMap((coverage) => {
      const measure = measureCells.get(coverage.measureId);
      const unit = unitCells.get(coverage.organizationalUnitId);
      const structureId = structureByMeasure.get(coverage.measureId);
      const row = rowIndex.get(coverage.measureId);
      const column = columnIndex.get(coverage.organizationalUnitId);
      if (!measure || !unit || !structureId || row === undefined || column === undefined) return [];
      return [{ ...coverage, structureId, rowIndex: row, columnIndex: column, x: unit.x, y: measure.y, width: unit.width, height: measure.height, visible: !hiddenStructures.has(structureId) && !hiddenMeasures.has(coverage.measureId) }];
    }));
    const components = [...new Set(cells.map((cell) => cell.structureId))].flatMap((structureId) => connectedComponents(cells.filter((cell) => cell.structureId === structureId), diagnosis.id, "component"));
    const segments = [...new Set(cells.filter((cell) => cell.visible).map((cell) => cell.structureId))].flatMap((structureId) => connectedComponents(cells.filter((cell) => cell.visible && cell.structureId === structureId), diagnosis.id, "segment").map((component) => ({ ...component, bounds: boundsFor(component.cells), rectangles: component.cells.map((cell) => ({ x: cell.x, y: cell.y, width: cell.width, height: cell.height })) })));
    return { diagnosisId: diagnosis.id, cardId: diagnosis.id, cells, hiddenCellCount: cells.filter((cell) => !cell.visible).length, components, segments };
  });
}
