import { Router } from 'express';
import { ingestLead } from '../controllers/leads.controller';

const router = Router();

router.post('/', ingestLead);

export default router;
