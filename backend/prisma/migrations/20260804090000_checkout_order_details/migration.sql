-- Checkout refactor: per-item configuration, a stored price breakdown and an
-- append-only status history.
--
-- Every statement is guarded so the migration can be re-applied safely. Railway
-- runs `prisma migrate deploy && npm run start`, so a failing statement
-- short-circuits the && and the API never boots — a migration problem would
-- become a full outage.
--
-- All additions are nullable or defaulted: existing reservations keep working
-- untouched, and an order placed before this migration simply has no options,
-- no breakdown and no history rows.

-- AlterTable: Reservation — price breakdown + the scheduled delivery date the
-- API accepted but previously discarded.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "scheduledDeliveryDate" TIMESTAMP(3);

-- AlterTable: ReservationItem — the chosen configuration.
ALTER TABLE "ReservationItem" ADD COLUMN IF NOT EXISTS "options" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReservationStatusEvent" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "ReservationStatus",
    "paymentStatus" "PaymentStatus",
    "note" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationStatusEvent_reservationId_idx" ON "ReservationStatusEvent"("reservationId");
CREATE INDEX IF NOT EXISTS "Reservation_paymentStatus_idx" ON "Reservation"("paymentStatus");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ReservationStatusEvent"
    ADD CONSTRAINT "ReservationStatusEvent_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
