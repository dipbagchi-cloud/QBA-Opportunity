import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { auditMutations } from '../lib/audit';
import {
    listClients,
    createClient,
    listRegions,
    getCountryRegionMap,
    validateCountries,
    listTechnologies,
    listPricingModels,
    listProjectTypes,
    listProjectRoles,
    listSalespersons,
    listDepartments,
    listManagersByDepartment,
    listPresalesTeam,
    listHolidays,
} from '../controllers/master-data.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Master data is reference data the whole CRM keys off, so changes here are
// audited on the same terms as the admin surface. (`validate-countries` is a
// POST that reads only, so it is excluded — auditing it would be noise.)
router.use(auditMutations({ source: 'MasterData', skipPaths: /^\/validate-countries/ }));

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/regions', listRegions);
router.get('/country-region-map', getCountryRegionMap);
router.post('/validate-countries', validateCountries);
router.get('/technologies', listTechnologies);
router.get('/pricing-models', listPricingModels);
router.get('/project-types', listProjectTypes);
router.get('/project-roles', listProjectRoles);
router.get('/salespersons', listSalespersons);
router.get('/departments', listDepartments);
router.get('/managers', listManagersByDepartment);
router.get('/presales-team', listPresalesTeam);
router.get('/holidays', listHolidays);

export default router;
