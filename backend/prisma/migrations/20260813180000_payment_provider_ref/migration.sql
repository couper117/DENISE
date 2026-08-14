-- Payments: store the gateway's own transaction id (Paypack `ref`) alongside
-- our internal reference, so the `transaction:processed` webhook — which only
-- carries the gateway id — can find the payment it belongs to.
--
-- Guarded (IF NOT EXISTS) so `prisma migrate deploy` is safe to re-run and a
-- failing statement can't short-circuit the `&&` that starts the API. The
-- column is nullable: existing payments simply have no provider ref.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerRef_key" ON "Payment"("providerRef");
CREATE INDEX IF NOT EXISTS "Payment_providerRef_idx" ON "Payment"("providerRef");
