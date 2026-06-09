const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('guest1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'guest@admin.com' },
    update: { role: 'ADMIN' },
    create: { email: 'guest@admin.com', name: 'Guest Admin', password: hash, role: 'ADMIN' },
  });
  console.log('Done:', user.email, '|', user.role);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
