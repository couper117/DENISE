import { useState } from 'react';
import { AlertTriangle, Check, Eye, History, Loader2, LogOut, Rocket, Settings, Undo2 } from 'lucide-react';
import { toast } from '../../components/ui/Toaster';
import { useCmsStore } from '../store';
import { discardAll, errorMessage, publishAll, saveDrafts } from '../sync';
import SettingsPanel from './SettingsPanel';
import HistoryPanel from './HistoryPanel';

/** The floating control bar for edit mode. */

const StatusPill = () => {
  const status = useCmsStore((s) => s.saveStatus);
  const dirtyCount = useCmsStore((s) => s.dirty.size);
  const error = useCmsStore((s) => s.saveError);

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] opacity-70">
        <Loader2 size={13} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-red-500" title={error ?? undefined}>
        <AlertTriangle size={13} /> Not saved
      </span>
    );
  }
  if (dirtyCount > 0) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] opacity-70">
        <Check size={13} /> Saved
      </span>
    );
  }
  return <span className="text-[12px] opacity-55">No changes</span>;
};

const EditorToolbar = () => {
  const setEditMode = useCmsStore((s) => s.setEditMode);
  const preview = useCmsStore((s) => s.preview);
  const setPreview = useCmsStore((s) => s.setPreview);
  const locale = useCmsStore((s) => s.locale);
  const editableCount = useCmsStore((s) => s.registry.size);
  const dirtyCount = useCmsStore((s) => s.dirty.size);

  const [busy, setBusy] = useState<'publish' | 'discard' | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const selected = useCmsStore((s) => s.selected);

  const onPublish = async () => {
    setBusy('publish');
    try {
      const count = await publishAll();
      toast(
        count > 0
          ? { title: 'Published', description: `${count} change${count === 1 ? '' : 's'} are now live.`, variant: 'success' }
          : { title: 'Nothing to publish', description: 'Everything is already live.' }
      );
    } catch (e) {
      toast({ title: 'Publish failed', description: errorMessage(e, 'Could not publish'), variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const onDiscard = async () => {
    setBusy('discard');
    setConfirmDiscard(false);
    try {
      const count = await discardAll();
      toast({ title: 'Changes discarded', description: `${count} block${count === 1 ? '' : 's'} reverted to the live version.` });
    } catch (e) {
      toast({ title: 'Discard failed', description: errorMessage(e, 'Could not discard'), variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  /** Leaving flushes rather than dropping whatever is still in the debounce. */
  const onExit = async () => {
    if (useCmsStore.getState().dirty.size > 0) {
      try {
        await saveDrafts();
      } catch {
        toast({ title: 'Some changes were not saved', description: 'Staying in edit mode so you can retry.', variant: 'error' });
        return;
      }
    }
    setEditMode(false);
  };

  return (
    <div data-cms-chrome="" className="cms-toolbar cms-glass">
      <span className="flex items-center gap-2 pl-1.5 pr-1">
        <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,.25)]" />
        <span className="font-semibold">{preview ? 'Previewing' : 'Editing'}</span>
        <span className="opacity-45 uppercase text-[11px] tracking-wide">{locale}</span>
      </span>

      <span className="w-px h-5 bg-current opacity-10" />
      <StatusPill />
      <span className="w-px h-5 bg-current opacity-10" />
      <span className="text-[12px] opacity-45 tabular-nums">{editableCount} editable</span>
      <span className="w-px h-5 bg-current opacity-10" />

      <button
        type="button"
        onClick={() => setPreview(!preview)}
        aria-pressed={preview}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
          preview ? 'bg-blue-600 text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
        }`}
        title="See drafts exactly as a visitor would"
      >
        <Eye size={13} /> Preview
      </button>

      {confirmDiscard ? (
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="opacity-70">Discard all?</span>
          <button type="button" onClick={onDiscard}
            className="px-2 py-1 rounded-md bg-red-600 text-white font-semibold">
            Yes
          </button>
          <button type="button" onClick={() => setConfirmDiscard(false)}
            className="px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Revert every unpublished change in this language"
        >
          {busy === 'discard' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Discard
        </button>
      )}

      <button
        type="button"
        onClick={onPublish}
        disabled={busy !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
        title="Make every saved change live"
      >
        {busy === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
        Publish
        {dirtyCount > 0 && <span className="opacity-70">({dirtyCount})</span>}
      </button>

      {/* History is here rather than in the editor panel because text blocks
          edit inline and have no panel — this way every content type can reach
          its history the same way. */}
      <button
        type="button"
        onClick={() => setShowHistory(true)}
        disabled={!selected}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
        title={selected ? `Version history for ${selected}` : 'Select something to see its history'}
      >
        <History size={13} />
      </button>

      {showHistory && selected && (
        <HistoryPanel contentKey={selected} onClose={() => setShowHistory(false)} />
      )}

      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title="Site settings, SEO, theme and find-and-replace"
      >
        <Settings size={13} />
      </button>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <LogOut size={13} /> Exit
      </button>
    </div>
  );
};

export default EditorToolbar;
