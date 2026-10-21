import { EMPTY_DIAGNOSTIC_DOCUMENT, type DiagnosticDocument, type LegacyReviewItem } from "../domain/model";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === "object";
const stringValue = (value: unknown) => typeof value === "string" ? value : "";
const nowFrom = (value: unknown) => stringValue(value) || "1970-01-01T00:00:00.000Z";
function preserveAdditionalLegacyData(reviewItems: LegacyReviewItem[], node: RecordValue, id: string, mappedDataKeys: string[]) {
  const data = isRecord(node.data) ? node.data : {};
  const mapped = new Set(mappedDataKeys);
  const hasAdditionalData = Object.keys(data).some((key) => !mapped.has(key));
  if (hasAdditionalData) reviewItems.push({ id: `legacy-node-extra:${id}`, reason: "converted-node-additional-data", raw: structuredClone(node) });
}

/**
 * Converts only legacy facts that have an unambiguous equivalent. Legacy edges
 * remain review items because their old editor did not distinguish hierarchy
 * from semantic relations.
 */
export function migrateLegacyStrategicMap(value: unknown): DiagnosticDocument {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error("Documento legado inválido.");
  const document = structuredClone(EMPTY_DIAGNOSTIC_DOCUMENT);
  const reviewItems: LegacyReviewItem[] = [];
  const nodes = value.nodes.filter(isRecord);
  const structureIds = new Set<string>();
  const measureIds = new Set<string>();
  const unitIds = new Set<string>();

  nodes.filter((node) => isRecord(node.data) && node.data.matrixType === "economic-structure").forEach((node) => {
    const id = stringValue(node.id);
    const data = isRecord(node.data) ? node.data : undefined;
    if (!id || !data) { reviewItems.push({ id: `legacy-node:${reviewItems.length}`, reason: "invalid-legacy-node", raw: node }); return; }
    const matrixType = stringValue(data.matrixType);
    const title = stringValue(data.title);
    if (matrixType === "economic-structure") {
      document.structures.push({ id, name: title || id, description: stringValue(data.description) }); structureIds.add(id); preserveAdditionalLegacyData(reviewItems, node, id, ["matrixType", "title", "description"]);
    }
  });
  nodes.filter((node) => isRecord(node.data) && node.data.matrixType !== "economic-structure").forEach((node) => {
    const id = stringValue(node.id);
    const data = isRecord(node.data) ? node.data : undefined;
    if (!id || !data) { reviewItems.push({ id: `legacy-node:${reviewItems.length}`, reason: "invalid-legacy-node", raw: node }); return; }
    const matrixType = stringValue(data.matrixType);
    const title = stringValue(data.title);
    if (matrixType === "economic-measure") {
      const structureId = stringValue(data.parentBlockId);
      if (!structureId || !structureIds.has(structureId)) reviewItems.push({ id: `legacy-measure:${id}`, reason: "measure-without-unambiguous-structure", raw: node });
      else { document.measures.push({ id, structureId, name: title || id }); measureIds.add(id); preserveAdditionalLegacyData(reviewItems, node, id, ["matrixType", "title", "parentBlockId"]); }
    } else if (matrixType === "business-unit") {
      document.organizationalUnits.push({ id, kind: "business-unit", name: title || id, active: true }); unitIds.add(id); preserveAdditionalLegacyData(reviewItems, node, id, ["matrixType", "title"]);
    }
  });

  nodes.forEach((node) => {
    const id = stringValue(node.id);
    const data = isRecord(node.data) ? node.data : undefined;
    if (!id || !data || stringValue(data.matrixType) !== "diagnostic") return;
    const measureId = stringValue(data.measureId);
    const organizationalUnitId = stringValue(data.businessUnitId);
    if (!measureIds.has(measureId) || !unitIds.has(organizationalUnitId)) {
      reviewItems.push({ id: `legacy-diagnosis:${id}`, reason: "diagnosis-without-unambiguous-intersection", raw: node });
      return;
    }
    if (data.diagnosticCategory !== "ambition" && data.diagnosticCategory !== "objection") {
      reviewItems.push({ id: `legacy-diagnosis:${id}`, reason: "diagnosis-with-unknown-category", raw: node });
      return;
    }
    const kind = data.diagnosticCategory;
    const createdAt = nowFrom(data.createdAt);
    document.diagnoses.push({
      id, kind, title: stringValue(data.title) || id, description: stringValue(data.description) || undefined,
      // A legacy Ambição has no reliable origin. Keep it pending instead of inventing one.
      ambitionOrigin: undefined, validationStatus: "pending", coverage: [{ measureId, organizationalUnitId }], createdAt, updatedAt: createdAt,
    });
    preserveAdditionalLegacyData(reviewItems, node, id, ["matrixType", "title", "description", "diagnosticCategory", "measureId", "businessUnitId", "createdAt"]);
  });

  nodes.forEach((node, index) => {
    const data = isRecord(node.data) ? node.data : undefined;
    const type = stringValue(data?.matrixType);
    if (!["economic-structure", "economic-measure", "business-unit", "diagnostic"].includes(type)) reviewItems.push({ id: `legacy-unmapped:${index}`, reason: "legacy-node-without-domain-equivalent", raw: node });
  });
  (value.edges as unknown[]).forEach((edge, index) => reviewItems.push({ id: `legacy-edge:${index}`, reason: "legacy-edge-type-ambiguous", raw: edge }));
  document.legacyReviewItems = reviewItems;
  return document;
}
