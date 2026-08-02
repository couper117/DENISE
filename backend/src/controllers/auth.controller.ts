import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, email, password, preferredLanguage } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Phone number already registered' });
      return;
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        res.status(409).json({ success: false, message: 'Email already registered' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { firstName, lastName, phone, email: email || null, password: hashedPassword, preferredLanguage: preferredLanguage || 'en' },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true, preferredLanguage: true },
    });

    const tokenPayload = { id: user.id, phone: user.phone, email: user.email || undefined, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.status(201).json({ success: true, message: 'Registration successful', data: { user, accessToken, refreshToken } });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: phone ? { phone } : { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account disabled' });
      return;
    }

    const tokenPayload = { id: user.id, phone: user.phone, email: user.email || undefined, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, data: { user: userWithoutPassword, accessToken, refreshToken } });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) { res.status(400).json({ success: false, message: 'Refresh token required' }); return; }

    const decoded = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findFirst({ where: { token, userId: decoded.id, expiresAt: { gt: new Date() } } });

    if (!stored) { res.status(401).json({ success: false, message: 'Invalid refresh token' }); return; }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) { res.status(401).json({ success: false, message: 'User not found' }); return; }

    const tokenPayload = { id: user.id, phone: user.phone, email: user.email || undefined, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (token) { await prisma.refreshToken.deleteMany({ where: { token } }); }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true, preferredLanguage: true, darkMode: true, avatarUrl: true, createdAt: true },
    });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, preferredLanguage, darkMode } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName, lastName, email: email || null, preferredLanguage, darkMode },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true, preferredLanguage: true, darkMode: true, avatarUrl: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('UpdateProfile error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } });
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('ChangePassword error:', error);
    res.status(500).json({ success: false, message: 'Password change failed' });
  }
};
