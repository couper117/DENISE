import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Star, CheckCircle2, MapPin, Phone } from 'lucide-react';
import { productsApi, adminApi } from '../lib/api';
import { Product, Testimonial } from '../types';
import ProductCard from '../components/products/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';

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
    { icon: '🔍', title: t('home.step1_title'), desc: t('home.step1_desc') },
    { icon: '📋', title: t('home.step2_title'), desc: t('home.step2_desc') },
    { icon: '🏪', title: t('home.step3_title'), desc: t('home.step3_desc') },
  ];

  const categories = [
    { nameKey: 'home.cat_curtains_name', descKey: 'home.cat_curtains_desc', slug: 'curtains', icon: '🪟' },
    { nameKey: 'home.cat_traditional_name', descKey: 'home.cat_traditional_desc', slug: 'traditional-attire', icon: '👘' },
    { nameKey: 'home.cat_fabrics_name', descKey: 'home.cat_fabrics_desc', slug: 'fabrics', icon: '🧵' },
    { nameKey: 'home.cat_accessories_name', descKey: 'home.cat_accessories_desc', slug: 'accessories', icon: '🔧' },
  ];

  const stats = [
    { value: '500+', labelKey: 'home.stat_products' },
    { value: '1000+', labelKey: 'home.stat_customers' },
    { value: '5★', labelKey: 'home.stat_rating' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center bg-gradient-to-br from-brand-dark via-primary/90 to-brand-crimson overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558171813-d3fcd69cf19b?w=1920')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20" />

        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full mb-4 backdrop-blur-sm">
                🇷🇼 {t('hero.badge')}
              </span>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight text-balance">
                {t('hero.title')}
              </h1>
              <p className="text-white/80 text-lg mb-8 max-w-xl">
                {t('hero.subtitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/reservation" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl">
                  {t('hero.cta_reserve')}
                  <ArrowRight size={18} />
                </Link>
                <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-xl backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20">
                  {t('hero.cta_browse')}
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating stats */}
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4">
          {stats.map((stat) => (
            <div key={stat.labelKey} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center text-white">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-white/70">{t(stat.labelKey)}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold mb-2">{t('home.collections_title')}</h2>
            <p className="text-muted-foreground">{t('home.collections_subtitle')}</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <motion.div key={cat.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Link to={`/products?category=${cat.slug}`}
                  className="group block bg-card border border-border rounded-xl p-6 text-center hover:border-primary hover:shadow-md transition-all">
                  <div className="text-4xl mb-3">{cat.icon}</div>
                  <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{t(cat.nameKey)}</h3>
                  <p className="text-xs text-muted-foreground">{t(cat.descKey)}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl font-bold">{t('home.featured')}</h2>
              <p className="text-muted-foreground mt-1">{t('home.featured_subtitle')}</p>
            </div>
            <Link to="/products?featured=true" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              {t('common.view_all')} <ArrowRight size={14} />
            </Link>
          </div>
          {featuredLoading ? <ProductGridSkeleton count={4} /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredData?.slice(0, 8).map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-brand-gold/5">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold mb-2">{t('home.how_it_works')}</h2>
            <p className="text-muted-foreground">{t('home.no_payment')}</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                  {step.icon}
                </div>
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3 -mt-8 translate-x-8">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl font-bold">{t('home.new_arrivals')}</h2>
              <p className="text-muted-foreground mt-1">{t('home.new_arrivals_subtitle')}</p>
            </div>
            <Link to="/products?newArrival=true" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              {t('common.view_all')} <ArrowRight size={14} />
            </Link>
          </div>
          {newLoading ? <ProductGridSkeleton count={4} /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newArrivalsData?.slice(0, 8).map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-brand-crimson text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t('home.cta_title')}</h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">{t('home.cta_subtitle')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/reservation" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg text-lg">
                {t('home.cta_button')} <ArrowRight size={20} />
              </Link>
              <a href="https://wa.me/250780000000" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all border border-white/30 text-lg">
                💬 {t('home.whatsapp_us')}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
              <h2 className="font-serif text-3xl font-bold mb-2">{t('home.testimonials')}</h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.slice(0, 3).map((testimonial, i) => (
                <motion.div key={testimonial.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6">
                  <div className="flex text-yellow-400 mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, j) => <Star key={j} size={14} fill="currentColor" />)}
                  </div>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">"{testimonial.message}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {testimonial.customerName[0]}
                    </div>
                    <span className="font-medium text-sm">{testimonial.customerName}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Map / Location */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="font-serif text-3xl font-bold mb-4">{t('home.location')}</h2>
              <p className="text-muted-foreground mb-6">{t('home.visit_desc')}</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin size={16} className="text-primary shrink-0" />
                  <span>{t('home.address')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="text-primary shrink-0" />
                  <a href="tel:+250780000000" className="hover:text-primary transition-colors">+250 780 000 000</a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span>{t('home.hours')}</span>
                </div>
              </div>
              <Link to="/contact" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors">
                {t('home.get_directions')} <ArrowRight size={16} />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="rounded-2xl overflow-hidden border border-border h-80 bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground p-8">
                <MapPin size={48} className="mx-auto mb-3 text-primary/30" />
                <p className="text-sm">Google Maps</p>
                <p className="text-xs mt-1">Add GOOGLE_MAPS_API_KEY to enable</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
