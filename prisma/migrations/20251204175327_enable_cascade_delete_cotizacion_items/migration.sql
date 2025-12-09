-- DropForeignKey
ALTER TABLE "CotizacionItem" DROP CONSTRAINT "CotizacionItem_cotizacionId_fkey";

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
