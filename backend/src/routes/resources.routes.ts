import { Router } from 'express';
import { listResources } from '../controllers/resources.controller';

const router = Router();

router.get('/', listResources);

export default router;
