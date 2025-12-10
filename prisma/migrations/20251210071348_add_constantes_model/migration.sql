-- CreateTable
CREATE TABLE "Constante" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "unidad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Constante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Constante_categoria_idx" ON "Constante"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Constante_categoria_subcategoria_key" ON "Constante"("categoria", "subcategoria");
