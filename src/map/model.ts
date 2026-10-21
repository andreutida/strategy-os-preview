import type { Edge, Node } from "@xyflow/react";

export interface SectionData extends Record<string, unknown> {
  kind: "section";
  title: string;
  description: string;
  createdAt: string;
}

export interface StructuralBlockData extends Record<string, unknown> {
  kind: "structural";
  title: string;
  description: string;
  owner: string;
  createdAt: string;
  collapsed: boolean;
  cascadeLevel: number;
  cascadeOrder: number;
  parentBlockId?: string;
  childrenCollapsed: boolean;
  matrixType: "economic-structure" | "economic-measure" | "business-unit" | "diagnostic";
  diagnosticCategory?: "ambition" | "objection";
  measureId?: string;
  businessUnitId?: string;
  childCount?: number;
  onToggleChildren?: () => void;
}

export type SectionNode = Node<SectionData, "section">;
export type StructuralBlockNode = Node<StructuralBlockData, "structural">;
export type StrategyNode = SectionNode | StructuralBlockNode;

export interface StrategicMapDocument {
  version: 2;
  nextId: number;
  nodes: StrategyNode[];
  edges: Edge[];
}

export const EMPTY_STRATEGIC_MAP: StrategicMapDocument = {
  version: 2,
  nextId: 1,
  nodes: [],
  edges: [],
};
