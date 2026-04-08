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
  addUserToRole,
  removeUserFromRole,
  listTeams,
  listQPeopleMappings,
  listQPeopleDesignations,
  upsertQPeopleMapping,
  deleteQPeopleMapping,
  applyQPeopleMappings,
  getAuthConfig,
  updateAuthConfig,
  assignLocalPassword,
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
  listAllProjectTypes,
  createProjectType,
  updateProjectType,
  deleteProjectType,
} from '../controllers/master-data.controller';
import {
  listAuditLogs,
  listAuditEntities,
  listAuditActions,
} from '../controllers/audit.controller';
import {
  listEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  sendTestEmail,
} from '../controllers/email-templates.controller';
import {
  listCurrencyRates,
  syncCurrencyRates,
  seedAllDefaultCurrencies,
  toggleCurrencyRate,
  updateCurrencyRate,
  addCurrencyRate,
  deleteCurrencyRate,
} from '../controllers/currency.controller';
import {
  listNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
} from '../controllers/notification-rules.controller';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// User management (requires users:manage)
router.get('/users', authorize(PERMISSIONS.USERS_MANAGE), listUsers);
router.post('/users', authorize(PERMISSIONS.USERS_MANAGE), createUser);
router.post('/users/sync-qpeople', authorize(PERMISSIONS.USERS_MANAGE), syncQPeopleUsers);
router.patch('/users/:id', authorize(PERMISSIONS.USERS_MANAGE), updateUser);
router.patch('/users/:id/reset-password', authorize(PERMISSIONS.USERS_MANAGE), resetUserPassword);
router.post('/users/:id/assign-local-password', authorize(PERMISSIONS.USERS_MANAGE), assignLocalPassword);

// Auth configuration (requires settings:manage)
router.get('/auth-config', authorize(PERMISSIONS.SETTINGS_MANAGE), getAuthConfig);
router.put('/auth-config', authorize(PERMISSIONS.SETTINGS_MANAGE), updateAuthConfig);

// Role management (requires roles:manage)
router.get('/roles', authorize(PERMISSIONS.ROLES_MANAGE), listRoles);
router.post('/roles', authorize(PERMISSIONS.ROLES_MANAGE), createRole);
router.patch('/roles/:id', authorize(PERMISSIONS.ROLES_MANAGE), updateRole);
router.delete('/roles/:id', authorize(PERMISSIONS.ROLES_MANAGE), deleteRole);
router.post('/roles/:id/users', authorize(PERMISSIONS.ROLES_MANAGE), addUserToRole);
router.delete('/roles/:id/users/:userId', authorize(PERMISSIONS.ROLES_MANAGE), removeUserFromRole);

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

// Project type management (requires metadata:manage)
router.get('/project-types', authorize(PERMISSIONS.METADATA_MANAGE), listAllProjectTypes);
router.post('/project-types', authorize(PERMISSIONS.METADATA_MANAGE), createProjectType);
router.patch('/project-types/:id', authorize(PERMISSIONS.METADATA_MANAGE), updateProjectType);
router.delete('/project-types/:id', authorize(PERMISSIONS.METADATA_MANAGE), deleteProjectType);

// Budget assumptions (GET: any authenticated user, PUT: requires settings:manage)
router.get('/budget-assumptions', getBudgetAssumptions);
router.put('/budget-assumptions', authorize(PERMISSIONS.SETTINGS_MANAGE), updateBudgetAssumptions);

// Audit logs (requires auditlogs:view)
router.get('/audit-logs', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditLogs);
router.get('/audit-logs/entities', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditEntities);
router.get('/audit-logs/actions', authorize(PERMISSIONS.AUDITLOGS_VIEW), listAuditActions);

// Email templates (requires settings:manage)
router.get('/email-templates', authorize(PERMISSIONS.SETTINGS_MANAGE), listEmailTemplates);
router.get('/email-templates/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), getEmailTemplate);
router.patch('/email-templates/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), updateEmailTemplate);
router.post('/email-templates/test', authorize(PERMISSIONS.SETTINGS_MANAGE), sendTestEmail);

// Currency rates (requires settings:manage for mutations, any auth for list)
router.get('/currency-rates', listCurrencyRates);
router.post('/currency-rates', authorize(PERMISSIONS.SETTINGS_MANAGE), addCurrencyRate);
router.post('/currency-rates/sync', authorize(PERMISSIONS.SETTINGS_MANAGE), syncCurrencyRates);
router.post('/currency-rates/seed', authorize(PERMISSIONS.SETTINGS_MANAGE), seedAllDefaultCurrencies);
router.patch('/currency-rates/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), updateCurrencyRate);
router.patch('/currency-rates/:id/toggle', authorize(PERMISSIONS.SETTINGS_MANAGE), toggleCurrencyRate);
router.delete('/currency-rates/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), deleteCurrencyRate);

// QPeople Role Mappings (requires roles:manage)
router.get('/qpeople-mappings', authorize(PERMISSIONS.ROLES_MANAGE), listQPeopleMappings);
router.get('/qpeople-mappings/designations', authorize(PERMISSIONS.ROLES_MANAGE), listQPeopleDesignations);
router.post('/qpeople-mappings', authorize(PERMISSIONS.ROLES_MANAGE), upsertQPeopleMapping);
router.post('/qpeople-mappings/apply', authorize(PERMISSIONS.ROLES_MANAGE), applyQPeopleMappings);
router.delete('/qpeople-mappings/:id', authorize(PERMISSIONS.ROLES_MANAGE), deleteQPeopleMapping);

// Notification rules (requires settings:manage)
router.get('/notification-rules', authorize(PERMISSIONS.SETTINGS_MANAGE), listNotificationRules);
router.post('/notification-rules', authorize(PERMISSIONS.SETTINGS_MANAGE), createNotificationRule);
router.patch('/notification-rules/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), updateNotificationRule);
router.delete('/notification-rules/:id', authorize(PERMISSIONS.SETTINGS_MANAGE), deleteNotificationRule);

export default router;
