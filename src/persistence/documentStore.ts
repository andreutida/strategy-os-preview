import type { DiagnosticDocument } from "../domain/model";
import { DIAGNOSTIC_STORAGE_KEY, importDiagnosticDocument, parseDiagnosticDocument, type StorageLike } from "./diagnosticStorage";

/** Thrown, and nothing is written, when the stored document is no longer the version this tab loaded or last saved. */
export class StaleDocumentError extends Error {
  constructor() {
    super("O documento foi alterado em outra aba do navegador.");
    this.name = "StaleDocumentError";
  }
}

export const STALE_DOCUMENT_MESSAGE = "Este documento foi alterado em outra aba do navegador. Para não sobrescrever a versão mais recente, esta aba não grava mais. As alterações não salvas continuam abertas aqui: baixe-as antes de recarregar.";
export const DOCUMENT_WRITE_LOCK = "strategyos-diagnosis-v3-write";
/**
 * Browsers replicate localStorage between tabs asynchronously: right after tab A writes, tab B may still read the old value for a
 * few milliseconds (measured: ~2-3 ms to deliver the storage event). The write lock is therefore kept this long after a write so
 * the next writer reads the new value. It shrinks the race window; it does not make the operation a transaction.
 */
export const DEFAULT_REPLICATION_SETTLE_MS = 40;

/** The subset of the Web Locks API used here (navigator.locks). */
export interface LockManagerLike { request<T>(name: string, callback: () => T | Promise<T>): Promise<T>; }

/**
 * The single gateway for writing the v3 document.
 *
 * A tab remembers the exact string it loaded or last wrote (`base`). Before every write it re-reads the stored string and
 * refuses to write unless it still equals `base`, so a tab holding an outdated copy can never silently replace what another
 * tab saved. The browser "storage" event only tells the UI sooner (`noteStorageEvent`); it is never trusted for safety.
 *
 * Guarantees and limits (localStorage has no compare-and-swap):
 *  - With Web Locks (`exclusive` writes, the default when `navigator.locks` exists) the check + write are mutually exclusive
 *    across the tabs of this origin that use this class, so concurrent saves are decided one at a time, and the lock is held a few
 *    milliseconds after writing (without delaying the caller) so the next writer sees the new value. Measured with two real tabs saving at the same instant:
 *    without locks both tabs passed the check in 16 of 40 attempts; with locks in 2 of 40 (before the settle delay).
 *  - Without Web Locks, and for the synchronous last-chance flush on pagehide, check and write are two separate calls: another
 *    tab can still write between them (a window of microseconds to a few milliseconds for large documents).
 *  - Writers that do not use this class (devtools, other scripts, other apps on the origin) are only detected, not excluded.
 */
export class GuardedDocumentStore {
  private base: string | null;
  private markedStale = false;

  constructor(private readonly storage: StorageLike, initialRaw: string | null, private readonly locks?: LockManagerLike, private readonly settleMs = DEFAULT_REPLICATION_SETTLE_MS) {
    this.base = initialRaw;
  }

  /** True once a different version than the one this tab is based on was seen in the storage. */
  get stale() { return this.markedStale; }
  /** The exact string this tab is based on. */
  get baseRaw() { return this.base; }

  /** Reacts to a window "storage" event; returns true when it shows that this tab is now outdated. */
  noteStorageEvent(key: string | null, newValue: string | null): boolean {
    if (key !== null && key !== DIAGNOSTIC_STORAGE_KEY) return false;
    if (key !== null && newValue === this.base) return false;
    this.markedStale = true;
    return true;
  }

  /** Once a different version has been seen the tab stays blocked until it reloads (the banner says so), even if a later read looks equal. */
  private assertFresh() {
    if (this.markedStale || this.storage.getItem(DIAGNOSTIC_STORAGE_KEY) !== this.base) { this.markedStale = true; throw new StaleDocumentError(); }
  }

  /** Synchronous check-and-write. Throws StaleDocumentError (nothing written) or the storage error (base unchanged). */
  saveNow(document: DiagnosticDocument): DiagnosticDocument {
    const validated = parseDiagnosticDocument(document, { allowLegacyPendingAmbitions: true });
    const serialized = JSON.stringify(validated);
    this.assertFresh();
    this.storage.setItem(DIAGNOSTIC_STORAGE_KEY, serialized);
    this.base = serialized;
    return validated;
  }

  /** Check-and-write, mutually exclusive across tabs when Web Locks exist. Use `exclusive: false` where it must stay synchronous (pagehide). */
  async save(document: DiagnosticDocument, options: { exclusive?: boolean } = {}): Promise<DiagnosticDocument> {
    if (options.exclusive === false || !this.locks) return this.saveNow(document);
    const locks = this.locks;
    return new Promise<DiagnosticDocument>((resolve, reject) => {
      locks.request(DOCUMENT_WRITE_LOCK, async () => {
        try { resolve(this.saveNow(document)); } catch (error) { reject(error); return; }
        // The caller is told right away; only the NEXT writer waits, so it reads the value just written.
        // Skipped in a hidden tab: its timers are throttled (up to a minute) and would keep the lock away from the visible tab.
        if (this.settleMs > 0 && globalThis.document?.visibilityState !== "hidden") await new Promise((done) => setTimeout(done, this.settleMs));
      }).catch(reject);
    });
  }

  /** Protected import: validates the serialized document, then replaces the stored one only if this tab is up to date. */
  async importDocument(serialized: string, options: { exclusive?: boolean } = {}): Promise<DiagnosticDocument> {
    return this.save(importDiagnosticDocument(serialized), options);
  }
}
