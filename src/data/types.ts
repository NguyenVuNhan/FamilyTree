export interface PersonRow {
  rowNumber: number;        // sheet row: header is 1, first person is 2
  id: string;               // trimmed
  fullName: string;         // trimmed
  image: string;            // raw cell text, '' when blank
  gender: string;           // raw cell text, '' when blank
  partnerId: string;        // trimmed, '' when blank
  parentIds: string[];      // trimmed, split on ';', empties removed
}

export interface Person {
  id: string;
  fullName: string;
  imageSrc?: string;
  gender?: 'male' | 'female';
}

export interface Union {
  id: string;
  partners: [string] | [string, string];
  childIds: string[];
}

export interface Issue {
  row?: number;
  message: string;
}

export interface FamilyModel {
  persons: Map<string, Person>;
  unions: Union[];
  rootId: string;           // union id (couple root) or person id prefixed 'p:' for a lone root
  excludedIds: string[];    // people in smaller disconnected components (not rendered)
}
