import { Router } from 'express';
import { authenticate, authorize, authorizeAny } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';
import {
  getSowDocument,
  createSowDocument,
  updateSowDocument,
  updateSowSection,
  lockSowSection,
  getReadiness,
  createSowVersion,
  listSowVersions,
  submitForReview,
  reviewSowApproval,
  updateSowStatus,
  checkStaleState,
} from '../controllers/sow.controller';
import {
  generateFullDraft,
  regenerateSection,
} from '../controllers/sow-generation.controller';
import {
  exportDocx,
  previewHtml,
  listExports,
  downloadExport,
} from '../controllers/sow-export.controller';

const router = Router();

// All SOW routes require authentication
router.use(authenticate);

// SOW Document CRUD (per opportunity)
router.get(
  '/opportunities/:opportunityId/sow',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  getSowDocument
);

router.post(
  '/opportunities/:opportunityId/sow',
  authorize(PERMISSIONS.SOW_WRITE),
  createSowDocument
);

router.patch(
  '/opportunities/:opportunityId/sow',
  authorize(PERMISSIONS.SOW_WRITE),
  updateSowDocument
);

// Section management
router.patch(
  '/opportunities/:opportunityId/sow/sections/:sectionKey',
  authorize(PERMISSIONS.SOW_WRITE),
  updateSowSection
);

router.patch(
  '/opportunities/:opportunityId/sow/sections/:sectionKey/lock',
  authorize(PERMISSIONS.SOW_WRITE),
  lockSowSection
);

// AI Generation
router.post(
  '/opportunities/:opportunityId/sow/generate',
  authorize(PERMISSIONS.SOW_WRITE),
  generateFullDraft
);

router.post(
  '/opportunities/:opportunityId/sow/sections/:sectionKey/regenerate',
  authorize(PERMISSIONS.SOW_WRITE),
  regenerateSection
);

// Readiness
router.get(
  '/opportunities/:opportunityId/sow/readiness',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  getReadiness
);

// Stale detection
router.get(
  '/opportunities/:opportunityId/sow/stale',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  checkStaleState
);

// Versioning
router.get(
  '/opportunities/:opportunityId/sow/versions',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  listSowVersions
);

router.post(
  '/opportunities/:opportunityId/sow/versions',
  authorize(PERMISSIONS.SOW_WRITE),
  createSowVersion
);

// Approval workflow
router.post(
  '/opportunities/:opportunityId/sow/submit-review',
  authorize(PERMISSIONS.SOW_WRITE),
  submitForReview
);

router.post(
  '/opportunities/:opportunityId/sow/approvals/:approvalId/review',
  authorize(PERMISSIONS.APPROVALS_MANAGE),
  reviewSowApproval
);

router.patch(
  '/opportunities/:opportunityId/sow/status',
  authorize(PERMISSIONS.SOW_WRITE),
  updateSowStatus
);

// Export / Preview
router.get(
  '/opportunities/:opportunityId/sow/preview',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  previewHtml
);

router.get(
  '/opportunities/:opportunityId/sow/export/docx',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  exportDocx
);

router.get(
  '/opportunities/:opportunityId/sow/exports',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  listExports
);

router.get(
  '/opportunities/:opportunityId/sow/exports/:exportId/download',
  authorizeAny(PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE),
  downloadExport
);

export default router;
