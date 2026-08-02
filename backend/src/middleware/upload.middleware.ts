import multer from 'multer';
import { productImageStorage, bannerImageStorage, blogImageStorage } from '../config/cloudinary';

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

export const uploadProductImages = multer({ storage: productImageStorage, fileFilter, limits });
export const uploadBannerImage = multer({ storage: bannerImageStorage, fileFilter, limits });
export const uploadBlogImage = multer({ storage: blogImageStorage, fileFilter, limits });
