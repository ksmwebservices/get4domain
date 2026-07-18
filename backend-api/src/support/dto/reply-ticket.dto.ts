import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReplyTicketDto {
  @ApiProperty({ example: "Thanks for flagging — we've corrected the GST calculation and reissued the invoice." })
  @IsString()
  adminReply!: string;
}
