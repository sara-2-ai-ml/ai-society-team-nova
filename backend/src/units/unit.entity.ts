export type UnitType = 'drejtori' | 'agjenci';

/** A department (drejtori) or agency (agjenci) that receives requests. */
export interface Unit {
  id: string;
  name: string;
  short: string;
  nameEn: string;
  shortEn: string;
  type: UnitType;
  /** Days a unit has to complete a request after it is registered. */
  slaDays: number;
}
