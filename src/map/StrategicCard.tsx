import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useRef } from "react";
import type { SectionNode, StructuralBlockNode } from "./model";

const handles = [["top", Position.Top], ["right", Position.Right], ["bottom", Position.Bottom], ["left", Position.Left]] as const;

export function SectionBlock({ data, selected }: NodeProps<SectionNode>) {
  return <section className={`section-block${selected ? " is-selected" : ""}`}>
    <NodeResizer isVisible={selected} minWidth={240} minHeight={120} lineClassName="section-block__resize-line" handleClassName="section-block__resize-handle"/>
    <header><strong>{data.title}</strong></header>
    {data.description && <p>{data.description}</p>}
  </section>;
}

export function StructuralBlock({ data, selected }: NodeProps<StructuralBlockNode>) {
  const ignoreSyntheticClick = useRef(false);
  return <article className={`structural-block matrix-${data.matrixType}${data.matrixType === "diagnostic" ? ` diagnostic-${data.diagnosticCategory}` : ""}${selected ? " is-selected" : ""}${data.collapsed ? " is-collapsed" : ""}`}>
    {handles.map(([handleId, position]) => <Handle key={handleId} id={handleId} type="source" position={position} className="structural-block__handle" aria-label={`Conector ${handleId}`}/>)}
    <div className="structural-block__body">
      {data.matrixType === "diagnostic" && <small className="diagnostic-kind">{data.diagnosticCategory === "objection" ? "Objeção" : "Ambição"}</small>}
      <strong>{data.title}</strong>
      {!data.collapsed && data.matrixType === "economic-structure" && data.description && <p>{data.description}</p>}
    </div>
    {Boolean(data.childCount) && <button type="button" className={`cascade-toggle nodrag nowheel nopan${data.childrenCollapsed ? " is-collapsed" : ""}`} aria-label={`${data.childrenCollapsed ? "Expandir" : "Recolher"} ${data.childCount} bloco${data.childCount === 1 ? "" : "s"} conectado${data.childCount === 1 ? "" : "s"}`} title={`${data.childrenCollapsed ? "Expandir" : "Recolher"} próximo nível`} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); if (event.pointerType !== "mouse") { ignoreSyntheticClick.current = true; data.onToggleChildren?.(); } }} onClick={(event) => { event.stopPropagation(); if (ignoreSyntheticClick.current) ignoreSyntheticClick.current = false; else data.onToggleChildren?.(); }}>{data.childCount}</button>}
  </article>;
}
