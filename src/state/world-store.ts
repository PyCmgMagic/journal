import { create } from 'zustand';
import { createWorldState, reduceWorld, type WorldEvent, type WorldState } from '../lib/world-machine';

type WorldStore = WorldState & { dispatch: (event: WorldEvent) => void };

export const useWorldStore = create<WorldStore>((set) => ({
  ...createWorldState(),
  dispatch: (event) => set((state) => reduceWorld(state, event)),
}));
