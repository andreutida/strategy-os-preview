import { EMPTY_DIAGNOSTIC_DOCUMENT, type DiagnosticDocument } from "../domain/model";
import { validateDiagnosticDocument } from "../domain/validation";
import { migrateLegacyStrategicMap } from "./migrations";

export const DIAGNOSTIC_STORAGE_KEY = "strategyos-diagnosis-v3";
export const LEGACY_STRATEGIC_MAP_STORAGE_KEY = "strategyos-strategic-map-v1";

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface LoadedDiagnosticDocument { document: DiagnosticDocument; source: "v3" | "legacy-migration" | "empty"; }
export class DiagnosticDocumentParseError extends Error {
  constructor(message: string) { super(message); this.name = "DiagnosticDocumentParseError"; }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const hasString = (value: Record<string, unknown>, key: string) => typeof value[key] === "string";
const isStringList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const fail = (message: string): never => { throw new DiagnosticDocumentParseError(message); };

function assertExternalShape(value: unknown): asserts value is DiagnosticDocument {
  if (isRecord(value) && value.diagnosisDrafts === undefined) value.diagnosisDrafts = [];
  if (!isRecord(value) || value.version !== 3) fail("Documento de Diagnóstico inválido ou incompatível.");
  const record = value as Record<string, unknown>;
  const arrays = ["structures", "measures", "organizationalUnits", "diagnoses", "diagnosisDrafts", "hierarchies", "semanticRelations", "legacyReviewItems"] as const;
  if (arrays.some((key) => !Array.isArray(record[key]))) fail("Documento de Diagnóstico incompleto.");
  if (!(record.structures as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "name") && hasString(item, "description"))) fail("Estruturas em formato inválido.");
  if (!(record.measures as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "name") && hasString(item, "structureId"))) fail("Medidas em formato inválido.");
  if (!(record.organizationalUnits as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "name") && typeof item.kind === "string" && typeof item.active === "boolean")) fail("Unidades organizacionais em formato inválido.");
  if (!(record.diagnoses as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "kind") && hasString(item, "title") && hasString(item, "createdAt") && hasString(item, "updatedAt") && Array.isArray(item.coverage) && (item.coverage as unknown[]).every((cell) => isRecord(cell) && hasString(cell, "measureId") && hasString(cell, "organizationalUnitId")) && (item.description === undefined || typeof item.description === "string") && (item.ambitionOrigin === undefined || typeof item.ambitionOrigin === "string") && (item.validationStatus === undefined || typeof item.validationStatus === "string") && (item.deletedAt === undefined || typeof item.deletedAt === "string") && (item.evidence === undefined || isStringList(item.evidence)) && (item.causes === undefined || isStringList(item.causes)) && (item.consequences === undefined || isStringList(item.consequences)))) fail("Diagnósticos em formato inválido.");
  if (!(record.diagnosisDrafts as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "createdAt") && hasString(item, "updatedAt"))) fail("Rascunhos de diagnóstico em formato inválido.");
  if (!(record.hierarchies as unknown[]).every((item) => isRecord(item) && hasString(item, "parentId") && hasString(item, "childId"))) fail("Hierarquias em formato inválido.");
  if (!(record.semanticRelations as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "sourceDiagnosisId") && hasString(item, "targetDiagnosisId") && hasString(item, "type"))) fail("Relações semânticas em formato inválido.");
  if (!(record.legacyReviewItems as unknown[]).every((item) => isRecord(item) && hasString(item, "id") && hasString(item, "reason") && Object.hasOwn(item, "raw"))) fail("Pendências legadas em formato inválido.");
}

export function parseDiagnosticDocument(value: unknown, options: { allowLegacyPendingAmbitions?: boolean } = {}): DiagnosticDocument {
  assertExternalShape(value);
  const document = value;
  const issues = validateDiagnosticDocument(document, options);
  if (issues.length) throw new DiagnosticDocumentParseError(`Documento de Diagnóstico inválido: ${issues.map((issue) => issue.code).join(", ")}`);
  return structuredClone(document);
}

export function loadDiagnosticDocument(storage: StorageLike): LoadedDiagnosticDocument {
  const current = storage.getItem(DIAGNOSTIC_STORAGE_KEY);
  if (current) return { document: parseDiagnosticDocument(JSON.parse(current), { allowLegacyPendingAmbitions: true }), source: "v3" };
  const legacy = storage.getItem(LEGACY_STRATEGIC_MAP_STORAGE_KEY);
  if (legacy) return { document: migrateLegacyStrategicMap(JSON.parse(legacy)), source: "legacy-migration" };
  return { document: structuredClone(EMPTY_DIAGNOSTIC_DOCUMENT), source: "empty" };
}

/** Writes only the new versioned key; the legacy document is never overwritten. */
export function saveDiagnosticDocument(storage: StorageLike, document: DiagnosticDocument) {
  const validated = parseDiagnosticDocument(document, { allowLegacyPendingAmbitions: true });
  storage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function exportDiagnosticDocument(document: DiagnosticDocument) {
  return JSON.stringify(parseDiagnosticDocument(document, { allowLegacyPendingAmbitions: true }));
}

export function importDiagnosticDocument(serialized: string) {
  try {
    return parseDiagnosticDocument(JSON.parse(serialized), { allowLegacyPendingAmbitions: true });
  } catch (error) {
    if (error instanceof DiagnosticDocumentParseError) throw error;
    throw new DiagnosticDocumentParseError("JSON de Diagnóstico inválido.");
  }
}
