import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = ['administrador', 'gerente', 'director de proyecto', 'contador'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Roles creados');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
