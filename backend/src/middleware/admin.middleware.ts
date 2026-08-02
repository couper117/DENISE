import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};

export const requireSuperAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, message: 'Super admin access required' });
    return;
  }
  next();
};
