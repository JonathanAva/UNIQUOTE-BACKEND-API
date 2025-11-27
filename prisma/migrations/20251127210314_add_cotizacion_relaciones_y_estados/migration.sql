/*
  Warnings:

  - The `status` column on the `Cotizacion` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `name` to the `Cotizacion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CotizacionStatus" AS ENUM ('ENVIADO', 'NEGOCIACION', 'APROBADO', 'NO_APROBADO', 'EN_PAUSA', 'REEMPLAZADA');

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "contactoId" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "CotizacionStatus" NOT NULL DEFAULT 'ENVIADO';

-- CreateIndex
CREATE INDEX "Cotizacion_status_idx" ON "Cotizacion"("status");

-- CreateIndex
CREATE INDEX "Cotizacion_contactoId_idx" ON "Cotizacion"("contactoId");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "ContactoEmpresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
