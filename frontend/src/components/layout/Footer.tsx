import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter } from 'lucide-react';
import {
  BUSINESS_PHONE, BUSINESS_PHONE_CLEAN, BUSINESS_EMAIL,
  BUSINESS_HOURS, BUSINESS_ADDRESS, SOCIAL_LINKS,
} from '../../lib/config';

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <span className="font-serif font-bold text-primary text-xl block">DENISE</span>
              <span className="text-xs text-muted-foreground">New Textile Social Co. Ltd</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('footer.tagline')}</p>
          <div className="flex gap-3">
            {SOCIAL_LINKS.facebook && (
              <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook size={16} />
              </a>
            )}
            {SOCIAL_LINKS.instagram && (
              <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram size={16} />
              </a>
            )}
            {SOCIAL_LINKS.twitter && (
              <a href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-full flex items-center justify-center transition-colors" aria-label="Twitter">
                <Twitter size={16} />
              </a>
            )}
          </div>
        </div>

        {/* Products */}
        <div>
          <h4 className="font-semibold mb-4">{t('footer.products')}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              { to: '/products?category=curtains', label: t('footer.curtains') },
              { to: '/products?category=fabrics', label: t('footer.fabrics') },
              { to: '/products?category=traditional-attire', label: t('footer.traditional') },
              { to: '/products?category=accessories', label: t('footer.accessories') },
            ].map(({ to, label }) => (
              <li key={to}><Link to={to} className="hover:text-primary transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              { to: '/about', label: t('footer.about') },
              { to: '/blog', label: t('footer.blog') },
              { to: '/contact', label: t('footer.contact') },
              { to: '/reservation', label: t('footer.reservation') },
              { to: '/track', label: t('footer.tracking') },
            ].map(({ to, label }) => (
              <li key={to}><Link to={to} className="hover:text-primary transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-semibold mb-4">{t('contact.title')}</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
              <span>{BUSINESS_ADDRESS}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-primary shrink-0" />
              <a href={`tel:${BUSINESS_PHONE_CLEAN}`} className="hover:text-primary transition-colors">
                {BUSINESS_PHONE}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={15} className="text-primary shrink-0" />
              <a href={`mailto:${BUSINESS_EMAIL}`} className="hover:text-primary transition-colors">
                {BUSINESS_EMAIL}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Clock size={15} className="text-primary shrink-0 mt-0.5" />
              <span>{BUSINESS_HOURS}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border py-4">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {year} New Textile Social Company Limited (DENISE). {t('footer.rights')}</p>
          <div className="flex items-center gap-3">
            <p>{t('footer.made_in')} 🇷🇼</p>
            <span>·</span>
            <a href="https://deniseshop.com" className="hover:text-primary transition-colors">deniseshop.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
