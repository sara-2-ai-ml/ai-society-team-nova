import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { UnitsModule } from '../units/units.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [RequestsModule, UnitsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
