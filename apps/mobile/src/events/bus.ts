import { isEvent, type EventType, type LearniEvent } from "./types";

type Handler<T extends EventType> = (e: LearniEvent<T>) => void;

/** Kleiner typisierter Event-Bus. Backend-Events werden hier eingespeist, Features/Feedback abonnieren. */
export class EventBus {
  private handlers = new Map<string, Set<(e: never) => void>>();
  private any = new Set<(e: LearniEvent) => void>();

  on<T extends EventType>(type: T, h: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(h as (e: never) => void);
    this.handlers.set(type, set);
    return () => { set.delete(h as (e: never) => void); };
  }

  onAny(h: (e: LearniEvent) => void): () => void {
    this.any.add(h);
    return () => { this.any.delete(h); };
  }

  /** Unbekannte oder kaputte Events werden verworfen (Vorwaertskompatibilitaet), nie geworfen. */
  emit(raw: unknown): boolean {
    if (!isEvent(raw)) return false;
    for (const h of this.handlers.get(raw.type) ?? []) {
      try { (h as (e: LearniEvent) => void)(raw); } catch { /* ein Handler darf die anderen nicht stoppen */ }
    }
    for (const h of this.any) {
      try { h(raw); } catch { /* s.o. */ }
    }
    return true;
  }

  emitAll(events: unknown[] | undefined): number {
    return (events ?? []).reduce<number>((n, e) => n + (this.emit(e) ? 1 : 0), 0);
  }
}

export const bus = new EventBus();
