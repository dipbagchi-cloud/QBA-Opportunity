import { Router } from 'express';
import { login, getMe, changePassword, switchRole, setPassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public
router.post('/login', login);

// Protected
router.get('/me', authenticate, getMe);
router.post('/switch-role', authenticate, switchRole);
router.patch('/change-password', authenticate, changePassword);
router.patch('/set-password', authenticate, setPassword);

export default router;
