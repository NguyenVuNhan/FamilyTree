export interface PersonRow {
  rowNumber: number;        // sheet row: header is 1, first person is 2; a person and their partner share it
  id: string;               // synthesized: r<rowNumber> for the person, r<rowNumber>p for their partner
  fullName: string;         // display name, verbatim from the cell segment (may include "(1932)" etc.)
  image: string;            // raw cell text, '' when blank
  gender: string;           // raw cell text (Gender / PartnerGender column), '' when blank
  partnerId: string;        // r<rowNumber>p when the cell names a partner, '' otherwise
  parentIds: string[];      // ids of the parent row's person (and partner, if any)
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
