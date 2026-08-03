import { PencilRuler } from 'lucide-react';
import { useCmsStore } from './store';

/**
 * The single entry point into edit mode. Renders nothing at all unless the
 * signed-in user is an admin, so a visitor's navbar is byte-for-byte what it
 * was before the CMS existed.
 */
const EditWebsiteButton = ({ className = '' }: { className?: string }) => {
  const canEdit = useCmsStore((s) => s.canEdit);
  const editMode = useCmsStore((s) => s.editMode);
  const setEditMode = useCmsStore((s) => s.setEditMode);

  if (!canEdit || editMode) return null;

  return (
    <button
      type="button"
      onClick={() => setEditMode(true)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-500/20 hover:border-blue-500/60 transition-colors ${className}`}
      title="Edit this website in place"
    >
      <PencilRuler size={14} strokeWidth={2} />
      <span className="hidden sm:inline">Edit Website</span>
    </button>
  );
};

export default EditWebsiteButton;
