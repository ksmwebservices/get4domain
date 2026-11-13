import { Global, Module } from '@nestjs/common';
import { PayLinkPort } from '../requests-orders/requests-ports';
import { PaymentsService } from './payments.service';
import { PayRequestsModule } from './payments.module';

/**
 * Binds the checkout's pay-link port (Amendment 09 W3) to the pay requests service. Global so the orders module can take it without importing the payments module (which imports the orders module).
 * The orders module asks for it as optional: without this module an online order still gets the older step.
 */
@Global()
@Module({ imports: [PayRequestsModule], providers: [{ provide: PayLinkPort, useExisting: PaymentsService }], exports: [PayLinkPort] })
export class PayLinkBridgeModule {}
