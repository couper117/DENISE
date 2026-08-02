import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Calendar, Eye } from 'lucide-react';
import { blogsApi } from '../lib/api';
import { Blog } from '../types';
import { formatDate, truncate } from '../lib/utils';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';

const BlogPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['blogs', { search, page }],
    queryFn: () => blogsApi.getAll({ search: search || undefined, page, limit: 9 }).then((r) => r.data),
  });

  const blogs: Blog[] = data?.data || [];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl font-bold mb-3">{t('blog.title')}</h1>
        <p className="text-muted-foreground">{t('blog.subtitle')}</p>
      </div>

      <div className="relative max-w-md mx-auto mb-10">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('blog.search')} className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {isLoading ? <ProductGridSkeleton count={6} /> : blogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <Link key={blog.id} to={`/blog/${blog.slug}`}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="aspect-video bg-muted overflow-hidden">
                {blog.imageUrl ? (
                  <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📝</div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">{blog.title}</h2>
                {blog.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{blog.excerpt}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Calendar size={12} />{blog.publishedAt ? formatDate(blog.publishedAt) : t('blog.draft')}</div>
                  <div className="flex items-center gap-1"><Eye size={12} />{blog.viewCount} {t('blog.views')}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p>{t('blog.no_articles')}</p>
        </div>
      )}
    </div>
  );
};

export default BlogPage;
