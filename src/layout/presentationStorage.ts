import type { DiagnosticDocument } from "../domain/model";
import {
  defaultMatrixPresentation,
  MIN_COLUMN_WIDTH,
  type MatrixPresentation,
} from "./economicMatrix";

export const MATRIX_PRESENTATION_KEY = "strategyos-matrix-presentation-v1";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * Treat persisted presentation as external input. Stale or malformed entries are
 * ignored; economic data is never changed while recovering visual preferences.
 */
export function sanitizeMatrixPresentation(
  raw: unknown,
  document: DiagnosticDocument,
): MatrixPresentation {
  const defaults = defaultMatrixPresentation();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;

  const value = raw as Record<string, unknown>;
  const structureIds = new Set(document.structures.map((item) => item.id));
  const activeBusinessUnitIds = new Set(
    document.organizationalUnits
      .filter((item) => item.active && item.kind === "business-unit")
      .map((item) => item.id),
  );
  const validColumnIds = new Set([
    "structures",
    "measures",
    "group",
    ...activeBusinessUnitIds,
  ]);
  const measuresByStructure = new Map(
    document.structures.map((structure) => [
      structure.id,
      new Set(
        document.measures
          .filter((measure) => measure.structureId === structure.id)
          .map((measure) => measure.id),
      ),
    ]),
  );
  const validMeasureIds = new Set(document.measures.map((item) => item.id));

  const columnWidths: Record<string, number> = {};
  if (value.columnWidths && typeof value.columnWidths === "object") {
    for (const [id, width] of Object.entries(
      value.columnWidths as Record<string, unknown>,
    )) {
      if (
        validColumnIds.has(id) &&
        typeof width === "number" &&
        Number.isFinite(width)
      ) {
        columnWidths[id] = Math.max(MIN_COLUMN_WIDTH, width);
      }
    }
  }

  const measureOrderByStructure: Record<string, string[]> = {};
  if (
    value.measureOrderByStructure &&
    typeof value.measureOrderByStructure === "object" &&
    !Array.isArray(value.measureOrderByStructure)
  ) {
    for (const [structureId, order] of Object.entries(
      value.measureOrderByStructure as Record<string, unknown>,
    )) {
      const measures = measuresByStructure.get(structureId);
      if (measures) {
        measureOrderByStructure[structureId] = stringArray(order).filter((id) =>
          measures.has(id),
        );
      }
    }
  }

  return {
    ...defaults,
    columnWidths,
    structureOrder: stringArray(value.structureOrder).filter((id) =>
      structureIds.has(id),
    ),
    measureOrderByStructure,
    // Group is deliberately omitted: its position is fixed by the layout.
    unitOrder: stringArray(value.unitOrder).filter((id) =>
      activeBusinessUnitIds.has(id),
    ),
    collapsedStructureIds: stringArray(value.collapsedStructureIds).filter((id) =>
      structureIds.has(id),
    ),
    collapsedMeasureIds: stringArray(value.collapsedMeasureIds).filter((id) =>
      validMeasureIds.has(id),
    ),
  };
}

export function loadMatrixPresentation(
  storage: Pick<Storage, "getItem">,
  document: DiagnosticDocument,
): MatrixPresentation {
  try {
    return sanitizeMatrixPresentation(
      JSON.parse(storage.getItem(MATRIX_PRESENTATION_KEY) ?? "{}"),
      document,
    );
  } catch {
    return defaultMatrixPresentation();
  }
}

export function saveMatrixPresentation(
  storage: Pick<Storage, "setItem">,
  value: MatrixPresentation,
): void {
  storage.setItem(MATRIX_PRESENTATION_KEY, JSON.stringify(value));
}

export function resetMatrixPresentation(
  storage: Pick<Storage, "removeItem">,
): MatrixPresentation {
  storage.removeItem(MATRIX_PRESENTATION_KEY);
  return defaultMatrixPresentation();
}

/** Restores dimensions only; ordering, expansion and other presentation choices remain. */
export function resetMatrixColumnWidths(
  presentation: MatrixPresentation,
): MatrixPresentation {
  return { ...presentation, columnWidths: {} };
}
