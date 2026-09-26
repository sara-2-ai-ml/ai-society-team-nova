import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { langOf } from '../common/lang';
import { AssistantService } from './assistant.service';

class AskDto {
  @IsString()
  @MaxLength(500)
  question: string;
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('suggestions')
  suggestions(@CurrentUser() user: JwtPayload, @Headers('accept-language') lang?: string) {
    return this.assistant.suggestions(user, langOf(lang));
  }

  @Post('ask')
  @HttpCode(200)
  ask(@CurrentUser() user: JwtPayload, @Body() dto: AskDto, @Headers('accept-language') lang?: string) {
    return this.assistant.ask(user, dto.question, langOf(lang));
  }
}
