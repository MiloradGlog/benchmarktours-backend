import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  setupAccountController,
  changePasswordController,
  requestPasswordResetController,
  requestPasswordResetByEmailController,
  deleteAccountController
} from './auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

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

const setupAccountValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('setup_code')
    .trim()
    .isLength({ min: 8, max: 9 })
    .withMessage('Setup code must be 8 characters (format: XXXX-XXXX)'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

const changePasswordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

const requestPasswordResetByEmailValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

// Public routes
router.post('/login', loginValidation, login);
router.post('/setup-account', setupAccountValidation, setupAccountController);
router.post('/forgot-password', requestPasswordResetByEmailValidation, requestPasswordResetByEmailController);

// Protected routes (require authentication)
router.post('/change-password', authenticateToken, changePasswordValidation, changePasswordController);
router.post('/request-password-reset', authenticateToken, requestPasswordResetController);
router.delete('/delete-account', authenticateToken, deleteAccountController);

export default router;