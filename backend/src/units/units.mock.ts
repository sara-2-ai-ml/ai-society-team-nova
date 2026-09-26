import { Unit } from './unit.entity';

// Mock list until the real organisation chart is available.
export const MOCK_UNITS: Unit[] = [
  { id: 'sociale', name: 'Drejtoria e Shërbimeve Sociale', short: 'Shërbimet Sociale', nameEn: 'Social Services Department', shortEn: 'Social Services', type: 'drejtori', slaDays: 15 },
  { id: 'publike', name: 'Drejtoria e Shërbimeve Publike', short: 'Shërbimet Publike', nameEn: 'Public Services Department', shortEn: 'Public Services', type: 'drejtori', slaDays: 5 },
  { id: 'infrastruktura', name: 'Drejtoria e Infrastrukturës', short: 'Infrastruktura', nameEn: 'Infrastructure Department', shortEn: 'Infrastructure', type: 'drejtori', slaDays: 10 },
  { id: 'urbanistika', name: 'Drejtoria e Urbanistikës', short: 'Urbanistika', nameEn: 'Urban Planning Department', shortEn: 'Urban Planning', type: 'drejtori', slaDays: 20 },
  { id: 'parqet', name: 'Agjencia e Parqeve dhe Rekreacionit', short: 'Parqet', nameEn: 'Parks and Recreation Agency', shortEn: 'Parks', type: 'agjenci', slaDays: 7 },
  { id: 'transporti', name: 'Agjencia e Transportit Publik', short: 'Transporti', nameEn: 'Public Transport Agency', shortEn: 'Transport', type: 'agjenci', slaDays: 10 },
];

/** Typical subjects (lënda) per unit, used to generate mock requests. */
export const MOCK_SUBJECTS: Record<string, string[]> = {
  sociale: [
    'Kërkesë për ndihmë ekonomike',
    'Kërkesë për pagesë paaftësie',
    'Kërkesë për bonus qiraje',
    'Kërkesë për strehim social',
  ],
  publike: ['Mbetje të pagrumbulluara', 'Pastrim rruge', 'Kazan i dëmtuar'],
  infrastruktura: ['Gropë në rrugë', 'Ndriçim publik jashtë funksionit', 'Trotuar i dëmtuar', 'Kanal i bllokuar'],
  urbanistika: ['Kërkesë për leje ndërtimi', 'Kërkesë për informacion urbanistik', 'Ankesë për ndërtim pa leje'],
  parqet: ['Mirëmbajtje e parkut', 'Pemë e rrëzuar', 'Kënd lojërash i dëmtuar'],
  transporti: ['Ankesë për linjën urbane', 'Stacion autobusi i dëmtuar', 'Kërkesë për linjë të re'],
};
