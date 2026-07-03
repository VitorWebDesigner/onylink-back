import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { companiesController } from './companies.controller';
import { companySchema } from './companies.schema';

const router = Router();

router.post('/', requireAuth, decodePayload, validate(companySchema), asyncHandler(companiesController.create));
router.get('/:id', optionalAuth, asyncHandler(companiesController.byId));
router.patch('/:id', requireAuth, decodePayload, validate(companySchema), asyncHandler(companiesController.update));

export default router;
