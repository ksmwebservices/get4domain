# V3 order-request mode (Block 4b, slice 7)

A shop with **no active payment method** used to refuse the order route (`ORDER_INVALID`, "send an enquiry instead"). It now takes an **order request**: the cart is written down as an order, no payment is taken and none is asked for, and the business settles it itself.

## Behaviour (`POST /v3/public/sites/:host/orders`)

- When no method is ACTIVE (none on file, or only UNVERIFIED or DISABLED ones), the order is stored with payment mode `MANUAL`, status `PLACED`, no method, request kind `ORDER_REQUEST`. The answer carries `readiness: "ORDER_REQUEST_ONLY"`, `paymentTaken: false`, `orderRequest: true` and `paymentStep: { step: "NO_PAYMENT_TAKEN" }`. There is no checkout object and no UPI string.
- The customer is not offered a way to pay. If the request names one (`payWith`), it is refused with `ORDER_INVALID` and nothing is stored.
- Every other order rule is unchanged: the price comes from the catalogue, stock is reserved and released by the same job, coupons, the numbering, the spam and consent checks, the plan gate (`shop.cart`).
- A shop with any active method behaves exactly as before (online checkout with UPI, or an order request settled on delivery, at the visit or by bank transfer).
- Later, the business settles the order with **Record a payment** (slice 5): cash, bank transfer or UPI against the order, with no UPI method needed. That is the only route to PAID, and the receipt names the method.

## Not changed

The legacy engine's own `ORDER_REQUEST` checkout setting (the old shop engine) is a separate system and is untouched. The store module's checkout decision (`checkoutMode`) already said ORDER_REQUEST for a business without UPI; this slice makes the public order route agree with it.
