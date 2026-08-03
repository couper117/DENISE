import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Target, Compass } from 'lucide-react';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { EditableIcon, EditableImage, EditableList, EditableText } from '../cms';

/* Both photos are hotlinked from Unsplash and verified to resolve — the previous
   store photo (photo-1558171813…) had been removed from Unsplash and rendered as
   a grey box. Swap these for the shop's own photography before launch: same
   <img>, new src. */
const swatchesSrc = (w: number) =>
  `https://images.unsplash.com/photo-1601056639638-c53c50e13ead?w=${w}&q=75&auto=format&fit=crop`;
const linenSrc = (w: number) =>
  `https://images.unsplash.com/photo-1616627561950-9f746e330187?w=${w}&q=75&auto=format&fit=crop`;

const srcSetOf = (make: (w: number) => string, widths: number[]) =>
  widths.map((w) => `${make(w)} ${w}w`).join(', ');

/**
 * One brand colour per value, matching the home page's category tiles.
 *
 * Icons are stored by *name* rather than as components so the whole list is
 * plain JSON — that is what lets an editor add, remove and reorder entries
 * without a developer. Titles stay as i18n keys and are resolved at render
 * time, so this array remains the translated default until someone overrides it.
 */
const VALUE_DEFAULTS = [
  { icon: 'Award', titleKey: 'about.value1_title', descKey: 'about.value1_desc', color: '#8B1A1A' },
  { icon: 'Users', titleKey: 'about.value2_title', descKey: 'about.value2_desc', color: '#006B3C' },
  { icon: 'MapPin', titleKey: 'about.value3_title', descKey: 'about.value3_desc', color: '#C8972A' },
  { icon: 'Heart', titleKey: 'about.value4_title', descKey: 'about.value4_desc', color: '#0057A8' },
];

interface ValueCard {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

/** Shape of one entry, so the CMS can build a form for it. */
const VALUE_FIELDS = [
  { name: 'title', type: 'TEXT' as const, label: 'Title' },
  { name: 'desc', type: 'TEXT' as const, label: 'Description' },
  { name: 'icon', type: 'ICON' as const, label: 'Icon' },
  { name: 'color', type: 'COLOR' as const, label: 'Accent colour' },
];

/* Three flag stripes. The 🇷🇼 emoji renders as the letters "RW" on Windows
   Chrome, so the flag is always drawn, never typed. */
const TricolourRule = ({ className = '' }: { className?: string }) => (
  <div className={`flex gap-1.5 ${className}`} aria-hidden="true">
    <span className="h-1 w-16 rounded-full bg-brand-blue" />
    <span className="h-1 w-9 rounded-full bg-brand-gold" />
    <span className="h-1 w-5 rounded-full bg-brand-green" />
  </div>
);

const About = () => {
  const { t } = useTranslation();

  // Translated defaults for the value cards. Resolved here rather than baked
  // into the module so switching language still changes them until an editor
  // overrides the list for that locale.
  const valueCards: ValueCard[] = VALUE_DEFAULTS.map((v) => ({
    icon: v.icon,
    title: t(v.titleKey),
    desc: t(v.descKey),
    color: v.color,
  }));

  return (
    <div>
      <Seo
        path="/about"
        title="About DENISE Textile — New Textile Social Company, Kigali"
        description="DENISE Textile (New Textile Social Company Limited) is Kigali's home for curtains, fabrics and traditional Rwandan attire. Learn our story."
      />

      {/* Story — the page opens straight into it, so this heading is the h1. */}
      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <Breadcrumbs items={[{ label: t('nav.about') }]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <EditableText
                id="about.story"
                as="h1"
                label="Story heading"
                className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.12] tracking-tight"
              />
              <TricolourRule className="mt-5 mb-7" />

              {/* The first paragraph is the lead, so it is set larger than the
                  two that follow — this block used to be three flat greys. */}
              <EditableText id="about.story_p1" as="p" multiline label="Story paragraph 1"
                className="text-lg leading-relaxed text-foreground/90" />
              <EditableText id="about.story_p2" as="p" multiline label="Story paragraph 2"
                className="mt-5 text-muted-foreground leading-relaxed" />
              <EditableText id="about.story_p3" as="p" multiline label="Story paragraph 3"
                className="mt-5 text-muted-foreground leading-relaxed" />

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <EditableText id="common.view_all" /> <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-xl font-medium hover:border-primary hover:text-primary transition-colors"
                >
                  <EditableText id="nav.contact" />
                </Link>
              </div>
            </motion.div>

            {/* Capped width: at full column width the 4:5 frame stands ~825px
                tall against ~480px of text and the row fills with dead space. */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              {/* The gold block and the inset photo sit in the grid gutter, so
                  they only appear at lg where that gutter exists — narrower than
                  that they would push past the container and scroll sideways. */}
              <div aria-hidden="true" className="hidden lg:block absolute -top-5 -left-5 w-28 h-28 rounded-2xl bg-brand-gold/25" />

              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-border bg-muted shadow-lg">
                {/* The Unsplash URL is now just the default. Replacing it with
                    the shop's own photography is a click in edit mode, not a
                    code change. */}
                <EditableImage
                  id="about.story_image"
                  label="Story photo"
                  fallback={{
                    url: swatchesSrc(800),
                    alt: 'Folded fabric swatches from the DENISE Textile range',
                  }}
                  srcSet={(url) => (url === swatchesSrc(800) ? srcSetOf(swatchesSrc, [400, 600, 800, 1200]) : undefined)}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  imgClassName="w-full h-full object-cover"
                />
              </div>

              <div className="hidden lg:block absolute -bottom-8 -left-8 w-40 h-40 rounded-xl overflow-hidden border-4 border-background shadow-xl bg-muted">
                <EditableImage
                  id="about.story_image_inset"
                  label="Story inset photo"
                  fallback={{ url: linenSrc(400), alt: 'Striped linen soft furnishings' }}
                  srcSet={(url) => (url === linenSrc(400) ? srcSetOf(linenSrc, [300, 400, 600]) : undefined)}
                  sizes="160px"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision — the about.mission / about.vision strings already
          shipped in all five locales but had never been rendered anywhere. */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary/5 to-brand-gold/5 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {[
              { icon: Target, title: t('about.mission'), body: t('about.mission_desc'), color: '#8B1A1A' },
              { icon: Compass, title: t('about.vision'), body: t('about.vision_desc'), color: '#006B3C' },
            ].map(({ icon: Icon, title, body, color }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative bg-card border border-border rounded-2xl p-8 overflow-hidden shadow-sm">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}1A`, color }}
                >
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <h2 className="font-serif text-2xl font-bold mt-5 mb-3">{title}</h2>
                <p className="text-muted-foreground leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <EditableText id="about.values" as="h2" label="Values heading"
              className="font-serif text-3xl md:text-4xl font-bold" />
            <TricolourRule className="justify-center mt-5" />
          </motion.div>

          {/* Repeatable collection: an editor can add, remove and reorder cards
              without a developer. The fallback is built from the translated
              defaults, so with no override this renders exactly as before. */}
          <EditableList<ValueCard>
            id="about.value_cards"
            label="Value cards"
            as="div"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
            fields={VALUE_FIELDS}
            fallback={valueCards}
          >
            {(card, i) => (
              <motion.div key={`${card.title}-${i}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="group flex flex-col h-full bg-card border border-border rounded-xl p-6 text-center items-center hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${card.color}1A`, color: card.color }}
                >
                  <EditableIcon id={`about.value_cards.${i}.icon`} fallback={card.icon} size={24} />
                </span>
                <h3 className="font-semibold mb-1.5">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
              </motion.div>
            )}
          </EditableList>
        </div>
      </section>
    </div>
  );
};

export default About;
