import { Router } from 'express';
import {
    listOpportunities,
    createOpportunity,
    getOpportunity,
    updateOpportunity,
    convertOpportunity,
} from '../controllers/opportunities.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PIPELINE_VIEW), listOpportunities);
router.post('/', authorize(PERMISSIONS.PIPELINE_WRITE), createOpportunity);
router.get('/:id', authorize(PERMISSIONS.PIPELINE_VIEW), getOpportunity);
router.patch('/:id', authorize(PERMISSIONS.PIPELINE_WRITE), updateOpportunity);
router.post('/:id/convert', authorize(PERMISSIONS.SALES_WRITE), convertOpportunity);

export default router;
