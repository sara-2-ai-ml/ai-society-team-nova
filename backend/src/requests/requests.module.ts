import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { ExcelService } from './excel.service';
import { AiStatusController } from '../analytics/ai-status.controller';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { UnitSuggestService } from './unit-suggest.service';

@Module({
  imports: [UnitsModule],
  controllers: [RequestsController, AiStatusController],
  providers: [RequestsService, ExcelService, UnitSuggestService],
  exports: [RequestsService],
})
export class RequestsModule {}
