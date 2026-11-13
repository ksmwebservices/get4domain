# V3 SMS and the DLT checklist (Block 4b, slice 3; Amendment 12 Q7)

Indian SMS needs DLT registration. The code is ready; the registration is the owner's. Nothing here has sent a real message: tests use a fake transport, the flag defaults OFF, and no SMS provider has been chosen, so the product transport (`UnboundSmsTransport`) refuses.

## What the code does

`SmsPort` has one implementation, `GuardedSmsPort`, which checks in this order: the kind is on the closed transactional list (`OTP` only; no promotional kind exists, `SMS_KIND_FORBIDDEN`), the DLT values are set (`SMS_NOT_CONFIGURED`), the number is an Indian mobile and the template is registered, APPROVED, of that kind, and the values fit it exactly (`SMS_INVALID`, `SMS_TEMPLATE_NOT_APPROVED`), and the flag `SMS_LIVE_SEND` is `true` (`SMS_NOT_LIVE`). The text sent is the approved template with its values in place, and a value cannot contain the placeholder or a line break or be longer than 30 characters.

Identity phone codes use the template key `IDENTITY_OTP` with the code as its one value.

## Settings (g4d_plan_settings, SUPER_ADMIN, all start unset)

- `smsPrincipalEntityId`: the principal entity id the operator registered for the company.
- `smsSenderId`: the six-letter sender id (header).
- `smsTemplates`: an object keyed by template key. Each entry: `{ "templateId": "<digits>", "text": "<the approved text, with {#var#} where a value goes>", "kind": "OTP", "status": "APPROVED" | "PENDING" }`. Only APPROVED entries can send. Record a PENDING one while waiting.

Environment: `SMS_LIVE_SEND` (default OFF) and `SMS_PROVIDER_API_KEY` (for the adapter of the chosen provider; unused until one is bound). Values are never printed.

## DLT checklist (owner)

1. Pick a DLT portal and register the company as principal entity (KSM QUANTUM TECHNOLOGIES): business documents and an authorised signatory are asked for.
2. Register the sender id (six letters) and link it to the entity.
3. Register each template. The text must match what we send exactly, variables written as `{#var#}`, at most 30 characters per variable. Start with the identity one-time code (`IDENTITY_OTP`, category service or transactional, never promotional).
4. After approval, copy the entity id, sender id and each template id into the settings above, status APPROVED.
5. Choose an SMS provider that accepts DLT parameters (entity id, sender id and template id on every request), create its API key, put it in `SMS_PROVIDER_API_KEY`, and ask for the adapter for that provider (the request the port builds already carries the three DLT ids).
6. Test on staging with one number you own, then switch `SMS_LIVE_SEND` on.

Promotional or marketing SMS is not part of this block and cannot be sent through this port.
