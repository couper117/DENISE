import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (date: string | Date | undefined | null, locale = 'en-RW'): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatTime = (time: string): string => {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
    PREPARING: 'bg-blue-100 text-blue-800 border-blue-200',
    PROCESSING: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PACKED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    READY_FOR_PICKUP: 'bg-purple-100 text-purple-800 border-purple-200',
    OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 border-orange-200',
    DELIVERED: 'bg-teal-100 text-teal-800 border-teal-200',
    COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    PREPARING: 'Preparing',
    PROCESSING: 'Processing',
    PACKED: 'Packed',
    READY_FOR_PICKUP: 'Ready for Pickup',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = 8; h < 18; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

export const getMinReservationDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

export const getWhatsAppLink = (phone: string, message: string): string => {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
};
