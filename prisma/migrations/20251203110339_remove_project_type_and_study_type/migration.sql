/*
  Warnings:

  - You are about to drop the column `projectType` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `studyType` on the `Project` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Project_projectType_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "projectType",
DROP COLUMN "studyType";
