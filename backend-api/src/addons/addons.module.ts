import { Module } from '@nestjs/common';
import { AddonsService } from './addons.service';
import { AddonsController } from './addons.controller';
import { ModulesController } from './modules.controller';

@Module({
  providers: [AddonsService],
  controllers: [AddonsController, ModulesController],
  exports: [AddonsService],
})
export class AddonsModule {}
