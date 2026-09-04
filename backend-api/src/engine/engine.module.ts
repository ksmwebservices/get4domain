import { Module } from '@nestjs/common';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { RetailModule } from '../retail/retail.module';
import { ActionRegistry } from './action-registry';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';

/**
 * Business Action Engine (demonstrable stub).
 *
 * Imports the industry modules so their EXPORTED services can be injected
 * in-process — the engine dispatches into the same service singletons the
 * industry controllers use, never a parallel booking/ordering system.
 */
@Module({
  imports: [RestaurantModule, RetailModule],
  providers: [ActionRegistry, EngineService],
  controllers: [EngineController],
  exports: [EngineService],
})
export class EngineModule {}
