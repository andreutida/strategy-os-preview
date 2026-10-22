export type EntityId = string;

export type DiagnosisKind = "ambition" | "objection";
export type AmbitionOrigin = "shareholders" | "diagnostic-proposal";
export type ValidationStatus = "pending" | "validated" | "rejected";
export type SemanticRelationType = "hinders" | "contributes-to" | "depends-on";

export interface EconomicStructure {
  id: EntityId;
  name: string;
  description: string;
}

export interface EconomicMeasure {
  id: EntityId;
  structureId: EntityId;
  name: string;
}

export interface OrganizationalUnit {
  id: EntityId;
  kind: "group" | "business-unit";
  name: string;
  active: boolean;
}

/** One exact matrix cell. A diagnosis owns a set of these pairs. */
export interface CoverageIntersection {
  measureId: EntityId;
  organizationalUnitId: EntityId;
}

export interface Diagnosis {
  id: EntityId;
  kind: DiagnosisKind;
  title: string;
  description?: string;
  evidence?: string[];
  causes?: string[];
  consequences?: string[];
  /** Required for a newly-created ambition. Old imported data may need review. */
  ambitionOrigin?: AmbitionOrigin;
  validationStatus?: ValidationStatus;
  coverage: CoverageIntersection[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
/** Persisted, non-relational work in progress. It is never a matrix region. */
export interface DiagnosisDraft {
  id: EntityId;
  kind?: DiagnosisKind;
  title?: string;
  description?: string;
  evidence?: string[];
  causes?: string[];
  consequences?: string[];
  ambitionOrigin?: AmbitionOrigin;
  validationStatus?: ValidationStatus;
  coverage?: CoverageIntersection[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A child can have no parent or exactly one parent. */
export interface HierarchyRelation {
  parentId: EntityId;
  childId: EntityId;
}

export interface SemanticRelation {
  id: EntityId;
  sourceDiagnosisId: EntityId;
  targetDiagnosisId: EntityId;
  type: SemanticRelationType;
}

export interface LegacyReviewItem {
  id: string;
  reason: string;
  raw: unknown;
}

export type AuditEntityKind = "diagnosis" | "business-unit" | "hierarchy" | "semantic-relation";

export interface AuditEntityReference {
  kind: AuditEntityKind;
  id: EntityId;
}

export interface DiagnosisAuditProjection {
  entityType: "diagnosis";
  id: EntityId;
  kind: DiagnosisKind;
  title: string;
  description?: string;
  evidence?: string[];
  causes?: string[];
  consequences?: string[];
  ambitionOrigin?: AmbitionOrigin;
  validationStatus?: ValidationStatus;
  coverage: CoverageIntersection[];
  deletedAt?: string;
}

export interface BusinessUnitAuditProjection {
  entityType: "business-unit";
  id: EntityId;
  name: string;
  active: boolean;
}

export interface HierarchyAuditProjection {
  entityType: "hierarchy";
  parentId: EntityId;
  childId: EntityId;
}

export interface SemanticRelationAuditProjection {
  entityType: "semantic-relation";
  id: EntityId;
  sourceDiagnosisId: EntityId;
  targetDiagnosisId: EntityId;
  type: SemanticRelationType;
}

export type AuditProjection = DiagnosisAuditProjection | BusinessUnitAuditProjection | HierarchyAuditProjection | SemanticRelationAuditProjection;

/** Metadata intentionally has a small, serializable contract; it is not a free-form event payload. */
export interface AuditEventMetadata {
  reason?: string;
  affectedDiagnosisIds?: EntityId[];
  session?: { id: string; state: "open" | "confirmed" };
}

export type AuditEventType =
  | "diagnosis.created" | "diagnosis.updated" | "diagnosis.coverage-changed" | "diagnosis.ambition-governance-changed" | "diagnosis.deleted"
  | "hierarchy.created" | "hierarchy.removed" | "hierarchy.parent-replaced"
  | "semantic.created" | "semantic.type-changed" | "semantic.deleted"
  | "business-unit.created" | "business-unit.renamed" | "business-unit.coverage-transferred" | "business-unit.deactivated" | "business-unit.reactivated";

export interface AuditEvent {
  id: EntityId;
  /** Groups the changes that belong to one atomic business operation. */
  operationId: EntityId;
  occurredAt: string;
  type: AuditEventType;
  subjects: AuditEntityReference[];
  before?: AuditProjection;
  after?: AuditProjection;
  metadata?: AuditEventMetadata;
}

export interface DiagnosticDocument {
  version: 3;
  structures: EconomicStructure[];
  measures: EconomicMeasure[];
  organizationalUnits: OrganizationalUnit[];
  diagnoses: Diagnosis[];
  /** Optional only for in-memory compatibility with pre-3.1 documents; storage normalizes it. */
  diagnosisDrafts?: DiagnosisDraft[];
  hierarchies: HierarchyRelation[];
  semanticRelations: SemanticRelation[];
  /** Optional only for compatibility with documents written before Incremento 7. */
  history?: AuditEvent[];
  /** Preserved, non-interpreted legacy records that need a product decision. */
  legacyReviewItems: LegacyReviewItem[];
}

export const EMPTY_DIAGNOSTIC_DOCUMENT: DiagnosticDocument = {
  version: 3,
  structures: [],
  measures: [],
  organizationalUnits: [],
  diagnoses: [],
  diagnosisDrafts: [],
  hierarchies: [],
  semanticRelations: [],
  history: [],
  legacyReviewItems: [],
};

export interface DomainIssue {
  code: string;
  message: string;
  path?: string;
}

export class DomainValidationError extends Error {
  constructor(public readonly issues: DomainIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "DomainValidationError";
  }
}
