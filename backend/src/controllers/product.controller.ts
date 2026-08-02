import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateSlug, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import cloudinary from '../config/cloudinary';
import logger from '../utils/logger';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 12, search, category, material, color, availability, isFeatured, isNewArrival, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where: Record<string, unknown> = { isAvailable: true };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { material: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (category) where.category = { slug: String(category) };
    if (material) where.material = { contains: String(material), mode: 'insensitive' };
    if (availability === 'true') where.isAvailable = true;
    if (availability === 'false') where.isAvailable = false;
    if (isFeatured === 'true') where.isFeatured = true;
    if (isNewArrival === 'true') where.isNewArrival = true;

    const { skip, take } = getPaginationParams(Number(page), Number(limit));

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [String(sortBy)]: sortOrder },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          colors: true,
          inventory: { select: { stockCount: true, isTracked: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: buildPaginationResponse(total, Number(page), Number(limit)),
    });
  } catch (error) {
    logger.error('GetProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        colors: true,
        inventory: true,
        translations: true,
      },
    });

    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }

    await prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });

    const related = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id }, isAvailable: true },
      take: 4,
      include: { images: { where: { isPrimary: true }, take: 1 }, colors: true },
    });

    res.json({ success: true, data: { ...product, related } });
  } catch (error) {
    logger.error('GetProductBySlug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
};

export const getFeaturedProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { isFeatured: true, isAvailable: true },
      take: 8,
      include: { images: { where: { isPrimary: true }, take: 1 }, colors: true, category: { select: { name: true, slug: true } } },
    });
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('GetFeatured error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured products' });
  }
};

export const getNewArrivals = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { isNewArrival: true, isAvailable: true },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { images: { where: { isPrimary: true }, take: 1 }, colors: true, category: { select: { name: true, slug: true } } },
    });
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('GetNewArrivals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch new arrivals' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, specifications, material, priceRange, categoryId, isFeatured, isNewArrival, isOnPromotion, promotionText, metaTitle, metaDescription, metaKeywords, colors, stockCount, metersAvailable } = req.body;

    const slug = generateSlug(name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const files = req.files as Express.Multer.File[];

    const product = await prisma.product.create({
      data: {
        name, slug: finalSlug, description, specifications, material, priceRange,
        categoryId, isFeatured: isFeatured === 'true', isNewArrival: isNewArrival === 'true',
        isOnPromotion: isOnPromotion === 'true', promotionText, metaTitle, metaDescription, metaKeywords,
        images: {
          create: files?.map((file: Express.Multer.File & { path?: string; filename?: string }, i: number) => ({
            url: file.path || '',
            publicId: file.filename || '',
            isPrimary: i === 0,
            sortOrder: i,
          })) || [],
        },
        colors: colors ? { create: JSON.parse(colors).map((c: { name: string; hexCode?: string }) => ({ name: c.name, hexCode: c.hexCode })) } : undefined,
        inventory: { create: { stockCount: parseInt(stockCount || '0'), metersAvailable: metersAvailable ? parseFloat(metersAvailable) : null } },
      },
      include: { images: true, colors: true, inventory: true, category: true },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    logger.error('CreateProduct error:', error);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.slug = generateSlug(updates.name);
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: updates.name,
        description: updates.description,
        specifications: updates.specifications,
        material: updates.material,
        priceRange: updates.priceRange,
        categoryId: updates.categoryId,
        isFeatured: updates.isFeatured === 'true' || updates.isFeatured === true,
        isNewArrival: updates.isNewArrival === 'true' || updates.isNewArrival === true,
        isAvailable: updates.isAvailable === 'true' || updates.isAvailable === true,
        isOnPromotion: updates.isOnPromotion === 'true' || updates.isOnPromotion === true,
        promotionText: updates.promotionText,
        metaTitle: updates.metaTitle,
        metaDescription: updates.metaDescription,
        metaKeywords: updates.metaKeywords,
      },
      include: { images: true, colors: true, inventory: true, category: true },
    });

    res.json({ success: true, data: product });
  } catch (error) {
    logger.error('UpdateProduct error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }

    for (const image of product.images) {
      if (image.publicId) { await cloudinary.uploader.destroy(image.publicId).catch(() => {}); }
    }

    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('DeleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

export const addProductImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    const existingCount = await prisma.productImage.count({ where: { productId: id } });

    const images = await prisma.productImage.createMany({
      data: files.map((file: Express.Multer.File & { path?: string; filename?: string }, i: number) => ({
        productId: id,
        url: file.path || '',
        publicId: file.filename || '',
        isPrimary: existingCount === 0 && i === 0,
        sortOrder: existingCount + i,
      })),
    });

    res.json({ success: true, data: images });
  } catch (error) {
    logger.error('AddProductImages error:', error);
    res.status(500).json({ success: false, message: 'Failed to add images' });
  }
};

export const deleteProductImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId } = req.params;
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) { res.status(404).json({ success: false, message: 'Image not found' }); return; }
    if (image.publicId) { await cloudinary.uploader.destroy(image.publicId).catch(() => {}); }
    await prisma.productImage.delete({ where: { id: imageId } });
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    logger.error('DeleteProductImage error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
};
