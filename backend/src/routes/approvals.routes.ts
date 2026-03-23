import { Router } from 'express';
import { createApproval } from '../controllers/approvals.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

router.use(authenticate);
router.post('/', authorize(PERMISSIONS.APPROVALS_MANAGE), createApproval);

export default router;
