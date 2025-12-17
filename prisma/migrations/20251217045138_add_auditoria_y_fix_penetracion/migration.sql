/*
  Warnings:

  - Made the column `clienteSolicitaTablas` on table `Cotizacion` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Cotizacion" ALTER COLUMN "penetracionCategoria" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "clienteSolicitaTablas" SET NOT NULL,
ALTER COLUMN "clienteSolicitaTablas" SET DEFAULT false;

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER,
    "metadata" JSONB,
    "cotizacionId" INTEGER,
    "performedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_createdAt_idx" ON "auditoria"("createdAt");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidadId_idx" ON "auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "auditoria_cotizacionId_idx" ON "auditoria"("cotizacionId");

-- CreateIndex
CREATE INDEX "auditoria_performedById_createdAt_idx" ON "auditoria"("performedById", "createdAt");

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
