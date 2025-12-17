// src/seeds/seed-users.ts
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Seed de usuarios iniciales:
 * - Admin (roleId = 1)
 * - Gerente (roleId = 2)
 * - Usuario (roleId = 3)
 *
 * IMPORTANTE:
 * Tus controllers usan RoleIds(1,2,3), así que esos IDs deben existir en Roles.
 * Corre seed-roles antes.
 */
export async function seedUsers() {
  // Verifica que existan roles (por ID)
  const roles = await prisma.role.findMany({
    where: { id: { in: [1, 2, 3] } },
    select: { id: true, name: true },
  });

  const have = new Set(roles.map((r) => r.id));
  for (const id of [1, 2, 3]) {
    if (!have.has(id)) {
      throw new Error(
        `Falta el rol con id=${id}. Corre primero seed-roles.ts (roles 1,2,3).`,
      );
    }
  }

  // Passwords (puedes moverlos a .env si quieres)
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const gerentePass = process.env.SEED_GERENTE_PASSWORD ?? 'Gerente123!';
  const userPass = process.env.SEED_USER_PASSWORD ?? 'User123!';

  const adminHash = await argon2.hash(adminPass);
  const gerenteHash = await argon2.hash(gerentePass);
  const userHash = await argon2.hash(userPass);

  // Para no bloquearte en el primer login, dejo mustChangePassword=false en seeds
  // (si quieres forzar cambio, ponlo en true y passwordChangedAt=null)
  const now = new Date();

  // ADMIN
  await prisma.user.upsert({
    where: { email: 'admin@unimerelsalvador.com' },
    update: {
      name: 'Admin',
      lastName: 'UNIMER',
      phone: '0000-0000',
      roleId: 1,
      password: adminHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
    create: {
      name: 'Admin',
      lastName: 'UNIMER',
      email: 'admin@unimerelsalvador.com',
      phone: '0000-0000',
      roleId: 1,
      password: adminHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
  });

  // GERENTE
  await prisma.user.upsert({
    where: { email: 'gerente@unimerelsalvador.com' },
    update: {
      name: 'Gerente',
      lastName: 'UNIMER',
      phone: '0000-0000',
      roleId: 2,
      password: gerenteHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
    create: {
      name: 'Gerente',
      lastName: 'UNIMER',
      email: 'gerente@unimerelsalvador.com',
      phone: '0000-0000',
      roleId: 2,
      password: gerenteHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
  });

  // USER NORMAL
  await prisma.user.upsert({
    where: { email: 'user@unimerelsalvador.com' },
    update: {
      name: 'Usuario',
      lastName: 'UNIMER',
      phone: '0000-0000',
      roleId: 3,
      password: userHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
    create: {
      name: 'Usuario',
      lastName: 'UNIMER',
      email: 'user@unimerelsalvador.com',
      phone: '0000-0000',
      roleId: 3,
      password: userHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    },
  });

  console.log('✅ Seed users OK');
}

if (require.main === module) {
  seedUsers()
    .catch((e) => {
      console.error('❌ Seed users error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
