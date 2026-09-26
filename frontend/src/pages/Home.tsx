import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
// Category and step icons are stored by name in the editable collections and
// resolved through cms/icons.ts, so an editor can change them without code.
import {
  ArrowRight, Star, MapPin, Phone, MessageCircle, PackageOpen, Clock, Truck, Smartphone, Ruler, Store, Moon, Sun,
} from 'lucide-react';
import { productsApi, contentApi } from '../lib/api';
import { Product, Testimonial } from '../types';
import ProductCard from '../components/products/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';
import Seo from '../components/Seo';
import { EditableIcon, EditableList, EditableText } from '../cms';
import {
  BUSINESS_PHONE, BUSINESS_PHONE_CLEAN, WHATSAPP_LINK, BUSINESS_LAT, BUSINESS_LNG,
} from '../lib/config';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/* Hero photo: bolts of fabric shot from above, served at several widths so a
   phone doesn't pull the 3000px original for a 400px viewport. */
const heroSrc = (w: number) =>
  `https://images.unsplash.com/photo-1783538690103-782ddd5404c1?fm=jpg&q=60&w=${w}&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA==`;

const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } };

/* Section heading shared by the product rails. Takes content keys so each
   rail's copy is independently editable on the page. */
const RailHeading = ({ eyebrowKey, titleKey, subtitleKey, viewAllTo }: { eyebrowKey?: string; titleKey: string; subtitleKey: string; viewAllTo: string }) => (
  <div className="mb-5 flex items-end justify-between gap-4 md:mb-8">
    <div>
      {eyebrowKey && <EditableText id={eyebrowKey} as="p" className="eyebrow mb-2" />}
      <EditableText id={titleKey} as="h2" className="section-title" />
      <EditableText id={subtitleKey} as="p" className="mt-2 text-muted-foreground" />
    </div>
    <Link to={viewAllTo} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary sm:btn sm:btn-outline sm:btn-sm sm:text-foreground">
      <EditableText id="common.view_all" /> <ArrowRight size={14} />
    </Link>
  </div>
);

interface Step { icon: string; title: string; desc: string }
interface Category { name: string; desc: string; slug: string; icon: string; color: string }

const STEP_FIELDS = [
  { name: 'title', type: 'TEXT' as const, label: 'Title' },
  { name: 'desc', type: 'TEXT' as const, label: 'Description' },
  { name: 'icon', type: 'ICON' as const, label: 'Icon' },
];

const CATEGORY_FIELDS = [
  { name: 'name', type: 'TEXT' as const, label: 'Name' },
  { name: 'desc', type: 'TEXT' as const, label: 'Description' },
  { name: 'icon', type: 'ICON' as const, label: 'Icon' },
  { name: 'color', type: 'COLOR' as const, label: 'Accent colour' },
  { name: 'slug', type: 'TEXT' as const, label: 'Category slug', placeholder: 'curtains' },
];

const EmptyRail = () => (
  <div className="surface flex flex-col items-center py-16 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><PackageOpen size={22} className="text-muted-foreground" /></span>
    <EditableText id="products.no_products" as="p" className="mt-4 text-muted-foreground" />
    <Link to="/products" className="btn btn-dark btn-sm mt-4"><EditableText id="hero.cta_browse" /> <ArrowRight size={14} /></Link>
  </div>
);

/* Phones swipe through a rail (two and a bit cards visible) instead of
   scrolling past eight stacked cards; from lg it is a normal grid. */
const rail = '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden';
const railItem = 'w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto';

const primaryImage = (p?: Product) => (p?.images?.find((i) => i.isPrimary) || p?.images?.[0])?.url;

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
    queryFn: () => contentApi.getTestimonials().then((r) => r.data.data as Testimonial[]),
    staleTime: 10 * 60 * 1000,
  });

  const steps: Step[] = [
    { icon: 'Ruler', title: t('home.step1_title'), desc: t('home.step1_desc') },
    { icon: 'Smartphone', title: t('home.step2_title'), desc: t('home.step2_desc') },
    { icon: 'Truck', title: t('home.step3_title'), desc: t('home.step3_desc') },
  ];

  const categories: Category[] = [
    { name: t('home.cat_curtains_name'), desc: t('home.cat_curtains_desc'), slug: 'curtains', icon: 'Blinds', color: '#8B1A1A' },
    { name: t('home.cat_fabrics_name'), desc: t('home.cat_fabrics_desc'), slug: 'fabrics', icon: 'Layers', color: '#C8972A' },
    { name: t('home.cat_traditional_name'), desc: t('home.cat_traditional_desc'), slug: 'traditional-attire', icon: 'Shirt', color: '#006B3C' },
    { name: t('home.cat_rods_name', { defaultValue: 'Curtain rods' }), desc: t('home.cat_rods_desc', { defaultValue: 'Rods sized to your window' }), slug: 'curtain-rods', icon: 'Package', color: '#0057A8' },
  ];

  // Each collection tile shows a real product photo from that category, so a
  // visitor sees what the shop actually sells rather than an icon.
  const tileImages = useQueries({
    queries: categories.map((c) => ({
      queryKey: ['products', 'tile', c.slug],
      queryFn: () => productsApi.getAll({ category: c.slug, limit: 1, sortBy: 'viewCount', sortOrder: 'desc' }).then((r) => primaryImage((r.data.data as Product[])[0])),
      staleTime: 10 * 60 * 1000,
    })),
  });
  const imageFor = (slug: string) => tileImages[categories.findIndex((c) => c.slug === slug)]?.data;

  const featuredEmpty = !featuredLoading && (featuredData?.length ?? 0) === 0;
  const newArrivalsEmpty = !newLoading && (newArrivalsData?.length ?? 0) === 0;

  const mapSrc = MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${BUSINESS_LAT},${BUSINESS_LNG}&zoom=15`
    : `https://www.google.com/maps?q=${BUSINESS_LAT},${BUSINESS_LNG}&z=15&output=embed`;

  const values = [
    { icon: Truck, key: 'home.value_delivery' },
    { icon: Smartphone, key: 'home.value_momo' },
    { icon: Ruler, key: 'home.value_measure' },
    { icon: Store, key: 'home.value_shop' },
  ];

  return (
    <div>
      <Seo
        path="/"
        title="DENISE Textile Rwanda — Curtains, Amarido & Imyenda Gakondo in Kigali | deniseshop.com"
        description="DENISE (New Textile Social Company) — shop curtains (amarido), fabrics, imikenyero, imishanana and traditional Rwandan attire online. Delivery across Rwanda or visit our Kigali store."
      />

      {/* ================= Hero =================
          Phones: one full-screen photo with the message on top of it — the
          image is what sells fabric, so it must not sit below the fold.
          Desktop: text and photo side by side. One markup, two layouts. */}
      <section className="lg:shop-container lg:pt-10">
        <div className="relative grid min-h-[calc(100svh-12rem)] items-end overflow-hidden lg:min-h-0 lg:grid-cols-12 lg:items-center lg:gap-12 lg:overflow-visible">
          <motion.div initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0 lg:relative lg:inset-auto lg:order-2 lg:col-span-6">
            <div className="relative h-full w-full overflow-hidden bg-muted lg:aspect-[5/6] lg:h-auto lg:rounded-3xl">
              <img
                src={heroSrc(1200)}
                srcSet={[600, 900, 1200, 1600].map((w) => `${heroSrc(w)} ${w}w`).join(', ')}
                sizes="(min-width: 1024px) 50vw, 100vw"
                alt={t('home.hero_alt', { defaultValue: 'Rolls of fabric at the DENISE shop in Kigali' })}
                className="h-full w-full object-cover"
                loading="eager"
                // React 18 doesn't know fetchPriority yet; the lowercase attribute passes through.
                {...{ fetchpriority: 'high' }}
              />
              {/* Scrim for the text on phones only. */}
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10 lg:hidden" />
            </div>
            {/* The one thing competitors don't do online: we do the maths. */}
            <Link
              to="/products?category=curtains"
              className="absolute -bottom-5 right-6 hidden w-80 items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lift backdrop-blur lg:flex"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Ruler size={20} /></span>
              <span className="min-w-0">
                <EditableText id="home.hero_card_title" as="span" className="block text-sm font-semibold" />
                <EditableText id="home.hero_card_text" as="span" className="block text-xs text-muted-foreground" />
              </span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 px-4 pb-8 pt-28 text-white sm:px-6 lg:order-1 lg:col-span-6 lg:p-0 lg:text-foreground">
            <EditableText id="hero.badge" as="p" label="Hero badge" className="inline-block rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm lg:bg-transparent lg:p-0 lg:text-xs lg:text-primary lg:backdrop-blur-none" />
            <EditableText
              id="hero.title" as="h1" label="Hero title"
              className="mt-3 font-serif text-[2.35rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:mt-4 lg:text-6xl"
            />
            <EditableText
              id="hero.subtitle" as="p" multiline label="Hero subtitle"
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 line-clamp-3 md:text-lg lg:mt-5 lg:line-clamp-none lg:text-muted-foreground"
            />
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:gap-3 lg:mt-8">
              <Link to="/products?category=curtains" className="btn btn-primary px-4 py-3.5 sm:btn-lg">
                <EditableText id="hero.cta_reserve" label="Hero primary button" /> <ArrowRight size={17} />
              </Link>
              <Link to="/products" className="btn btn-glass px-4 py-3.5 sm:btn-lg lg:border-foreground/15 lg:bg-transparent lg:text-foreground lg:backdrop-blur-none lg:hover:bg-foreground/[0.03]">
                <EditableText id="hero.cta_browse" label="Hero secondary button" />
              </Link>
            </div>
            <ul className="mt-8 hidden flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground lg:flex">
              {['home.trust_reserve', 'home.trust_delivery', 'home.trust_languages'].map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> <EditableText id={key} />
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ================= Value strip ================= */}
      <section className="shop-container mt-6 md:mt-20">
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {values.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-3 py-3 md:gap-3 md:px-4 md:py-4">
              <Icon size={20} className="shrink-0 text-primary" />
              <EditableText id={key} className="text-[13px] font-medium leading-snug md:text-sm" />
            </li>
          ))}
        </ul>
      </section>

      {/* ================= Collections ================= */}
      <section className="shop-container py-12 md:py-20">
        <motion.div {...fadeUp} className="mb-8">
          <EditableText id="home.collections_eyebrow" as="p" className="eyebrow mb-2" />
          <EditableText id="home.collections_title" as="h2" className="section-title" />
          <EditableText id="home.collections_subtitle" as="p" className="section-lead" />
        </motion.div>

        <EditableList<Category>
          id="home.category_cards"
          label="Collection cards"
          as="div"
          className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4"
          fields={CATEGORY_FIELDS}
          fallback={categories}
        >
          {(cat, i) => {
            const img = imageFor(cat.slug);
            return (
              <motion.div key={`${cat.slug}-${i}`} {...fadeUp} transition={{ delay: i * 0.06 }}>
                <Link to={`/products?category=${cat.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl" style={{ backgroundColor: `${cat.color}1A` }}>
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center" style={{ color: cat.color }}>
                      <EditableIcon id={`home.category_cards.${i}.icon`} fallback={cat.icon} size={48} />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-4 text-white md:p-5">
                    <span className="block font-serif text-lg font-semibold md:text-2xl">{cat.name}</span>
                    <span className="mt-0.5 hidden text-sm text-white/80 sm:block">{cat.desc}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider">
                      <EditableText id="home.shop_now" /> <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </span>
                </Link>
              </motion.div>
            );
          }}
        </EditableList>
      </section>

      {/* ================= Featured ================= */}
      <section className="shop-container pb-12 md:pb-20">
        <RailHeading titleKey="home.featured" subtitleKey="home.featured_subtitle" viewAllTo="/products?featured=true" />
        {featuredLoading ? <ProductGridSkeleton count={4} /> : featuredEmpty ? <EmptyRail /> : (
          <div className={rail}>
            {featuredData?.slice(0, 8).map((product, i) => <div key={product.id} className={railItem}><ProductCard product={product} index={i} /></div>)}
          </div>
        )}
      </section>

      {/* ================= Made to measure ================= */}
      <section className="bg-brand-dark text-white dark:bg-card">
        <div className="shop-container grid gap-8 py-12 md:gap-10 md:py-20 lg:grid-cols-12 lg:items-center">
          <motion.div {...fadeUp} className="lg:col-span-5">
            <EditableText id="home.measure_eyebrow" as="p" className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold" />
            <EditableText id="home.measure_title" as="h2" className="mt-3 font-serif text-3xl font-semibold tracking-tight md:text-4xl" />
            <EditableText id="home.measure_text" as="p" multiline className="mt-4 leading-relaxed text-white/75 dark:text-muted-foreground" />
            <Link to="/products?category=hard-curtains" className="btn btn-light btn-lg mt-8">
              <EditableText id="home.measure_cta" /> <ArrowRight size={18} />
            </Link>
          </motion.div>
          <ol className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
            {[
              { icon: Ruler, t: 'home.measure_s1_title', d: 'home.measure_s1_text' },
              { icon: Moon, t: 'home.measure_s2_title', d: 'home.measure_s2_text' },
              { icon: Sun, t: 'home.measure_s3_title', d: 'home.measure_s3_text' },
            ].map(({ icon: Icon, t: tk, d }, i) => (
              <motion.li key={tk} {...fadeUp} transition={{ delay: i * 0.08 }} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="flex items-center gap-2 text-brand-gold"><Icon size={18} /><span className="text-xs font-bold">0{i + 1}</span></span>
                <EditableText id={tk} as="h3" className="mt-4 font-semibold" />
                <EditableText id={d} as="p" className="mt-1.5 text-sm leading-relaxed text-white/70 dark:text-muted-foreground" />
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= How to buy ================= */}
      <section className="shop-container py-12 md:py-20">
        <motion.div {...fadeUp} className="mb-10 text-center">
          <EditableText id="home.how_it_works" as="h2" className="section-title" />
          <EditableText id="home.no_payment" as="p" className="section-lead mx-auto" />
        </motion.div>
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <EditableList<Step> id="home.steps" label="How it works steps" fields={STEP_FIELDS} fallback={steps}>
            {(step, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }} className="surface flex gap-4 p-4 md:block md:p-6">
                <div className="flex shrink-0 items-center justify-between">
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary md:h-12 md:w-12">
                    <EditableIcon id={`home.steps.${i}.icon`} fallback={step.icon} size={21} />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background md:hidden">{i + 1}</span>
                  </span>
                  <span className="hidden font-serif text-3xl font-semibold text-muted-foreground/30 md:inline">0{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold md:mt-5 md:text-lg">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:mt-1.5">{step.desc}</p>
                </div>
              </motion.div>
            )}
          </EditableList>
        </div>
      </section>

      {/* ================= New arrivals ================= */}
      <section className="shop-container pb-12 md:pb-20">
        <RailHeading titleKey="home.new_arrivals" subtitleKey="home.new_arrivals_subtitle" viewAllTo="/products?newArrival=true" />
        {newLoading ? <ProductGridSkeleton count={4} /> : newArrivalsEmpty ? <EmptyRail /> : (
          <div className={rail}>
            {newArrivalsData?.slice(0, 8).map((product, i) => <div key={product.id} className={railItem}><ProductCard product={product} index={i} /></div>)}
          </div>
        )}
      </section>

      {/* ================= Testimonials ================= */}
      {testimonials && testimonials.length > 0 && (
        <section className="bg-muted/50 py-12 md:py-20">
          <div className="shop-container">
            <motion.div {...fadeUp} className="mb-10 text-center">
              <EditableText id="home.testimonials" as="h2" className="section-title" />
            </motion.div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
              {testimonials.slice(0, 3).map((testimonial, i) => (
                <motion.figure key={testimonial.id} {...fadeUp} transition={{ delay: i * 0.08 }} className="surface flex w-[85%] shrink-0 snap-start flex-col p-5 md:w-auto md:p-6">
                  <div className="flex gap-0.5 text-amber-400" role="img" aria-label={`${testimonial.rating} / 5`}>
                    {Array.from({ length: testimonial.rating }).map((_, j) => <Star key={j} size={15} fill="currentColor" strokeWidth={0} />)}
                  </div>
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">“{testimonial.message}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{testimonial.customerName[0]}</span>
                    <span className="text-sm font-medium">{testimonial.customerName}</span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= Visit us ================= */}
      <section className="shop-container py-12 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <EditableText id="home.location_eyebrow" as="p" className="eyebrow mb-2" />
            <EditableText id="home.location" as="h2" className="section-title" />
            <EditableText id="home.visit_desc" as="p" multiline className="section-lead" />
            <ul className="mt-8 space-y-4">
              {[
                { icon: MapPin, node: <EditableText id="home.address" /> },
                { icon: Clock, node: <EditableText id="home.hours" /> },
                { icon: Phone, node: <a href={`tel:+${BUSINESS_PHONE_CLEAN}`} className="hover:text-primary">{BUSINESS_PHONE}</a> },
              ].map(({ icon: Icon, node }, i) => (
                <li key={i} className="flex items-center gap-3.5 text-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={17} /></span>
                  {node}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${BUSINESS_LAT},${BUSINESS_LNG}`} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
                <EditableText id="home.get_directions" /> <ArrowRight size={16} />
              </a>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn bg-[#1f8f4e] text-white hover:bg-[#197a42]">
                <MessageCircle size={16} /> <EditableText id="home.whatsapp_us" />
              </a>
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="h-80 overflow-hidden rounded-3xl border border-border bg-muted lg:h-[26rem]">
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
      </section>
    </div>
  );
};

export default Home;
