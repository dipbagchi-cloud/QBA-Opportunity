import { Router } from 'express';
import { getUserDetails } from '../controllers/users.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Require authentication for all user routes
router.use(authenticate);

// GET /api/users/:id
router.get('/:id', getUserDetails);

export default router;
