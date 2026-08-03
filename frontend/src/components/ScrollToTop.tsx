import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to the top on every route change. Without this, React Router keeps the
 * previous scroll position, so a link clicked from the footer opens the next page
 * scrolled to the bottom. Keyed on pathname only, so query/hash changes (e.g.
 * /track?ref=…) don't yank the page.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

export default ScrollToTop;
