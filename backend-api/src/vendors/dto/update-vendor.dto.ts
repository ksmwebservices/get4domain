import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';

/** The duplicate-check inputs (city, area, pincode, gstin, confirmDistinct, duplicateOverrideReason) belong to creating a vendor only: they are not vendor columns. */
export class UpdateVendorDto extends PartialType(
  OmitType(CreateVendorDto, ['password', 'city', 'area', 'pincode', 'gstin', 'confirmDistinct', 'duplicateOverrideReason'] as const),
) {}
