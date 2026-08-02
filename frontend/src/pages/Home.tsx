import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight, Star, CheckCircle2, MapPin, Phone, MessageCircle,
  Blinds, Shirt, Layers, Package, Search, CalendarCheck, Store, PackageOpen,
} from 'lucide-react';
import { productsApi, adminApi } from '../lib/api';
import { Product, Testimonial } from '../types';
import ProductCard from '../components/products/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';
import Seo from '../components/Seo';
import {
  BUSINESS_PHONE, BUSINESS_PHONE_CLEAN, WHATSAPP_LINK,
  BUSINESS_LAT, BUSINESS_LNG,
} from '../lib/config';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/* Section heading used by both product rails, so they stay identical. */
const RailHeading = ({
  title, subtitle, viewAllTo, viewAllLabel,
}: { title: string; subtitle: string; viewAllTo: string; viewAllLabel: string }) => (
  <div className="flex items-end justify-between gap-4 mb-8">
    <div>
      <h2 className="font-serif text-3xl font-bold">{title}</h2>
      <p className="text-muted-foreground mt-1">{subtitle}</p>
    </div>
    <Link
      to={viewAllTo}
      className="hidden sm:inline-flex shrink-0 items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:border-primary hover:text-primary transition-colors"
    >
      {viewAllLabel} <ArrowRight size={14} />
    </Link>
  </div>
);

/* Shown when a rail has no products — previously these grids rendered blank. */
const EmptyRail = ({ label, cta }: { label: string; cta: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
    <span className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
      <PackageOpen size={22} strokeWidth={1.7} />
    </span>
    <p className="mt-4 text-muted-foreground">{label}</p>
    <Link
      to="/products"
      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-4"
    >
      {cta} <ArrowRight size={14} />
    </Link>
  </div>
);

const Home = () => {
  const { t } = useTranslation();

  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => productsApi.getFeatured().then((r) => r.data.data as Product[]),
  });

  const { data: newArrivalsData, isLoading: newLoading } = useQuery({
    queryKey: ['products', 'new-arrivals'],
    queryFn: () => productsApi.getNewArrivals().then((r) => r.data.data as Product[]),
  });

  const { data: testimonials } = useQuery({
    queryKey: ['testimonials'],
    queryFn: () => adminApi.getTestimonials().then((r) => r.data.data as Testimonial[]),
    staleTime: 10 * 60 * 1000,
  });

  const steps = [
    { icon: Search, title: t('home.step1_title'), desc: t('home.step1_desc') },
    { icon: CalendarCheck, title: t('home.step2_title'), desc: t('home.step2_desc') },
    { icon: Store, title: t('home.step3_title'), desc: t('home.step3_desc') },
  ];

  const categories = [
    { nameKey: 'home.cat_curtains_name', descKey: 'home.cat_curtains_desc', slug: 'curtains', icon: Blinds, color: '#8B1A1A' },
    { nameKey: 'home.cat_traditional_name', descKey: 'home.cat_traditional_desc', slug: 'traditional-attire', icon: Shirt, color: '#006B3C' },
    { nameKey: 'home.cat_fabrics_name', descKey: 'home.cat_fabrics_desc', slug: 'fabrics', icon: Layers, color: '#C8972A' },
    { nameKey: 'home.cat_accessories_name', descKey: 'home.cat_accessories_desc', slug: 'accessories', icon: Package, color: '#0057A8' },
  ];

  const featuredEmpty = !featuredLoading && (featuredData?.length ?? 0) === 0;
  const newArrivalsEmpty = !newLoading && (newArrivalsData?.length ?? 0) === 0;

  const mapSrc = MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${BUSINESS_LAT},${BUSINESS_LNG}&zoom=15`
    : `https://www.google.com/maps?q=${BUSINESS_LAT},${BUSINESS_LNG}&z=15&output=embed`;

  return (
    <div>
      <Seo
        path="/"
        title="DENISE Textile Rwanda — Curtains, Amarido & Imyenda Gakondo in Kigali | deniseshop.com"
        description="DENISE (New Textile Social Company) — shop curtains (amarido), fabrics, imikenyero, imishanana and traditional Rwandan attire online. Delivery across Rwanda or visit our Kigali store."
      />
      {/* ================= Hero ================= */}
      <section className="relative min-h-[82vh] flex items-center bg-brand-dark overflow-hidden">
        {/* Bolts of fabric, then layered scrims for contrast. Chosen because it
            carries no third-party brand labels, unlike most market photos. */}
        <img
          src="https://images.unsplash.com/photo-1783538690103-782ddd5404c1?w=1920&q=80&auto=format&fit=crop"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Neutral scrim keeps the fabric colours honest; the directional
            gradient buys contrast for the text; the tint ties it to the brand. */}
        <div className="absolute inset-0 bg-brand-dark/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-dark via-brand-dark/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-brand-dark/40" />

        <div className="relative container mx-auto px-4 py-24">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white/10 text-white text-xs font-medium rounded-full mb-7 backdrop-blur-sm border border-white/20">
                {/* Tricolour dots: the 🇷🇼 emoji renders as the letters "RW" on Windows. */}
                <span className="flex gap-1" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                </span>
                {t('hero.badge')}
              </span>

              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.08] tracking-tight text-balance">
                {t('hero.title')}
              </h1>

              {/* Tricolour rule, echoing the flag. */}
              <div className="flex gap-1.5 mb-7" aria-hidden="true">
                <span className="h-1 w-16 rounded-full bg-brand-blue" />
                <span className="h-1 w-9 rounded-full bg-brand-gold" />
                <span className="h-1 w-5 rounded-full bg-brand-green" />
              </div>

              <p className="text-white/85 text-lg mb-9 max-w-xl leading-relaxed">
                {t('hero.subtitle')}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link to="/reservation" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-primary font-semibold rounded-xl hover:bg-brand-cream transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  {t('hero.cta_reserve')}
                  <ArrowRight size={18} />
                </Link>
                <Link to="/products" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 text-white font-medium rounded-xl backdrop-blur-sm hover:bg-white/20 transition-all border border-white/25">
                  {t('hero.cta_browse')}
                </Link>
              </div>

              {/* Trust points. Every claim here is true of the business —
                  no invented product counts or ratings. */}
              <ul className="flex flex-wrap gap-x-7 gap-y-3 mt-11 pt-8 border-t border-white/15">
                {['home.trust_reserve', 'home.trust_delivery', 'home.trust_languages'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 size={16} className="text-brand-gold shrink-0" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= Categories ================= */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-2">{t('home.collections_title')}</h2>
            <p className="text-muted-foreground">{t('home.collections_subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <motion.div key={cat.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <Link to={`/products?category=${cat.slug}`}
                    className="group flex flex-col h-full bg-card border border-border rounded-xl p-6 text-center items-center hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <span
                      className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}
                    >
                      <Icon size={24} strokeWidth={1.7} />
                    </span>
                    <h3 className="font-semibold text-sm md:text-base mb-1 group-hover:text-primary transition-colors">{t(cat.nameKey)}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t(cat.descKey)}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= Featured Products ================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <RailHeading
            title={t('home.featured')}
            subtitle={t('home.featured_subtitle')}
            viewAllTo="/products?featured=true"
            viewAllLabel={t('common.view_all')}
          />

          {featuredLoading ? (
            <ProductGridSkeleton count={4} />
          ) : featuredEmpty ? (
            <EmptyRail label={t('products.no_products')} cta={t('hero.cta_browse')} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {featuredData?.slice(0, 8).map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link to="/products?featured=true" className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-border rounded-lg text-sm font-medium">
              {t('common.view_all')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= How It Works ================= */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary/5 to-brand-gold/5 border-y border-border">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-2">{t('home.how_it_works')}</h2>
            <p className="text-muted-foreground">{t('home.no_payment')}</p>
          </motion.div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 max-w-5xl mx-auto">
            {/* Connector line behind the three steps on desktop. */}
            <span aria-hidden="true" className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-border" />

            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                  className="relative text-center">
                  <div className="relative z-10 mx-auto w-16 h-16 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center text-primary shadow-sm">
                    <Icon size={24} strokeWidth={1.7} />
                    <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center border-2 border-background">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mt-5 mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mt-14">
            <Link to="/reservation" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-md">
              {t('home.cta_button')} <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================= New Arrivals ================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <RailHeading
            title={t('home.new_arrivals')}
            subtitle={t('home.new_arrivals_subtitle')}
            viewAllTo="/products?newArrival=true"
            viewAllLabel={t('common.view_all')}
          />

          {newLoading ? (
            <ProductGridSkeleton count={4} />
          ) : newArrivalsEmpty ? (
            <EmptyRail label={t('products.no_products')} cta={t('hero.cta_browse')} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {newArrivalsData?.slice(0, 8).map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="py-20 bg-gradient-to-r from-primary to-brand-crimson text-white relative overflow-hidden">
        <div aria-hidden="true" className="absolute top-0 inset-x-0 h-1 bg-brand-gold" />
        <div className="container mx-auto px-4 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 text-balance">{t('home.cta_title')}</h2>
            <p className="text-white/80 text-lg mb-9 max-w-lg mx-auto">{t('home.cta_subtitle')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/reservation" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-brand-cream transition-all shadow-lg hover:-translate-y-0.5 text-lg">
                {t('home.cta_button')} <ArrowRight size={20} />
              </Link>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/15 text-white font-semibold rounded-xl hover:bg-white/25 transition-all border border-white/30 text-lg backdrop-blur-sm">
                <MessageCircle size={20} /> {t('home.whatsapp_us')}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= Testimonials ================= */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <h2 className="font-serif text-3xl md:text-4xl font-bold">{t('home.testimonials')}</h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {testimonials.slice(0, 3).map((testimonial, i) => (
                <motion.figure key={testimonial.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6 flex flex-col">
                  <div className="flex gap-0.5 text-brand-gold" role="img" aria-label={`${testimonial.rating} / 5`}>
                    {Array.from({ length: testimonial.rating }).map((_, j) => <Star key={j} size={14} fill="currentColor" strokeWidth={0} />)}
                  </div>
                  <blockquote className="text-muted-foreground text-sm mt-4 mb-5 leading-relaxed line-clamp-3 flex-1">
                    "{testimonial.message}"
                  </blockquote>
                  <figcaption className="flex items-center gap-3 pt-4 border-t border-border">
                    <span className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {testimonial.customerName[0]}
                    </span>
                    <span className="font-medium text-sm">{testimonial.customerName}</span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= Find Us ================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t('home.location')}</h2>
              <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">{t('home.visit_desc')}</p>

              <ul className="space-y-4">
                {[
                  { icon: MapPin, node: <span>{t('home.address')}</span> },
                  { icon: CheckCircle2, node: <span>{t('home.hours')}</span> },
                  { icon: Phone, node: <a href={`tel:${BUSINESS_PHONE_CLEAN}`} className="hover:text-primary transition-colors">{BUSINESS_PHONE}</a> },
                ].map(({ icon: Icon, node }, i) => (
                  <li key={i} className="flex items-center gap-3.5 text-sm">
                    <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    {node}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3 mt-8">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${BUSINESS_LAT},${BUSINESS_LNG}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
                >
                  {t('home.get_directions')} <ArrowRight size={16} />
                </a>
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-brand-green/50 text-brand-green font-medium rounded-xl hover:bg-brand-green hover:text-white transition-colors">
                  <MessageCircle size={16} /> {t('home.whatsapp_us')}
                </a>
              </div>
            </motion.div>

            {/* Live Google map. Uses the Embed API when a key is set, otherwise
                the keyless share-embed so a map always renders. */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="rounded-2xl overflow-hidden border border-border h-80 lg:h-96 bg-muted shadow-sm">
              <iframe
                title="DENISE Textile — Kigali, Rwanda"
                src={mapSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
