import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { langOf, translateMessage } from './lang';

/** Sends error messages in the client's language (Accept-Language), keeping Nest's usual error shape. */
@Catch(HttpException)
export class LocalizedExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const lang = langOf(ctx.getRequest<Request>().headers['accept-language']);
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body: Record<string, unknown> = typeof raw === 'string' ? { statusCode: status, message: raw } : { ...(raw as object) };

    const message = body.message;
    if (typeof message === 'string') body.message = translateMessage(message, lang);
    else if (Array.isArray(message)) body.message = message.map((m) => (typeof m === 'string' ? translateMessage(m, lang) : m));

    ctx.getResponse<Response>().status(status).json(body);
  }
}
