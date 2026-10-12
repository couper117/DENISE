import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminApi } from './api';
import { toast } from '../components/ui/Toaster';

/**
 * New-order / new-message alerts for an open admin panel.
 *
 * Every 15 s (and when the tab comes back into view) the panel asks the API
 * what arrived since the last check. Each new order or reservation, and each
 * new chat message from a customer, plays a chime, shows a toast and — when
 * the admin allowed it and the tab is in the background — a desktop
 * notification. Works while the admin panel is open in any tab; it is not a
 * phone push notification.
 *
 * Browsers only allow sound after the person has interacted with the page, so
 * the audio is unlocked on the first click anywhere in the admin.
 */

const POLL_MS = 15_000;
const SOUND_KEY = 'denise-admin-sound';

interface AlertOrder { id: string; reservationNumber: string; customerName: string; fulfillmentType: string; totalAmount: number | null }
interface AlertMessage { id: string; body: string; conversationId: string; customerName: string }

let audioCtx: AudioContext | null = null;
const getAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
};

/** A short two-note chime; `times` repeats it (orders ring twice). */
const playChime = (times = 1) => {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const start = ctx.currentTime + 0.02;
  for (let r = 0; r < times; r++) {
    [[880, 0], [1318.5, 0.16]].forEach(([freq, offset]) => {
      const t = start + r * 0.6 + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }
};

const money = (v: number | null) => (v ? `${Math.round(v).toLocaleString()} RWF` : '');

export const useAdminAlerts = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sinceRef = useRef<string | null>(null);
  const missedRef = useRef(0);
  const baseTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');
  const [unreadChats, setUnreadChats] = useState(0);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
  });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // Unlock audio on the first interaction (browser autoplay rules).
  useEffect(() => {
    const unlock = () => { const ctx = getAudio(); if (ctx?.state === 'suspended') ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const desktop = useCallback((title: string, body: string, link: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    try {
      const n = new Notification(title, { body, icon: '/favicon-32x32.png', tag: link });
      n.onclick = () => { window.focus(); window.location.assign(link); n.close(); };
    } catch { /* some mobile browsers only allow notifications from a service worker */ }
  }, []);

  const check = useCallback(async () => {
    try {
      const res = await adminApi.getAlerts(sinceRef.current ?? undefined);
      const data = res.data.data as { now: string; orders: AlertOrder[]; messages: AlertMessage[]; unreadChats: number };
      const firstRun = sinceRef.current === null;
      sinceRef.current = data.now;
      setUnreadChats(data.unreadChats);
      if (firstRun) return; // only things that arrive after the panel opened

      for (const o of data.orders) {
        const isReservation = o.fulfillmentType === 'RESERVATION';
        const title = isReservation ? t('admin.alert_new_reservation', { defaultValue: 'New reservation' }) : t('admin.alert_new_order', { defaultValue: 'New order' });
        const body = [o.reservationNumber, o.customerName, money(o.totalAmount)].filter(Boolean).join(' · ');
        toast({ title, description: body, variant: 'success' });
        desktop(title, body, '/admin/reservations');
      }
      for (const m of data.messages) {
        const title = t('admin.alert_new_message', { defaultValue: 'New message from {{name}}', name: m.customerName });
        toast({ title, description: m.body });
        desktop(title, m.body, '/admin/messages');
      }

      const count = data.orders.length + data.messages.length;
      if (count > 0) {
        if (soundRef.current) playChime(data.orders.length > 0 ? 2 : 1);
        queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['admin-chats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-chat'] });
        if (document.hidden) {
          missedRef.current += count;
          document.title = `(${missedRef.current}) ${baseTitleRef.current}`;
        }
      }
    } catch { /* offline or logged out: try again on the next tick */ }
  }, [desktop, queryClient, t]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.hidden) return;
      missedRef.current = 0;
      document.title = baseTitleRef.current;
      check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [check]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
    if (next) playChime(1); // also unlocks audio and lets the admin hear it
  };

  const enableDesktop = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  return { unreadChats, soundOn, toggleSound, permission, enableDesktop, testChime: () => playChime(2) };
};
