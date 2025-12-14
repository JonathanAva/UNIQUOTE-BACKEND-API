-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cotizacion_distrib_overrides" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "departamento" TEXT NOT NULL,
    "urbano" INTEGER,
    "rural" INTEGER,
    "total" INTEGER,
    "horasEfectivas" INTEGER,
    "tiempoEfectivoMin" INTEGER,
    "rendimiento" DOUBLE PRECISION,
    "encuestadores" INTEGER,
    "supervisores" INTEGER,
    "diasCampoEncuest" DOUBLE PRECISION,
    "viaticosUnit" DOUBLE PRECISION,
    "tMicrobusUnit" DOUBLE PRECISION,
    "hotelUnit" DOUBLE PRECISION,
    "precioBoleta" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizacion_distrib_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_distrib_overrides_cotizacionId_departamento_key" ON "cotizacion_distrib_overrides"("cotizacionId", "departamento");

-- AddForeignKey
ALTER TABLE "cotizacion_distrib_overrides" ADD CONSTRAINT "cotizacion_distrib_overrides_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
