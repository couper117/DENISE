import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MessageCircle, Phone, RotateCcw, Send } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { cn } from '../../lib/utils';

interface ConversationRow {
  id: string;
  customerName: string;
  customerPhone: string | null;
  status: 'OPEN' | 'CLOSED';
  adminUnread: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
}
interface ChatMessage { id: string; sender: 'CUSTOMER' | 'ADMIN'; body: string; createdAt: string }
interface Conversation extends ConversationRow { messages: ChatMessage[] }

const timeLabel = (iso: string, lng: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(lng, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(lng, { day: 'numeric', month: 'short' });
};

/**
 * Admin inbox for the website chat. The list refreshes every 10 s and the
 * open conversation every 5 s; new messages also ring through the admin
 * alerts (see useAdminAlerts).
 */
const AdminMessages = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin-chats', filter],
    queryFn: () => adminApi.getChats(filter).then((r) => r.data.data as { conversations: ConversationRow[]; unread: number }),
    refetchInterval: 10_000,
  });

  const { data: active } = useQuery({
    queryKey: ['admin-chat', activeId],
    queryFn: () => adminApi.getChat(activeId!).then((r) => r.data.data as Conversation),
    enabled: !!activeId,
    refetchInterval: 5_000,
  });

  // Opening a conversation marks it read; refresh the list's unread counts.
  useEffect(() => {
    if (active) queryClient.invalidateQueries({ queryKey: ['admin-chats'] });
  }, [active?.id, active?.messages.length, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [active?.messages.length]);

  const reply = useMutation({
    mutationFn: (message: string) => adminApi.replyChat(activeId!, message),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['admin-chat', activeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-chats'] });
    },
    onError: () => toast({ title: t('admin.chat_send_failed', { defaultValue: 'The reply could not be sent' }), variant: 'error' }),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'OPEN' | 'CLOSED') => adminApi.setChatStatus(activeId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chat', activeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-chats'] });
    },
  });

  const send = () => {
    const text = draft.trim();
    if (!text || reply.isPending) return;
    reply.mutate(text);
  };

  const conversations = list?.conversations ?? [];
  const digits = active?.customerPhone?.replace(/\D/g, '') ?? '';
  const intl = digits.startsWith('0') ? `250${digits.slice(1)}` : digits;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <p className="eyebrow">{t('admin.chat_eyebrow', { defaultValue: 'Website chat' })}</p>
        <h1 className="section-title">{t('admin.nav_messages', { defaultValue: 'Messages' })}</h1>
      </div>

      <div className="grid grid-cols-1 h-[calc(100svh-15rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-border bg-card lg:h-[calc(100vh-12rem)] lg:grid-cols-[20rem_1fr]">
        {/* ── Conversation list ── */}
        <div className={cn('flex min-h-0 min-w-0 flex-col border-border lg:border-r', activeId && 'hidden lg:flex')}>
          <div className="flex gap-1 border-b border-border p-2">
            {(['OPEN', 'CLOSED'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-semibold', filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent')}>
                {f === 'OPEN' ? t('admin.chat_open', { defaultValue: 'Open' }) : t('admin.chat_closed', { defaultValue: 'Closed' })}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <li className="p-4 text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</li>}
            {!isLoading && conversations.length === 0 && (
              <li className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <MessageCircle size={28} className="opacity-40" />
                {t('admin.chat_empty', { defaultValue: 'No conversations yet. Messages from the Contact page appear here.' })}
              </li>
            )}
            {conversations.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setActiveId(c.id)}
                  className={cn('flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent', activeId === c.id && 'bg-accent')}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{c.customerName[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', c.adminUnread > 0 ? 'font-semibold' : 'font-medium')}>{c.customerName}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c.lastMessageAt, i18n.language)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                      {c.adminUnread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{c.adminUnread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Conversation ── */}
        <div className={cn('min-h-0 min-w-0 flex-col', activeId ? 'flex' : 'hidden lg:flex')}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              {t('admin.chat_pick', { defaultValue: 'Choose a conversation to read and reply.' })}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <button type="button" className="icon-btn lg:hidden" onClick={() => setActiveId(null)} aria-label={t('common.back', { defaultValue: 'Back' })}><ArrowLeft size={18} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{active.customerName}</p>
                  {active.customerPhone && <p className="truncate text-xs text-muted-foreground">{active.customerPhone}</p>}
                </div>
                {active.customerPhone && (
                  <>
                    <a href={`tel:${active.customerPhone}`} className="icon-btn" aria-label={t('admin.chat_call', { defaultValue: 'Call' })}><Phone size={17} /></a>
                    <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" className="icon-btn text-[#1f8f4e]" aria-label="WhatsApp"><MessageCircle size={17} /></a>
                  </>
                )}
                {active.status === 'OPEN' ? (
                  <button type="button" onClick={() => setStatus.mutate('CLOSED')} className="btn btn-outline btn-sm !px-3">
                    <CheckCircle2 size={14} /> <span className="hidden sm:inline">{t('admin.chat_mark_done', { defaultValue: 'Mark done' })}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => setStatus.mutate('OPEN')} className="btn btn-outline btn-sm !px-3">
                    <RotateCcw size={14} /> <span className="hidden sm:inline">{t('admin.chat_reopen', { defaultValue: 'Reopen' })}</span>
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
                {active.messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.sender === 'ADMIN' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                      m.sender === 'ADMIN' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card')}>
                      {m.body}
                      <span className={cn('mt-1 block text-[10px]', m.sender === 'ADMIN' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{timeLabel(m.createdAt, i18n.language)}</span>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-border p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  maxLength={1000}
                  placeholder={t('admin.chat_reply_placeholder', { defaultValue: 'Write a reply…' })}
                  aria-label={t('admin.chat_reply_placeholder', { defaultValue: 'Write a reply…' })}
                  className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button type="submit" disabled={!draft.trim() || reply.isPending} className="btn btn-primary h-11 !px-4" aria-label={t('admin.chat_send', { defaultValue: 'Send' })}>
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessages;
