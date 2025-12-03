/*
  Warnings:

  - You are about to alter the column `incentivoTotal` on the `Cotizacion` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Integer`.
  - You are about to alter the column `factorComisionablePct` on the `Cotizacion` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `DoublePrecision`.
  - You are about to alter the column `factorNoComisionablePct` on the `Cotizacion` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `DoublePrecision`.
  - You are about to alter the column `totalCobrar` on the `Cotizacion` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `DoublePrecision`.
  - You are about to alter the column `costoPorEntrevista` on the `Cotizacion` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - A unique constraint covering the columns `[code]` on the table `Cotizacion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studyType` to the `Cotizacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trabajoDeCampo` to the `Cotizacion` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `penetracionCategoria` on the `Cotizacion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "Cotizacion_contactoId_idx";

-- DropIndex
DROP INDEX "Cotizacion_projectId_contactoId_idx";

-- DropIndex
DROP INDEX "Cotizacion_projectId_idx";

-- DropIndex
DROP INDEX "Cotizacion_status_idx";

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "metodologia" TEXT,
ADD COLUMN     "numeroOlasBi" INTEGER,
ADD COLUMN     "studyType" TEXT NOT NULL,
ADD COLUMN     "trabajoDeCampo" BOOLEAN NOT NULL,
DROP COLUMN "penetracionCategoria",
ADD COLUMN     "penetracionCategoria" INTEGER NOT NULL,
ALTER COLUMN "incentivoTotal" SET DATA TYPE INTEGER,
ALTER COLUMN "factorComisionablePct" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "factorNoComisionablePct" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalCobrar" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "costoPorEntrevista" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_code_key" ON "Cotizacion"("code");
