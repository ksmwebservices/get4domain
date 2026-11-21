import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGapsService } from '../admin-gaps.service';

class VendorListDto {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(60) plan?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(60) industry?: string;
  @IsOptional() @IsString() @MaxLength(30) listingState?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class NoteDto { @IsString() @MaxLength(4000) body!: string }

/**
 * Wave 2 Part C, the staff reads. WHO may call each route is DATA in src/auth/guards/admin-role-matrix.ts (a route with no entry is SUPER_ADMIN only), never a branch here:
 * the permission matrix is open to every staff role; the vendors list, the held count and the notes are OPERATIONS and SUPER_ADMIN (ADMIN by inheritance; SALES and SUPPORT refused).
 */
@ApiTags('v3-admin-gaps')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminGapsController {
  constructor(private readonly gaps: AdminGapsService) {}

  @Get('permission-matrix') @ApiOperation({ summary: 'Which staff roles may call which route, as the server enforces it (the base table plus the ADMIN and SUPPORT extensions); a route that is not listed is SUPER_ADMIN only' })
  matrix() { return this.gaps.matrix(); }

  @Get('vendors') @ApiOperation({ summary: 'Businesses, paged, with search and filters (plan, status, industry, listing state); each row carries its plan and its listing state' })
  vendors(@Query() q: VendorListDto) { return this.gaps.vendors(q); }

  @Get('vendors/:id/held-count') @ApiOperation({ summary: 'How many enquiries are held for this business while its plan is not active (a count only)' })
  held(@Param('id') id: string) { return this.gaps.heldCount(id); }

  @Get('vendors/:id/notes') @ApiOperation({ summary: 'Staff notes on this business, newest first' })
  notes(@Param('id') id: string, @Query() q: PageDto) { return this.gaps.notes(id, q.page ?? 1, q.pageSize ?? 25); }

  @Post('vendors/:id/notes') @HttpCode(200) @ApiOperation({ summary: 'Add a staff note to this business (append only, audited)' })
  addNote(@Param('id') id: string, @Body() dto: NoteDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.gaps.addNote(id, dto.body, { id: u?.sub ?? null, email: u?.email ?? 'staff', ip: req?.ip ?? null });
  }
}
