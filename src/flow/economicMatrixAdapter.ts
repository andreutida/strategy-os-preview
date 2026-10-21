import type { Node } from "@xyflow/react";
import type { DiagnosticDocument } from "../domain/model";
import { layoutEconomicMatrix, type MatrixPresentation } from "../layout/economicMatrix";

export function economicMatrixNodes(document: DiagnosticDocument, presentation: MatrixPresentation): Node[] {
  return layoutEconomicMatrix(document, presentation).cells.map((cell) => {
    const suffix = cell.kind === "structure" && cell.compact ? ` · ${cell.hiddenMeasureCount ?? 0} medida(s) oculta(s)` : cell.kind === "measure" && cell.compact ? " · recolhida" : "";
    return { id: cell.id, type: "default", position: { x: cell.x, y: cell.y }, draggable: false, data: { label: `${cell.label}${suffix}`, matrixKind: cell.kind, parentId: cell.parentId, compact: cell.compact, hiddenMeasureCount: cell.hiddenMeasureCount }, style: { width: cell.width, minHeight: cell.height } };
  });
}
