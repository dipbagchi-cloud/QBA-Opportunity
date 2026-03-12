import { Router } from 'express';
import { createApproval } from '../controllers/approvals.controller';

const router = Router();

router.post('/', createApproval);

export default router;
