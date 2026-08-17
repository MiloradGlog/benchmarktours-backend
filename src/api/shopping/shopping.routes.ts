import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  requireTourMembership,
  requireTourMembershipByShoppingItemId,
} from '../../middleware/tourMembership.middleware';
import * as shoppingController from './shopping.controller';

const router = Router();

// All shopping routes require authentication
router.use(authenticateToken);

// Get all shopping items for a tour
router.get('/tours/:tourId/shopping-items', requireTourMembership, shoppingController.getShoppingItems);

// Get a specific shopping item with comments
router.get('/shopping-items/:itemId', requireTourMembershipByShoppingItemId, shoppingController.getShoppingItem);

// Create a new shopping item
router.post('/tours/:tourId/shopping-items', requireTourMembership, shoppingController.createShoppingItem);

// Update a shopping item
router.put('/shopping-items/:itemId', requireTourMembershipByShoppingItemId, shoppingController.updateShoppingItem);

// Delete a shopping item
router.delete('/shopping-items/:itemId', requireTourMembershipByShoppingItemId, shoppingController.deleteShoppingItem);

// Vote on a shopping item
router.post('/shopping-items/:itemId/vote', requireTourMembershipByShoppingItemId, shoppingController.voteOnItem);

// Remove vote from a shopping item
router.delete('/shopping-items/:itemId/vote', requireTourMembershipByShoppingItemId, shoppingController.removeVote);

// Add a comment to a shopping item
router.post('/shopping-items/:itemId/comments', requireTourMembershipByShoppingItemId, shoppingController.addComment);

export default router;