import { Router } from 'express';
import {
    listOpportunities,
    createOpportunity,
    getOpportunity,
    updateOpportunity,
    convertOpportunity,
} from '../controllers/opportunities.controller';

const router = Router();

router.get('/', listOpportunities);
router.post('/', createOpportunity);
router.get('/:id', getOpportunity);
router.patch('/:id', updateOpportunity);
router.post('/:id/convert', convertOpportunity);

export default router;
