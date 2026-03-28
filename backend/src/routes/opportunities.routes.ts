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
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

// Multer config for attachment uploads
const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}-${file.originalname}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

// All routes require authentication
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PIPELINE_VIEW), listOpportunities);
router.post('/', authorize(PERMISSIONS.PIPELINE_WRITE), createOpportunity);
router.get('/:id', authorize(PERMISSIONS.PIPELINE_VIEW), getOpportunity);
router.patch('/:id', authorize(PERMISSIONS.PIPELINE_WRITE), updateOpportunity);
router.post('/:id/convert', authorize(PERMISSIONS.SALES_WRITE), convertOpportunity);
router.patch('/:id/approve-gom', authorize(PERMISSIONS.PRESALES_WRITE), approveGom);
router.get('/:id/gom-approval-status', authorize(PERMISSIONS.PIPELINE_VIEW), getGomApprovalStatus);
router.patch('/:id/review-gom-approval', authorize(PERMISSIONS.PRESALES_WRITE), reviewGomApproval);
router.get('/:id/comments', authorize(PERMISSIONS.PIPELINE_VIEW), listComments);
router.post('/:id/comments', authorize(PERMISSIONS.PIPELINE_VIEW), addComment);
router.get('/:id/audit-log', authorize(PERMISSIONS.PIPELINE_VIEW), getOpportunityAuditLog);

// Attachment routes
router.post('/:id/attachments', authorize(PERMISSIONS.PIPELINE_WRITE), upload.single('file'), uploadAttachment);
router.get('/:id/attachments/:attachmentId/download', authorize(PERMISSIONS.PIPELINE_VIEW), downloadAttachment);
router.delete('/:id/attachments/:attachmentId', authorize(PERMISSIONS.PIPELINE_WRITE), deleteAttachment);

export default router;
