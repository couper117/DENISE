import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';

export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProducts, totalReservations, totalCustomers,
      dailyReservations, weeklyReservations, monthlyReservations,
      pendingReservations, lowStockProducts, popularProducts,
      reservationsByStatus, recentReservations,
    ] = await Promise.all([
      prisma.product.count({ where: { isAvailable: true } }),
      prisma.reservation.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.reservation.count({ where: { createdAt: { gte: today } } }),
      prisma.reservation.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.reservation.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.reservation.count({ where: { status: 'PENDING' } }),
      prisma.inventory.findMany({ where: { isTracked: true, stockCount: { lte: 5 } }, include: { product: { select: { name: true, id: true } } } }),
      prisma.product.findMany({ orderBy: { reservationCount: 'desc' }, take: 5, select: { id: true, name: true, reservationCount: true } }),
      prisma.reservation.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.reservation.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, reservationNumber: true, customerName: true, customerPhone: true, status: true, visitDate: true, visitTime: true, createdAt: true } }),
    ]);

    res.json({
      success: true,
      data: {
        overview: { totalProducts, totalReservations, totalCustomers, pendingReservations },
        reservations: { daily: dailyReservations, weekly: weeklyReservations, monthly: monthlyReservations },
        reservationsByStatus,
        lowStockProducts,
        popularProducts,
        recentReservations,
      },
    });
  } catch (error) {
    logger.error('GetDashboardStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const where: Record<string, unknown> = { role: 'CUSTOMER' };
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, isActive: true, createdAt: true, _count: { select: { reservations: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: customers, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    logger.error('GetCustomers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
};

export const toggleCustomerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
    res.json({ success: true, message: `User ${user.isActive ? 'disabled' : 'enabled'}` });
  } catch (error) {
    logger.error('ToggleCustomerStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update customer status' });
  }
};

export const updateSiteContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, language } = req.body;
    const content = await prisma.siteContent.upsert({
      where: { key },
      update: { value, language },
      create: { key, value, language: language || 'en' },
    });
    res.json({ success: true, data: content });
  } catch (error) {
    logger.error('UpdateSiteContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
};

export const getSiteContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { language } = req.query;
    const content = await prisma.siteContent.findMany({ where: language ? { language: String(language) } : undefined });
    const contentMap = content.reduce((acc: Record<string, string>, item) => { acc[item.key] = item.value; return acc; }, {});
    res.json({ success: true, data: contentMap });
  } catch (error) {
    logger.error('GetSiteContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

export const updateSEO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, ...seoData } = req.body;
    const seo = await prisma.sEOSettings.upsert({
      where: { page },
      update: seoData,
      create: { page, ...seoData },
    });
    res.json({ success: true, data: seo });
  } catch (error) {
    logger.error('UpdateSEO error:', error);
    res.status(500).json({ success: false, message: 'Failed to update SEO' });
  }
};

export const getInventory = async (_req: Request, res: Response): Promise<void> => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: { product: { select: { id: true, name: true, slug: true, category: { select: { name: true } } } } },
      orderBy: { stockCount: 'asc' },
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    logger.error('GetInventory error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory' });
  }
};

export const updateInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { stockCount, metersAvailable, lowStockAlert } = req.body;
    const inventory = await prisma.inventory.upsert({
      where: { productId },
      update: { stockCount: parseInt(stockCount), metersAvailable: metersAvailable ? parseFloat(metersAvailable) : null, lowStockAlert: parseInt(lowStockAlert || '5') },
      create: { productId, stockCount: parseInt(stockCount), metersAvailable: metersAvailable ? parseFloat(metersAvailable) : null, lowStockAlert: parseInt(lowStockAlert || '5') },
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    logger.error('UpdateInventory error:', error);
    res.status(500).json({ success: false, message: 'Failed to update inventory' });
  }
};

export const manageBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const banners = await prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: banners });
  } catch (error) {
    logger.error('ManageBanners error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banners' });
  }
};

export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, subtitle, linkUrl, linkText, sortOrder } = req.body;
    const file = req.file as Express.Multer.File & { path?: string; filename?: string };
    const banner = await prisma.banner.create({
      data: { title, subtitle, linkUrl, linkText, imageUrl: file?.path || '', imagePublicId: file?.filename || null, sortOrder: parseInt(sortOrder || '0') },
    });
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    logger.error('CreateBanner error:', error);
    res.status(500).json({ success: false, message: 'Failed to create banner' });
  }
};

export const getTestimonials = async (_req: Request, res: Response): Promise<void> => {
  try {
    const testimonials = await prisma.testimonial.findMany({ where: { isApproved: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: testimonials });
  } catch (error) {
    logger.error('GetTestimonials error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
  }
};

export const getFAQs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const faqs = await prisma.fAQ.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: faqs });
  } catch (error) {
    logger.error('GetFAQs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FAQs' });
  }
};

export const getDeliveryZonesAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const zones = await prisma.deliveryZone.findMany({ orderBy: [{ province: 'asc' }, { district: 'asc' }] });
    res.json({ success: true, data: zones });
  } catch (error) {
    logger.error('GetDeliveryZones error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery zones' });
  }
};

export const upsertDeliveryZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { province, district, baseFee, estimatedDays, isActive } = req.body;
    if (!province || baseFee === undefined) {
      res.status(400).json({ success: false, message: 'province and baseFee are required' });
      return;
    }
    const zone = await prisma.deliveryZone.upsert({
      where: { province_district: { province, district: district || null } },
      update: { baseFee: Number(baseFee), estimatedDays: Number(estimatedDays || 1), isActive: isActive !== false },
      create: { province, district: district || null, baseFee: Number(baseFee), estimatedDays: Number(estimatedDays || 1) },
    });
    res.json({ success: true, data: zone });
  } catch (error) {
    logger.error('UpsertDeliveryZone error:', error);
    res.status(500).json({ success: false, message: 'Failed to update delivery zone' });
  }
};

export const getReviewsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { approved, page = 1, limit = 20 } = req.query;
    const where: Record<string, unknown> = {};
    if (approved !== undefined) where.isApproved = approved === 'true';
    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, slug: true } } },
      }),
      prisma.productReview.count({ where }),
    ]);
    res.json({ success: true, data: reviews, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    logger.error('GetReviewsAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

export const approveReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const review = await prisma.productReview.update({ where: { id }, data: { isApproved: true } });
    res.json({ success: true, data: review });
  } catch (error) {
    logger.error('ApproveReview error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve review' });
  }
};

export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.productReview.delete({ where: { id } });
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    logger.error('DeleteReview error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
};
