import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';

/**
 * Website chat. A visitor starts a conversation from the Contact page and keeps
 * its random token in their browser; the token is the only key to it on the
 * public side, so one visitor can never read another's messages. Admins reach
 * every conversation through /api/admin/chats. Messages are plain text — the
 * site renders them as text, never as HTML.
 */

const MAX_BODY = 1000;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const preview = (body: string) => body.slice(0, 120);

const publicMessage = (m: { id: string; sender: string; body: string; createdAt: Date }) => ({
  id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt,
});

const publicConversation = (c: { token: string; customerName: string; status: string; createdAt: Date }) => ({
  token: c.token, customerName: c.customerName, status: c.status, createdAt: c.createdAt,
});

// ── Public (visitor) ─────────────────────────────────────────────────────────

export const startConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerName = clean(req.body.name, 80);
    const customerPhone = clean(req.body.phone, 30) || null;
    const body = clean(req.body.message, MAX_BODY);
    const token = crypto.randomBytes(24).toString('hex');
    const conversation = await prisma.chatConversation.create({
      data: {
        token, customerName, customerPhone,
        adminUnread: 1, lastMessageAt: new Date(), lastMessagePreview: preview(body),
        messages: { create: { sender: 'CUSTOMER', body } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.status(201).json({ success: true, data: { conversation: publicConversation(conversation), messages: conversation.messages.map(publicMessage) } });
  } catch (error) {
    logger.error('startConversation error:', error);
    res.status(500).json({ success: false, message: 'Could not start the chat' });
  }
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const after = req.query.after ? new Date(String(req.query.after)) : null;
    const conversation = await prisma.chatConversation.findUnique({ where: { token: req.params.token } });
    if (!conversation) { res.status(404).json({ success: false, message: 'Chat not found' }); return; }
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    if (conversation.customerUnread > 0) {
      await prisma.chatConversation.update({ where: { id: conversation.id }, data: { customerUnread: 0 } });
    }
    res.json({ success: true, data: { conversation: publicConversation(conversation), messages: messages.map(publicMessage) } });
  } catch (error) {
    logger.error('getConversation error:', error);
    res.status(500).json({ success: false, message: 'Could not load the chat' });
  }
};

export const postCustomerMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = clean(req.body.message, MAX_BODY);
    const conversation = await prisma.chatConversation.findUnique({ where: { token: req.params.token } });
    if (!conversation) { res.status(404).json({ success: false, message: 'Chat not found' }); return; }
    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { conversationId: conversation.id, sender: 'CUSTOMER', body } }),
      prisma.chatConversation.update({
        where: { id: conversation.id },
        // A customer writing again reopens a closed conversation.
        data: { adminUnread: { increment: 1 }, lastMessageAt: new Date(), lastMessagePreview: preview(body), status: 'OPEN' },
      }),
    ]);
    res.status(201).json({ success: true, data: publicMessage(message) });
  } catch (error) {
    logger.error('postCustomerMessage error:', error);
    res.status(500).json({ success: false, message: 'Could not send the message' });
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status === 'CLOSED' ? 'CLOSED' : req.query.status === 'ALL' ? undefined : 'OPEN';
    const conversations = await prisma.chatConversation.findMany({
      where: status ? { status } : {},
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      select: { id: true, customerName: true, customerPhone: true, status: true, adminUnread: true, lastMessageAt: true, lastMessagePreview: true, createdAt: true },
    });
    const unread = await prisma.chatConversation.aggregate({ _sum: { adminUnread: true } });
    res.json({ success: true, data: { conversations, unread: unread._sum.adminUnread ?? 0 } });
  } catch (error) {
    logger.error('listConversations error:', error);
    res.status(500).json({ success: false, message: 'Could not load chats' });
  }
};

export const getConversationAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 500 } },
    });
    if (!conversation) { res.status(404).json({ success: false, message: 'Chat not found' }); return; }
    if (conversation.adminUnread > 0) {
      await prisma.chatConversation.update({ where: { id: conversation.id }, data: { adminUnread: 0 } });
    }
    const { token: _token, ...rest } = conversation;
    res.json({ success: true, data: rest });
  } catch (error) {
    logger.error('getConversationAdmin error:', error);
    res.status(500).json({ success: false, message: 'Could not load the chat' });
  }
};

export const replyAsAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = clean(req.body.message, MAX_BODY);
    const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) { res.status(404).json({ success: false, message: 'Chat not found' }); return; }
    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { conversationId: conversation.id, sender: 'ADMIN', body, authorId: req.user?.id ?? null } }),
      prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { customerUnread: { increment: 1 }, lastMessageAt: new Date(), lastMessagePreview: preview(body), adminUnread: 0 },
      }),
    ]);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    logger.error('replyAsAdmin error:', error);
    res.status(500).json({ success: false, message: 'Could not send the reply' });
  }
};

export const setConversationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const updated = await prisma.chatConversation.update({ where: { id: req.params.id }, data: { status } }).catch(() => null);
    if (!updated) { res.status(404).json({ success: false, message: 'Chat not found' }); return; }
    res.json({ success: true, data: { id: updated.id, status: updated.status } });
  } catch (error) {
    logger.error('setConversationStatus error:', error);
    res.status(500).json({ success: false, message: 'Could not update the chat' });
  }
};

/**
 * What the admin panel polls: orders and reservations placed after `since`,
 * and chat messages from customers after `since`. Small and indexed, so a poll
 * every few seconds from an open admin tab stays cheap.
 */
export const getAdminAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = req.query.since ? new Date(String(req.query.since)) : null;
    const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - 60_000);
    const [orders, messages, unread] = await Promise.all([
      prisma.reservation.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true, reservationNumber: true, customerName: true, fulfillmentType: true, totalAmount: true, createdAt: true },
      }),
      prisma.chatMessage.findMany({
        where: { sender: 'CUSTOMER', createdAt: { gt: since } },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true, body: true, createdAt: true, conversation: { select: { id: true, customerName: true } } },
      }),
      prisma.chatConversation.aggregate({ _sum: { adminUnread: true } }),
    ]);
    res.json({
      success: true,
      data: {
        now: new Date().toISOString(),
        orders,
        messages: messages.map((m) => ({ id: m.id, body: preview(m.body), createdAt: m.createdAt, conversationId: m.conversation.id, customerName: m.conversation.customerName })),
        unreadChats: unread._sum.adminUnread ?? 0,
      },
    });
  } catch (error) {
    logger.error('getAdminAlerts error:', error);
    res.status(500).json({ success: false, message: 'Could not load alerts' });
  }
};
