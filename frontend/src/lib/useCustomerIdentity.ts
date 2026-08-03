import { useMemo } from 'react';
import { useAuthStore } from '../store';

/**
 * The signed-in customer's details, in the shape the public forms ask for.
 *
 * One implementation so the reservation form, the order lookup and the review
 * form cannot drift apart on what "your details" means — and so that adding a
 * field later only has to happen here.
 */
export interface CustomerIdentity {
  isSignedIn: boolean;
  name: string;
  phone: string;
  email: string;
  language: string;
}

export const useCustomerIdentity = (): CustomerIdentity => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useMemo(() => {
    if (!isAuthenticated || !user) {
      return { isSignedIn: false, name: '', phone: '', email: '', language: '' };
    }
    return {
      isSignedIn: true,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      phone: user.phone ?? '',
      email: user.email ?? '',
      language: user.preferredLanguage ?? '',
    };
  }, [isAuthenticated, user]);
};

/**
 * Fill blank fields from the signed-in account without touching anything the
 * visitor has already typed.
 *
 * Prefilled fields stay editable on purpose: someone may be reserving on behalf
 * of a family member, or want delivery to a different phone.
 */
export const fillBlanks = <T extends Record<string, unknown>>(
  current: T,
  values: Partial<Record<keyof T, string>>
): T => {
  const next = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(values) as [keyof T, string][]) {
    if (value && !next[key]) {
      next[key] = value as T[keyof T];
      changed = true;
    }
  }
  return changed ? next : current;
};
