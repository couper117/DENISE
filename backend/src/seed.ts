import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '+250780000001' },
    update: {},
    create: {
      firstName: 'DENISE',
      lastName: 'Admin',
      phone: '+250780000001',
      email: process.env.ADMIN_EMAIL || 'admin@denise-textile.rw',
      password: adminPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Categories
  const categories = [
    { name: 'Curtains', slug: 'curtains', description: 'Premium curtains for every style', sortOrder: 1 },
    { name: 'Curtain Rods', slug: 'curtain-rods', description: 'Quality curtain rods and rails', sortOrder: 2 },
    { name: 'Curtain Accessories', slug: 'accessories', description: 'Hooks, rings, tiebacks and more', sortOrder: 3 },
    { name: 'Traditional Attire', slug: 'traditional-attire', description: 'Authentic Rwandan traditional fashion', sortOrder: 4 },
    { name: 'Fabrics', slug: 'fabrics', description: 'Quality fabrics for clothing', sortOrder: 5 },
    { name: 'Interior Decoration', slug: 'interior-decoration', description: 'Interior decoration fabrics', sortOrder: 6 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }
  console.log('✅ Categories seeded');

  // Sample products
  const curtainsCategory = await prisma.category.findUnique({ where: { slug: 'curtains' } });
  const traditionalCategory = await prisma.category.findUnique({ where: { slug: 'traditional-attire' } });

  if (curtainsCategory) {
    await prisma.product.upsert({
      where: { slug: 'luxury-velvet-curtains' },
      update: {},
      create: {
        name: 'Luxury Velvet Curtains',
        slug: 'luxury-velvet-curtains',
        description: 'Premium velvet curtains perfect for living rooms and master bedrooms. Available in multiple colors to match any interior.',
        material: '100% Premium Velvet',
        priceRange: 'RWF 12,000 – 45,000/panel',
        categoryId: curtainsCategory.id,
        isFeatured: true,
        isAvailable: true,
        inventory: { create: { stockCount: 50, metersAvailable: 200 } },
        colors: { create: [{ name: 'Deep Burgundy', hexCode: '#722F37' }, { name: 'Navy Blue', hexCode: '#000080' }, { name: 'Forest Green', hexCode: '#228B22' }] },
      },
    });

    await prisma.product.upsert({
      where: { slug: 'sheer-linen-curtains' },
      update: {},
      create: {
        name: 'Sheer Linen Curtains',
        slug: 'sheer-linen-curtains',
        description: 'Light and airy sheer linen curtains that allow natural light while providing privacy.',
        material: '100% Natural Linen',
        priceRange: 'RWF 8,000 – 25,000/panel',
        categoryId: curtainsCategory.id,
        isNewArrival: true,
        isAvailable: true,
        inventory: { create: { stockCount: 80, metersAvailable: 350 } },
        colors: { create: [{ name: 'Cream White', hexCode: '#FFFDD0' }, { name: 'Beige', hexCode: '#F5F5DC' }] },
      },
    });
  }

  if (traditionalCategory) {
    await prisma.product.upsert({
      where: { slug: 'rwandan-isikote-fabric' },
      update: {},
      create: {
        name: 'Rwandan Isikote Fabric',
        slug: 'rwandan-isikote-fabric',
        description: 'Authentic Rwandan traditional fabric featuring beautiful geometric patterns. Perfect for traditional attire and special occasions.',
        material: 'Cotton blend with traditional patterns',
        priceRange: 'RWF 5,000 – 15,000/meter',
        categoryId: traditionalCategory.id,
        isFeatured: true,
        isNewArrival: true,
        isAvailable: true,
        inventory: { create: { stockCount: 30, metersAvailable: 150 } },
        colors: { create: [{ name: 'Royal Blue & Gold', hexCode: '#4169E1' }, { name: 'Red & Black', hexCode: '#8B0000' }] },
      },
    });
  }

  console.log('✅ Sample products seeded');

  // Testimonials
  const testimonials = [
    { customerName: 'Marie Uwimana', message: 'DENISE Textile has the most beautiful curtains in Kigali! The reservation system made it so easy to visit and the staff was incredibly helpful with measurements.', rating: 5, isApproved: true },
    { customerName: 'Jean-Paul Habimana', message: 'I reserved traditional attire fabric for my wedding and the quality exceeded my expectations. Highly recommend!', rating: 5, isApproved: true },
    { customerName: 'Diane Mukamana', message: 'Great selection of interior decoration fabrics. The walk-in consultation option is perfect for those who aren\'t sure what they need.', rating: 4, isApproved: true },
  ];

  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t }).catch(() => {});
  }

  console.log('✅ Testimonials seeded');

  // FAQs
  await prisma.fAQ.createMany({
    skipDuplicates: true,
    data: [
      { question: 'Can I purchase products online?', answer: 'No. Browse online, reserve, then visit our Kigali shop to inspect and pay.', language: 'en', sortOrder: 1 },
      { question: 'How does reservation work?', answer: 'Add products to your cart, choose a visit date/time, and submit. We\'ll prepare products before you arrive.', language: 'en', sortOrder: 2 },
      { question: 'What if I don\'t know my measurements?', answer: 'Select "Help Me Measure" — our staff will assist you during your visit.', language: 'en', sortOrder: 3 },
      { question: 'Can I book without selecting products?', answer: 'Yes! Book a walk-in consultation and we\'ll prepare recommendations for you.', language: 'en', sortOrder: 4 },
    ],
  });

  console.log('✅ FAQs seeded');
  console.log('🎉 Database seeded successfully!');
  console.log('\n📋 Admin credentials:');
  console.log('  Phone: +250780000001');
  console.log('  Password:', process.env.ADMIN_PASSWORD || 'Admin@123456');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
