import type { DiagnosticDocument } from "../domain/model";
import type { MatrixPresentation } from "./economicMatrix";

export type PresentationOrderScope = "structure" | "measure" | "business-unit";

export interface PresentationOrder {
  scope: PresentationOrderScope;
  ids: string[];
  structureId?: string;
}

const ordered = (ids: string[], preference: string[]) =>
  [...ids].sort((left, right) => {
    const leftIndex = preference.indexOf(left);
    const rightIndex = preference.indexOf(right);
    return (
      (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex) ||
      left.localeCompare(right)
    );
  });

/** Returns the single visual ordering scope an item is allowed to change. */
export function presentationOrderFor(
  document: DiagnosticDocument,
  presentation: MatrixPresentation,
  id: string,
): PresentationOrder | undefined {
  if (document.structures.some((item) => item.id === id)) {
    return {
      scope: "structure",
      ids: ordered(document.structures.map((item) => item.id), presentation.structureOrder),
    };
  }

  const measure = document.measures.find((item) => item.id === id);
  if (measure) {
    return {
      scope: "measure",
      structureId: measure.structureId,
      ids: ordered(
        document.measures
          .filter((item) => item.structureId === measure.structureId)
          .map((item) => item.id),
        presentation.measureOrderByStructure[measure.structureId] ?? [],
      ),
    };
  }

  if (document.organizationalUnits.some((item) => item.id === id && item.active && item.kind === "business-unit")) {
    return {
      scope: "business-unit",
      ids: ordered(
        document.organizationalUnits
          .filter((item) => item.active && item.kind === "business-unit")
          .map((item) => item.id),
        presentation.unitOrder,
      ),
    };
  }

  return undefined;
}

function withOrder(
  presentation: MatrixPresentation,
  order: PresentationOrder,
  ids: string[],
): MatrixPresentation {
  switch (order.scope) {
    case "structure":
      return { ...presentation, structureOrder: ids };
    case "business-unit":
      return { ...presentation, unitOrder: ids };
    case "measure":
      return {
        ...presentation,
        measureOrderByStructure: {
          ...presentation.measureOrderByStructure,
          [order.structureId!]: ids,
        },
      };
  }
}

/** Reorders only presentation metadata. Domain links and coverage are untouched. */
export function movePresentationItem(
  document: DiagnosticDocument,
  presentation: MatrixPresentation,
  id: string,
  targetIndex: number,
): MatrixPresentation {
  const order = presentationOrderFor(document, presentation, id);
  if (!order) return presentation;
  const currentIndex = order.ids.indexOf(id);
  const nextIndex = Math.max(0, Math.min(order.ids.length - 1, targetIndex));
  if (currentIndex < 0 || currentIndex === nextIndex) return presentation;

  const ids = [...order.ids];
  ids.splice(currentIndex, 1);
  ids.splice(nextIndex, 0, id);
  return withOrder(presentation, order, ids);
}

export function movePresentationItemBy(
  document: DiagnosticDocument,
  presentation: MatrixPresentation,
  id: string,
  delta: -1 | 1,
): MatrixPresentation {
  const order = presentationOrderFor(document, presentation, id);
  const index = order?.ids.indexOf(id) ?? -1;
  return index < 0 ? presentation : movePresentationItem(document, presentation, id, index + delta);
}
