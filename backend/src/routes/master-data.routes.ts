import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    listClients,
    listRegions,
    listTechnologies,
    listPricingModels,
    listSalespersons,
    listDepartments,
    listManagersByDepartment,
} from '../controllers/master-data.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/clients', listClients);
router.get('/regions', listRegions);
router.get('/technologies', listTechnologies);
router.get('/pricing-models', listPricingModels);
router.get('/salespersons', listSalespersons);
router.get('/departments', listDepartments);
router.get('/managers', listManagersByDepartment);

export default router;
