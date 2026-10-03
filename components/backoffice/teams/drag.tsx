import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';
import { haptic } from '@/lib/haptics';

/**
 * Leichtgewichtiges Drag & Drop für das Team-Board auf Basis des
 * React-Native-Responder-Systems (Responder-Props), damit keine zusätzliche
 * Gesten-Bibliothek nötig ist. Funktioniert mit Maus/Pointer im Web und mit
 * Touch auf breiten Tablets. Drop-Zonen werden zu Beginn eines Zugs per
 * `measureInWindow` vermessen; während des Ziehens rendert nur der schwebende
 * Ghost neu, nicht das ganze Board.
 *
 * Ziehen ist eine Abkürzung: Jede Zuordnung bleibt zusätzlich per Antippen
 * (Sheet) erreichbar, auch für Tastatur und Screenreader.
 */

type Rect = { x: number; y: number; width: number; height: number };
type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

type DragState = {
  payload: string | null;
  label: string;
  x: number;
  y: number;
  /** Fensterposition des Providers, damit der Ghost relativ dazu sitzt. */
  originX: number;
  originY: number;
  overZone: string | null;
};

type Store = {
  get: () => DragState;
  set: (patch: Partial<DragState>) => void;
  subscribe: (listener: () => void) => () => void;
};

function createStore(): Store {
  let state: DragState = { payload: null, label: '', x: 0, y: 0, originX: 0, originY: 0, overZone: null };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type DragContextValue = {
  enabled: boolean;
  store: Store;
  registerZone: (id: string, node: Measurable | null) => void;
  begin: (payload: string, label: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (drop: boolean) => void;
};

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({
  enabled,
  onDrop,
  children,
}: {
  enabled: boolean;
  onDrop: (payload: string, zoneId: string) => void;
  children: ReactNode;
}) {
  const [store] = useState(createStore);
  const zones = useRef(new Map<string, Measurable>());
  const rects = useRef(new Map<string, Rect>());
  const rootRef = useRef<View>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const hitTest = useCallback((x: number, y: number) => {
    let hit: string | null = null;
    let area = Infinity;
    // Die kleinste umschließende Zone gewinnt (verschachtelte Zonen).
    rects.current.forEach((r, id) => {
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && r.width * r.height < area) {
        hit = id;
        area = r.width * r.height;
      }
    });
    return hit;
  }, []);

  const value = useMemo<DragContextValue>(
    () => ({
      enabled,
      store,
      registerZone: (id, node) => {
        if (node) zones.current.set(id, node);
        else zones.current.delete(id);
      },
      begin: (payload, label, x, y) => {
        rects.current.clear();
        zones.current.forEach((node, id) =>
          node.measureInWindow((zx, zy, width, height) => rects.current.set(id, { x: zx, y: zy, width, height })),
        );
        rootRef.current?.measureInWindow((originX, originY) => store.set({ originX, originY }));
        haptic('medium');
        store.set({ payload, label, x, y, overZone: null });
      },
      move: (x, y) => {
        const overZone = hitTest(x, y);
        if (overZone !== store.get().overZone && overZone) haptic('selection');
        store.set({ x, y, overZone });
      },
      end: (drop) => {
        const { payload, x, y } = store.get();
        const zone = drop ? hitTest(x, y) : null;
        store.set({ payload: null, overZone: null });
        if (payload && zone) {
          haptic('success');
          onDropRef.current(payload, zone);
        }
      },
    }),
    [enabled, hitTest, store],
  );

  return (
    <DragContext.Provider value={value}>
      <View className="flex-1" ref={rootRef}>
        {children}
        <DragGhost store={store} />
      </View>
    </DragContext.Provider>
  );
}

function DragGhost({ store }: { store: Store }) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!state.payload) return null;
  return (
    <View
      className="absolute flex-row items-center rounded-full border border-primary bg-surface px-3 py-2 shadow-lg"
      pointerEvents="none"
      style={{ left: state.x - state.originX + 12, top: state.y - state.originY - 18, elevation: 16, opacity: 0.95 }}
    >
      <Text className="text-[13px] font-bold text-ink">{state.label}</Text>
    </View>
  );
}

/** Gibt `true` zurück, solange ein Zug über dieser Zone schwebt. */
export function useDropZone(id: string) {
  const ctx = useContext(DragContext);
  const store = ctx?.store;
  const subscribe = useCallback((l: () => void) => (store ? store.subscribe(l) : () => {}), [store]);
  const isOver = useSyncExternalStore(
    subscribe,
    () => (store ? store.get().overZone === id && store.get().payload != null : false),
    () => false,
  );
  const isDragging = useSyncExternalStore(
    subscribe,
    () => (store ? store.get().payload != null : false),
    () => false,
  );
  const ref = useCallback(
    (node: View | null) => ctx?.registerZone(id, node as unknown as Measurable | null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, ctx?.registerZone],
  );
  return { ref, isOver, isDragging };
}

/**
 * Macht ein Element ziehbar. Ein Zug startet erst nach einigen Pixeln
 * Bewegung, damit ein einfacher Tipp weiterhin als Tipp (onPress) ankommt.
 * Gibt Responder-Props für die umschließende View zurück.
 */
export function useDraggable(payload: string, label: string): ViewProps | undefined {
  const ctx = useContext(DragContext);
  const start = useRef<{ x: number; y: number } | null>(null);

  if (!ctx?.enabled) return undefined;

  const point = (evt: GestureResponderEvent) => ({ x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY });
  const movedEnough = (evt: GestureResponderEvent) => {
    const from = start.current;
    if (!from) return false;
    const p = point(evt);
    return Math.abs(p.x - from.x) + Math.abs(p.y - from.y) > 6;
  };

  return {
    onStartShouldSetResponderCapture: (evt) => {
      start.current = point(evt);
      return false;
    },
    onMoveShouldSetResponderCapture: movedEnough,
    onMoveShouldSetResponder: movedEnough,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (evt) => {
      const p = point(evt);
      ctx.begin(payload, label, p.x, p.y);
    },
    onResponderMove: (evt) => {
      const p = point(evt);
      ctx.move(p.x, p.y);
    },
    onResponderRelease: () => {
      start.current = null;
      ctx.end(true);
    },
    onResponderTerminate: () => {
      start.current = null;
      ctx.end(false);
    },
  };
}
