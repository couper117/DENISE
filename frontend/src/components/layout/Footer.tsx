import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter, MessageCircle, ArrowRight } from 'lucide-react';
import {
  BUSINESS_PHONE, BUSINESS_PHONE_CLEAN, BUSINESS_EMAIL,
  BUSINESS_HOURS, BUSINESS_ADDRESS, SOCIAL_LINKS, WHATSAPP_LINK,
  AIRTEL_ENABLED, BANK_TRANSFER_ENABLED, PAY_ON_COLLECTION_ENABLED,
} from '../../lib/config';
import { EditableList, EditableText } from '../../cms';

interface FooterLink { label: string; href: string }

/* Shape of one footer link, so an editor can add, remove and reorder them. */
const LINK_FIELDS = [
  { name: 'label', type: 'TEXT' as const, label: 'Label' },
  { name: 'href', type: 'TEXT' as const, label: 'Destination', placeholder: '/products' },
];

const SOCIALS = [
  { href: SOCIAL_LINKS.facebook, icon: Facebook, label: 'Facebook' },
  { href: SOCIAL_LINKS.instagram, icon: Instagram, label: 'Instagram' },
  { href: SOCIAL_LINKS.twitter, icon: Twitter, label: 'Twitter' },
].filter((s) => s.href);

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  // Driven by the same flags as checkout, so the footer never advertises a
  // payment method the shop cannot actually take.
  const paymentKeys = [
    'footer.pay_momo',
    AIRTEL_ENABLED && 'footer.pay_airtel',
    BANK_TRANSFER_ENABLED && 'footer.pay_bank',
    PAY_ON_COLLECTION_ENABLED && 'footer.pay_in_store',
  ].filter(Boolean) as string[];

  const linkClass = 'text-sm text-muted-foreground transition-colors hover:text-foreground';

  return (
    <footer className="border-t border-border bg-card">
      {/* Help band: the shop sells by conversation as much as by catalogue. */}
      <div className="border-b border-border">
        <div className="shop-container flex flex-col items-start justify-between gap-5 py-10 md:flex-row md:items-center">
          <div className="max-w-xl">
            <EditableText id="footer.help_title" as="h3" className="font-serif text-2xl font-semibold tracking-tight" />
            <EditableText id="footer.help_desc" as="p" multiline className="mt-2 text-sm leading-relaxed text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn bg-[#1f8f4e] text-white hover:bg-[#197a42]">
              <MessageCircle size={17} /> <EditableText id="home.whatsapp_us" />
            </a>
            <a href={`tel:+${BUSINESS_PHONE_CLEAN}`} className="btn btn-outline">
              <Phone size={16} /> {BUSINESS_PHONE}
            </a>
          </div>
        </div>
      </div>

      <div className="shop-container grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 lg:grid-cols-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-4 lg:col-span-4">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-serif text-lg font-semibold text-primary-foreground">D</span>
            <span className="leading-none">
              <span className="block font-serif text-2xl font-semibold tracking-tight">DENISE</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">New Textile Social Company Ltd</span>
            </span>
          </Link>
          <EditableText id="footer.tagline" as="p" multiline label="Footer tagline" className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground" />
          {SOCIALS.length > 0 && (
            <div className="mt-6 flex gap-2">
              {SOCIALS.map(({ href, icon: Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Shop */}
        <div className="lg:col-span-2">
          <EditableText id="footer.products" as="h4" className="mb-4 text-sm font-semibold" />
          <EditableList<FooterLink>
            id="footer.product_links"
            label="Footer product links"
            as="ul"
            className="space-y-2.5"
            fields={LINK_FIELDS}
            fallback={[
              { href: '/products?category=curtains', label: t('footer.curtains') },
              { href: '/products?category=fabrics', label: t('footer.fabrics') },
              { href: '/products?category=traditional-attire', label: t('footer.traditional') },
              { href: '/products?category=accessories', label: t('footer.accessories') },
              { href: '/products?newArrival=true', label: t('home.new_arrivals') },
            ]}
          >
            {(link, i) => (
              <li key={i}><Link to={link.href} className={linkClass}>{link.label}</Link></li>
            )}
          </EditableList>
        </div>

        {/* Company & help */}
        <div className="lg:col-span-2">
          <EditableText id="footer.company" as="h4" className="mb-4 text-sm font-semibold" />
          <EditableList<FooterLink>
            id="footer.company_links"
            label="Footer company links"
            as="ul"
            className="space-y-2.5"
            fields={LINK_FIELDS}
            fallback={[
              { href: '/about', label: t('footer.about') },
              { href: '/blog', label: t('footer.blog') },
              { href: '/contact', label: t('footer.contact') },
              { href: '/track', label: t('footer.tracking') },
              { href: '/cart', label: t('nav.cart') },
            ]}
          >
            {(link, i) => (
              <li key={i}><Link to={link.href} className={linkClass}>{link.label}</Link></li>
            )}
          </EditableList>
        </div>

        {/* Visit */}
        <div className="col-span-2 md:col-span-2 lg:col-span-4">
          <EditableText id="footer.visit_title" as="h4" className="mb-4 text-sm font-semibold" />
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>{BUSINESS_ADDRESS}</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>{BUSINESS_HOURS}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={16} className="shrink-0 text-primary" />
              <a href={`tel:+${BUSINESS_PHONE_CLEAN}`} className="hover:text-foreground">{BUSINESS_PHONE}</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail size={16} className="shrink-0 text-primary" />
              <a href={`mailto:${BUSINESS_EMAIL}`} className="break-all hover:text-foreground">{BUSINESS_EMAIL}</a>
            </li>
          </ul>
          <Link to="/contact" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-4">
            <EditableText id="home.get_directions" /> <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="shop-container flex flex-col gap-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <EditableText id="footer.pay_with" className="mr-1" />
            {paymentKeys.map((key) => (
              <span key={key} className="rounded-md border border-border bg-background px-2.5 py-1 font-medium text-foreground/80">
                <EditableText id={key} />
              </span>
            ))}
          </div>
          <p>
            © {year} New Textile Social Company Limited (DENISE). <EditableText id="footer.rights" />{' '}
            <span className="whitespace-nowrap">· <EditableText id="footer.made_in" /></span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
