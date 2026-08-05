import { describe, expect, it } from 'vitest';
import type { FamilyModel, Person, Union } from '../data/types';
import type { PrintMeasurer } from './flow-layout';
import { PANEL_GAP_MM, panelsLayout, panelsUnplacedIds } from './panels-layout';

const measure: PrintMeasurer = (text, fontMm) => text.length * fontMm * 0.5; // deterministic fake

const kids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
function deepModel(): FamilyModel {
  const gg = kids(5, 'x');
  const persons = new Map<string, Person>();
  const unions: Union[] = [
    { id: 'u:a+b', partners: ['a', 'b'], childIds: ['c'] },
    { id: 'u:c+cw', partners: ['c', 'cw'], childIds: ['g'] },
    { id: 'u:g+gw', partners: ['g', 'gw'], childIds: gg },
    ...gg.map((x): Union => ({ id: `u:${x}+${x}w`, partners: [x, `${x}w`], childIds: [] })),
  ];
  for (const id of ['a', 'b', 'c', 'cw', 'g', 'gw', ...gg, ...gg.map((x) => `${x}w`)]) {
    persons.set(id, { id, fullName: `Name ${id}`, cleanName: `Name ${id}` });
  }
  return { persons, unions, rootId: 'u:a+b', excludedIds: [], excludedNames: [] };
}

describe('panelsLayout — composition', () => {
  it('lays panels side-by-side with the panel gap, tops aligned; dims include the title strip', () => {
    const comp = panelsLayout(deepModel(), measure);
    expect(comp.kind).toBe('panels');
    expect(comp.panels).toHaveLength(2);
    const [master, sub] = comp.panels;
    expect(master.label).toBeNull();
    expect(master.xMm).toBe(0);
    expect(sub.xMm).toBeCloseTo(master.wMm + PANEL_GAP_MM, 9);
    expect(master.hMm).toBeCloseTo(master.scene.hMm + 26, 9); // TITLE_BLOCK_MM
    expect(comp.wMm).toBeCloseTo(sub.xMm + sub.wMm, 9);
    expect(comp.hMm).toBeCloseTo(Math.max(master.hMm, sub.hMm), 9);
  });

  it('carries head metadata by display name and the marker chip renders as a scene node', () => {
    const comp = panelsLayout(deepModel(), measure);
    const [master, sub] = comp.panels;
    expect(sub.headId).toBe('g');
    expect(sub.headName).toBe('Name g'); // cleanName, never the id
    expect(master.cutLabels).toEqual(['I']);
    const chip = master.scene.nodes.find((n) => n.personId === 'm:I')!;
    expect(chip).toBeDefined();
    expect(chip.nameLines).toEqual(['I']);
    // the replacement connector targets the chip
    expect(master.scene.edges.some((e) => e.fromId === 'u:g+gw' && e.toId === 'm:I')).toBe(true);
  });

  it('no-silent-drop holds globally: every person placed in some panel; markers/echoes never mask a miss', () => {
    const m = deepModel();
    const comp = panelsLayout(m, measure);
    expect(panelsUnplacedIds(m, comp)).toEqual([]);
    // deleting a panel would surface its people
    const broken = { ...comp, panels: [comp.panels[0]] };
    expect(panelsUnplacedIds(m, broken)).toContain('x0');
  });

  it('is deterministic', () => {
    const m = deepModel();
    expect(panelsLayout(m, measure)).toEqual(panelsLayout(m, measure));
  });

  it('panels never overlap horizontally', () => {
    const comp = panelsLayout(deepModel(), measure);
    for (let i = 1; i < comp.panels.length; i++) {
      const prev = comp.panels[i - 1];
      expect(comp.panels[i].xMm).toBeGreaterThanOrEqual(prev.xMm + prev.wMm + PANEL_GAP_MM - 1e-9);
    }
  });
});
