-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "endAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_roomId_startAt_key" ON "Booking"("roomId", "startAt");
