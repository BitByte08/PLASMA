type Listener<T> = (data: T) => void;

/**
 * Minimal type-safe event emitter.
 * EventMap is a record of { eventName: payloadType }.
 */
export class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return this;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
    return this;
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    const wrapper: Listener<EventMap[K]> = (data) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((l) => l(data));
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
