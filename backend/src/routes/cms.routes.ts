import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import {
  discardDrafts,
  getDraftContent,
  getPublicSettings,
  getPublishedContent,
  getRevisions,
  getSettings,
  publishContent,
  replaceContent,
  restoreRevision,
  saveDrafts,
  scheduleContent,
  searchContent,
  updateSettings,
} from '../controllers/cms.controller';
import {
  contentQueryRules,
  discardRules,
  publishRules,
  replaceRules,
  restoreRules,
  revisionsRules,
  saveDraftsRules,
  scheduleRules,
  searchRules,
  settingsRules,
} from '../validators/cms.validator';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
// Published content only. Everything a visitor's browser is allowed to see.
router.get('/content', contentQueryRules, getPublishedContent);
router.get('/settings', getPublicSettings);

// ─── Admin ────────────────────────────────────────────────────────────────────
// Every route below is authenticated *and* admin-gated. Draft content must
// never be reachable by a signed-in customer.
router.use(authenticate, requireAdmin);

router.get('/admin/content', contentQueryRules, getDraftContent);
router.patch('/admin/content', saveDraftsRules, saveDrafts);
router.post('/admin/content/publish', publishRules, publishContent);
router.post('/admin/content/discard', discardRules, discardDrafts);
router.post('/admin/content/schedule', scheduleRules, scheduleContent);

router.get('/admin/content/search', searchRules, searchContent);
router.post('/admin/content/replace', replaceRules, replaceContent);

router.get('/admin/content/:key/revisions', revisionsRules, getRevisions);
router.post('/admin/content/:key/restore', restoreRules, restoreRevision);

router.get('/admin/settings', getSettings);
router.put('/admin/settings', settingsRules, updateSettings);

export default router;
