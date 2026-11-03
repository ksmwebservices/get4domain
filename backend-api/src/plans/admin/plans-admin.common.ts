import { ConflictException, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { planError } from '../plans.errors';

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
}

export function pageArgs(q: PageQueryDto): { skip: number; take: number; page: number; pageSize: number } {
  const page = q.page && q.page >= 1 ? q.page : 1;
  const pageSize = q.pageSize && q.pageSize >= 1 ? Math.min(q.pageSize, 100) : 25;
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export const paged = <T>(items: T[], total: number, page: number, pageSize: number): { items: T[]; page: number; pageSize: number; total: number } => ({ items, page, pageSize, total });

/** The signed-in staff member behind a request (JwtStrategy already re-loaded them from the database). */
export function actorOf(user: AuthenticatedUser, req: Request): { type: 'STAFF'; id: string | null; ip: string | null } {
  return { type: 'STAFF', id: user?.sub ?? null, ip: req?.ip ?? null };
}

export const staleWrite = (): ConflictException => new ConflictException(planError('STALE_WRITE', 'Someone else changed this just now. Reload it and try again.'));
export const unknownPlan = (): NotFoundException => new NotFoundException(planError('UNKNOWN_PLAN', 'That plan does not exist.'));
export const unknownVendor = (): NotFoundException => new NotFoundException(planError('UNKNOWN_VENDOR', 'That vendor does not exist.'));

/** The `updatedAt` the caller last read, as a Date. Optimistic concurrency: the update only succeeds when the row is unchanged. */
export function expectedDate(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ConflictException(planError('STALE_WRITE', 'expectedUpdatedAt is not a date.'));
  return d;
}
