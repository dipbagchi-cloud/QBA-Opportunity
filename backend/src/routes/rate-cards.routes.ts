import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listRateCards } from '../controllers/rate-cards.controller';

const router = Router();

// All authenticated users can list active rate cards
router.use(authenticate);
router.get('/', listRateCards);

export default router;
