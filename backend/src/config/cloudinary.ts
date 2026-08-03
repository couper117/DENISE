import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// When Cloudinary isn't configured we fall back to local disk storage so image
// uploads still work out-of-the-box (see upload.middleware.ts / utils/uploads.ts).
export const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

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

/**
 * Visual CMS media library. Unlike the product/banner/blog buckets this one does
 * not crop to a fixed shape — an asset here may be used as a hero backdrop, a
 * card thumbnail or an OG image, so it is only bounded and quality-optimised.
 * Cropping is an explicit editor action, applied as a delivery transformation.
 */
export const cmsMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'denise-textile/cms',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'],
    transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  } as object,
});

export default cloudinary;
