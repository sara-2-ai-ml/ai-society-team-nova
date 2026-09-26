import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { Role } from '../src/auth/role.enum';
import { today } from '../src/common/dates';

process.env.JWT_SECRET = 'test-secret';
process.env.SEED_PASSWORD = 'test-password';
// Tests run without the Python service (nothing listens on port 1): mock data, offline answers.
process.env.PYTHON_API_URL = 'http://127.0.0.1:1/api';

// Test-only routes to exercise @Roles through the real guards.
@Controller('role-test')
class RoleTestController {
  @Roles(Role.Kryetari)
  @Get('kryetari')
  kryetariOnly() {
    return { ok: true };
  }

  @Roles(Role.Drejtoria, Role.Kryetari)
  @Get('management')
  management() {
    return { ok: true };
  }
}

const OPERATOR = 'operator';
const SOCIALE = 'drejtoria.sociale';
const PUBLIKE = 'drejtoria.publike';
const KRYETARI = 'kryetari';

describe('App (e2e)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (username: string) => ({ Authorization: `Bearer ${tokens[username]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RoleTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    for (const username of [OPERATOR, SOCIALE, PUBLIKE, KRYETARI]) {
      const res = await http().post('/api/auth/login').send({ username, password: 'test-password' });
      tokens[username] = res.body.accessToken;
    }
  });

  afterAll(() => app.close());

  describe('auth', () => {
    it.each([
      [OPERATOR, 'OPERATOR', null],
      [SOCIALE, 'DREJTORIA', 'sociale'],
      [KRYETARI, 'KRYETARI', null],
    ])('logs in %s with role %s', async (username, role, unitId) => {
      const res = await http().post('/api/auth/login').send({ username, password: 'test-password' }).expect(200);
      expect(res.body.user).toMatchObject({ username, role, unitId });
      expect(res.body.user.passwordHash).toBeUndefined();
      await http().get('/api/auth/me').set(as(username)).expect(200);
    });

    it('rejects a wrong password, an invalid body and a missing token', async () => {
      await http().post('/api/auth/login').send({ username: OPERATOR, password: 'wrong' }).expect(401);
      await http().post('/api/auth/login').send({}).expect(400);
      await http().get('/api/auth/me').expect(401);
    });

    it('lists demo accounts without passwords', async () => {
      const res = await http().get('/api/auth/demo-accounts').expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(8);
      expect(JSON.stringify(res.body)).not.toContain('password');
    });
  });

  describe('role restrictions', () => {
    it.each([
      [OPERATOR, 'kryetari', 403],
      [SOCIALE, 'kryetari', 403],
      [KRYETARI, 'kryetari', 200],
      [OPERATOR, 'management', 403],
      [SOCIALE, 'management', 200],
      [KRYETARI, 'management', 200],
    ])('%s -> /role-test/%s = %i', (user, route, status) => {
      return http().get(`/api/role-test/${route}`).set(as(user)).expect(status);
    });

    it('rejects a tampered token', () => {
      return http().get('/api/role-test/management').set('Authorization', `Bearer ${tokens[OPERATOR]}x`).expect(401);
    });
  });

  describe('request workflow', () => {
    let id: number;
    const protocolNo = 'TEST-0001';

    it('lists the mock units', async () => {
      const res = await http().get('/api/units').set(as(KRYETARI)).expect(200);
      expect(res.body.map((u: { id: string }) => u.id)).toContain('sociale');
    });

    it('operator registers a request for Shërbimet Sociale', async () => {
      const next = await http().get('/api/requests/next-number').set(as(OPERATOR)).expect(200);
      expect(next.body.protocolNo).toMatch(/^K-\d{4}-\d{4}$/);

      const res = await http()
        .post('/api/requests')
        .set(as(OPERATOR))
        .send({ protocolNo, date: today(), subject: 'Kërkesë për ndihmë ekonomike', unitId: 'sociale' })
        .expect(201);
      expect(res.body).toMatchObject({ status: 'new', unitId: 'sociale', overdue: false });
      id = res.body.id;
    });

    it('refuses a duplicate protocol number, a future date and non-operators', async () => {
      const body = { protocolNo, date: today(), subject: 'X', unitId: 'sociale' };
      await http().post('/api/requests').set(as(OPERATOR)).send(body).expect(409);
      await http()
        .post('/api/requests')
        .set(as(OPERATOR))
        .send({ ...body, protocolNo: 'TEST-FUT', date: '2999-01-01' })
        .expect(400);
      await http().post('/api/requests').set(as(KRYETARI)).send({ ...body, protocolNo: 'TEST-K' }).expect(403);
    });

    it('a unit only sees its own requests', async () => {
      const own = await http().get('/api/requests').set(as(SOCIALE)).expect(200);
      expect(own.body.length).toBeGreaterThan(0);
      expect(own.body.every((r: { unitId: string }) => r.unitId === 'sociale')).toBe(true);

      // Asking for another unit does not widen the view.
      const other = await http().get('/api/requests?unitId=publike').set(as(SOCIALE)).expect(200);
      expect(other.body.every((r: { unitId: string }) => r.unitId === 'sociale')).toBe(true);

      await http().get(`/api/requests/${id}`).set(as(PUBLIKE)).expect(404);
    });

    it('the mayor sees every unit', async () => {
      const res = await http().get('/api/requests').set(as(KRYETARI)).expect(200);
      expect(new Set(res.body.map((r: { unitId: string }) => r.unitId)).size).toBeGreaterThan(3);
    });

    it('another unit cannot act on it; the right unit starts and completes it', async () => {
      await http().post(`/api/requests/${id}/actions`).set(as(PUBLIKE)).send({ action: 'start' }).expect(403);
      await http().post(`/api/requests/${id}/actions`).set(as(KRYETARI)).send({ action: 'start' }).expect(403);

      const started = await http().post(`/api/requests/${id}/actions`).set(as(SOCIALE)).send({ action: 'start' }).expect(201);
      expect(started.body.status).toBe('in_progress');

      const done = await http()
        .post(`/api/requests/${id}/actions`)
        .set(as(SOCIALE))
        .send({ action: 'complete', note: 'U miratua.' })
        .expect(201);
      expect(done.body).toMatchObject({ status: 'done', completedAt: today() });
      expect(done.body.history.map((h: { action: string }) => h.action)).toEqual(['sent', 'started', 'completed']);
    });

    it('a returned request goes back to the operator, who resends it', async () => {
      const created = await http()
        .post('/api/requests')
        .set(as(OPERATOR))
        .send({ protocolNo: 'TEST-0002', date: today(), subject: 'Pastrim rruge', unitId: 'sociale' })
        .expect(201);
      const rid = created.body.id;

      await http().post(`/api/requests/${rid}/actions`).set(as(SOCIALE)).send({ action: 'return' }).expect(400);
      const returned = await http()
        .post(`/api/requests/${rid}/actions`)
        .set(as(SOCIALE))
        .send({ action: 'return', note: 'I përket Shërbimeve Publike.' })
        .expect(201);
      expect(returned.body.status).toBe('returned');

      const resent = await http()
        .post(`/api/requests/${rid}/actions`)
        .set(as(OPERATOR))
        .send({ action: 'resend', unitId: 'publike' })
        .expect(201);
      expect(resent.body).toMatchObject({ status: 'new', unitId: 'publike' });
    });

    it('filters by period and status', async () => {
      const t = today();
      const res = await http().get(`/api/requests?from=${t}&to=${t}&status=open`).set(as(KRYETARI)).expect(200);
      expect(res.body.every((r: { date: string; status: string }) => r.date === t && ['new', 'in_progress'].includes(r.status))).toBe(true);
      await http().get('/api/requests?from=01.01.2026').set(as(KRYETARI)).expect(400);
    });
  });

  describe('unit suggestion', () => {
    const suggest = (user: string, subject: string, lang = 'sq') =>
      http().post('/api/requests/suggest-unit').set({ ...as(user), 'Accept-Language': lang }).send({ subject });

    it('suggests a unit from similar past requests when the AI is not available', async () => {
      const res = await suggest(OPERATOR, 'Gropa të mëdha në rrugë te shkolla').expect(200);
      expect(res.body).toMatchObject({ unitId: 'infrastruktura', source: 'history' });
      expect(res.body.reason).toContain('Infrastruktura');

      const en = await suggest(OPERATOR, 'Gropë në rrugë', 'en').expect(200);
      expect(en.body.reason).toContain('Infrastructure');
    });

    it('returns no unit when nothing matches, and only serves the operator', async () => {
      const res = await suggest(OPERATOR, 'qwerty zxcvb').expect(200);
      expect(res.body.unitId).toBeNull();
      await suggest(KRYETARI, 'Gropë në rrugë').expect(403);
      await suggest(OPERATOR, '').expect(400);
    });
  });

  describe('statistics', () => {
    it('the mayor gets totals for every unit', async () => {
      const res = await http().get('/api/requests/stats').set(as(KRYETARI)).expect(200);
      expect(res.body.total).toBe(res.body.byUnit.reduce((s: number, u: { total: number }) => s + u.total, 0));
      expect(res.body.byUnit).toHaveLength(6);
      expect(res.body.byWeek.length).toBeGreaterThan(0);
      expect(res.body.topSubjects.length).toBeGreaterThan(0);
    });

    it('a unit gets only its own numbers', async () => {
      const res = await http().get('/api/requests/stats?unitId=publike').set(as(SOCIALE)).expect(200);
      expect(res.body.unitId).toBe('sociale');
      expect(res.body.byUnit).toHaveLength(1);
    });
  });

  describe('excel import', () => {
    async function workbook(rows: unknown[][]): Promise<Buffer> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Regjistri');
      ws.addRow(['Nr. Protokolli', 'Data', 'Lënda', 'Drejtoria / Agjencia']);
      rows.forEach((r) => ws.addRow(r));
      return Buffer.from(await wb.xlsx.writeBuffer());
    }

    it('downloads the template without signing in', async () => {
      const res = await http().get('/api/requests/template').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('checks a file on dry run, then imports only the valid rows', async () => {
      const file = await workbook([
        ['XL-001', '01.09.2026', 'Kërkesë për bonus qiraje', 'Drejtoria e Sherbimeve Sociale'],
        ['XL-002', new Date(Date.UTC(2026, 8, 2)), 'Gropë në rrugë', 'infrastruktura'],
        ['XL-003', '', 'Pa datë', 'Parqet'],
        ['XL-004', '03.09.2026', 'Drejtori e panjohur', 'Drejtoria e Hënës'],
        ['XL-001', '03.09.2026', 'Numër i përsëritur', 'Parqet'],
        [],
      ]);

      const dry = await http()
        .post('/api/requests/import?dryRun=true')
        .set(as(OPERATOR))
        .attach('file', file, 'regjistri.xlsx')
        .expect(201);
      expect(dry.body.accepted.map((r: { protocolNo: string }) => r.protocolNo)).toEqual(['XL-001', 'XL-002']);
      expect(dry.body.accepted[1]).toMatchObject({ date: '2026-09-02', unitId: 'infrastruktura' });
      expect(dry.body.rejected.map((r: { row: number }) => r.row)).toEqual([4, 5, 6]);
      expect(dry.body.rejected[1].errors[0]).toContain('Drejtoria e Hënës');

      // Nothing saved yet.
      const before = await http().get('/api/requests?q=XL-00').set(as(KRYETARI)).expect(200);
      expect(before.body).toHaveLength(0);

      await http().post('/api/requests/import').set(as(OPERATOR)).attach('file', file, 'regjistri.xlsx').expect(201);
      const after = await http().get('/api/requests?q=XL-00').set(as(KRYETARI)).expect(200);
      expect(after.body).toHaveLength(2);

      // Uploading the same file again adds nothing.
      const again = await http().post('/api/requests/import').set(as(OPERATOR)).attach('file', file, 'regjistri.xlsx').expect(201);
      expect(again.body.accepted).toHaveLength(0);
    });

    it('refuses non-operators and files that are not a register', async () => {
      const file = await workbook([['XL-100', '01.09.2026', 'X', 'Parqet']]);
      await http().post('/api/requests/import').set(as(KRYETARI)).attach('file', file, 'r.xlsx').expect(403);
      await http()
        .post('/api/requests/import')
        .set(as(OPERATOR))
        .attach('file', Buffer.from('not excel'), 'r.xlsx')
        .expect(400);
    });
  });

  describe('assistant', () => {
    const ask = (user: string, question: string) =>
      http().post('/api/assistant/ask').set(as(user)).send({ question }).expect(200);

    it('answers totals, delays and subjects from the data', async () => {
      const stats = await http().get('/api/requests/stats').set(as(KRYETARI));
      const total = await ask(KRYETARI, 'Sa kërkesa kemi gjithsej?');
      expect(total.body.answer).toContain(String(stats.body.total));

      const late = await ask(KRYETARI, 'Cila drejtori ka më shumë kërkesa të vonuara?');
      expect(late.body.answer).toContain(String(stats.body.overdue));

      const subjects = await ask(KRYETARI, 'Cilat janë lëndët më të shpeshta?');
      expect(subjects.body.facts.length).toBeGreaterThan(0);
    });

    it('keeps a unit inside its own data', async () => {
      const res = await ask(SOCIALE, 'Si po ecën Infrastruktura?');
      expect(res.body.answer).toMatch(/^Shërbimet Sociale/);
      expect(res.body.answer).toContain('vetëm të dhënat e drejtorisë suaj');
    });

    it('offers help when it does not understand', async () => {
      const res = await ask(OPERATOR, 'përshëndetje');
      expect(res.body.answer).toContain('Nuk e kuptova');
      expect(res.body.suggestions.length).toBeGreaterThan(0);
    });
  });
  describe('reports', () => {
    it('the mayor gets a weekly report for the whole municipality by default', async () => {
      const res = await http().get('/api/reports').set(as(KRYETARI)).expect(200);
      expect(res.body.scope).toEqual({ unitId: null, name: 'Bashkia' });
      expect(res.body.period.to).toBe(today());
      expect(res.body.byUnit).toHaveLength(6);
      expect(res.body.generatedBy).toBe('auto');
      expect(res.body.narrative.headline).toEqual(expect.any(String));
      expect(res.body.narrative.recommendations.length).toBeGreaterThan(0);

      // The report's numbers match the dashboard's for the same period.
      const { from, to } = res.body.period;
      const stats = await http().get(`/api/requests/stats?from=${from}&to=${to}`).set(as(KRYETARI));
      expect(res.body.metrics.total).toBe(stats.body.total);
      expect(res.body.previousPeriod.to < from).toBe(true);
    });

    it('a unit gets only its own report, for any period', async () => {
      const res = await http()
        .get('/api/reports?from=2026-09-01&to=2026-09-20&unitId=publike')
        .set(as(SOCIALE))
        .expect(200);
      expect(res.body.scope.unitId).toBe('sociale');
      expect(res.body.byUnit).toEqual([]);
      expect(res.body.period).toEqual({ from: '2026-09-01', to: '2026-09-20' });
      expect(res.body.previousPeriod).toEqual({ from: '2026-08-12', to: '2026-08-31' });
    });

    it('refuses the operator and invalid periods', async () => {
      await http().get('/api/reports').set(as(OPERATOR)).expect(403);
      await http().get('/api/reports?from=2026-09-20&to=2026-09-01').set(as(KRYETARI)).expect(400);
      await http().get('/api/reports?from=2024-01-01&to=2026-09-01').set(as(KRYETARI)).expect(400);
    });
  });

  describe('English', () => {
    const EN = { 'Accept-Language': 'en' };

    it('sends error messages in English when asked, Albanian otherwise', async () => {
      const en = await http().post('/api/auth/login').set(EN).send({ username: OPERATOR, password: 'wrong' }).expect(401);
      expect(en.body.message).toBe('Wrong username or password');
      const sq = await http().post('/api/auth/login').send({ username: OPERATOR, password: 'wrong' }).expect(401);
      expect(sq.body.message).toBe('Përdoruesi ose fjalëkalimi është i gabuar');

      const dup = await http()
        .post('/api/requests')
        .set({ ...as(OPERATOR), ...EN })
        .send({ protocolNo: 'TEST-0001', date: today(), subject: 'X', unitId: 'sociale' })
        .expect(409);
      expect(dup.body.message).toBe('Number TEST-0001 is already registered');
    });

    it('answers the assistant in English, understanding English questions', async () => {
      const stats = await http().get('/api/requests/stats').set(as(KRYETARI));
      const res = await http()
        .post('/api/assistant/ask')
        .set({ ...as(KRYETARI), ...EN })
        .send({ question: 'Which department has the most overdue requests?' })
        .expect(200);
      expect(res.body.answer).toContain(`${stats.body.overdue} requests are past their deadline`);

      const unit = await http()
        .post('/api/assistant/ask')
        .set({ ...as(KRYETARI), ...EN })
        .send({ question: 'How is Social Services doing?' })
        .expect(200);
      expect(unit.body.answer).toMatch(/^Social Services: \d+ requests in total/);

      const suggestions = await http().get('/api/assistant/suggestions').set({ ...as(SOCIALE), ...EN }).expect(200);
      expect(suggestions.body[0]).toBe('How many requests do we have this month?');
    });

    it('writes reports in English with English unit names', async () => {
      const res = await http().get('/api/reports').set({ ...as(KRYETARI), ...EN }).expect(200);
      expect(res.body.scope.name).toBe('Municipality');
      expect(res.body.byUnit.map((u: { name: string }) => u.name)).toContain('Social Services');
      expect(res.body.narrative.summary).toContain('requests were registered in the period');
    });

    it('offers an English template and imports English headers and unit names', async () => {
      const template = await http().get('/api/requests/template?lang=en').buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(template.body);
      expect(wb.worksheets[0].getRow(1).values).toEqual([undefined, 'Protocol no.', 'Date', 'Subject', 'Department / Agency']);

      const book = new ExcelJS.Workbook();
      const ws = book.addWorksheet('Requests');
      ws.addRow(['Protocol no.', 'Date', 'Subject', 'Department / Agency']);
      ws.addRow(['EN-001', '01.09.2026', 'Broken street light', 'Infrastructure Department']);
      ws.addRow(['EN-002', '01.09.2026', 'Unknown', 'Ministry of Magic']);
      const res = await http()
        .post('/api/requests/import?dryRun=true')
        .set({ ...as(OPERATOR), ...EN })
        .attach('file', Buffer.from(await book.xlsx.writeBuffer()), 'en.xlsx')
        .expect(201);
      expect(res.body.accepted[0]).toMatchObject({ protocolNo: 'EN-001', unitId: 'infrastruktura' });
      expect(res.body.rejected[0].errors).toEqual(['Unknown department/agency "Ministry of Magic"']);
    });
  });
});
