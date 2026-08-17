import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  requireTourMembership,
  requireTourMembershipByActivityId,
} from '../../middleware/tourMembership.middleware';
import * as reviewController from './review.controller';

const router = express.Router();

// All review routes require authentication (app is private)
router.use(authenticateToken);

// Activity review routes (scoped to the activity's tour)
router.post('/activities/:activityId/reviews', requireTourMembershipByActivityId, reviewController.createReview);
router.get('/activities/:activityId/reviews', requireTourMembershipByActivityId, reviewController.getActivityReviews);
router.get('/activities/:activityId/reviews/me', requireTourMembershipByActivityId, reviewController.getUserReviewForActivity);
router.get('/activities/:activityId/reviews/stats', requireTourMembershipByActivityId, reviewController.getActivityReviewStats);

// Tour review routes
router.get('/tours/:tourId/reviews', requireTourMembership, reviewController.getTourReviews);
router.get('/tours/:tourId/reviews/stats', requireTourMembership, reviewController.getTourReviewStats);

// Individual review routes
router.put('/reviews/:reviewId', reviewController.updateReview); // ownership enforced in SQL
router.delete('/reviews/:reviewId', reviewController.deleteReview); // own-content erasure must never be blocked

export default router;