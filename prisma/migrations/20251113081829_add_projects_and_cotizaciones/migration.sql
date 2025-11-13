-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "contactoId" INTEGER,
    "name" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "studyType" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" INTEGER NOT NULL,
    "totalEntrevistas" INTEGER NOT NULL,
    "duracionCuestionarioMin" INTEGER NOT NULL,
    "tipoEntrevista" TEXT NOT NULL,
    "penetracionCategoria" TEXT NOT NULL,
    "cobertura" TEXT NOT NULL,
    "supervisores" INTEGER NOT NULL,
    "encuestadoresTotales" INTEGER NOT NULL,
    "realizamosCuestionario" BOOLEAN NOT NULL,
    "realizamosScript" BOOLEAN NOT NULL,
    "clienteSolicitaReporte" BOOLEAN NOT NULL,
    "clienteSolicitaInformeBI" BOOLEAN NOT NULL,
    "incentivoTotal" DECIMAL(12,2),
    "factorComisionablePct" DECIMAL(5,2),
    "factorNoComisionablePct" DECIMAL(5,2),
    "totalCobrar" DECIMAL(14,2),
    "costoPorEntrevista" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionItem" (
    "id" SERIAL NOT NULL,
    "cotizacionId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "personas" DECIMAL(12,2),
    "dias" DECIMAL(12,2),
    "costoUnitario" DECIMAL(14,4),
    "costoTotal" DECIMAL(14,4),
    "comisionable" BOOLEAN NOT NULL,
    "totalConComision" DECIMAL(14,4),
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_clienteId_idx" ON "Project"("clienteId");

-- CreateIndex
CREATE INDEX "Project_projectType_idx" ON "Project"("projectType");

-- CreateIndex
CREATE INDEX "Cotizacion_projectId_idx" ON "Cotizacion"("projectId");

-- CreateIndex
CREATE INDEX "Cotizacion_status_idx" ON "Cotizacion"("status");

-- CreateIndex
CREATE INDEX "CotizacionItem_cotizacionId_idx" ON "CotizacionItem"("cotizacionId");

-- CreateIndex
CREATE INDEX "CotizacionItem_category_idx" ON "CotizacionItem"("category");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "ContactoEmpresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
