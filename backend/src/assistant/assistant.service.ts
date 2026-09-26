import { Injectable, Logger } from '@nestjs/common';
import { DIRECTORATE_BY_UNIT, PythonApiError, PythonApiService } from '../analytics/python-api.service';
import { addDays, today } from '../common/dates';
import type { Lang } from '../common/lang';
import { normalize } from '../common/text';
import type { JwtPayload } from '../auth/jwt-payload';
import { Role } from '../auth/role.enum';
import { RequestsService } from '../requests/requests.service';
import { Unit } from '../units/unit.entity';
import { UnitsService } from '../units/units.service';

export interface AssistantAnswer {
  answer: string;
  facts: { label: string; value: string }[];
  suggestions: string[];
  /** 'ai' = OpenAI agent over the Bashkia 360 data; 'offline' = rule-based answers. */
  source: 'ai' | 'offline';
  /** Data tools the AI used to answer. */
  tools?: string[];
}

type PeriodId = 'today' | 'yesterday' | 'week' | 'month' | 'all';

interface Period {
  id: PeriodId;
  from?: string;
  to?: string;
}

const PERIOD_TEXT: Record<Lang, Record<PeriodId, string>> = {
  sq: { today: 'sot', yesterday: 'dje', week: 'në 7 ditët e fundit', month: 'këtë muaj', all: 'gjithsej' },
  en: { today: 'today', yesterday: 'yesterday', week: 'in the last 7 days', month: 'this month', all: 'in total' },
};

// Albanian first, English second: the same intent, recognised in either language.
const INTENT = {
  overdue: /vonu|vones|afat.*kalu|kalu.*afat|jashte afatit|overdue|late|past (the )?deadline|delay/,
  onTime: /brenda afatit|perqind|perfundoj|perfundua|zgjidh|mbyll|on time|percent|completed|resolved|closed|finished|done/,
  subjects: /lend|tema|subjekt|shpesh|arsye|subject|topic|common|frequent/,
  returned: /kthyer|kthe|ridrejt|returned|sent back|redirect/,
  ranking: /cila|renditj|krahas|me shume|me pak|drejtori|agjenci|which|compare|rank|most|least|department|agency/,
  total: /sa |numr|total|gjithsej|kerkesa|si po ec|gjendj|permbledhj|how many|number|requests|how is|how are|doing|status|summary/,
};

/**
 * Offline assistant: recognises common questions in Albanian or English and answers from the same
 * statistics the dashboard shows, so it never invents a number. A language model can replace
 * `answer()` later without changing the API.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly requests: RequestsService,
    private readonly units: UnitsService,
    private readonly python: PythonApiService,
  ) {}

  /**
   * Asks the OpenAI agent when it is available and the question is about data it has
   * (DSHP and DI); otherwise answers offline. A directorate user's question only ever
   * reaches the agent with that directorate's data.
   */
  async ask(viewer: JwtPayload, question: string, lang: Lang): Promise<AssistantAnswer> {
    const scoped = viewer.role === Role.Drejtoria;
    const directorate = scoped ? DIRECTORATE_BY_UNIT[viewer.unitId ?? ''] : undefined;
    if (!scoped || directorate) {
      try {
        const reply = await this.python.ask(question, `nova-${viewer.username}`, lang, directorate);
        return {
          answer: reply.answer,
          facts: [],
          suggestions: this.suggestions(viewer, lang),
          source: 'ai',
          tools: [...new Set(reply.tools_used.map((t) => t.tool))],
        };
      } catch (error) {
        // 503 = no OPENAI_API_KEY; null = Python not running. Both are normal: answer offline.
        if (!(error instanceof PythonApiError) || (error.status !== 503 && error.status !== null)) {
          this.logger.warn(`AI assistant failed, answering offline: ${(error as Error).message}`);
        }
      }
    }
    return this.answer(viewer, question, lang);
  }

  suggestions(viewer: JwtPayload, lang: Lang): string[] {
    const own = viewer.role === Role.Drejtoria;
    if (lang === 'en') {
      return [
        'How many requests do we have this month?',
        own ? 'How many requests are past their deadline?' : 'Which department has the most overdue requests?',
        'What are the most frequent subjects?',
        own ? 'What percentage do we complete on time?' : 'How is Social Services doing?',
        'How many requests were registered this week?',
      ];
    }
    return [
      'Sa kërkesa kemi këtë muaj?',
      own ? 'Sa kërkesa janë me afat të kaluar?' : 'Cila drejtori ka më shumë kërkesa të vonuara?',
      'Cilat janë lëndët më të shpeshta?',
      own ? 'Sa përqind përfundojmë brenda afatit?' : 'Si po ecën Drejtoria e Shërbimeve Sociale?',
      'Sa kërkesa u regjistruan këtë javë?',
    ];
  }

  answer(viewer: JwtPayload, question: string, lang: Lang = 'sq'): AssistantAnswer {
    return { ...this.offline(viewer, question, lang), source: 'offline' };
  }

  private offline(viewer: JwtPayload, question: string, lang: Lang): Omit<AssistantAnswer, 'source'> {
    const en = lang === 'en';
    const q = normalize(question);
    const period = this.period(q);
    const when = PERIOD_TEXT[lang][period.id];
    const mentioned = this.mentionedUnit(q);
    const scoped = viewer.role === Role.Drejtoria;
    const unit = scoped ? this.units.findById(viewer.unitId ?? '') : mentioned;
    const stats = this.requests.stats(viewer, { from: period.from, to: period.to, unitId: unit?.id });
    const who = unit ? (en ? unit.shortEn : unit.short) : en ? 'Municipality of Elbasan' : 'Bashkia Elbasan';
    const name = (id: string) => this.units.shortName(id, lang);
    const suggestions = this.suggestions(viewer, lang);
    const note =
      scoped && mentioned && mentioned.id !== unit?.id
        ? en
          ? ' (You can only see your own department’s data.)'
          : ' (Ju shihni vetëm të dhënat e drejtorisë suaj.)'
        : '';
    const reply = (answer: string, facts: AssistantAnswer['facts'] = []) => ({ answer: answer + note, facts, suggestions });

    if (!q) return this.help(lang, suggestions);

    if (INTENT.overdue.test(q) && !/brenda|on time/.test(q)) {
      const late = stats.byUnit.filter((u) => u.overdue > 0);
      const worst = late[0];
      const facts = late.slice(0, 6).map((u) => ({ label: name(u.unitId), value: en ? `${u.overdue} overdue` : `${u.overdue} me vonesë` }));
      if (stats.overdue === 0) return reply(en ? `${who}: no requests past their deadline ${when}.` : `${who}: asnjë kërkesë me afat të kaluar ${when}.`);
      return reply(
        en
          ? `${who}: ${stats.overdue} requests are past their deadline ${when}.` + (!unit && worst ? ` ${name(worst.unitId)} has the most (${worst.overdue}).` : '')
          : `${who}: ${stats.overdue} kërkesa kanë kaluar afatin ${when}.` + (!unit && worst ? ` Më shumë ka ${name(worst.unitId)} (${worst.overdue}).` : ''),
        facts,
      );
    }

    if (INTENT.onTime.test(q)) {
      const facts = [
        { label: en ? 'Completed' : 'Të përfunduara', value: String(stats.done) },
        { label: en ? 'On time' : 'Brenda afatit', value: stats.onTimeRate === null ? '–' : `${stats.onTimeRate}%` },
        { label: en ? 'Average days' : 'Ditë mesatarisht', value: stats.avgDaysToComplete === null ? '–' : String(stats.avgDaysToComplete) },
      ];
      if (stats.onTimeRate === null) return reply(en ? `${who}: no completed requests yet ${when}.` : `${who}: ende asnjë kërkesë e përfunduar ${when}.`);
      const avg = stats.avgDaysToComplete;
      return reply(
        en
          ? `${who}: ${stats.done} requests completed ${when}, ${stats.onTimeRate}% on time.` + (avg !== null ? ` On average they take ${avg} days.` : '')
          : `${who}: ${stats.done} kërkesa të përfunduara ${when}, ${stats.onTimeRate}% brenda afatit.` + (avg !== null ? ` Mesatarisht zgjidhen për ${avg} ditë.` : ''),
        facts,
      );
    }

    if (INTENT.subjects.test(q)) {
      const top = stats.topSubjects;
      const facts = top.map((t) => ({ label: t.subject, value: en ? `${t.total} requests` : `${t.total} kërkesa` }));
      if (!top.length) return reply(en ? `${who}: no requests ${when}.` : `${who}: asnjë kërkesë ${when}.`);
      return reply(
        en
          ? `${who}: the most frequent subject ${when} is "${top[0].subject}" with ${top[0].total} requests.`
          : `${who}: lënda më e shpeshtë ${when} është "${top[0].subject}" me ${top[0].total} kërkesa.`,
        facts,
      );
    }

    if (INTENT.returned.test(q)) {
      const facts = stats.byUnit
        .filter((u) => u.returned > 0)
        .map((u) => ({ label: name(u.unitId), value: en ? `${u.returned} returned` : `${u.returned} të kthyera` }));
      return reply(
        en
          ? `${who}: ${stats.returned} requests were returned to the operator ${when} and are waiting to be resent.`
          : `${who}: ${stats.returned} kërkesa janë kthyer te operatori ${when} dhe presin të ridërgohen.`,
        facts,
      );
    }

    if (!unit && INTENT.ranking.test(q)) {
      const ranked = [...stats.byUnit].sort((a, b) => b.total - a.total);
      const facts = ranked.map((u) => ({
        label: name(u.unitId),
        value: en ? `${u.total} total · ${u.overdue} overdue` : `${u.total} gjithsej · ${u.overdue} me vonesë`,
      }));
      if (!ranked.length) return reply(en ? `No requests ${when}.` : `Asnjë kërkesë ${when}.`);
      return reply(
        en
          ? `${name(ranked[0].unitId)} has the most requests ${when} (${ranked[0].total}).`
          : `${name(ranked[0].unitId)} ka më shumë kërkesa ${when} (${ranked[0].total}).`,
        facts,
      );
    }

    if (INTENT.total.test(`${q} `) || unit) {
      if (stats.total === 0) return reply(en ? `${who}: no requests ${when}.` : `${who}: asnjë kërkesë ${when}.`);
      const facts = [
        { label: en ? 'Total' : 'Gjithsej', value: String(stats.total) },
        { label: en ? 'New' : 'Të reja', value: String(stats.new) },
        { label: en ? 'In progress' : 'Në proces', value: String(stats.inProgress) },
        { label: en ? 'Completed' : 'Të përfunduara', value: String(stats.done) },
        { label: en ? 'Past deadline' : 'Me afat të kaluar', value: String(stats.overdue) },
      ];
      return reply(
        en
          ? `${who}: ${stats.total} requests ${when}. ${stats.new} new, ${stats.inProgress} in progress, ${stats.done} completed` +
              (stats.overdue ? `, ${stats.overdue} past their deadline.` : '.')
          : `${who}: ${stats.total} kërkesa ${when}. ${stats.new} të reja, ${stats.inProgress} në proces, ${stats.done} të përfunduara` +
              (stats.overdue ? `, ${stats.overdue} me afat të kaluar.` : '.'),
        facts,
      );
    }

    return this.help(lang, suggestions);
  }

  private help(lang: Lang, suggestions: string[]): Omit<AssistantAnswer, 'source'> {
    return {
      answer:
        lang === 'en'
          ? "I didn't understand the question. You can ask about the number of requests, delays, the most frequent subjects, " +
            'completion on time, or a specific department, e.g. for this week or this month.'
          : 'Nuk e kuptova pyetjen. Mund të pyesni për numrin e kërkesave, vonesat, lëndët më të shpeshta, ' +
            'përfundimin brenda afatit ose për një drejtori të caktuar, p.sh. për këtë javë ose këtë muaj.',
      facts: [],
      suggestions,
    };
  }

  private period(q: string): Period {
    const now = today();
    if (/\bsot\b|\btoday\b/.test(q)) return { id: 'today', from: now, to: now };
    if (/\bdje\b|\byesterday\b/.test(q)) return { id: 'yesterday', from: addDays(now, -1), to: addDays(now, -1) };
    if (/jav|week/.test(q)) return { id: 'week', from: addDays(now, -6), to: now };
    if (/muaj|month/.test(q)) return { id: 'month', from: `${now.slice(0, 7)}-01`, to: now };
    return { id: 'all' };
  }

  private mentionedUnit(q: string): Unit | undefined {
    const words = (u: Unit) =>
      [u.short, u.shortEn]
        .flatMap((s) => normalize(s).split(' '))
        .filter((w) => w.length > 4 && !['sherbimet', 'services', 'public'].includes(w));
    return this.units
      .findAll()
      .find(
        (u) =>
          [u.name, u.nameEn].some((n) => q.includes(normalize(n))) ||
          q.includes(u.id) ||
          words(u).some((w) => q.includes(w.slice(0, 6))),
      );
  }
}
