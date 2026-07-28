import type { FamilyModel, Person, PersonRow, Union } from './types';
import { resolveImage } from './image-source';

const unionId = (partners: string[]) => `u:${[...partners].sort().join('+')}`;

export function buildModel(rows: PersonRow[]): FamilyModel {
  const persons = new Map<string, Person>();
  for (const row of rows) {
    const img = resolveImage(row.image);
    persons.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      ...(img.kind === 'src' ? { imageSrc: img.src } : {}),
    });
  }

  // collect unions from explicit partners and from ParentIDs pairs
  const unions = new Map<string, Union>();
  const ensureUnion = (partners: string[]) => {
    const id = unionId(partners);
    if (!unions.has(id)) {
      unions.set(id, { id, partners: [...partners].sort() as Union['partners'], childIds: [] });
    }
    return unions.get(id)!;
  };
  for (const row of rows) {
    if (row.partnerId) ensureUnion([row.id, row.partnerId]);
  }
  for (const row of rows) {
    if (row.parentIds.length > 0) ensureUnion(row.parentIds).childIds.push(row.id);
  }

  // connected components over person ids (edges: partner + parent-child)
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const u of unions.values()) {
    if (u.partners.length === 2) link(u.partners[0], u.partners[1]);
    for (const c of u.childIds) link(u.partners[0], c);
  }
  const componentOf = new Map<string, number>();
  let comp = 0;
  for (const id of persons.keys()) {
    if (componentOf.has(id)) continue;
    const stack = [id];
    componentOf.set(id, comp);
    while (stack.length) {
      for (const n of adj.get(stack.pop()!) ?? []) {
        if (!componentOf.has(n)) {
          componentOf.set(n, comp);
          stack.push(n);
        }
      }
    }
    comp++;
  }
  const sizes = new Map<number, number>();
  for (const c of componentOf.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const maxSize = Math.max(0, ...sizes.values());

  // Keep every component tied for the largest size; exclude only strictly smaller ones
  // (see FamilyModel.excludedIds: "people in smaller disconnected components").
  const excludedIds = [...persons.keys()]
    .filter((id) => sizes.get(componentOf.get(id)!) !== maxSize)
    .sort();
  for (const id of excludedIds) persons.delete(id);
  const keptUnions = [...unions.values()].filter((u) => persons.has(u.partners[0]));

  // root: union whose partners are nobody's children; else lone person
  const isChild = new Set(keptUnions.flatMap((u) => u.childIds));
  const rootUnion = keptUnions.find((u) => u.partners.every((p) => !isChild.has(p)));
  const rootId = rootUnion ? rootUnion.id : `p:${[...persons.keys()][0] ?? ''}`;

  return { persons, unions: keptUnions, rootId, excludedIds };
}
