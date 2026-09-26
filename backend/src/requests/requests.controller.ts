import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { Role } from '../auth/role.enum';
import { langOf, translateMessage } from '../common/lang';
import { CreateRequestDto, RequestActionDto, RequestFilterDto, SuggestUnitDto } from './dto/request.dto';
import { ExcelService } from './excel.service';
import { RequestsService } from './requests.service';
import { UnitSuggestService } from './unit-suggest.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly excel: ExcelService,
    private readonly suggester: UnitSuggestService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() filter: RequestFilterDto) {
    return this.requests.list(user, filter);
  }

  @Get('stats')
  stats(@CurrentUser() user: JwtPayload, @Query() filter: RequestFilterDto) {
    return this.requests.stats(user, filter);
  }

  @Roles(Role.Operator)
  @Get('next-number')
  nextNumber() {
    return { protocolNo: this.requests.nextProtocolNo() };
  }

  // Public: an empty template holds no data, and a plain link is easiest to download.
  @Public()
  @Get('template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="regjistri-kerkesave.xlsx"')
  async template(@Query('lang') lang?: string) {
    return new StreamableFile(await this.excel.template(langOf(lang)));
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.requests.get(user, id);
  }

  @Roles(Role.Operator)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRequestDto) {
    return this.requests.create(user, dto);
  }

  /** Which drejtori/agjenci a subject belongs to (AI, or similar past requests). Only a suggestion. */
  @Roles(Role.Operator)
  @Post('suggest-unit')
  @HttpCode(200)
  suggestUnit(@Body() dto: SuggestUnitDto, @Headers('accept-language') lang?: string) {
    return this.suggester.suggest(dto.subject, langOf(lang));
  }

  /** Upload an Excel register. `?dryRun=true` only checks it. */
  @Roles(Role.Operator)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async import(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    if (!file) throw new BadRequestException('Zgjidhni një skedar Excel (.xlsx)');
    const rows = await this.excel.parse(file.buffer);
    if (!rows.length) throw new BadRequestException('Skedari nuk ka asnjë rresht me kërkesa');
    const result = this.requests.importRows(user, rows, dryRun === 'true');
    const lang = langOf(acceptLanguage);
    return {
      ...result,
      rejected: result.rejected.map((r) => ({ ...r, errors: r.errors.map((e) => translateMessage(e, lang)) })),
    };
  }

  @Roles(Role.Operator, Role.Drejtoria)
  @Post(':id/actions')
  act(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number, @Body() dto: RequestActionDto) {
    return this.requests.act(user, id, dto);
  }
}
