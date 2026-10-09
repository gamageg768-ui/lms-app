const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@velora.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const NAME     = process.env.ADMIN_NAME     || 'Admin';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'ADMIN', password: hash },
    create: { email: EMAIL, name: NAME, password: hash, role: 'ADMIN' },
  });
  console.log(`Admin ready: ${admin.email} (role: ${admin.role})`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
