import { Router } from 'express';
import { executeAgentTask, runAgent } from '../controllers/agents.controller';

const router = Router();

router.post('/agents/task', executeAgentTask);
router.post('/agent/run', runAgent);

export default router;
