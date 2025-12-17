-- CreateIndex
CREATE INDEX "Cotizacion_createdAt_idx" ON "Cotizacion"("createdAt");

-- CreateIndex
CREATE INDEX "Cotizacion_status_createdAt_idx" ON "Cotizacion"("status", "createdAt");
