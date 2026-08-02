import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = import.meta.env.VITE_GA_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Loads GA4 script once and tracks page_view on every route change
const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (!GA_ID) return;

    // Load gtag script if not already present
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function (...args: unknown[]) {
        window.dataLayer!.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, { send_page_view: false });

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(script);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
      send_to: GA_ID,
    });
  }, [location]);

  return null;
};

export default Analytics;
