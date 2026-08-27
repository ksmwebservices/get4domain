-- Phase 2 (Hotel): dedicated Room (inventory + housekeeping) + RoomBooking
-- (reservations) models. Additive; no data touched.

-- CreateTable
CREATE TABLE "g4d_rooms" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "roomType" TEXT NOT NULL DEFAULT 'Standard',
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "pricePerNight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'available',
    "housekeeping" TEXT NOT NULL DEFAULT 'clean',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_room_bookings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "roomId" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_rooms_vendorId_idx" ON "g4d_rooms"("vendorId");
CREATE INDEX "g4d_room_bookings_vendorId_idx" ON "g4d_room_bookings"("vendorId");
CREATE INDEX "g4d_room_bookings_vendorId_checkIn_idx" ON "g4d_room_bookings"("vendorId", "checkIn");

-- AddForeignKey
ALTER TABLE "g4d_rooms" ADD CONSTRAINT "g4d_rooms_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_room_bookings" ADD CONSTRAINT "g4d_room_bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_room_bookings" ADD CONSTRAINT "g4d_room_bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "g4d_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
