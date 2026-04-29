import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
    listOpportunities,
    createOpportunity,
    getOpportunity,
    updateOpportunity,
    convertOpportunity,
    approveGom,
    getGomApprovalStatus,
    reviewGomApproval,
    listComments,
    addComment,
    getOpportunityAuditLog,
    uploadAttachment,
    downloadAttachment,
    deleteAttachment,
} from '../controllers/opportunities.controller';
import { authenticate, authorize, authorizeAny } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

// Multer config for attachment uploads
const attachmentDir = path.join(__dirname, '../../uploads/attachments');
if (!require('fs').existsSync(attachmentDir)) require('fs').mkdirSync(attachmentDir, { recursive: true });
const storage = multer.diskStorage({
    destination: attachmentDir,
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}-${file.originalname}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

// All routes require authentication
router.use(authenticate);

router.get('/', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), listOpportunities);
router.post('/', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), createOpportunity);
router.get('/:id', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getOpportunity);
router.patch('/:id', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), updateOpportunity);
router.post('/:id/convert', authorize(PERMISSIONS.SALES_WRITE), convertOpportunity);
router.patch('/:id/approve-gom', authorize(PERMISSIONS.PRESALES_WRITE), approveGom);
router.get('/:id/gom-approval-status', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getGomApprovalStatus);
router.patch('/:id/review-gom-approval', authorize(PERMISSIONS.PRESALES_WRITE), reviewGomApproval);
router.get('/:id/comments', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), listComments);
router.post('/:id/comments', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), addComment);
router.get('/:id/audit-log', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getOpportunityAuditLog);

// Attachment routes
router.post('/:id/attachments', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), upload.single('file'), uploadAttachment);
router.get('/:id/attachments/:attachmentId/download', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), downloadAttachment);
router.delete('/:id/attachments/:attachmentId', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), deleteAttachment);

export default router;
