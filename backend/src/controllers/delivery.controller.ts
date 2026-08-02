import { Request, Response } from 'express';
import prisma from '../config/database';
import { DELIVERY_FEES, getDeliveryFee } from '../utils/delivery';
import logger from '../utils/logger';

export const getDeliveryZones = async (_req: Request, res: Response): Promise<void> => {
  try {
    const zones = await prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: { province: 'asc' } });
    res.json({ success: true, data: zones.length > 0 ? zones : Object.entries(DELIVERY_FEES).map(([province, fee]) => ({ province, baseFee: fee, currency: 'RWF' })) });
  } catch (error) {
    logger.error('GetDeliveryZones error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery zones' });
  }
};

export const getDeliveryFeeForArea = async (req: Request, res: Response): Promise<void> => {
  try {
    const { province, district } = req.query;
    if (!province) { res.status(400).json({ success: false, message: 'province is required' }); return; }

    // Check DB first for specific zone override
    const zone = await prisma.deliveryZone.findFirst({
      where: {
        province: String(province),
        ...(district ? { district: String(district) } : {}),
        isActive: true,
      },
    });

    const fee = zone ? zone.baseFee : getDeliveryFee(String(province));
    res.json({ success: true, data: { province, district: district || null, fee, currency: 'RWF' } });
  } catch (error) {
    logger.error('GetDeliveryFee error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate delivery fee' });
  }
};

export const trackDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reservationNumber } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { reservationNumber },
      select: {
        reservationNumber: true,
        status: true,
        fulfillmentType: true,
        deliveryType: true,
        deliveryAddress: true,
        adminNotes: true,
        updatedAt: true,
      },
    });
    if (!reservation) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    res.json({ success: true, data: reservation });
  } catch (error) {
    logger.error('TrackDelivery error:', error);
    res.status(500).json({ success: false, message: 'Failed to track delivery' });
  }
};
