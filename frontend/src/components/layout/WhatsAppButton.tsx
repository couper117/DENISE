import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_LINK } from '../../lib/config';

const WhatsAppButton = () => {
  const link = WHATSAPP_LINK;

  return (
    <motion.a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: 'spring' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Chat on WhatsApp"
    >
      <div className="w-14 h-14 flex items-center justify-center rounded-full">
        <MessageCircle size={28} fill="white" />
      </div>
    </motion.a>
  );
};

export default WhatsAppButton;
