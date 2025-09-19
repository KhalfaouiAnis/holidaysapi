/*
  Warnings:

  - You are about to drop the column `checkIn` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `checkOut` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `guestCount` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `totalPrice` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `check_in` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `check_out` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guest_count` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_price` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "checkIn",
DROP COLUMN "checkOut",
DROP COLUMN "guestCount",
DROP COLUMN "totalPrice",
ADD COLUMN     "check_in" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "check_out" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "guest_count" INTEGER NOT NULL,
ADD COLUMN     "total_price" DOUBLE PRECISION NOT NULL;
