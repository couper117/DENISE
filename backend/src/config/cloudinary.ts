import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const productImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'denise-textile/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  } as object,
});

export const bannerImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'denise-textile/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1920, height: 600, crop: 'fill', quality: 'auto' }],
  } as object,
});

export const blogImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'denise-textile/blogs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 630, crop: 'fill', quality: 'auto' }],
  } as object,
});

export default cloudinary;
