export type Category = 'notes' | 'practice' | 'reading';
export type WorldPhase = 'idle' | 'charging' | 'awakening' | 'awake';
export type Vec3 = readonly [number, number, number];

export interface SceneSnapshot {
  position: Vec3;
  target: Vec3;
  scrollY: number;
}

export type WorldView =
  | { kind: 'world' }
  | { kind: 'category'; category: Category }
  | { kind: 'article'; slug: string; category: Category };

export interface WorldState {
  phase: WorldPhase;
  view: WorldView;
  selectedCategory: Category | null;
  returnSnapshot: SceneSnapshot | null;
  readSlugs: readonly string[];
}

export type WorldEvent =
  | { type: 'charge.begin' }
  | { type: 'charge.cancel' }
  | { type: 'charge.complete' }
  | { type: 'awakening.complete' }
  | { type: 'category.open'; category: Category }
  | { type: 'article.open'; slug: string; category: Category; snapshot: SceneSnapshot }
  | { type: 'view.close' };

export const createWorldState = (): WorldState => ({
  phase: 'idle',
  view: { kind: 'world' },
  selectedCategory: null,
  returnSnapshot: null,
  readSlugs: [],
});

function snapshotCopy(snapshot: SceneSnapshot): SceneSnapshot {
  return {
    position: [...snapshot.position],
    target: [...snapshot.target],
    scrollY: snapshot.scrollY,
  };
}

/** Discrete events only. Per-frame charge, camera and shader data live outside React. */
export function reduceWorld(state: WorldState, event: WorldEvent): WorldState {
  switch (event.type) {
    case 'charge.begin':
      return state.phase === 'idle' && state.view.kind === 'world'
        ? { ...state, phase: 'charging' }
        : state;
    case 'charge.cancel':
      return state.phase === 'charging' ? { ...state, phase: 'idle' } : state;
    case 'charge.complete':
      return state.phase === 'charging' ? { ...state, phase: 'awakening' } : state;
    case 'awakening.complete':
      return state.phase === 'awakening' ? { ...state, phase: 'awake' } : state;
    case 'category.open':
      return {
        ...state,
        phase: state.phase === 'charging' ? 'idle' : state.phase,
        view: { kind: 'category', category: event.category },
        selectedCategory: event.category,
      };
    case 'article.open': {
      const firstOpen = state.view.kind !== 'article';
      return {
        ...state,
        phase: state.phase === 'charging' ? 'idle' : state.phase,
        view: { kind: 'article', slug: event.slug, category: event.category },
        selectedCategory: event.category,
        returnSnapshot: firstOpen ? snapshotCopy(event.snapshot) : state.returnSnapshot,
        readSlugs: state.readSlugs.includes(event.slug)
          ? state.readSlugs
          : [...state.readSlugs, event.slug],
      };
    }
    case 'view.close':
      return state.view.kind === 'world' ? state : { ...state, view: { kind: 'world' } };
  }
}
