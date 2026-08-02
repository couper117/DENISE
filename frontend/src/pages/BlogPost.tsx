import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Eye, ChevronLeft } from 'lucide-react';
import { blogsApi } from '../lib/api';
import { Blog } from '../types';
import { formatDate } from '../lib/utils';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const BlogPost = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => blogsApi.getBySlug(slug!).then((r) => r.data.data as Blog),
    enabled: !!slug,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="text-center py-20">{t('blog.not_found')} <Link to="/blog" className="text-primary">{t('blog.back')}</Link></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/blog" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft size={14} /> {t('blog.back')}
      </Link>

      {data.imageUrl && (
        <img src={data.imageUrl} alt={data.title} className="w-full aspect-video object-cover rounded-2xl mb-8" />
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1"><Calendar size={13} />{data.publishedAt ? formatDate(data.publishedAt) : ''}</div>
        <div className="flex items-center gap-1"><Eye size={13} />{data.viewCount} {t('blog.views')}</div>
        <span>{t('blog.by')} {data.authorName}</span>
      </div>

      <h1 className="font-serif text-3xl md:text-4xl font-bold mb-6">{data.title}</h1>

      <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {data.content}
      </div>
    </div>
  );
};

export default BlogPost;
