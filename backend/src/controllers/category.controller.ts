import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateSlug } from '../utils/helpers';
import logger from '../utils/logger';

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('GetCategories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, parentId, sortOrder } = req.body;
    const slug = generateSlug(name);

    const category = await prisma.category.create({
      data: { name, slug, description, parentId: parentId || null, sortOrder: parseInt(sortOrder || '0') },
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    logger.error('CreateCategory error:', error);
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = { description, isActive, sortOrder: parseInt(sortOrder) };
    if (name) { updates.name = name; updates.slug = generateSlug(name); }

    const category = await prisma.category.update({ where: { id }, data: updates });
    res.json({ success: true, data: category });
  } catch (error) {
    logger.error('UpdateCategory error:', error);
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete category with products. Reassign products first.' });
      return;
    }
    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    logger.error('DeleteCategory error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
};
