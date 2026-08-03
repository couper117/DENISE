import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cmsApi } from '../lib/api';
import { useAuthStore } from '../store';
import { primeFromCache, useCmsStore, writeCache } from './store';
import type { ContentType, ContentValue } from './types';

/**
 * The entire editing experience — outlines, toolbar, rich text, media library,
 * history — lives behind this dynamic import. Vite splits it into its own
 * chunk, so a visitor's browser never requests a byte of it.
 */
const EditorLayer = lazy(() => import('./editor/EditorLayer'));

export const SUPPORTED_LOCALES = ['en', 'rw', 'fr', 'sw', 'ln'];

/** i18next may report "en-US"; the API only knows the five base locales. */
export const normalizeLocale = (raw: string | undefined): string => {
  const base = (raw || 'en').split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : 'en';
};

interface ContentResponse {
  locale: string;
  blocks: Record<string, ContentValue>;
  types: Record<string, ContentType>;
  meta?: Record<string, never>;
}

/**
 * Wraps the app. Loads the content overlay for the current locale and, for
 * admins only, mounts the editor.
 *
 * Deliberately does not block rendering: children paint immediately from the
 * bundled i18n defaults (or the localStorage cache) and the fetched overrides
 * swap in when they arrive. Blocking here would put a network round trip in
 * front of first paint for every visitor.
 */
const CmsProvider = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canEdit = useCmsStore((s) => s.canEdit);
  const editMode = useCmsStore((s) => s.editMode);
  const storeLocale = useCmsStore((s) => s.locale);
  const [maintenance, setMaintenance] = useState(false);

  // Only admins ever get editing affordances. The server enforces this too —
  // this is the UI half of the same rule.
  useEffect(() => {
    const isAdmin = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN');
    useCmsStore.getState().setCanEdit(Boolean(isAdmin));
  }, [isAuthenticated, user?.role]);

  // Switching language swaps the whole overlay; drafts are per-locale.
  useEffect(() => {
    if (storeLocale !== locale) {
      useCmsStore.getState().setLocale(locale);
    } else if (!useCmsStore.getState().loaded) {
      primeFromCache(locale);
    }
  }, [locale, storeLocale]);

  // Published content for everyone; drafts once an admin turns edit mode on.
  useEffect(() => {
    let cancelled = false;
    const wantsDraft = canEdit && editMode;

    const load = async () => {
      try {
        const res = wantsDraft ? await cmsApi.getDraft(locale) : await cmsApi.getContent(locale);
        if (cancelled) return;

        const data = res.data.data as ContentResponse;
        useCmsStore.getState().hydrate({
          locale: data.locale ?? locale,
          blocks: data.blocks ?? {},
          types: data.types ?? {},
          meta: data.meta,
        });

        // Only published content is cached — a draft must never be able to leak
        // into what a signed-out visitor sees on this device.
        if (!wantsDraft) {
          writeCache({ locale, blocks: data.blocks ?? {}, types: data.types ?? {} });
        }
      } catch {
        // The site is fully functional on the bundled i18n defaults, so a CMS
        // outage degrades to "no overrides" rather than a broken page.
        if (!cancelled) useCmsStore.setState({ loaded: true });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [locale, canEdit, editMode]);

  // Site settings apply to everyone, so they are fetched alongside content and
  // written straight onto the document: CSS variables for theme colours, the
  // favicon link, and a maintenance gate.
  useEffect(() => {
    let cancelled = false;
    cmsApi
      .getSettings()
      .then((res) => {
        if (cancelled) return;
        const s = (res.data.data ?? {}) as Record<string, unknown>;
        const root = document.documentElement;

        // Written as raw hex on a separate variable rather than overwriting the
        // Tailwind HSL tokens, which expect "H S% L%" and would break if given
        // a hex value.
        for (const [key, cssVar] of [
          ['theme.primary', '--cms-primary'],
          ['theme.secondary', '--cms-secondary'],
          ['theme.accent', '--cms-accent'],
        ] as const) {
          const value = s[key];
          if (typeof value === 'string' && /^#(?:[0-9a-f]{3}){1,2}$/i.test(value)) {
            root.style.setProperty(cssVar, value);
          }
        }

        if (typeof s['site.favicon'] === 'string' && s['site.favicon']) {
          const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (link) link.href = s['site.favicon'] as string;
        }

        setMaintenance(Boolean(s['site.maintenance']));
      })
      .catch(() => {
        /* Settings are optional; the site has sensible defaults without them. */
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Admins keep full access during maintenance so the site can be checked
  // before it is turned back on.
  if (maintenance && !canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-serif text-3xl font-bold mb-3">We are making some changes</h1>
          <p className="text-muted-foreground">
            The site is briefly unavailable while we update it. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {canEdit && editMode && (
        <Suspense fallback={null}>
          <EditorLayer />
        </Suspense>
      )}
    </>
  );
};

export default CmsProvider;
