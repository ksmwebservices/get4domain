import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Contract } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

@ApiTags('travel-contracts')
@ApiBearerAuth()
@Controller('travel/contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @ApiOperation({ summary: "List the vendor's recurring contracts (with client + assignments)" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listContracts(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring monthly contract' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto): Promise<Contract> {
    return this.service.createContract(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contract (assignments are replaced wholesale if provided)' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateContractDto): Promise<Contract> {
    return this.service.updateContract(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contract' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Contract> {
    return this.service.deleteContract(user.sub, id);
  }

  @Post('generate-invoices')
  @ApiOperation({ summary: "Manually generate this month's contract invoices (idempotent catch-up)" })
  generate(@CurrentUser() user: AuthenticatedUser): Promise<{ generated: number; alreadyBilled: number }> {
    return this.service.generateThisMonth(user.sub);
  }
}
