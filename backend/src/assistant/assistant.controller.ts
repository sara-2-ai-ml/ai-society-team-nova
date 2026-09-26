import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { langOf } from '../common/lang';
import { AssistantService } from './assistant.service';

class AskDto {
  @IsString()
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;
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
    return this.assistant.ask(user, dto.question, langOf(lang), dto.conversationId);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: JwtPayload) {
    return this.assistant.conversations(user);
  }

  @Get('conversations/:id')
  conversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.assistant.conversation(user, id);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  deleteConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.assistant.deleteConversation(user, id);
  }
}
