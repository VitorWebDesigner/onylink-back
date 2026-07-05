import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { rateLimit } from '../../middlewares/rateLimit';
import { messagesController } from './messages.controller';
import { addMembersSchema, createChatGroupSchema, sendMessageSchema, updateChatGroupSchema } from './messages.schema';

const router = Router();

// tudo aqui exige sessão
router.get('/', requireAuth, asyncHandler(messagesController.list));
router.get('/contacts', requireAuth, asyncHandler(messagesController.contacts)); // antes de /:id
router.post('/with/:userId', requireAuth, asyncHandler(messagesController.openDm));
router.post('/groups', requireAuth, decodePayload, validate(createChatGroupSchema), asyncHandler(messagesController.createGroup));

router.get('/:id', requireAuth, asyncHandler(messagesController.detail));
router.patch('/:id', requireAuth, decodePayload, validate(updateChatGroupSchema), asyncHandler(messagesController.updateGroup));

router.get('/:id/messages', requireAuth, asyncHandler(messagesController.messages));
router.post(
  '/:id/messages',
  requireAuth,
  rateLimit({ keyPrefix: 'chat-send', max: 60, windowSec: 60 }),
  decodePayload,
  validate(sendMessageSchema),
  asyncHandler(messagesController.sendMessage),
);
router.post('/:id/read', requireAuth, asyncHandler(messagesController.markRead));

router.post('/:id/members', requireAuth, decodePayload, validate(addMembersSchema), asyncHandler(messagesController.addMembers));
router.delete('/:id/members/:userId', requireAuth, asyncHandler(messagesController.removeMember));
router.post('/:id/members/:userId/promote', requireAuth, asyncHandler(messagesController.promote));
router.post('/:id/members/:userId/transfer', requireAuth, asyncHandler(messagesController.transfer));

router.post('/:id/pin', requireAuth, asyncHandler(messagesController.pin));
router.delete('/:id/pin', requireAuth, asyncHandler(messagesController.unpin));

export default router;
