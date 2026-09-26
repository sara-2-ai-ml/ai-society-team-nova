import { Controller, Get } from '@nestjs/common';
import { RequestsService } from '../requests/requests.service';
import { PythonApiService } from './python-api.service';

@Controller('ai')
export class AiStatusController {
  constructor(
    private readonly python: PythonApiService,
    private readonly requests: RequestsService,
  ) {}

  /** Whether the AI can answer (Python running + OPENAI_API_KEY set) and where the data comes from. */
  @Get('status')
  async status() {
    const ai = await this.python.aiStatus().catch(() => null);
    return {
      provider: 'openai' as const,
      pythonReachable: ai !== null,
      configured: ai?.configured ?? false,
      model: ai?.model ?? null,
      dataSource: this.requests.dataSource,
    };
  }
}
