import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { chatMessage, chatHistory, chatSuggestions, chatLLMStatus } from '../controllers/chatbot.controller';

const router = Router();

// All chatbot routes require authentication
router.use(authenticate);

router.post('/message', chatMessage);
router.get('/history', chatHistory);
router.get('/suggestions', chatSuggestions);
router.get('/llm-status', chatLLMStatus);

export default router;
