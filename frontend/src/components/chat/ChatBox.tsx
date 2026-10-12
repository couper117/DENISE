import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send } from 'lucide-react';
import { chatApi } from '../../lib/api';
import { useCustomerIdentity } from '../../lib/useCustomerIdentity';
import { cn } from '../../lib/utils';

interface ChatMessage { id: string; sender: 'CUSTOMER' | 'ADMIN'; body: string; createdAt: string }
interface ChatData { conversation: { token: string; customerName: string; status: string }; messages: ChatMessage[] }

const TOKEN_KEY = 'denise-chat-token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (v: string | null) => { try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

const inputClass = 'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

/**
 * Chat with the shop from the Contact page. The conversation's token stays in
 * this browser (localStorage) — it is the only key to the conversation, so the
 * visitor can come back to it later and nobody else can read it. Refreshes
 * every 5 s while the page is visible.
 */
const ChatBox = ({ hours }: { hours: string }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const identity = useCustomerIdentity();
  const [token, setToken] = useState<string | null>(readToken);
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (identity.isSignedIn) setForm((f) => ({ ...f, name: f.name || identity.name, phone: f.phone || identity.phone || '' }));
  }, [identity]);

  const { data, error: loadError } = useQuery({
    queryKey: ['chat', token],
    queryFn: () => chatApi.get(token!).then((r) => r.data.data as ChatData),
    enabled: !!token,
    refetchInterval: () => (document.hidden ? false : 5_000),
    retry: (count, err) => (err as { response?: { status?: number } })?.response?.status !== 404 && count < 2,
  });

  // A token that no longer exists (or was cleared on the server): start over.
  useEffect(() => {
    if ((loadError as { response?: { status?: number } } | null)?.response?.status === 404) { writeToken(null); setToken(null); }
  }, [loadError]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [data?.messages.length]);

  const start = useMutation({
    mutationFn: () => chatApi.start({ name: form.name.trim(), phone: form.phone.trim() || undefined, message: form.message.trim() }).then((r) => r.data.data as ChatData),
    onSuccess: (res) => {
      writeToken(res.conversation.token);
      setToken(res.conversation.token);
      queryClient.setQueryData(['chat', res.conversation.token], res);
      setError('');
    },
    onError: () => setError(t('chat.error', { defaultValue: 'The message could not be sent. Please try again.' })),
  });

  const send = useMutation({
    mutationFn: (message: string) => chatApi.send(token!, message),
    onSuccess: () => { setDraft(''); setError(''); queryClient.invalidateQueries({ queryKey: ['chat', token] }); },
    onError: () => setError(t('chat.error', { defaultValue: 'The message could not be sent. Please try again.' })),
  });

  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <section id="chat" className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircle size={19} /></span>
        <div className="min-w-0">
          <h2 className="font-semibold">{t('chat.title', { defaultValue: 'Chat with us' })}</h2>
          <p className="text-xs text-muted-foreground">{t('chat.hours_note', { defaultValue: 'We reply during opening hours: {{hours}}', hours })}</p>
        </div>
      </div>

      {!token ? (
        <form
          className="space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || !form.message.trim()) { setError(t('chat.fill_in', { defaultValue: 'Please write your name and a message.' })); return; }
            start.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80}
              placeholder={t('chat.name', { defaultValue: 'Your name' })} aria-label={t('chat.name', { defaultValue: 'Your name' })} className={inputClass} />
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={30} inputMode="tel"
              placeholder={t('chat.phone', { defaultValue: 'Phone (optional)' })} aria-label={t('chat.phone', { defaultValue: 'Phone (optional)' })} className={inputClass} />
          </div>
          <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4} maxLength={1000}
            placeholder={t('chat.message_placeholder', { defaultValue: 'How can we help? e.g. "Do you have blackout curtains for a 2.4 m window?"' })}
            aria-label={t('chat.message', { defaultValue: 'Your message' })} className={cn(inputClass, 'resize-none')} />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <button type="submit" disabled={start.isPending} className="btn btn-primary w-full sm:w-auto">
            <Send size={16} /> {t('chat.start', { defaultValue: 'Send message' })}
          </button>
        </form>
      ) : (
        <div className="flex h-[26rem] flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
            {(data?.messages ?? []).map((m) => (
              <div key={m.id} className={cn('flex', m.sender === 'CUSTOMER' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                  m.sender === 'CUSTOMER' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card')}>
                  {m.sender === 'ADMIN' && <span className="mb-0.5 block text-[11px] font-semibold text-primary">DENISE</span>}
                  {m.body}
                  <span className={cn('mt-1 block text-[10px]', m.sender === 'CUSTOMER' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{time(m.createdAt)}</span>
                </div>
              </div>
            ))}
            {data && data.messages.every((m) => m.sender === 'CUSTOMER') && (
              <p className="pt-1 text-center text-xs text-muted-foreground">{t('chat.waiting', { defaultValue: 'Thanks! Our team will reply here shortly.' })}</p>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (v && !send.isPending) send.mutate(v); }} className="flex items-end gap-2 border-t border-border p-3">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = draft.trim(); if (v && !send.isPending) send.mutate(v); } }}
              placeholder={t('chat.type', { defaultValue: 'Type a message…' })} aria-label={t('chat.type', { defaultValue: 'Type a message…' })}
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button type="submit" disabled={!draft.trim() || send.isPending} className="btn btn-primary h-11 !px-4" aria-label={t('chat.send', { defaultValue: 'Send' })}><Send size={16} /></button>
          </form>
          {error && <p className="px-4 pb-3 text-sm text-destructive" role="alert">{error}</p>}
          <button type="button" onClick={() => { writeToken(null); setToken(null); setForm((f) => ({ ...f, message: '' })); }}
            className="border-t border-border py-2.5 text-xs text-muted-foreground hover:text-foreground">
            {t('chat.new', { defaultValue: 'Start a new conversation' })}
          </button>
        </div>
      )}
    </section>
  );
};

export default ChatBox;
