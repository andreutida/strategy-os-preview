import type { DiagnosticDocument } from "../domain/model";
import { defaultDiagnosisVisibilityPresentation, type DiagnosisVisibilityPresentation } from "./diagnosisVisibility";

/** Stored separately from both v3 domain data and economic matrix preferences. */
export const DIAGNOSIS_VISIBILITY_PRESENTATION_KEY = "strategyos-diagnosis-visibility-v1";

export function sanitizeDiagnosisVisibilityPresentation(raw: unknown, document: DiagnosticDocument): DiagnosisVisibilityPresentation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultDiagnosisVisibilityPresentation();
  const activeIds = new Set(document.diagnoses.filter((item) => !item.deletedAt).map((item) => item.id));
  const ids = (raw as { collapsedDiagnosisIds?: unknown }).collapsedDiagnosisIds;
  return {
    collapsedDiagnosisIds: Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string => typeof id === "string" && activeIds.has(id)))].sort((a, b) => a.localeCompare(b))
      : [],
  };
}

export function loadDiagnosisVisibilityPresentation(storage: Pick<Storage, "getItem">, document: DiagnosticDocument): DiagnosisVisibilityPresentation {
  try { return sanitizeDiagnosisVisibilityPresentation(JSON.parse(storage.getItem(DIAGNOSIS_VISIBILITY_PRESENTATION_KEY) ?? "{}"), document); }
  catch { return defaultDiagnosisVisibilityPresentation(); }
}

export function saveDiagnosisVisibilityPresentation(storage: Pick<Storage, "setItem">, value: DiagnosisVisibilityPresentation): void {
  storage.setItem(DIAGNOSIS_VISIBILITY_PRESENTATION_KEY, JSON.stringify(value));
}
