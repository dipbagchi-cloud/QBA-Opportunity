import { Router } from 'express';
import { listContacts, getContact, createContact, updateContact, deleteContact } from '../controllers/contacts.controller';
import { authenticate, authorize, authorizeAny } from '../middleware/auth';
import { PERMISSIONS } from '../lib/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorizeAny(PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_WRITE), listContacts);
router.get('/:id', authorizeAny(PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_WRITE), getContact);
router.post('/', authorize(PERMISSIONS.CONTACTS_WRITE), createContact);
router.patch('/:id', authorize(PERMISSIONS.CONTACTS_WRITE), updateContact);
router.delete('/:id', authorize(PERMISSIONS.CONTACTS_WRITE), deleteContact);

export default router;
