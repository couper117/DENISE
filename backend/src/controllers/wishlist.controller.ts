import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export const getWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 }, category: { select: { name: true, slug: true } } } } },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('GetWishlist error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist' });
  }
};

export const addToWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      update: {},
      create: { userId: req.user!.id, productId },
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    logger.error('AddToWishlist error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
};

export const removeFromWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    await prisma.wishlistItem.delete({ where: { userId_productId: { userId: req.user!.id, productId } } });
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    logger.error('RemoveFromWishlist error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
  }
};
