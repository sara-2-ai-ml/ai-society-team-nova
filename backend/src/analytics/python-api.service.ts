import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Lang } from '../common/lang';

/** Bashkia 360 directorate codes in the dataset ↔ unit ids in this app. */
export const UNIT_BY_DIRECTORATE: Record<string, string> = { DSHP: 'publike', DI: 'infrastruktura' };
export const DIRECTORATE_BY_UNIT: Record<string, string> = { publike: 'DSHP', infrastruktura: 'DI' };

/** One request as the Python service exports it from Bashkia_360_Data.xlsx. */
export interface DatasetRequest {
  id: string;
  date: string;
  channel: string | null;
  area: string | null;
  place: string | null;
  category: string | null;
  description: string | null;
  registered_by: string | null;
  directorate: string;
  assigned: boolean;
  assigned_at: string | null;
  deadline: string;
  status: string;
  resolved_at: string | null;
  note: string | null;
}

export interface AiStatus {
  provider: 'openai';
  configured: boolean;
  model: string;
}

export interface AgentReply {
  answer: string;
  tools_used: { tool: string; input: Record<string, unknown> }[];
}

export class PythonApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

/**
 * Talks to the Python service (real data + OpenAI agent). NestJS stays the only door for the
 * website: it signs users in and applies their role before anything reaches Python.
 */
@Injectable()
export class PythonApiService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('PYTHON_API_URL') ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');
  }

  getRequests(): Promise<DatasetRequest[]> {
    return this.call('/requests', { timeoutMs: 15_000 });
  }

  aiStatus(): Promise<AiStatus> {
    return this.call('/ai/status', { timeoutMs: 3_000 });
  }

  /** Grounded agent answer. `directorate` limits it to one directorate's data. */
  ask(question: string, sessionId: string, lang: Lang, directorate?: string): Promise<AgentReply> {
    return this.call('/ask', {
      body: { question, session_id: sessionId, directorate: directorate ?? null, language: lang },
      timeoutMs: 120_000,
    });
  }

  /** Which unit a subject belongs to; `units` carries each unit's usual subjects as examples. */
  suggestUnit(subject: string, units: unknown[], lang: Lang): Promise<{ unit_id: string | null; reason: string; model: string }> {
    return this.call('/suggest-unit', { body: { subject, units, language: lang }, timeoutMs: 20_000 });
  }

  reportNarrative<T>(facts: unknown, lang: Lang): Promise<T & { model: string }> {
    return this.call('/report-narrative', { body: { facts, language: lang }, timeoutMs: 120_000 });
  }

  private async call<T>(path: string, { body, timeoutMs }: { body?: unknown; timeoutMs: number }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new PythonApiError(`Python service unreachable at ${this.baseUrl}: ${(error as Error).message}`, null);
    }
    if (!res.ok) {
      const detail = await res.json().then((b: { detail?: unknown }) => b.detail, () => undefined);
      throw new PythonApiError(`Python ${path} failed (${res.status}): ${typeof detail === 'string' ? detail : res.statusText}`, res.status);
    }
    return res.json() as Promise<T>;
  }

}
