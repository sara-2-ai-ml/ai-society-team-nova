import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AnalyticsModule } from './analytics/analytics.module';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { LocalizedExceptionFilter } from './common/localized-exception.filter';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AnalyticsModule,
    UsersModule,
    AuthModule,
    UnitsModule,
    RequestsModule,
    AssistantModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: LocalizedExceptionFilter }],
})
export class AppModule {}
