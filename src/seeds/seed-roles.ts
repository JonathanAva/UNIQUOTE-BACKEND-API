import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Script de seed para insertar roles básicos en la tabla Role
async function seedRoles() {
  const baseRoles = ['administrador', 'gerente', 'director de proyecto', 'contador'];

  for (const name of baseRoles) {
    await prisma.role.upsert({
      where: { name },
      update: {},    // Si ya existe, no hace cambios
      create: { name },
    });
  }

  console.log('✅ Roles insertados correctamente');
  await prisma.$disconnect();
}

seedRoles().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
