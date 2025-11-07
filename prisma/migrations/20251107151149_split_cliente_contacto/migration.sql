/*
  Warnings:

  - You are about to drop the column `contacto` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `telefono` on the `Cliente` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Cliente_email_key";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "contacto",
DROP COLUMN "email",
DROP COLUMN "telefono";

-- CreateTable
CREATE TABLE "ContactoEmpresa" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactoEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactoEmpresa_email_key" ON "ContactoEmpresa"("email");

-- CreateIndex
CREATE INDEX "ContactoEmpresa_clienteId_idx" ON "ContactoEmpresa"("clienteId");

-- AddForeignKey
ALTER TABLE "ContactoEmpresa" ADD CONSTRAINT "ContactoEmpresa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
