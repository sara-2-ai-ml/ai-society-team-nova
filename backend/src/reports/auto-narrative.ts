import type { Lang } from '../common/lang';
import { Narrative, ReportFacts } from './report.types';

const day = (d: string) => d.split('-').reverse().join('.');
export const periodText = (p: { from: string; to: string }) => (p.from === p.to ? day(p.from) : `${day(p.from)} – ${day(p.to)}`);

type Unit = ReportFacts['byUnit'][number];

// The wording of every sentence, per language. The rules deciding which sentences appear are shared.
const WORDS = {
  sq: {
    same: ' Numri është i njëjtë me periudhën e mëparshme.',
    trend: (prev: number, up: boolean, pct: number) =>
      ` Krahasuar me periudhën e mëparshme (${prev}), kërkesat ${up ? 'u rritën' : 'u ulën'} me ${pct}%.`,
    headNone: (who: string, late: number) =>
      `${who}: asnjë kërkesë e re në këtë periudhë${late ? `; ${late} kërkesa të hapura kanë kaluar afatin` : ''}`,
    headLate: (who: string, total: number, late: number, worst?: string) =>
      `${who}: ${total} kërkesa të reja; ${late} kërkesa të hapura kanë kaluar afatin${worst ? `, më shumë te ${worst}` : ''}`,
    headOk: (who: string, total: number) => `${who}: ${total} kërkesa të reja dhe asnjë kërkesë me afat të kaluar`,
    summary: (period: string, total: number) => `Në periudhën ${period} u regjistruan ${total} kërkesa.`,
    done: (n: number) => `${n} u përfunduan`,
    onTime: (pct: number) => `, ${pct}% brenda afatit`,
    before: (pct: number) => ` (më parë ${pct}%)`,
    open: (n: number) => `; ${n} janë ende të hapura.`,
    hiDone: (n: number) => `${n} kërkesa u përfunduan në këtë periudhë.`,
    hiBetter: (a: number, b: number) => `Përfundimi brenda afatit u përmirësua nga ${a}% në ${b}%.`,
    hiBest: (name: string, pct: number) => `${name} përfundon ${pct}% të kërkesave brenda afatit.`,
    hiAvg: (d: number) => `Një kërkesë zgjidhet mesatarisht për ${d} ditë.`,
    coLateMayor: (n: number, list: string) => `${n} kërkesa të hapura kanë kaluar afatin: ${list}.`,
    coLateUnit: (n: number, oldest: number) => `${n} kërkesa të hapura kanë kaluar afatin; më e vjetra ka ${oldest} ditë vonesë.`,
    coRising: (s: string, a: number, b: number) => `"${s}" u rrit nga ${a} në ${b} kërkesa.`,
    coLow: (pct: number) => `Vetëm ${pct}% e kërkesave u përfunduan brenda afatit.`,
    coReturned: (n: number) =>
      n === 1 ? '1 kërkesë u kthye si jo e kompetencës dhe pret ridërgim.' : `${n} kërkesa u kthyen si jo të kompetencës dhe presin ridërgim.`,
    reLate: (list: string) => `Trajtoni me përparësi kërkesat me vonesë, duke nisur nga ${list}.`,
    reMeet: (name: string) => `Takim ndjekës me ${name} për planin e mbylljes së vonesave.`,
    reRising: (s: string) => `Planifikoni kapacitet shtesë për "${s}", pasi kërkesat po rriten.`,
    reReturned: 'Rishikoni me operatorin se cila drejtori trajton cilat lëndë, për të shmangur kthimet.',
    reNone: 'Vazhdoni me ritmin aktual; nuk ka vonesa që kërkojnë ndërhyrje.',
    hiNone: 'Nuk ka ende kërkesa të përfunduara në këtë periudhë.',
    coNone: 'Asnjë shqetësim i madh në këtë periudhë.',
  },
  en: {
    same: ' The number is the same as in the previous period.',
    trend: (prev: number, up: boolean, pct: number) =>
      ` Compared with the previous period (${prev}), requests ${up ? 'rose' : 'fell'} by ${pct}%.`,
    headNone: (who: string, late: number) =>
      `${who}: no new requests in this period${late ? `; ${late} open requests are past their deadline` : ''}`,
    headLate: (who: string, total: number, late: number, worst?: string) =>
      `${who}: ${total} new requests; ${late} open requests are past their deadline${worst ? `, most at ${worst}` : ''}`,
    headOk: (who: string, total: number) => `${who}: ${total} new requests and none past their deadline`,
    summary: (period: string, total: number) => `${total} requests were registered in the period ${period}.`,
    done: (n: number) => `${n} were completed`,
    onTime: (pct: number) => `, ${pct}% on time`,
    before: (pct: number) => ` (previously ${pct}%)`,
    open: (n: number) => `; ${n} are still open.`,
    hiDone: (n: number) => `${n} requests were completed in this period.`,
    hiBetter: (a: number, b: number) => `On-time completion improved from ${a}% to ${b}%.`,
    hiBest: (name: string, pct: number) => `${name} completes ${pct}% of its requests on time.`,
    hiAvg: (d: number) => `A request is resolved in ${d} days on average.`,
    coLateMayor: (n: number, list: string) => `${n} open requests are past their deadline: ${list}.`,
    coLateUnit: (n: number, oldest: number) => `${n} open requests are past their deadline; the oldest is ${oldest} days late.`,
    coRising: (s: string, a: number, b: number) => `"${s}" rose from ${a} to ${b} requests.`,
    coLow: (pct: number) => `Only ${pct}% of requests were completed on time.`,
    coReturned: (n: number) =>
      n === 1 ? '1 request was returned as not within the department’s remit and awaits resending.' : `${n} requests were returned as not within the department’s remit and await resending.`,
    reLate: (list: string) => `Prioritise the overdue requests, starting with ${list}.`,
    reMeet: (name: string) => `Hold a follow-up meeting with ${name} on a plan to clear the delays.`,
    reRising: (s: string) => `Plan extra capacity for "${s}", as these requests are rising.`,
    reReturned: 'Review with the operator which department handles which subjects, to avoid returns.',
    reNone: 'Keep the current pace; there are no delays that need intervention.',
    hiNone: 'No requests have been completed yet in this period.',
    coNone: 'No major concerns in this period.',
  },
};

/**
 * Writes the report from rules when no language model is available.
 * Same facts, same structure as the AI version, so the page looks the same either way.
 */
export function autoNarrative(f: ReportFacts, lang: Lang = 'sq'): Narrative {
  const w = WORDS[lang];
  const m = f.metrics;
  const who = f.scope.name;
  const mayor = f.scope.unitId === null;
  const worst: Unit | undefined = f.byUnit.filter((u) => u.overdue > 0).sort((a, b) => b.overdue - a.overdue)[0];
  const best = f.byUnit
    .filter((u) => u.onTimeRate !== null && u.done >= 2)
    .sort((a, b) => b.onTimeRate! - a.onTimeRate!)[0];
  const rising = f.topSubjects
    .filter((s) => s.total >= 3 && s.total >= s.previous * 1.5)
    .sort((a, b) => b.total - b.previous - (a.total - a.previous))[0];

  const trend =
    m.changePercent === null ? '' : m.changePercent === 0 ? w.same : w.trend(m.previousTotal, m.changePercent > 0, Math.abs(m.changePercent));

  const headline =
    m.total === 0
      ? w.headNone(who, m.overdue)
      : m.overdue > 0
        ? w.headLate(who, m.total, m.overdue, mayor ? worst?.name : undefined)
        : w.headOk(who, m.total);

  const summary =
    `${w.summary(periodText(f.period), m.total)}${trend} ` +
    w.done(m.done) +
    (m.onTimeRate !== null ? w.onTime(m.onTimeRate) : '') +
    (m.previousOnTimeRate !== null && m.onTimeRate !== null ? w.before(m.previousOnTimeRate) : '') +
    w.open(m.new + m.inProgress);

  const highlights: string[] = [];
  if (m.done > 0) highlights.push(w.hiDone(m.done));
  if (m.onTimeRate !== null && m.previousOnTimeRate !== null && m.onTimeRate > m.previousOnTimeRate) {
    highlights.push(w.hiBetter(m.previousOnTimeRate, m.onTimeRate));
  }
  if (mayor && best) highlights.push(w.hiBest(best.name, best.onTimeRate!));
  if (m.avgDaysToComplete !== null) highlights.push(w.hiAvg(m.avgDaysToComplete));

  const concerns: string[] = [];
  if (m.overdue > 0) {
    concerns.push(
      mayor
        ? w.coLateMayor(
            m.overdue,
            f.byUnit
              .filter((u) => u.overdue > 0)
              .map((u) => `${u.name} ${u.overdue}`)
              .join(', '),
          )
        : w.coLateUnit(m.overdue, f.overdueItems[0]?.daysLate ?? 0),
    );
  }
  if (rising) concerns.push(w.coRising(rising.subject, rising.previous, rising.total));
  if (m.onTimeRate !== null && m.onTimeRate < 70) concerns.push(w.coLow(m.onTimeRate));
  if (m.returned > 0) concerns.push(w.coReturned(m.returned));

  const recommendations: string[] = [];
  if (f.overdueItems.length) {
    recommendations.push(
      w.reLate(
        f.overdueItems
          .slice(0, 3)
          .map((i) => i.protocolNo)
          .join(', '),
      ),
    );
  }
  if (mayor && worst) recommendations.push(w.reMeet(worst.name));
  if (rising) recommendations.push(w.reRising(rising.subject));
  if (m.returned > 0) recommendations.push(w.reReturned);
  if (!recommendations.length) recommendations.push(w.reNone);

  if (!highlights.length) highlights.push(w.hiNone);
  if (!concerns.length) concerns.push(w.coNone);
  return { headline, summary, highlights, concerns, recommendations };
}
