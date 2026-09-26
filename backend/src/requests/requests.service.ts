import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PythonApiService, UNIT_BY_DIRECTORATE, type DatasetRequest } from '../analytics/python-api.service';
import { addDays, daysBetween, isValidDay, today, weekStart } from '../common/dates';
import { normalize } from '../common/text';
import type { JwtPayload } from '../auth/jwt-payload';
import { Role } from '../auth/role.enum';
import { UnitsService } from '../units/units.service';
import { CreateRequestDto, RequestActionDto, RequestFilterDto } from './dto/request.dto';
import type { ParsedRow } from './excel.service';
import { OPEN_STATUSES, RequestRecord, RequestView } from './request.entity';
import { fromDataset } from './dataset-mapper';
import { generateMockRequests } from './requests.mock';

export interface NewRequest {
  protocolNo: string;
  date: string;
  subject: string;
  unitId: string;
}

@Injectable()
export class RequestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RequestsService.name);
  // In-memory register: the Bashkia 360 dataset (via the Python service) plus mock data for the
  // units the dataset doesn't cover. Swapped for a database later.
  private records: RequestRecord[];
  private source: 'dataset' | 'mock' = 'mock';
  /** Changes made in the app since the data was loaded. */
  private revision = 0;
  /** Goes up each time the data is (re)loaded. */
  private generation = 0;
  private retry?: NodeJS.Timeout;

  constructor(
    private readonly units: UnitsService,
    private readonly python: PythonApiService,
  ) {
    this.records = generateMockRequests(units.findAll(), today());
  }

  /** Changes whenever the data changes, so derived results (e.g. generated reports) know when they are stale. */
  get dataRevision(): number {
    return this.generation * 1_000_000 + this.revision;
  }

  get dataSource(): 'dataset' | 'mock' {
    return this.source;
  }

  async onModuleInit() {
    if (await this.loadDataset()) return;
    this.logger.warn('Python data service not reachable: showing mock data, retrying every 10 s.');
    this.retry = setInterval(() => {
      // Only swap in the real data while nobody has changed the mock register yet.
      if (this.revision > 0) return this.stopRetry();
      void this.loadDataset().then((ok) => ok && this.stopRetry());
    }, 10_000);
    this.retry.unref();
  }

  onModuleDestroy() {
    this.stopRetry();
  }

  private stopRetry() {
    if (this.retry) clearInterval(this.retry);
    this.retry = undefined;
  }

  /** Real DSHP/DI requests from the Python service, plus mock requests for the other units. */
  private async loadDataset(): Promise<boolean> {
    let rows: DatasetRequest[];
    try {
      rows = await this.python.getRequests();
    } catch {
      return false;
    }
    if (this.revision > 0) return false;

    const real = rows.map((row, i) => fromDataset(row, i + 1)).filter((r): r is RequestRecord => r !== null);
    const covered = new Set(Object.values(UNIT_BY_DIRECTORATE));
    const lastNumber = real.reduce((max, r) => Math.max(max, Number(r.protocolNo.split('-').pop()) || 0), 0);
    const others = this.units.findAll().filter((u) => !covered.has(u.id));
    const extras = generateMockRequests(others, today(), lastNumber + 1, real.length + 1);

    this.records = [...real, ...extras];
    this.source = 'dataset';
    this.generation++;
    this.logger.log(`Loaded ${real.length} requests from Bashkia_360_Data.xlsx, plus ${extras.length} mock requests for ${others.length} other units.`);
    return true;
  }

  /** A DREJTORIA user only ever sees their own unit; others may narrow to one. */
  scopeUnit(viewer: JwtPayload, unitId?: string): string | undefined {
    return viewer.role === Role.Drejtoria ? (viewer.unitId ?? '__none__') : unitId || undefined;
  }

  list(viewer: JwtPayload, filter: RequestFilterDto): RequestView[] {
    const unitId = this.scopeUnit(viewer, filter.unitId);
    const q = normalize(filter.q);
    return this.inPeriod(filter.from, filter.to)
      .filter((r) => !unitId || r.unitId === unitId)
      .filter((r) => !q || normalize(`${r.protocolNo} ${r.subject}`).includes(q))
      .map((r) => this.view(r))
      .filter((r) => {
        if (!filter.status) return true;
        if (filter.status === 'open') return OPEN_STATUSES.includes(r.status);
        if (filter.status === 'overdue') return r.overdue;
        return r.status === filter.status;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.protocolNo.localeCompare(a.protocolNo));
  }

  get(viewer: JwtPayload, id: number): RequestView {
    const record = this.records.find((r) => r.id === id);
    const unitId = this.scopeUnit(viewer);
    if (!record || (unitId && record.unitId !== unitId)) throw new NotFoundException('Kërkesa nuk u gjet');
    return this.view(record);
  }

  /** The most frequent subjects each unit receives, as examples for routing new requests. */
  usualSubjects(perUnit = 6): Map<string, { subject: string; count: number }[]> {
    const counts = new Map<string, Map<string, number>>();
    for (const r of this.records) {
      const unit = counts.get(r.unitId) ?? new Map<string, number>();
      unit.set(r.subject, (unit.get(r.subject) ?? 0) + 1);
      counts.set(r.unitId, unit);
    }
    return new Map(
      [...counts].map(([unitId, subjects]) => [
        unitId,
        [...subjects]
          .map(([subject, count]) => ({ subject, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, perUnit),
      ]),
    );
  }

  /** Suggests the next protocol number, e.g. K-2026-0488. */
  nextProtocolNo(): string {
    const year = today().slice(0, 4);
    const prefix = `K-${year}-`;
    const last = this.records
      .filter((r) => r.protocolNo.startsWith(prefix))
      .map((r) => Number(r.protocolNo.slice(prefix.length)))
      .filter(Number.isFinite)
      .reduce((max, n) => Math.max(max, n), 0);
    return `${prefix}${String(last + 1).padStart(4, '0')}`;
  }

  /** Problems with a new request, in the operator's words; empty when it can be registered. */
  validate(input: NewRequest, taken = new Set<string>()): string[] {
    const errors: string[] = [];
    const protocolNo = input.protocolNo?.trim();
    if (!protocolNo) errors.push('Mungon numri i protokollit');
    else if (taken.has(normalize(protocolNo)) || this.findByProtocol(protocolNo))
      errors.push(`Numri ${protocolNo} është regjistruar më parë`);
    if (!input.date || !isValidDay(input.date)) errors.push('Data mungon ose nuk lexohet');
    else if (input.date > today()) errors.push('Data nuk mund të jetë në të ardhmen');
    if (!input.subject?.trim()) errors.push('Mungon lënda');
    if (!this.units.findById(input.unitId)) errors.push('Drejtoria/agjencia nuk njihet');
    return errors;
  }

  create(viewer: JwtPayload, dto: CreateRequestDto, source: RequestRecord['source'] = 'form'): RequestView {
    const errors = this.validate(dto);
    if (errors.length) {
      const duplicate = errors.some((e) => e.includes('regjistruar më parë'));
      throw duplicate ? new ConflictException(errors.join('. ')) : new BadRequestException(errors.join('. '));
    }
    const unit = this.units.findById(dto.unitId)!;
    const record: RequestRecord = {
      id: this.records.reduce((max, r) => Math.max(max, r.id), 0) + 1,
      protocolNo: dto.protocolNo.trim(),
      date: dto.date,
      subject: dto.subject.trim(),
      unitId: unit.id,
      status: 'new',
      deadline: addDays(dto.date, unit.slaDays),
      completedAt: null,
      source,
      createdBy: viewer.username,
      history: [{ at: new Date().toISOString(), by: viewer.username, action: 'sent', unitId: unit.id }],
    };
    this.records.push(record);
    this.revision++;
    return this.view(record);
  }

  /**
   * Registers the valid rows of an Excel register and reports the others by row number.
   * With dryRun nothing is saved, so the operator can check the file first.
   */
  importRows(viewer: JwtPayload, rows: ParsedRow[], dryRun: boolean) {
    const taken = new Set<string>();
    const accepted: (NewRequest & { row: number })[] = [];
    const rejected: { row: number; protocolNo: string; errors: string[] }[] = [];

    for (const { row, values, unitText } of rows) {
      const errors = this.validate(values, taken).map((e) =>
        e.startsWith('Drejtoria') && unitText ? `Drejtoria/agjencia "${unitText}" nuk njihet` : e,
      );
      if (errors.length) rejected.push({ row, protocolNo: values.protocolNo, errors });
      else {
        taken.add(normalize(values.protocolNo));
        accepted.push({ row, ...values });
      }
    }

    if (!dryRun) {
      for (const { row, ...values } of accepted) this.create(viewer, values, 'excel');
    }
    return { dryRun, accepted, rejected };
  }

  /** Moves a request through the workflow; who may do what is checked here. */
  act(viewer: JwtPayload, id: number, { action, note, unitId }: RequestActionDto): RequestView {
    const record = this.records.find((r) => r.id === id);
    if (!record) throw new NotFoundException('Kërkesa nuk u gjet');
    const at = new Date().toISOString();
    const by = viewer.username;

    if (action === 'resend') {
      if (viewer.role !== Role.Operator) throw new ForbiddenException('Vetëm operatori e ridërgon një kërkesë');
      if (record.status !== 'returned') throw new BadRequestException('Ridërgohen vetëm kërkesat e kthyera');
      const unit = this.units.findById(unitId ?? '');
      if (!unit) throw new BadRequestException('Zgjidhni drejtorinë/agjencinë ku do dërgohet');
      Object.assign(record, { unitId: unit.id, status: 'new', deadline: addDays(today(), unit.slaDays) });
      record.history.push({ at, by, action: 'resent', unitId: unit.id, note });
      this.revision++;
      return this.view(record);
    }

    if (viewer.role !== Role.Drejtoria || viewer.unitId !== record.unitId) {
      throw new ForbiddenException('Vetëm drejtoria/agjencia që e ka marrë mund ta ndryshojë');
    }
    const open = OPEN_STATUSES.includes(record.status);
    if (action === 'start') {
      if (record.status !== 'new') throw new BadRequestException('Kërkesa është nisur tashmë');
      record.status = 'in_progress';
      record.history.push({ at, by, action: 'started', note });
    } else if (action === 'complete') {
      if (!open) throw new BadRequestException('Kërkesa nuk është e hapur');
      record.status = 'done';
      record.completedAt = today();
      record.history.push({ at, by, action: 'completed', note });
    } else {
      if (!open) throw new BadRequestException('Kërkesa nuk është e hapur');
      if (!note?.trim()) throw new BadRequestException('Shkruani pse po e ktheni kërkesën');
      record.status = 'returned';
      record.history.push({ at, by, action: 'returned', note: note.trim() });
    }
    this.revision++;
    return this.view(record);
  }

  stats(viewer: JwtPayload, filter: Pick<RequestFilterDto, 'from' | 'to' | 'unitId'>) {
    const unitId = this.scopeUnit(viewer, filter.unitId);
    const items = this.inPeriod(filter.from, filter.to)
      .filter((r) => !unitId || r.unitId === unitId)
      .map((r) => this.view(r));
    const done = items.filter((r) => r.status === 'done');
    const onTime = done.filter((r) => r.completedAt! <= r.deadline);

    const count = (list: RequestView[]) => ({
      total: list.length,
      new: list.filter((r) => r.status === 'new').length,
      inProgress: list.filter((r) => r.status === 'in_progress').length,
      done: list.filter((r) => r.status === 'done').length,
      returned: list.filter((r) => r.status === 'returned').length,
      overdue: list.filter((r) => r.overdue).length,
    });

    const byUnit = this.units
      .findAll()
      .filter((u) => !unitId || u.id === unitId)
      .map((unit) => {
        const mine = items.filter((r) => r.unitId === unit.id);
        const mineDone = mine.filter((r) => r.status === 'done');
        return {
          unitId: unit.id,
          ...count(mine),
          onTimeRate: rate(mineDone.filter((r) => r.completedAt! <= r.deadline).length, mineDone.length),
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);

    const subjects = new Map<string, number>();
    for (const r of items) subjects.set(r.subject, (subjects.get(r.subject) ?? 0) + 1);

    return {
      period: { from: filter.from ?? null, to: filter.to ?? null },
      unitId: unitId ?? null,
      ...count(items),
      onTimeRate: rate(onTime.length, done.length),
      avgDaysToComplete: done.length
        ? Math.round((done.reduce((s, r) => s + daysBetween(r.date, r.completedAt!), 0) / done.length) * 10) / 10
        : null,
      byUnit,
      byWeek: this.byWeek(items, filter.from, filter.to),
      topSubjects: [...subjects.entries()]
        .map(([subject, total]) => ({ subject, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    };
  }

  private byWeek(items: RequestView[], from?: string, to?: string) {
    const end = weekStart(to ?? today());
    const earliest = items.reduce((min, r) => (r.date < min ? r.date : min), end);
    // At most 12 bars, so the chart stays readable.
    let start = weekStart(from ?? earliest);
    if (daysBetween(start, end) > 7 * 11) start = addDays(end, -7 * 11);

    const weeks: { week: string; total: number; done: number }[] = [];
    for (let w = start; w <= end; w = addDays(w, 7)) {
      const inWeek = items.filter((r) => weekStart(r.date) === w);
      weeks.push({ week: w, total: inWeek.length, done: inWeek.filter((r) => r.status === 'done').length });
    }
    return weeks;
  }

  private inPeriod(from?: string, to?: string): RequestRecord[] {
    return this.records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  }

  private findByProtocol(protocolNo: string): RequestRecord | undefined {
    const key = normalize(protocolNo);
    return this.records.find((r) => normalize(r.protocolNo) === key);
  }

  private view(record: RequestRecord): RequestView {
    const open = OPEN_STATUSES.includes(record.status);
    const daysLeft = open ? daysBetween(today(), record.deadline) : null;
    return { ...record, overdue: daysLeft !== null && daysLeft < 0, daysLeft };
  }
}

function rate(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 100) : null;
}
