import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { RequestStatus } from '../request.entity';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  protocolNo: string;

  @Matches(DAY, { message: 'date duhet të jetë YYYY-MM-DD' })
  date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject: string;

  @IsString()
  @IsNotEmpty()
  unitId: string;
}

export class SuggestUnitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject: string;
}

export class RequestFilterDto {
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @IsOptional()
  @Matches(DAY)
  to?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsIn(['new', 'in_progress', 'done', 'returned', 'open', 'overdue'])
  status?: RequestStatus | 'open' | 'overdue';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class RequestActionDto {
  @IsIn(['start', 'complete', 'return', 'resend'])
  action: 'start' | 'complete' | 'return' | 'resend';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Where to resend a returned request. */
  @IsOptional()
  @IsString()
  unitId?: string;
}
