import { Router } from 'express';
import { getUserDetails, searchUsers } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

// Require authentication for all user routes
router.use(authenticate);

// GET /api/users/search?q=<name>&permission=presales:write
router.get('/search', searchUsers);

// GET /api/users/:id
router.get('/:id', authorize(PERMISSIONS.USERS_MANAGE), getUserDetails);

export default router;
