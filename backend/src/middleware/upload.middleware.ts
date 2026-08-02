import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { productImageStorage, bannerImageStorage, blogImageStorage, isCloudinaryConfigured } from '../config/cloudinary';

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

// Local disk fallback — files land in backend/uploads/<folder> and are served at /uploads
const diskStorage = (folder: string) => multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const uploadProductImages = multer({ storage: isCloudinaryConfigured ? productImageStorage : diskStorage('products'), fileFilter, limits });
export const uploadBannerImage = multer({ storage: isCloudinaryConfigured ? bannerImageStorage : diskStorage('banners'), fileFilter, limits });
export const uploadBlogImage = multer({ storage: isCloudinaryConfigured ? blogImageStorage : diskStorage('blogs'), fileFilter, limits });
