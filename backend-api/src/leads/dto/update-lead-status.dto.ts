import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateLeadStatusDto {
  @ApiProperty({ example: 'called', enum: ['pending', 'called', 'converted'] })
  @IsIn(['pending', 'called', 'converted'])
  status!: string;
}
