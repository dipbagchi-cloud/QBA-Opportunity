import { Router } from 'express';
import { listContacts, getContact, createContact, updateContact, deleteContact } from '../controllers/contacts.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listContacts);
router.get('/:id', getContact);
router.post('/', createContact);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
