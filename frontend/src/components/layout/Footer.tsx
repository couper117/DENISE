import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter } from 'lucide-react';
import {
  BUSINESS_PHONE, BUSINESS_PHONE_CLEAN, BUSINESS_EMAIL,
  BUSINESS_HOURS, BUSINESS_ADDRESS, SOCIAL_LINKS,
} from '../../lib/config';
import { EditableList, EditableText } from '../../cms';

interface FooterLink { label: string; href: string }

/* Shape of one footer link, so an editor can add, remove and reorder them. */
const LINK_FIELDS = [
  { name: 'label', type: 'TEXT' as const, label: 'Label' },
  { name: 'href', type: 'TEXT' as const, label: 'Destination', placeholder: '/products' },
];

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
          <EditableText id="footer.tagline" as="p" multiline label="Footer tagline" className="text-sm text-muted-foreground mb-4" />
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
          <EditableText id="footer.products" as="h4" className="font-semibold mb-4" />
          <EditableList<FooterLink>
            id="footer.product_links"
            label="Footer product links"
            as="ul"
            className="space-y-2 text-sm text-muted-foreground"
            fields={LINK_FIELDS}
            fallback={[
              { href: '/products?category=curtains', label: t('footer.curtains') },
              { href: '/products?category=fabrics', label: t('footer.fabrics') },
              { href: '/products?category=traditional-attire', label: t('footer.traditional') },
              { href: '/products?category=accessories', label: t('footer.accessories') },
            ]}
          >
            {(link, i) => (
              <li key={i}><Link to={link.href} className="hover:text-primary transition-colors">{link.label}</Link></li>
            )}
          </EditableList>
        </div>

        {/* Company */}
        <div>
          <EditableText id="footer.company" as="h4" className="font-semibold mb-4" />
          <EditableList<FooterLink>
            id="footer.company_links"
            label="Footer company links"
            as="ul"
            className="space-y-2 text-sm text-muted-foreground"
            fields={LINK_FIELDS}
            fallback={[
              { href: '/about', label: t('footer.about') },
              { href: '/blog', label: t('footer.blog') },
              { href: '/contact', label: t('footer.contact') },
              { href: '/reservation', label: t('footer.reservation') },
              { href: '/track', label: t('footer.tracking') },
            ]}
          >
            {(link, i) => (
              <li key={i}><Link to={link.href} className="hover:text-primary transition-colors">{link.label}</Link></li>
            )}
          </EditableList>
        </div>

        {/* Contact */}
        <div>
          <EditableText id="contact.title" as="h4" className="font-semibold mb-4" />
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
          <p>© {year} New Textile Social Company Limited (DENISE). <EditableText id="footer.rights" /></p>
          <div className="flex items-center gap-3">
            <p><EditableText id="footer.made_in" /> 🇷🇼</p>
            <span>·</span>
            <a href="https://deniseshop.com" className="hover:text-primary transition-colors">deniseshop.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
