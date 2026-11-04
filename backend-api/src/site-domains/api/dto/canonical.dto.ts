import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class GrantAddonDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
  @IsDateString() endsAt!: string;
}
export class EndAddonDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
