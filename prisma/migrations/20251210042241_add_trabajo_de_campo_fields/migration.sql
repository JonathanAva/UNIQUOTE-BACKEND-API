/*
  Warnings:

  - You are about to drop the column `trabajoDeCampo` on the `Cotizacion` table. All the data in the column will be lost.
  - Added the required column `trabajoDeCampoRealiza` to the `Cotizacion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cotizacion" DROP COLUMN "trabajoDeCampo",
ADD COLUMN     "trabajoDeCampoCosto" DOUBLE PRECISION,
ADD COLUMN     "trabajoDeCampoRealiza" BOOLEAN NOT NULL,
ADD COLUMN     "trabajoDeCampoTipo" TEXT;
