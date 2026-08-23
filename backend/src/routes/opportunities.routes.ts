import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import {
    listOpportunities,
    createOpportunity,
    getOpportunity,
    updateOpportunity,
    deleteOpportunity,
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
    uploadSow,
    getOpportunityFilterOptions,
    exportOpportunities,
} from '../controllers/opportunities.controller';
import {
    listSelectableProjects,
    getMapping,
    saveMapping,
    deleteMapping,
    getResourcePlan,
    saveResourcePlan,
    getProjectAllocation,
    listSkillsets,
} from '../controllers/actual-gom.controller';
import { authenticate, authorize, authorizeAny, authorizeAdmin } from '../middleware/auth';
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
// Keep this in sync with nginx `client_max_body_size` (currently 50M on all envs).
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } });

// Wrap multer's single-file middleware so size/upload errors return a clean JSON
// response instead of bubbling up to the generic 500 error handler.
function handleUpload(req: Request, res: Response, next: NextFunction) {
    upload.single('file')(req, res, (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ error: 'File too large. Maximum upload size is 50MB.' });
                }
                return res.status(400).json({ error: `Upload error: ${err.message}` });
            }
            return res.status(500).json({ error: 'File upload failed.' });
        }
        next();
    });
}

// All routes require authentication
router.use(authenticate);

router.get('/', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), listOpportunities);
// Must be registered before '/:id' so it isn't captured as an opportunity id.
router.get('/filter-options', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getOpportunityFilterOptions);
// CSV of all opportunities. Also registered before '/:id'.
router.get('/export', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), exportOpportunities);
router.post('/', authorize(PERMISSIONS.PIPELINE_WRITE), createOpportunity);
router.get('/:id', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getOpportunity);
router.patch('/:id', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), updateOpportunity);
// Hard delete — Admin only (the controller enforces the wildcard check and
// returns a clear 403 for everyone else). PIPELINE_WRITE is just a base gate.
router.delete('/:id', authorize(PERMISSIONS.PIPELINE_WRITE), deleteOpportunity);
router.post('/:id/convert', authorize(PERMISSIONS.SALES_WRITE), convertOpportunity);
router.patch('/:id/approve-gom', authorizeAny(PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE, PERMISSIONS.PIPELINE_WRITE), approveGom);
router.get('/:id/gom-approval-status', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getGomApprovalStatus);
router.patch('/:id/review-gom-approval', authorize(PERMISSIONS.APPROVALS_MANAGE), reviewGomApproval);
router.get('/:id/comments', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), listComments);
router.post('/:id/comments', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), addComment);
router.get('/:id/audit-log', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), getOpportunityAuditLog);

// Attachment routes
router.post('/:id/sow', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), handleUpload, uploadSow);
router.post('/:id/attachments', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), handleUpload, uploadAttachment);
router.get('/:id/attachments/:attachmentId/download', authorizeAny(PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW), downloadAttachment);
router.delete('/:id/attachments/:attachmentId', authorizeAny(PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE), deleteAttachment);

// ── Actual GOM: Q-People project / resource mapping ─────────────────────────
// ADMIN ONLY, read and write alike. This deliberately overrides the earlier
// rule that every role could view Actual GOM on a won deal: the tab exposes
// cost, margin and individual employee data, so it is restricted to Admin.
//
// authorizeAdmin checks for the wildcard permission itself — no named
// permission can express "Admin and nobody else", because a wildcard holder
// satisfies every named permission a Manager would also pass.
router.get('/qpeople/skillsets', authorizeAdmin, listSkillsets);
router.get('/:id/qpeople/projects', authorizeAdmin, listSelectableProjects);
router.get('/:id/qpeople/mapping', authorizeAdmin, getMapping);
router.put('/:id/qpeople/mapping', authorizeAdmin, saveMapping);
router.delete('/:id/qpeople/mapping', authorizeAdmin, deleteMapping);
router.get('/:id/qpeople/resource-plan', authorizeAdmin, getResourcePlan);
router.put('/:id/qpeople/resource-plan', authorizeAdmin, saveResourcePlan);
router.get('/:id/qpeople/allocation', authorizeAdmin, getProjectAllocation);

export default router;
