import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Award, Users, MapPin, Heart } from 'lucide-react';

const About = () => {
  const { t } = useTranslation();

  const values = [
    { icon: Award, titleKey: 'about.value1_title', descKey: 'about.value1_desc' },
    { icon: Users, titleKey: 'about.value2_title', descKey: 'about.value2_desc' },
    { icon: MapPin, titleKey: 'about.value3_title', descKey: 'about.value3_desc' },
    { icon: Heart, titleKey: 'about.value4_title', descKey: 'about.value4_desc' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 bg-gradient-to-br from-primary/10 to-brand-gold/10">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">{t('about.title')}</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('about.hero_subtitle')}</p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="font-serif text-3xl font-bold mb-4">{t('about.story')}</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>{t('about.story_p1')}</p>
                <p>{t('about.story_p2')}</p>
                <p>{t('about.story_p3')}</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="aspect-square bg-muted rounded-2xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1558171813-d3fcd69cf19b?w=600" alt="DENISE Textile Store" className="w-full h-full object-cover" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold mb-2">{t('about.values')}</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, titleKey, descKey }, i) => (
              <motion.div key={titleKey} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon size={22} className="text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
