import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import {
  createCompanyController,
  getAllCompaniesController,
  getCompanyByIdController,
  updateCompanyController,
  deleteCompanyController
} from './company.controller';

const router = Router();

// Validation middleware
const createCompanyValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Website must be a valid URL'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters')
];

const updateCompanyValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Website must be a valid URL'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters')
];

// Routes - GET routes allow any authenticated user, others require admin
router.get('/', authenticateToken, getAllCompaniesController);
router.get('/:id', authenticateToken, getCompanyByIdController);

// Admin-only routes for modifications
router.post('/', authenticateToken, requireAdmin, createCompanyValidation, createCompanyController);
router.put('/:id', authenticateToken, requireAdmin, updateCompanyValidation, updateCompanyController);
router.delete('/:id', authenticateToken, requireAdmin, deleteCompanyController);

export default router;