import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: role="dialog" + aria-modal, labelled by its title, focus moves inside on open,
 * Tab/Shift+Tab stay inside, Escape and the backdrop cancel, and focus returns to the opener on close.
 */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = window.document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
    (focusables().find((element) => element.dataset.autofocus !== undefined) ?? focusables()[0] ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = window.document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus(); }
    };
    window.document.addEventListener("keydown", onKeyDown, true);
    return () => { window.document.removeEventListener("keydown", onKeyDown, true); if (opener && window.document.contains(opener)) opener.focus(); };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
