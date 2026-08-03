import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered,
  Redo2, Strikethrough, Underline, Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCmsStore } from '../store';
import { useAnchorRect } from './Panel';

/**
 * True inline editing: the element already on the page becomes contentEditable
 * rather than being swapped for an input. That is what makes it feel like a
 * document instead of a form — the text keeps its real typography, width and
 * line breaks while you type.
 *
 * React rendered this node, so the two must not fight. The value in the store is
 * therefore left untouched until the edit is committed (blur, Enter or the
 * toolbar), at which point React re-renders and reconciles against text that
 * already matches. Updating the store on every keystroke would re-render
 * mid-edit and drop the caret to the start of the line.
 */

const exec = (command: string, value?: string) => {
  // execCommand is formally deprecated but is the only API implemented
  // everywhere for this, and its output maps exactly onto the tag allowlist the
  // server sanitises against. A full editor library would be a large dependency
  // for the handful of operations this toolbar exposes.
  document.execCommand(command, false, value);
};

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  command: string;
  value?: string;
  onRun: () => void;
}

const ToolbarButton = ({ icon: Icon, label, command, value, onRun }: ToolbarButtonProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className="cms-icon-btn"
    // Mouse-down default would blur the contentEditable and collapse the
    // selection before the command could apply to it.
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => {
      exec(command, value);
      onRun();
    }}
  >
    <Icon size={14} />
  </button>
);

const FormatToolbar = ({ anchorKey, onChange }: { anchorKey: string; onChange: () => void }) => {
  const rect = useAnchorRect(anchorKey);
  if (!rect) return null;

  const top = Math.max(8, rect.top - 46);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 420));

  return (
    <div data-cms-chrome="" className="cms-format-toolbar cms-glass" style={{ top, left }}>
      <ToolbarButton icon={Bold} label="Bold (Ctrl+B)" command="bold" onRun={onChange} />
      <ToolbarButton icon={Italic} label="Italic (Ctrl+I)" command="italic" onRun={onChange} />
      <ToolbarButton icon={Underline} label="Underline (Ctrl+U)" command="underline" onRun={onChange} />
      <ToolbarButton icon={Strikethrough} label="Strikethrough" command="strikeThrough" onRun={onChange} />
      <span className="cms-sep" />
      <ToolbarButton icon={List} label="Bulleted list" command="insertUnorderedList" onRun={onChange} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" command="insertOrderedList" onRun={onChange} />
      <span className="cms-sep" />
      <ToolbarButton icon={AlignLeft} label="Align left" command="justifyLeft" onRun={onChange} />
      <ToolbarButton icon={AlignCenter} label="Align centre" command="justifyCenter" onRun={onChange} />
      <ToolbarButton icon={AlignRight} label="Align right" command="justifyRight" onRun={onChange} />
      <span className="cms-sep" />
      <button
        type="button"
        title="Insert link"
        aria-label="Insert link"
        className="cms-icon-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const href = window.prompt('Link URL');
          // Blocks javascript: and data: — the same rule the server enforces.
          if (href && /^(https?:\/\/|\/|mailto:|tel:|#)/i.test(href.trim())) {
            exec('createLink', href.trim());
            onChange();
          }
        }}
      >
        <Link2 size={14} />
      </button>
      <span className="cms-sep" />
      <ToolbarButton icon={Undo2} label="Undo (Ctrl+Z)" command="undo" onRun={onChange} />
      <ToolbarButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" command="redo" onRun={onChange} />
    </div>
  );
};

interface InlineEditorProps {
  contentKey: string;
  type: 'TEXT' | 'RICHTEXT';
  multiline: boolean;
  onDone: () => void;
}

const InlineEditor = ({ contentKey, type, multiline, onDone }: InlineEditorProps) => {
  const setValue = useCmsStore((s) => s.setValue);
  const elRef = useRef<HTMLElement | null>(null);
  const originalRef = useRef<string>('');
  const committedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const read = useCallback(
    (el: HTMLElement) => (type === 'RICHTEXT' ? el.innerHTML : el.innerText.replace(/\n+$/, '')),
    [type]
  );

  const commit = useCallback(() => {
    const el = elRef.current;
    if (!el || committedRef.current) return;
    committedRef.current = true;
    const next = read(el);
    if (next !== originalRef.current) setValue(contentKey, type, next);
  }, [contentKey, type, read, setValue]);

  const cancel = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    committedRef.current = true;
    if (type === 'RICHTEXT') el.innerHTML = originalRef.current;
    else el.innerText = originalRef.current;
  }, [type]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-cms-id="${CSS.escape(contentKey)}"]`);
    if (!el) return;

    elRef.current = el;
    originalRef.current = read(el);
    committedRef.current = false;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.classList.add('cms-editing');
    el.focus({ preventScroll: true });

    // Caret to the end rather than selecting everything — selecting all makes
    // the next keystroke destroy the existing copy, which is rarely intended.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    setReady(true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        onDone();
        return;
      }
      // Enter commits a single-line field; multiline needs it for paragraphs.
      if (e.key === 'Enter' && !multiline && type === 'TEXT') {
        e.preventDefault();
        commit();
        onDone();
      }
    };

    const onBlur = () => {
      commit();
      onDone();
    };

    // Paste as plain text so copying from Word cannot inject markup that the
    // server would strip anyway, leaving the editor confused about what saved.
    const onPaste = (e: ClipboardEvent) => {
      if (type !== 'TEXT') return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text);
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('blur', onBlur);
    el.addEventListener('paste', onPaste);

    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('paste', onPaste);
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.classList.remove('cms-editing');
      // Covers unmount paths that never fired blur — switching to another
      // element, or leaving edit mode entirely.
      commit();
    };
  }, [contentKey, type, multiline, commit, cancel, onDone, read]);

  if (type !== 'RICHTEXT' || !ready) return null;

  return (
    <FormatToolbar
      anchorKey={contentKey}
      onChange={() => {
        // Toolbar commands mutate the DOM directly; re-focus so typing carries
        // on where it left off.
        elRef.current?.focus({ preventScroll: true });
      }}
    />
  );
};

export default InlineEditor;
