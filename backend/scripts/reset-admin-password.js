/**
 * Sets the admin account's password from ADMIN_RESET_PASSWORD. The account is
 * ADMIN_RESET_EMAIL (or phone) when given, otherwise the single SUPER_ADMIN.
 * Signs the account out everywhere (drops its refresh tokens) and reactivates it.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

exports.run = async () => {
  const password = process.env.ADMIN_RESET_PASSWORD || '';
  if (password.length < 12) throw new Error('ADMIN_RESET_PASSWORD must be at least 12 characters');

  const prisma = new PrismaClient();
  try {
    const target = process.env.ADMIN_RESET_EMAIL;
    const users = await prisma.user.findMany({
      where: target
        ? { OR: [{ email: target }, { phone: target }], role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
        : { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, phone: true, role: true },
    });
    if (users.length !== 1) {
      const admins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }, select: { email: true, phone: true, role: true } });
      throw new Error(`Expected exactly one account to reset, found ${users.length}. Set ADMIN_RESET_EMAIL to one of: ${admins.map((a) => `${a.email ?? a.phone} (${a.role})`).join(', ')}`);
    }
    const [user] = users;
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12), isActive: true } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
    console.log(`Admin password reset for ${user.email ?? '(no email)'} / ${user.phone} (${user.role}).`);
  } finally {
    await prisma.$disconnect();
  }
};
