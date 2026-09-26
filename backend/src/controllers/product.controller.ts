import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateSlug, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import { filesToImages, destroyImage } from '../utils/uploads';
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

    // A parent category includes its sub-categories, so "curtains" lists both
    // the night (hard) and day (soft) curtains.
    if (category) where.category = { OR: [{ slug: String(category) }, { parent: { slug: String(category) } }] };
    if (material) where.material = { contains: String(material), mode: 'insensitive' };
    if (availability === 'true') where.isAvailable = true;
    if (availability === 'false') where.isAvailable = false;
    if (isFeatured === 'true') where.isFeatured = true;
    if (isNewArrival === 'true') where.isNewArrival = true;

    const { skip, take } = getPaginationParams(Number(page), Number(limit));

    // Whitelist sort inputs so arbitrary query params can't crash Prisma
    const SORTABLE_FIELDS = ['createdAt', 'name', 'price', 'salePrice', 'viewCount', 'reservationCount', 'sortOrder'];
    const sortField = SORTABLE_FIELDS.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const sortDir = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: sortDir },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
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
      include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 }, colors: true },
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
      include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 }, colors: true, category: { select: { name: true, slug: true } } },
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
      include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 }, colors: true, category: { select: { name: true, slug: true } } },
    });
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error('GetNewArrivals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch new arrivals' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, specifications, material, priceRange, price, salePrice, pricePerMeter, categoryId, isFeatured, isNewArrival, isAvailable, isOnPromotion, promotionText, metaTitle, metaDescription, metaKeywords, colors, stockCount, metersAvailable } = req.body;

    const slug = generateSlug(name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const files = (req.files as Express.Multer.File[]) || [];
    const num = (v: unknown) => (v === undefined || v === '' || v === null ? null : parseFloat(String(v)));

    const product = await prisma.product.create({
      data: {
        name, slug: finalSlug, description, specifications, material, priceRange,
        price: num(price), salePrice: num(salePrice), pricePerMeter: num(pricePerMeter),
        categoryId, isFeatured: isFeatured === 'true', isNewArrival: isNewArrival === 'true',
        // Omitted = on sale (the old behaviour); the admin form can create a hidden draft.
        isAvailable: isAvailable === undefined ? true : isAvailable === 'true' || isAvailable === true,
        isOnPromotion: isOnPromotion === 'true', promotionText, metaTitle, metaDescription, metaKeywords,
        images: {
          create: filesToImages(req, files).map((img, i) => ({
            url: img.url,
            publicId: img.publicId,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        },
        colors: colors ? { create: JSON.parse(colors).map((c: { name: string; hexCode?: string }) => ({ name: c.name.trim(), hexCode: c.hexCode || null })) } : undefined,
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

    // Only apply a boolean when the caller actually sent it, so partial
    // updates don't silently flip omitted flags to false.
    const boolIfPresent = (v: unknown): boolean | undefined =>
      v === undefined ? undefined : v === 'true' || v === true;

    const numIfPresent = (v: unknown): number | null | undefined =>
      v === undefined ? undefined : v === '' || v === null ? null : parseFloat(String(v));

    const data: Record<string, unknown> = {
      name: updates.name,
      description: updates.description,
      specifications: updates.specifications,
      material: updates.material,
      priceRange: updates.priceRange,
      price: numIfPresent(updates.price),
      salePrice: numIfPresent(updates.salePrice),
      pricePerMeter: numIfPresent(updates.pricePerMeter),
      categoryId: updates.categoryId,
      isFeatured: boolIfPresent(updates.isFeatured),
      isNewArrival: boolIfPresent(updates.isNewArrival),
      isAvailable: boolIfPresent(updates.isAvailable),
      isOnPromotion: boolIfPresent(updates.isOnPromotion),
      promotionText: updates.promotionText,
      metaTitle: updates.metaTitle,
      metaDescription: updates.metaDescription,
      metaKeywords: updates.metaKeywords,
    };

    // Only re-slug when the name actually changes, and keep the slug unique —
    // regenerating it on every save used to collide with a sibling product
    // whose slug had been suffixed, failing the whole update.
    if (updates.name) {
      const current = await prisma.product.findUnique({ where: { id }, select: { name: true } });
      if (!current) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
      if (current.name !== updates.name) {
        const base = generateSlug(updates.name);
        const clash = await prisma.product.findFirst({ where: { slug: base, id: { not: id } }, select: { id: true } });
        data.slug = clash ? `${base}-${Date.now()}` : base;
      }
    }

    // Replace colours when provided (accepts a JSON string or an array)
    if (updates.colors !== undefined) {
      const colors = typeof updates.colors === 'string' ? JSON.parse(updates.colors) : updates.colors;
      data.colors = {
        deleteMany: {},
        create: (colors as { name: string; hexCode?: string }[]).map((c) => ({ name: c.name.trim(), hexCode: c.hexCode || null })),
      };
    }

    // Update stock/meters when provided (upsert covers products without an inventory row)
    if (updates.stockCount !== undefined || updates.metersAvailable !== undefined) {
      const invUpdate: Record<string, unknown> = {};
      if (updates.stockCount !== undefined && !Number.isNaN(parseInt(updates.stockCount))) {
        invUpdate.stockCount = parseInt(updates.stockCount);
      }
      if (updates.metersAvailable !== undefined) {
        invUpdate.metersAvailable = updates.metersAvailable === '' || updates.metersAvailable === null
          ? null : parseFloat(updates.metersAvailable);
      }
      data.inventory = {
        upsert: {
          create: {
            stockCount: invUpdate.stockCount ?? 0,
            metersAvailable: (invUpdate.metersAvailable as number | null) ?? null,
          },
          update: invUpdate,
        },
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data,
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

    // Orders keep a reference to the product they were placed for, so a product
    // that has been ordered cannot be removed without losing order history.
    // Tell the admin to hide it instead of failing with a generic 500.
    const orderCount = await prisma.reservationItem.count({ where: { productId: id } });
    if (orderCount > 0) {
      res.status(409).json({
        success: false,
        code: 'PRODUCT_HAS_ORDERS',
        orderCount,
        message: `This product appears in ${orderCount} order(s) and cannot be deleted. Hide it from the shop instead.`,
      });
      return;
    }

    for (const image of product.images) {
      await destroyImage(image.publicId);
    }

    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('DeleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

/**
 * Admin catalogue listing. Unlike the public `getProducts` it includes hidden
 * (unavailable) products and every image, so the admin can manage them all.
 */
export const getAdminProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { material: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { OR: [{ slug: String(category) }, { parent: { slug: String(category) } }] };
    if (status === 'available') where.isAvailable = true;
    if (status === 'hidden') where.isAvailable = false;
    if (status === 'featured') where.isFeatured = true;
    if (status === 'new') where.isNewArrival = true;

    const { skip, take } = getPaginationParams(Number(page), Number(limit));

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true, slug: true, parentId: true } },
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          colors: true,
          inventory: { select: { stockCount: true, metersAvailable: true, isTracked: true } },
          _count: { select: { reservationItems: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: products, pagination: buildPaginationResponse(total, Number(page), Number(limit)) });
  } catch (error) {
    logger.error('GetAdminProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

export const addProductImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    const exists = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      for (const img of filesToImages(req, files)) await destroyImage(img.publicId);
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const existingCount = await prisma.productImage.count({ where: { productId: id } });

    await prisma.productImage.createMany({
      data: filesToImages(req, files).map((img, i) => ({
        productId: id,
        url: img.url,
        publicId: img.publicId,
        isPrimary: existingCount === 0 && i === 0,
        sortOrder: existingCount + i,
      })),
    });

    // Return the product's full, ordered image list so the admin can act on the
    // new photos (e.g. make one the main image) without a second request.
    const images = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
    await destroyImage(image.publicId);
    await prisma.productImage.delete({ where: { id: imageId } });
    // If we removed the primary image, promote the next one so the product still shows a photo.
    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({ where: { productId: image.productId }, orderBy: { sortOrder: 'asc' } });
      if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    logger.error('DeleteProductImage error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
};

/** Make one image the product's main photo (shown on cards and first in the gallery). */
export const setPrimaryProductImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId } = req.params;
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) { res.status(404).json({ success: false, message: 'Image not found' }); return; }

    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId: image.productId, isPrimary: true }, data: { isPrimary: false } }),
      prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);

    const images = await prisma.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });
    res.json({ success: true, data: images });
  } catch (error) {
    logger.error('SetPrimaryProductImage error:', error);
    res.status(500).json({ success: false, message: 'Failed to set main image' });
  }
};
