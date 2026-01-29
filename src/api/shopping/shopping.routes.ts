import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as shoppingController from './shopping.controller';

const router = Router();

// All shopping routes require authentication
router.use(authenticateToken);

// Get all shopping items for a tour
router.get('/tours/:tourId/shopping-items', shoppingController.getShoppingItems);

// Get a specific shopping item with comments
router.get('/shopping-items/:itemId', shoppingController.getShoppingItem);

// Create a new shopping item
router.post('/tours/:tourId/shopping-items', shoppingController.createShoppingItem);

// Update a shopping item
router.put('/shopping-items/:itemId', shoppingController.updateShoppingItem);

// Delete a shopping item
router.delete('/shopping-items/:itemId', shoppingController.deleteShoppingItem);

// Vote on a shopping item
router.post('/shopping-items/:itemId/vote', shoppingController.voteOnItem);

// Remove vote from a shopping item
router.delete('/shopping-items/:itemId/vote', shoppingController.removeVote);

// Add a comment to a shopping item
router.post('/shopping-items/:itemId/comments', shoppingController.addComment);

export default router;