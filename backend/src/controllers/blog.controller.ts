import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateSlug, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import { fileToImage } from '../utils/uploads';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export const getBlogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 9, search } = req.query;
    const where: Record<string, unknown> = { isPublished: true };
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { content: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    const { skip, take } = getPaginationParams(Number(page), Number(limit));
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({ where, skip, take, orderBy: { publishedAt: 'desc' }, select: { id: true, title: true, slug: true, excerpt: true, imageUrl: true, authorName: true, publishedAt: true, viewCount: true } }),
      prisma.blog.count({ where }),
    ]);
    res.json({ success: true, data: blogs, pagination: buildPaginationResponse(total, Number(page), Number(limit)) });
  } catch (error) {
    logger.error('GetBlogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs' });
  }
};

export const getBlogBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const blog = await prisma.blog.findUnique({ where: { slug: req.params.slug, isPublished: true } });
    if (!blog) { res.status(404).json({ success: false, message: 'Blog not found' }); return; }
    await prisma.blog.update({ where: { id: blog.id }, data: { viewCount: { increment: 1 } } });
    res.json({ success: true, data: blog });
  } catch (error) {
    logger.error('GetBlog error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog' });
  }
};

export const createBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, excerpt, authorName, isPublished, metaTitle, metaDescription, metaKeywords } = req.body;
    const img = req.file ? fileToImage(req, req.file) : null;
    const slug = generateSlug(title);
    const blog = await prisma.blog.create({
      data: { title, slug, content, excerpt, authorName, isPublished: isPublished === 'true', publishedAt: isPublished === 'true' ? new Date() : null, imageUrl: img?.url || null, imagePublicId: img?.publicId || null, metaTitle, metaDescription, metaKeywords },
    });
    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    logger.error('CreateBlog error:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
};

export const updateBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Allowlist updatable fields — never spread req.body straight into Prisma
    const data: Record<string, unknown> = {};
    const ALLOWED = ['title', 'content', 'excerpt', 'authorName', 'metaTitle', 'metaDescription', 'metaKeywords'] as const;
    for (const field of ALLOWED) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (body.title) data.slug = generateSlug(body.title);
    if (body.isPublished !== undefined) {
      data.isPublished = body.isPublished === 'true' || body.isPublished === true;
      if (data.isPublished) data.publishedAt = new Date();
    }
    if (req.file) { const img = fileToImage(req, req.file); data.imageUrl = img.url; data.imagePublicId = img.publicId; }

    const blog = await prisma.blog.update({ where: { id }, data });
    res.json({ success: true, data: blog });
  } catch (error) {
    logger.error('UpdateBlog error:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog' });
  }
};

export const deleteBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.blog.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    logger.error('DeleteBlog error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog' });
  }
};
