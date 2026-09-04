import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { BillOrderDto } from '../restaurant/dto/restaurant.dto';

/**
 * Input for the `restaurant.bill_order` action.
 *
 * On the REST route (`POST /restaurant/orders/:id/bill`) the order id is a PATH
 * param and the payment method is the body. The engine dispatches by a single
 * JSON payload, so this input reuses {@link BillOrderDto} VERBATIM (by extension —
 * it inherits `paymentMethod` and its validation) and adds the `orderId` that was
 * the path param. No booking/billing field is re-declared here.
 */
export class BillOrderActionInput extends BillOrderDto {
  @ApiProperty({ description: 'Id of the restaurant order to bill.' })
  @IsString()
  orderId!: string;
}

// `retail.create_sale` needs no wrapper: its action input IS `CreateSaleDto`
// verbatim (re-exported here so the registry imports both action inputs from
// one place). See `../retail/dto/retail.dto`.
export { CreateSaleDto } from '../retail/dto/retail.dto';
