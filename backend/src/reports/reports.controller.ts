import { Controller, Get, Headers, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { Role } from '../auth/role.enum';
import { langOf } from '../common/lang';
import { RequestFilterDto } from '../requests/dto/request.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Report for a period (default: the last 7 days). `refresh=true` writes it again. */
  @Roles(Role.Drejtoria, Role.Kryetari)
  @Get()
  report(
    @CurrentUser() user: JwtPayload,
    @Query() { from, to, unitId }: RequestFilterDto,
    @Query('refresh') refresh?: string,
    @Headers('accept-language') lang?: string,
  ) {
    return this.reports.report(user, { from, to, unitId, refresh: refresh === 'true', lang: langOf(lang) });
  }
}
