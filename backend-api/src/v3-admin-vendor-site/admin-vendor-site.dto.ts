import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Staff create a business for an owner, with its Free plan and live trial site (B2.2). */
export class CreateVendorWithSiteDto {
  @ApiProperty({ example: 'driving-school', description: 'A category key from GET /v3/admin/categories/tree' }) @IsString() @Length(2, 80) category!: string;
  @ApiProperty({ example: 'Sri Murugan Driving School' }) @IsString() @Length(2, 120) businessName!: string;
  @ApiProperty({ example: 'Murugan K' }) @IsString() @Length(2, 120) ownerName!: string;
  @ApiProperty({ example: '+919876543210' }) @IsString() @Length(5, 30) phone!: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ example: 'Madurai' }) @IsString() @Length(2, 80) city!: string;
  @ApiProperty({ example: 'srimurugan', description: 'The free address: srimurugan.get4domain.com. Checked with the same rules as a signup.' }) @IsString() @Length(2, 63) subdomain!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) area?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' }) pincode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @ApiPropertyOptional({ description: 'A written reason (5 to 300 characters) to create this business although it looks like an existing one. ADMIN or SUPER_ADMIN only; logged.' }) @IsOptional() @IsString() @MaxLength(300) duplicateOverrideReason?: string;
}

export class CategoryTreeQueryDto { @IsOptional() @IsString() @MaxLength(100) q?: string }
