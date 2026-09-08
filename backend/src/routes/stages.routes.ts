import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStages } from '../controllers/stages.controller';

const router = Router();
router.use(authenticate);

// The configured stage model is readable by any authenticated user (it drives
// the stage path, the board and the list everywhere).
router.get('/', getStages);

export default router;
