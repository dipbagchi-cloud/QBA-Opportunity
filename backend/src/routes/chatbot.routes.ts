import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { chatMessage, chatHistory, chatSuggestions } from '../controllers/chatbot.controller';

const router = Router();

// All chatbot routes require authentication
router.use(authenticate);

router.post('/message', chatMessage);
router.get('/history', chatHistory);
router.get('/suggestions', chatSuggestions);

export default router;
