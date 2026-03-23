import { Router } from 'express';
import { ingestLead } from '../controllers/leads.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

router.use(authenticate);
router.post('/', authorize(PERMISSIONS.LEADS_MANAGE), ingestLead);

export default router;
