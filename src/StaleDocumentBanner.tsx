import { useLayoutEffect, useRef, useState } from "react";
import { Modal } from "./ui/Modal";

/**
 * Shown when another tab saved a newer version. This tab stops saving (nothing is overwritten and no audit event is created)
 * and offers a safe way out: first download the local changes that could not be saved, then explicitly discard and reload.
 */
export function StaleDocumentBanner({ onDownload, onReload, downloadError }: { onDownload: () => void; onReload: () => void; downloadError: string }) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // The fixed side panels start below the header; publish the banner height so they start below the banner too and never cover its buttons.
  useLayoutEffect(() => {
    const element = ref.current!;
    const root = window.document.documentElement;
    const publish = () => root.style.setProperty("--stale-offset", `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty("--stale-offset"); };
  }, []);
  return (
    <section ref={ref} className="stale-banner" role="alert" aria-label="Documento desatualizado">
      <div>
        <strong>Documento alterado em outra aba</strong>
        <p>Outra aba salvou uma versão mais recente. Para não sobrescrevê-la, <b>esta aba não grava mais</b>: o que você alterou aqui depois disso não foi salvo nem entrou no histórico. Baixe suas alterações antes de recarregar.</p>
        {downloadError && <p className="stale-banner-error">{downloadError}</p>}
      </div>
      <div className="stale-banner-actions">
        <button type="button" onClick={onDownload}>Baixar minhas alterações</button>
        <button type="button" className="primary" onClick={() => setConfirming(true)}>Recarregar a versão mais recente</button>
      </div>
      {confirming && (
        <Modal title="Recarregar a versão mais recente" onClose={() => setConfirming(false)}>
          <p>A versão mais recente, salva na outra aba, será carregada e <strong>as alterações não salvas desta aba serão descartadas</strong>. Se precisar delas, baixe-as antes: o arquivo contém o estado atual desta aba.</p>
          <div className="modal-actions">
            <button type="button" data-autofocus onClick={() => setConfirming(false)}>Cancelar</button>
            <button type="button" className="primary" onClick={onReload}>Descartar e recarregar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
