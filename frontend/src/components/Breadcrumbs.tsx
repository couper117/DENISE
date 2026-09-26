import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  /** Link target for intermediate crumbs. The last crumb is rendered as plain text. */
  to?: string;
}

/**
 * "You are here" trail: Home › … › current page. Helps users see where they are
 * and jump back a level. Render it at the top of a page's content.
 */
const Breadcrumbs = ({ items }: { items: Crumb[] }) => {
  const { t } = useTranslation();
  // Phones get one "‹ parent" link instead of the whole trail: it is what
  // people use the trail for, and it keeps the page title near the top.
  const parent = [...items].reverse().find((c, i) => i > 0 && c.to) ?? items.slice(0, -1).reverse().find((c) => c.to);
  return (
    <nav aria-label="Breadcrumb" className="mb-4 sm:mb-5">
      <Link to={parent?.to ?? '/'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:hidden">
        <ChevronLeft size={16} /> {parent?.label ?? t('nav.home')}
      </Link>
      <ol className="hidden items-center flex-wrap gap-1.5 text-sm text-muted-foreground sm:flex">
        <li>
          <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors">
            <Home size={14} />
            <span className="sr-only sm:not-sr-only">{t('nav.home')}</span>
          </Link>
        </li>
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight size={14} className="shrink-0 text-muted-foreground/50" />
              {c.to && !isLast ? (
                <Link to={c.to} className="hover:text-primary transition-colors">{c.label}</Link>
              ) : (
                <span className="text-foreground font-medium truncate max-w-[60vw] sm:max-w-xs" aria-current="page">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
