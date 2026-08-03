import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSaved, removeSaved, upsertSaved, REGISTRY_STORAGE_KEY } from './registry';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const alpha = { key: '?src=a', name: 'Alpha', search: '?src=a&name=Alpha' };
const bravo = { key: '?src=b', name: 'Bravo', search: '?src=b&name=Bravo' };

describe('registry', () => {
  it('starts empty', () => {
    expect(loadSaved()).toEqual([]);
  });

  it('upsert + load round-trip, newest first', () => {
    upsertSaved(alpha, 1000);
    upsertSaved(bravo, 2000);
    expect(loadSaved().map((f) => f.name)).toEqual(['Bravo', 'Alpha']);
    expect(loadSaved()[0]).toEqual({ ...bravo, savedAt: 2000 });
  });

  it('upsert with an existing key replaces the entry (rename + reorder, no duplicates)', () => {
    upsertSaved(alpha, 1000);
    upsertSaved(bravo, 2000);
    upsertSaved({ ...alpha, name: 'Alpha Renamed', search: '?src=a&name=Alpha+Renamed' }, 3000);
    const saved = loadSaved();
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ key: '?src=a', name: 'Alpha Renamed', savedAt: 3000 });
  });

  it('remove deletes by key and persists', () => {
    upsertSaved(alpha, 1000);
    upsertSaved(bravo, 2000);
    removeSaved('?src=a');
    expect(loadSaved().map((f) => f.key)).toEqual(['?src=b']);
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['non-array payload', '{"a":1}'],
    ['null', 'null'],
  ])('%s → empty list, no throw', (_label, payload) => {
    localStorage.setItem(REGISTRY_STORAGE_KEY, payload);
    expect(loadSaved()).toEqual([]);
  });

  it('entries with wrong shapes are dropped, valid ones kept', () => {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify([
      { key: '?src=a', name: 'Alpha', search: '?src=a', savedAt: 1 },
      { key: 42, name: 'Bad' },
      'garbage',
    ]));
    expect(loadSaved()).toEqual([{ key: '?src=a', name: 'Alpha', search: '?src=a', savedAt: 1 }]);
  });

  it('QuotaExceededError on write is swallowed', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    expect(() => upsertSaved(alpha)).not.toThrow();
    expect(() => removeSaved('?src=a')).not.toThrow();
  });

  it('read-throw (blocked storage) behaves as empty', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(loadSaved()).toEqual([]);
  });
});
