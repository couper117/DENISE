import { v4 as uuidv4 } from 'uuid';

export const generateReservationNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DN-${timestamp}-${random}`;
};

export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const getPaginationParams = (page = 1, limit = 12) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const buildPaginationResponse = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\s+/g, '').replace(/[()-]/g, '');
};
