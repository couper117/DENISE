import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadMedia } from '../middleware/upload.middleware';
import {
  buildTransform,
  createFolder,
  deleteAsset,
  deleteFolder,
  getAssetUsage,
  listAssets,
  listFolders,
  renameFolder,
  updateAsset,
  uploadAssets,
} from '../controllers/media.controller';
import {
  assetIdRules,
  createFolderRules,
  folderIdRules,
  listAssetsRules,
  renameFolderRules,
  transformRules,
  updateAssetRules,
  uploadAssetsRules,
} from '../validators/media.validator';

// The media library is entirely admin-only — there is no public surface here.
const router = Router();
router.use(authenticate, requireAdmin);

// Folders are declared before /:id so "folders" is never read as an asset id.
router.get('/folders', listFolders);
router.post('/folders', createFolderRules, createFolder);
router.patch('/folders/:id', renameFolderRules, renameFolder);
router.delete('/folders/:id', folderIdRules, deleteFolder);

router.get('/', listAssetsRules, listAssets);
// Validators run *after* multer so req.body is populated on a multipart request.
router.post('/', uploadMedia.array('files', 20), uploadAssetsRules, uploadAssets);
router.get('/:id/usage', assetIdRules, getAssetUsage);
router.post('/:id/transform', transformRules, buildTransform);
router.patch('/:id', updateAssetRules, updateAsset);
router.delete('/:id', assetIdRules, deleteAsset);

export default router;
