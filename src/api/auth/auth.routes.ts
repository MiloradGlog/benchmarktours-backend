import { Router } from 'express';
import { body } from 'express-validator';
import { login } from './auth.controller';

const router = Router();

// Validation middleware
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Routes
// Public registration is disabled - all users must be created by admins
router.post('/login', loginValidation, login);

export default router;