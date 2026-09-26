import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// A stand-in for the Python service: two dataset rows, an AI with a key, and a log of what it was asked.
const asked: { question: string; session_id: string; directorate: string | null }[] = [];
const ROWS = [
  {
    id: 'K-2026-0001', date: '2026-09-01', channel: 'Telefon', area: 'Lagjja nr. 3', place: 'Tregu', category: 'Mbetje të pagrumbulluara',
    description: 'Kazanët janë plot.', registered_by: 'operator.telefon', directorate: 'DSHP', assigned: true, assigned_at: '2026-09-01',
    deadline: '2026-09-03', status: 'E zgjidhur', resolved_at: '2026-09-02', note: 'U pastrua.',
  },
  {
    id: 'K-2026-0002', date: '2026-09-05', channel: 'Email', area: 'Papër', place: 'Rruga kryesore', category: 'Gropa / rrugë e dëmtuar',
    description: 'Gropë e madhe.', registered_by: 'operator.sporteli', directorate: 'DI', assigned: false, assigned_at: null,
    deadline: '2026-09-19', status: 'E re', resolved_at: null, note: null,
  },
];

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data ? JSON.parse(data) : null));
  });
}

describe('With the Python service (e2e)', () => {
  let python: Server;
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (u: string) => ({ Authorization: `Bearer ${tokens[u]}` });

  beforeAll(async () => {
    python = createServer(async (req, res) => {
      const body = await readJson(req);
      const send = (status: number, json: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      if (req.url === '/api/requests') return send(200, ROWS);
      if (req.url === '/api/ai/status') return send(200, { provider: 'openai', configured: true, model: 'gpt-test' });
      if (req.url === '/api/ask') {
        asked.push(body);
        return send(200, { session_id: body.session_id, answer: `AI answer (${body.directorate ?? 'all'})`, tools_used: [{ tool: 'get_kpis', input: {} }] });
      }
      if (req.url === '/api/suggest-unit') {
        asked.push({ question: body.subject, session_id: 'suggest', directorate: null });
        const known = body.units.map((u: { id: string }) => u.id);
        return send(200, { unit_id: known.includes('sociale') ? 'sociale' : null, reason: 'Ndihma ekonomike mbulohet nga Shërbimet Sociale.', model: 'gpt-test' });
      }
      if (req.url === '/api/report-narrative') {
        return send(200, { headline: 'AI headline', summary: 'AI summary', highlights: ['h'], concerns: ['c'], recommendations: ['r'], model: 'gpt-test' });
      }
      send(404, { detail: 'not found' });
    });
    await new Promise<void>((resolve) => python.listen(0, '127.0.0.1', resolve));
    process.env.PYTHON_API_URL = `http://127.0.0.1:${(python.address() as AddressInfo).port}/api`;
    process.env.JWT_SECRET = 'test-secret';
    process.env.SEED_PASSWORD = 'test-password';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    for (const username of ['operator', 'kryetari', 'drejtoria.publike', 'drejtoria.sociale']) {
      const res = await http().post('/api/auth/login').send({ username, password: 'test-password' });
      tokens[username] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => python.close(resolve));
  });

  it('loads the dataset rows into the register, with mock data only for the other units', async () => {
    const all = await http().get('/api/requests').set(as('kryetari')).expect(200);
    const real = all.body.filter((r: { source: string }) => r.source === 'dataset');
    expect(real.map((r: { protocolNo: string }) => r.protocolNo).sort()).toEqual(['K-2026-0001', 'K-2026-0002']);
    expect(real.find((r: { protocolNo: string }) => r.protocolNo === 'K-2026-0001')).toMatchObject({
      unitId: 'publike', status: 'done', completedAt: '2026-09-02', area: 'Lagjja nr. 3', description: 'Kazanët janë plot.',
    });
    expect(real.find((r: { protocolNo: string }) => r.protocolNo === 'K-2026-0002')).toMatchObject({ unitId: 'infrastruktura', status: 'new' });

    const mockUnits = new Set(all.body.filter((r: { source: string }) => r.source === 'mock').map((r: { unitId: string }) => r.unitId));
    expect(mockUnits.has('publike') || mockUnits.has('infrastruktura')).toBe(false);
    expect(mockUnits.has('sociale')).toBe(true);

    // Mock protocol numbers continue after the dataset's, so they never clash.
    const next = await http().get('/api/requests/next-number').set(as('operator')).expect(200);
    expect(next.body.protocolNo > 'K-2026-0002').toBe(true);
  });

  it('reports the AI status and the data source', async () => {
    const res = await http().get('/api/ai/status').set(as('kryetari')).expect(200);
    expect(res.body).toEqual({ provider: 'openai', pythonReachable: true, configured: true, model: 'gpt-test', dataSource: 'dataset' });
  });

  it('sends a directorate user to the AI with only their directorate', async () => {
    asked.length = 0;
    const res = await http().post('/api/assistant/ask').set(as('drejtoria.publike')).send({ question: 'Sa kërkesa kemi?' }).expect(200);
    expect(res.body).toMatchObject({ answer: 'AI answer (DSHP)', source: 'ai', tools: ['get_kpis'] });
    expect(asked).toEqual([{ question: 'Sa kërkesa kemi?', session_id: 'nova-drejtoria.publike', directorate: 'DSHP', language: 'sq' }]);
  });

  it('answers offline for units the dataset does not cover, without calling the AI', async () => {
    asked.length = 0;
    const res = await http().post('/api/assistant/ask').set(as('drejtoria.sociale')).send({ question: 'Sa kërkesa kemi?' }).expect(200);
    expect(res.body.source).toBe('offline');
    expect(asked).toHaveLength(0);
  });

  it('gives the mayor the AI over all directorates', async () => {
    asked.length = 0;
    const res = await http().post('/api/assistant/ask').set(as('kryetari')).send({ question: 'Kush ka vonesa?' }).expect(200);
    expect(res.body.answer).toBe('AI answer (all)');
    expect(asked[0].directorate).toBeNull();
  });

  it('passes the AI unit suggestion to the operator', async () => {
    const res = await http()
      .post('/api/requests/suggest-unit')
      .set(as('operator'))
      .send({ subject: 'Kërkesë për ndihmë ekonomike' })
      .expect(200);
    expect(res.body).toEqual({ unitId: 'sociale', reason: 'Ndihma ekonomike mbulohet nga Shërbimet Sociale.', source: 'ai' });
  });

  it('has the report written by the AI', async () => {
    const res = await http().get('/api/reports').set(as('kryetari')).expect(200);
    expect(res.body).toMatchObject({ generatedBy: 'ai', model: 'gpt-test' });
    expect(res.body.narrative.headline).toBe('AI headline');
  });
});
