import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    listClients,
    createClient,
    listRegions,
    getCountryRegionMap,
    validateCountries,
    listTechnologies,
    listPricingModels,
    listProjectTypes,
    listSalespersons,
    listDepartments,
    listManagersByDepartment,
} from '../controllers/master-data.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/regions', listRegions);
router.get('/country-region-map', getCountryRegionMap);
router.post('/validate-countries', validateCountries);
router.get('/technologies', listTechnologies);
router.get('/pricing-models', listPricingModels);
router.get('/project-types', listProjectTypes);
router.get('/salespersons', listSalespersons);
router.get('/departments', listDepartments);
router.get('/managers', listManagersByDepartment);

export default router;
