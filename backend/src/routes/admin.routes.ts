import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  syncQPeopleUsers,
  getBudgetAssumptions,
  updateBudgetAssumptions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listTeams,
} from '../controllers/admin.controller';
import {
  listAllRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
} from '../controllers/rate-cards.controller';
import {
  listAllClients,
  createClient,
  updateClient,
  deleteClient,
  listAllRegions,
  createRegion,
  updateRegion,
  deleteRegion,
  listAllTechnologies,
  createTechnology,
  updateTechnology,
  deleteTechnology,
  listAllPricingModels,
  createPricingModel,
  updatePricingModel,
  deletePricingModel,
} from '../controllers/master-data.controller';
import {
  listAuditLogs,
  listAuditEntities,
  listAuditActions,
} from '../controllers/audit.controller';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// User management (requires users:manage)
router.get('/users', authorize(PERMISSIONS.USERS_MANAGE), listUsers);
router.post('/users', authorize(PERMISSIONS.USERS_MANAGE), createUser);
router.post('/users/sync-qpeople', authorize(PERMISSIONS.USERS_MANAGE), syncQPeopleUsers);
router.patch('/users/:id', authorize(PERMISSIONS.USERS_MANAGE), updateUser);
router.patch('/users/:id/reset-password', authorize(PERMISSIONS.USERS_MANAGE), resetUserPassword);

// Role management (requires roles:manage)
router.get('/roles', authorize(PERMISSIONS.ROLES_MANAGE), listRoles);
router.post('/roles', authorize(PERMISSIONS.ROLES_MANAGE), createRole);
router.patch('/roles/:id', authorize(PERMISSIONS.ROLES_MANAGE), updateRole);
router.delete('/roles/:id', authorize(PERMISSIONS.ROLES_MANAGE), deleteRole);

// Team listing (requires users:manage)
router.get('/teams', authorize(PERMISSIONS.USERS_MANAGE), listTeams);

// Rate card management (requires costcard:manage)
router.get('/rate-cards', authorize(PERMISSIONS.COSTCARD_MANAGE), listAllRateCards);
router.post('/rate-cards', authorize(PERMISSIONS.COSTCARD_MANAGE), createRateCard);
router.patch('/rate-cards/:id', authorize(PERMISSIONS.COSTCARD_MANAGE), updateRateCard);
router.delete('/rate-cards/:id', authorize(PERMISSIONS.COSTCARD_MANAGE), deleteRateCard);

// Client management (requires metadata:manage)
router.get('/clients', authorize(PERMISSIONS.METADATA_MANAGE), listAllClients);
router.post('/clients', authorize(PERMISSIONS.METADATA_MANAGE), createClient);
router.patch('/clients/:id', authorize(PERMISSIONS.METADATA_MANAGE), updateClient);
router.delete('/clients/:id', authorize(PERMISSIONS.METADATA_MANAGE), deleteClient);

// Region management (requires metadata:manage)
router.get('/regions', authorize(PERMISSIONS.METADATA_MANAGE), listAllRegions);
router.post('/regions', authorize(PERMISSIONS.METADATA_MANAGE), createRegion);
router.patch('/regions/:id', authorize(PERMISSIONS.METADATA_MANAGE), updateRegion);
router.delete('/regions/:id', authorize(PERMISSIONS.METADATA_MANAGE), deleteRegion);

// Technology management (requires metadata:manage)
router.get('/technologies', authorize(PERMISSIONS.METADATA_MANAGE), listAllTechnologies);
router.post('/technologies', authorize(PERMISSIONS.METADATA_MANAGE), createTechnology);
router.patch('/technologies/:id', authorize(PERMISSIONS.METADATA_MANAGE), updateTechnology);
router.delete('/technologies/:id', authorize(PERMISSIONS.METADATA_MANAGE), deleteTechnology);

// Pricing model management (requires metadata:manage)
router.get('/pricing-models', authorize(PERMISSIONS.METADATA_MANAGE), listAllPricingModels);
router.post('/pricing-models', authorize(PERMISSIONS.METADATA_MANAGE), createPricingModel);
router.patch('/pricing-models/:id', authorize(PERMISSIONS.METADATA_MANAGE), updatePricingModel);
router.delete('/pricing-models/:id', authorize(PERMISSIONS.METADATA_MANAGE), deletePricingModel);

// Budget assumptions (GET: any authenticated user, PUT: requires settings:manage)
router.get('/budget-assumptions', getBudgetAssumptions);
router.put('/budget-assumptions', authorize(PERMISSIONS.SETTINGS_MANAGE), updateBudgetAssumptions);

// Audit logs (requires auditlogs:view)
router.get('/audit-logs', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditLogs);
router.get('/audit-logs/entities', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditEntities);
router.get('/audit-logs/actions', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditActions);

export default router;
