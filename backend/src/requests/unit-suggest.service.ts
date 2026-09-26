import { Injectable } from '@nestjs/common';
import { PythonApiService } from '../analytics/python-api.service';
import type { Lang } from '../common/lang';
import { normalize } from '../common/text';
import { UnitsService } from '../units/units.service';
import { RequestsService } from './requests.service';

export interface UnitSuggestion {
  unitId: string | null;
  reason: string;
  /** 'ai' = OpenAI chose it; 'history' = most similar past requests. */
  source: 'ai' | 'history';
}

// Word stems, so "gropa" and "gropë", "ndriçim" and "ndriçimi" match.
const stems = (text: string) =>
  new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w.length >= 4 && !['kerkese', 'kerkesa', 'request'].includes(w))
      .map((w) => w.slice(0, 4)),
  );

/**
 * Suggests the unit a request belongs to from its subject. Only a suggestion: the operator
 * confirms or picks another unit.
 */
@Injectable()
export class UnitSuggestService {
  private readonly cache = new Map<string, UnitSuggestion>();

  constructor(
    private readonly requests: RequestsService,
    private readonly units: UnitsService,
    private readonly python: PythonApiService,
  ) {}

  async suggest(subject: string, lang: Lang): Promise<UnitSuggestion> {
    const key = `${lang}|${normalize(subject)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const usual = this.requests.usualSubjects();
    const units = this.units.findAll().map((u) => ({
      id: u.id,
      name: u.name,
      name_en: u.nameEn,
      type: u.type === 'agjenci' ? 'agency' : 'department',
      usual_subjects: (usual.get(u.id) ?? []).map((s) => s.subject),
    }));

    let suggestion: UnitSuggestion;
    try {
      const ai = await this.python.suggestUnit(subject, units, lang);
      suggestion = { unitId: ai.unit_id, reason: ai.reason, source: 'ai' };
    } catch {
      suggestion = this.fromHistory(subject, usual, lang);
    }
    // Remember a handful of answers, so retyping the same subject costs nothing.
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, suggestion);
    return suggestion;
  }

  /** Offline: the unit whose past subjects share the most words with this one. */
  private fromHistory(subject: string, usual: Map<string, { subject: string; count: number }[]>, lang: Lang): UnitSuggestion {
    const words = stems(subject);
    let best: { unitId: string; score: number; example: string } | null = null;
    for (const [unitId, subjects] of usual) {
      for (const s of subjects) {
        const shared = [...stems(s.subject)].filter((w) => words.has(w)).length;
        // More shared words wins; among equals, the more common subject.
        const score = shared * 100 + s.count;
        if (shared && (!best || score > best.score)) best = { unitId, score, example: s.subject };
      }
    }
    if (!best) return { unitId: null, reason: '', source: 'history' };
    const unit = this.units.shortName(best.unitId, lang);
    return {
      unitId: best.unitId,
      reason:
        lang === 'en'
          ? `Similar requests ("${best.example}") usually go to ${unit}.`
          : `Kërkesa të ngjashme ("${best.example}") zakonisht shkojnë te ${unit}.`,
      source: 'history',
    };
  }
}
