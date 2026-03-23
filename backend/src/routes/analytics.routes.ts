import { Router } from 'express';
import { getAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

router.use(authenticate);
router.get('/', authorize(PERMISSIONS.ANALYTICS_VIEW), getAnalytics);

export default router;
