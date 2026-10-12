import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useBusiness } from '../lib/siteConfig';
import Seo from '../components/Seo';
import ChatBox from '../components/chat/ChatBox';
import Breadcrumbs from '../components/Breadcrumbs';
import { EditableText } from '../cms';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Kigali, Rwanda coordinates
const LAT = -1.9441;
const LNG = 30.0619;

const Contact = () => {
  const biz = useBusiness();
  // Arriving with #chat (the phone tab bar's Chat button): scroll to the chat
  // once the page has rendered — the router resets scroll to the top first.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#chat') return;
    const id = setTimeout(() => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(id);
  }, [hash]);
  const { t } = useTranslation();

  const contactItems = [
    { icon: MapPin, label: t('contact.address'), value: t('contact.address_value'), href: undefined },
    { icon: Phone, label: t('contact.phone'), value: biz.phone, href: `tel:+${biz.phoneDigits}` },
    { icon: Mail, label: t('contact.email'), value: biz.email, href: `mailto:${biz.email}` },
    { icon: Clock, label: t('contact.hours'), value: biz.hours, href: undefined },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <Seo
        path="/contact"
        title="Contact DENISE Textile — Kigali, Rwanda"
        description="Contact DENISE Textile in Kigali. WhatsApp, call or visit. Curtains, fabrics and traditional Rwandan attire."
      />
      <Breadcrumbs items={[{ label: t('nav.contact') }]} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <EditableText id="contact.title" as="h1" className="font-serif text-4xl font-bold mb-3" />
        <EditableText id="contact.subtitle" as="p" className="text-muted-foreground max-w-lg mx-auto" />
        <a href="#chat" className="btn btn-primary mt-6">
          <MessageCircle size={17} /> {t('chat.title', { defaultValue: 'Chat with us' })}
        </a>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            {contactItems.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  {href
                    ? <a href={href} className="font-medium hover:text-primary transition-colors">{value}</a>
                    : <p className="font-medium">{value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          <a href={biz.whatsappLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 bg-[#1f8f4e] text-white font-semibold rounded-xl hover:bg-[#197a42] transition-colors text-lg">
            <MessageCircle size={22} />
            <EditableText id="contact.whatsapp" />
          </a>

          {/* Was "Book a shop visit" → /reservation, which lands on an empty cart.
              Visiting needs no booking; directions are what people want here. */}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${biz.lat},${biz.lng}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            <MapPin size={18} /> <EditableText id="home.get_directions" />
          </a>
        </motion.div>

        {/* Google Maps embed */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl overflow-hidden h-80 lg:h-auto min-h-[320px] border border-border">
          {MAPS_KEY ? (
            <iframe
              title="DENISE Textile Location"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: 320 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${LAT},${LNG}&zoom=15`}
            />
          ) : (
            <a
              href={`https://www.google.com/maps?q=${LAT},${LNG}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 transition-colors text-center p-8 gap-4"
            >
              <MapPin size={48} className="text-primary/60" />
              <div>
                <p className="font-semibold text-foreground">DENISE Textile – Kigali, Rwanda</p>
                <p className="text-sm text-muted-foreground mt-1">{t('contact.map_open', { defaultValue: 'Click to open in Google Maps' })}</p>
              </div>
              <span className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                {t('home.get_directions')} →
              </span>
            </a>
          )}
        </motion.div>
      </div>

      {/* Website chat — answered from the admin inbox. */}
      <div className="mx-auto mt-12 max-w-3xl">
        <ChatBox hours={biz.hours} />
      </div>
    </div>
  );
};

export default Contact;
