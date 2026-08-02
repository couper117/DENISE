import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const reviews = await prisma.productReview.findMany({
      where: { productId, isApproved: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    logger.error('GetProductReviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

export const createReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId, rating, title, message, customerName } = req.body;

    if (!productId || !rating || !message) {
      res.status(400).json({ success: false, message: 'productId, rating and message are required' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      return;
    }

    // Check product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }

    // If authenticated, check if they previously purchased the product
    let isVerified = false;
    if (req.user?.id) {
      const purchase = await prisma.reservationItem.findFirst({
        where: {
          productId,
          reservation: { userId: req.user.id, status: { in: ['COMPLETED', 'DELIVERED'] } },
        },
      });
      isVerified = !!purchase;
    }

    const review = await prisma.productReview.create({
      data: {
        productId,
        userId: req.user?.id || null,
        customerName: customerName || 'Anonymous',
        rating: Number(rating),
        title: title || null,
        message,
        isApproved: false,
        isVerified,
      },
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted and pending approval',
    });
  } catch (error) {
    logger.error('CreateReview error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};

export const markReviewHelpful = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const review = await prisma.productReview.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
    res.json({ success: true, data: review });
  } catch (error) {
    logger.error('MarkReviewHelpful error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark review as helpful' });
  }
};
