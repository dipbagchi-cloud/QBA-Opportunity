import { Router } from 'express';
import { executeAgentTask, runAgent } from '../controllers/agents.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

router.use(authenticate);
router.post('/agents/task', authorize(PERMISSIONS.AGENTS_EXECUTE), executeAgentTask);
router.post('/agent/run', authorize(PERMISSIONS.AGENTS_EXECUTE), runAgent);

export default router;
