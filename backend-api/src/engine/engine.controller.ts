import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { EngineService } from './engine.service';
import { ActionDescriptor } from './engine.types';

@ApiTags('engine')
@Controller('engine')
export class EngineController {
  constructor(private readonly engine: EngineService) {}

  @ApiBearerAuth()
  @Get('actions')
  @ApiOperation({ summary: 'List registered engine actions and the real endpoints they delegate to' })
  listActions(): ActionDescriptor[] {
    return this.engine.listActions();
  }

  @ApiBearerAuth()
  @Post('actions/:intent')
  @ApiOperation({ summary: 'Dispatch an engine action into the real industry backend (vendor JWT)' })
  dispatch(
    @CurrentUser() u: AuthenticatedUser,
    @Param('intent') intent: string,
    @Body() input: Record<string, unknown>,
  ): Promise<unknown> {
    // vendorId (u.sub) is forwarded UNCHANGED — the same tenant boundary the
    // industry controllers enforce.
    return this.engine.dispatch(intent, { vendorId: u.sub, user: u }, input);
  }

  // ── Public website surface (anonymous visitors) ──

  @Public()
  @Get('public/:subdomain/actions')
  @ApiOperation({ summary: 'List the engine actions a public generated website may expose' })
  listPublicActions(): ActionDescriptor[] {
    return this.engine.listPublicActions();
  }

  @Public()
  @Post('public/:subdomain/actions/:intent')
  @ApiOperation({ summary: 'Dispatch a public action (enquiry/booking/payment) from a generated website' })
  dispatchPublic(
    @Param('subdomain') subdomain: string,
    @Param('intent') intent: string,
    @Body() input: Record<string, unknown>,
  ): Promise<unknown> {
    // vendorId is resolved server-side from the subdomain — never trusted from the client.
    return this.engine.dispatchPublic(subdomain, intent, input);
  }
}
