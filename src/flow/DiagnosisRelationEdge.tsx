import { BaseEdge, type EdgeProps } from "@xyflow/react";
import type { DiagnosisRelationEdgeData } from "./diagnosisRelationAdapter";

export function DiagnosisRelationEdge({ data, markerEnd, style }: EdgeProps) {
  const value = data as DiagnosisRelationEdgeData | undefined;
  if (!value?.route?.length) return null;
  const path = value.route.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <BaseEdge path={path} markerEnd={markerEnd} className={`diagnosis-relation-edge ${value.kind}`} aria-label={value.label} interactionWidth={14} style={style} />;
}
export const diagnosisEdgeTypes = { diagnosisRelation: DiagnosisRelationEdge };
