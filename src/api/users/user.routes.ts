import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import { 
  getMe, 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  getUsersStats,
  searchUsers,
  getUsersByRole
} from './user.controller';
import { getUserToursController, getUserTourByIdController, getUserTourActivitiesController } from '../tours/participants.controller';

const router = Router();

// Validation middleware
const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('role').isIn(['Admin', 'User', 'Guide']).withMessage('Role must be Admin, User, or Guide')
];

const updateUserValidation = [
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('last_name').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('role').optional().isIn(['Admin', 'User', 'Guide']).withMessage('Role must be Admin, User, or Guide')
];

// Protected routes
router.get('/me', authenticateToken, getMe);
router.get('/my-tours', authenticateToken, getUserToursController);
router.get('/my-tours/:tourId', authenticateToken, getUserTourByIdController);
router.get('/my-tours/:tourId/activities', authenticateToken, getUserTourActivitiesController);

// Admin only routes for user management
router.get('/', authenticateToken, requireAdmin, getAllUsers);
router.get('/stats', authenticateToken, requireAdmin, getUsersStats);
router.get('/search', authenticateToken, requireAdmin, searchUsers);
router.get('/role/:role', authenticateToken, requireAdmin, getUsersByRole);
router.get('/:id', authenticateToken, requireAdmin, getUserById);
router.post('/', authenticateToken, requireAdmin, createUserValidation, createUser);
router.put('/:id', authenticateToken, requireAdmin, updateUserValidation, updateUser);
router.delete('/:id', authenticateToken, requireAdmin, deleteUser);

export default router;