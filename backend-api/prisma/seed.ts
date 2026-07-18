import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@get4domain.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('ADMIN_PASSWORD env var is required to seed the admin account — set it in .env.local and re-run.');
    process.exit(1);
  }

  const existing = await prisma.vendor.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email} — skipping seed.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.vendor.create({
    data: {
      name: 'Get4Domain Admin',
      email,
      password: hashedPassword,
      businessName: process.env.COMPANY_NAME ?? 'KSM Quantum Technologies',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Seeded SUPER_ADMIN account: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
