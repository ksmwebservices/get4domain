import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EngineService } from './engine.service';
import { ActionDescriptor } from './engine.types';

@ApiTags('engine')
@ApiBearerAuth()
@Controller('engine')
export class EngineController {
  constructor(private readonly engine: EngineService) {}

  @Get('actions')
  @ApiOperation({ summary: 'List registered engine actions and the real endpoints they delegate to' })
  listActions(): ActionDescriptor[] {
    return this.engine.listActions();
  }

  @Post('actions/:intent')
  @ApiOperation({ summary: 'Dispatch an engine action into the real industry backend' })
  dispatch(
    @CurrentUser() u: AuthenticatedUser,
    @Param('intent') intent: string,
    @Body() input: Record<string, unknown>,
  ): Promise<unknown> {
    // vendorId (u.sub) is forwarded UNCHANGED — the same tenant boundary the
    // industry controllers enforce.
    return this.engine.dispatch(intent, { vendorId: u.sub, user: u }, input);
  }
}
