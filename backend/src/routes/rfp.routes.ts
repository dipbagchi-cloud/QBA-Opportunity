import { Router } from 'express';
import { authenticate, authorizeAny } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';
import { listRfps, getRfp, createRfp, updateRfp } from '../controllers/rfp.controller';

const router = Router();
router.use(authenticate);

// RFP tracking rides on the pipeline/sales permissions (viewing vs writing).
const VIEW = [PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW];
const WRITE = [PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE];

router.get('/', authorizeAny(...VIEW), listRfps);
router.get('/:id', authorizeAny(...VIEW), getRfp);
router.post('/', authorizeAny(...WRITE), createRfp);
router.patch('/:id', authorizeAny(...WRITE), updateRfp);

export default router;
