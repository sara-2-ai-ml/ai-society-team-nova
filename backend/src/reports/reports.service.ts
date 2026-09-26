import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, daysBetween, isValidDay, today } from '../common/dates';
import type { JwtPayload } from '../auth/jwt-payload';
import type { Lang } from '../common/lang';
import { RequestsService } from '../requests/requests.service';
import { UnitsService } from '../units/units.service';
import { PythonApiService } from '../analytics/python-api.service';
import { autoNarrative } from './auto-narrative';
import { Narrative, Report, ReportFacts } from './report.types';

const MAX_DAYS = 366;

@Injectable()
export class ReportsService {
  // Generated reports are kept until the data changes, so reopening one is instant and free.
  private readonly cache = new Map<string, Report>();

  constructor(
    private readonly requests: RequestsService,
    private readonly units: UnitsService,
    private readonly python: PythonApiService,
  ) {}

  async report(
    viewer: JwtPayload,
    q: { from?: string; to?: string; unitId?: string; refresh?: boolean; lang?: Lang },
  ): Promise<Report> {
    const lang = q.lang ?? 'sq';
    const to = q.to ?? today();
    const from = q.from ?? addDays(to, -6);
    if (!isValidDay(from) || !isValidDay(to) || from > to) throw new BadRequestException('Periudha nuk është e vlefshme');
    if (daysBetween(from, to) >= MAX_DAYS) throw new BadRequestException('Periudha mund të jetë deri në një vit');

    const unitId = this.requests.scopeUnit(viewer, q.unitId);
    if (unitId && !this.units.findById(unitId)) throw new BadRequestException('Drejtoria nuk njihet');

    const key = [unitId ?? 'all', from, to, lang, this.requests.dataRevision, today()].join('|');
    const cached = this.cache.get(key);
    if (cached && !q.refresh) return cached;

    const facts = this.facts(viewer, from, to, unitId, lang);
    const written = await this.python.reportNarrative<Narrative>(facts, lang).catch(() => null);
    const report: Report = {
      ...facts,
      narrative: written ? pickNarrative(written) : autoNarrative(facts, lang),
      generatedBy: written ? 'ai' : 'auto',
      model: written?.model ?? null,
      generatedAt: new Date().toISOString(),
    };
    this.cache.set(key, report);
    return report;
  }

  private facts(viewer: JwtPayload, from: string, to: string, unitId: string | undefined, lang: Lang): ReportFacts {
    const length = daysBetween(from, to) + 1;
    const previous = { from: addDays(from, -length), to: addDays(from, -1) };
    const stats = this.requests.stats(viewer, { from, to, unitId });
    const before = this.requests.stats(viewer, { ...previous, unitId });
    const items = this.requests.list(viewer, { from, to, unitId });
    const prevItems = this.requests.list(viewer, { ...previous, unitId });
    const name = (id: string) => this.units.shortName(id, lang);

    const subjects = new Map<string, { total: number; previous: number }>();
    for (const r of items) subjects.set(r.subject, { total: (subjects.get(r.subject)?.total ?? 0) + 1, previous: 0 });
    for (const r of prevItems) {
      const s = subjects.get(r.subject);
      if (s) s.previous++;
    }

    // Late requests count whenever they were registered: a report must not hide old backlog.
    const overdue = this.requests.list(viewer, { unitId, status: 'overdue' });
    const overdueIn = (id: string) => overdue.filter((r) => r.unitId === id).length;
    const overdueItems = [...overdue]
      .sort((a, b) => a.daysLeft! - b.daysLeft!)
      .slice(0, 8)
      .map((r) => ({ protocolNo: r.protocolNo, subject: r.subject, unit: name(r.unitId), daysLate: -r.daysLeft! }));

    return {
      scope: { unitId: unitId ?? null, name: unitId ? this.units.fullName(unitId, lang) : lang === 'en' ? 'Municipality of Elbasan' : 'Bashkia Elbasan' },
      period: { from, to },
      previousPeriod: previous,
      metrics: {
        total: stats.total,
        previousTotal: before.total,
        changePercent: before.total ? Math.round(((stats.total - before.total) / before.total) * 100) : null,
        new: stats.new,
        inProgress: stats.inProgress,
        done: stats.done,
        returned: stats.returned,
        overdue: overdue.length,
        onTimeRate: stats.onTimeRate,
        onTimeDone: items.filter((r) => r.status === 'done' && r.completedAt! <= r.deadline).length,
        previousOnTimeRate: before.onTimeRate,
        avgDaysToComplete: stats.avgDaysToComplete,
      },
      byUnit: unitId
        ? []
        : stats.byUnit.map((u) => ({
            unitId: u.unitId,
            name: name(u.unitId),
            total: u.total,
            open: u.new + u.inProgress,
            overdue: overdueIn(u.unitId),
            done: u.done,
            onTimeRate: u.onTimeRate,
          }))
            .sort((a, b) => b.overdue - a.overdue || b.total - a.total),
      topSubjects: [...subjects.entries()]
        .map(([subject, v]) => ({ subject, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
      overdueItems,
    };
  }
}

/** Keeps only the narrative fields, as strings, whatever else the AI response carried. */
function pickNarrative(n: Narrative): Narrative {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    headline: String(n.headline ?? ''),
    summary: String(n.summary ?? ''),
    highlights: list(n.highlights),
    concerns: list(n.concerns),
    recommendations: list(n.recommendations),
  };
}
