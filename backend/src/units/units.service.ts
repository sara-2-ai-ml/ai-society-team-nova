import { Injectable } from '@nestjs/common';
import type { Lang } from '../common/lang';
import { normalize } from '../common/text';
import { Unit } from './unit.entity';
import { MOCK_UNITS } from './units.mock';

@Injectable()
export class UnitsService {
  private readonly units: Unit[] = MOCK_UNITS;

  findAll(): Unit[] {
    return this.units;
  }

  findById(id: string): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  /** Short name in the given language, e.g. "Shërbimet Sociale" / "Social Services". */
  shortName(id: string, lang: Lang): string {
    const u = this.findById(id);
    return u ? (lang === 'en' ? u.shortEn : u.short) : id;
  }

  fullName(id: string, lang: Lang): string {
    const u = this.findById(id);
    return u ? (lang === 'en' ? u.nameEn : u.name) : id;
  }

  /** Matches an id or a full/short name in either language, ignoring case and accents ("Sherbimet sociale"). */
  match(text: string): Unit | undefined {
    const t = normalize(text);
    if (!t) return undefined;
    const names = (u: Unit) => [u.id, u.name, u.short, u.nameEn, u.shortEn].map(normalize);
    return (
      this.units.find((u) => names(u).includes(t)) ??
      this.units.find((u) => [u.name, u.nameEn].some((n) => normalize(n).includes(t)) || [u.short, u.shortEn].some((s) => t.includes(normalize(s))))
    );
  }
}
