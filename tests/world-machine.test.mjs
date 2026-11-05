import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState, reduceWorld } from '../src/lib/world-machine.ts';

const snapshot = () => ({ position: [4, 2, 6], target: [0, 1, 0], scrollY: 480 });

test('early release cancels and permits immediate retry', () => {
  let state = reduceWorld(createWorldState(), { type: 'charge.begin' });
  assert.equal(state.phase, 'charging');
  state = reduceWorld(state, { type: 'charge.cancel' });
  assert.equal(state.phase, 'idle');
  assert.equal(reduceWorld(state, { type: 'charge.begin' }).phase, 'charging');
});

test('completion cannot bypass a hold or trigger awakening twice', () => {
  const initial = createWorldState();
  assert.equal(reduceWorld(initial, { type: 'charge.complete' }), initial);
  let state = reduceWorld(initial, { type: 'charge.begin' });
  state = reduceWorld(state, { type: 'charge.complete' });
  assert.equal(state.phase, 'awakening');
  assert.equal(reduceWorld(state, { type: 'charge.complete' }), state);
  state = reduceWorld(state, { type: 'awakening.complete' });
  assert.equal(state.phase, 'awake');
  assert.equal(reduceWorld(state, { type: 'charge.begin' }), state);
  assert.equal(reduceWorld(state, { type: 'charge.cancel' }), state);
});

test('category selection interrupts unfinished charging and reading remains accessible', () => {
  let state = reduceWorld(createWorldState(), { type: 'charge.begin' });
  state = reduceWorld(state, { type: 'category.open', category: 'notes' });
  assert.equal(state.phase, 'idle');
  assert.deepEqual(state.view, { kind: 'category', category: 'notes' });
  assert.equal(reduceWorld(state, { type: 'charge.begin' }), state);
});

test('next article preserves the original scene snapshot; revisits do not duplicate stars', () => {
  const original = snapshot();
  let state = reduceWorld(createWorldState(), {
    type: 'article.open', slug: 'first', category: 'notes', snapshot: original,
  });
  original.position[0] = 999;
  assert.equal(state.returnSnapshot.position[0], 4);
  state = reduceWorld(state, {
    type: 'article.open', slug: 'second', category: 'notes',
    snapshot: { ...snapshot(), scrollY: 999 },
  });
  assert.equal(state.returnSnapshot.scrollY, 480);
  state = reduceWorld(state, {
    type: 'article.open', slug: 'first', category: 'notes', snapshot: snapshot(),
  });
  assert.deepEqual(state.readSlugs, ['first', 'second']);
  state = reduceWorld(state, { type: 'view.close' });
  assert.deepEqual(state.view, { kind: 'world' });
  assert.equal(state.selectedCategory, 'notes');
  assert.equal(state.returnSnapshot.scrollY, 480);
});

test('a new visit from the world replaces the old return snapshot', () => {
  let state = reduceWorld(createWorldState(), {
    type: 'article.open', slug: 'first', category: 'notes', snapshot: snapshot(),
  });
  state = reduceWorld(state, { type: 'view.close' });
  state = reduceWorld(state, {
    type: 'article.open', slug: 'third', category: 'reading',
    snapshot: { ...snapshot(), scrollY: 800 },
  });
  assert.equal(state.returnSnapshot.scrollY, 800);
  assert.equal(state.selectedCategory, 'reading');
});
