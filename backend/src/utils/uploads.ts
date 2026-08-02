import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { isCloudinaryConfigured } from '../config/cloudinary';
import cloudinary from '../config/cloudinary';
import logger from './logger';

export interface UploadedImage {
  url: string;
  publicId: string;
}

// Multer's file shape differs between Cloudinary storage (path = full URL, filename = public_id)
// and local disk storage (path = disk path, destination = folder, filename = file name).
type StoredFile = Express.Multer.File & { path?: string; filename?: string; destination?: string };

/**
 * Resolve the public URL + identifier for an uploaded file, regardless of whether
 * Cloudinary or the local-disk fallback was used. Local URLs are built from the
 * incoming request host so they resolve correctly from any device (laptop or phone).
 */
export const fileToImage = (req: Request, file: StoredFile): UploadedImage => {
  if (isCloudinaryConfigured) {
    return { url: file.path || '', publicId: file.filename || '' };
  }
  const folder = file.destination ? path.basename(file.destination) : 'products';
  const filename = file.filename || '';
  return {
    url: `${req.protocol}://${req.get('host')}/uploads/${folder}/${filename}`,
    publicId: `local:${folder}/${filename}`,
  };
};

export const filesToImages = (req: Request, files: StoredFile[] = []): UploadedImage[] =>
  files.map((f) => fileToImage(req, f));

/** Remove a stored image by its publicId (Cloudinary asset or local file). Never throws. */
export const destroyImage = async (publicId?: string | null): Promise<void> => {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      const rel = publicId.slice('local:'.length);
      await fs.promises.unlink(path.join(process.cwd(), 'uploads', rel)).catch(() => {});
    } else {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (e) {
    logger.error('destroyImage failed:', e);
  }
};
