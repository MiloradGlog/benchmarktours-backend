import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as reviewController from './review.controller';

const router = express.Router();

// All review routes require authentication (app is private)
router.use(authenticateToken);

// Activity review routes
router.post('/activities/:activityId/reviews', reviewController.createReview);
router.get('/activities/:activityId/reviews', reviewController.getActivityReviews);
router.get('/activities/:activityId/reviews/me', reviewController.getUserReviewForActivity);
router.get('/activities/:activityId/reviews/stats', reviewController.getActivityReviewStats);

// Tour review routes
router.get('/tours/:tourId/reviews', reviewController.getTourReviews);
router.get('/tours/:tourId/reviews/stats', reviewController.getTourReviewStats);

// Individual review routes
router.put('/reviews/:reviewId', reviewController.updateReview);
router.delete('/reviews/:reviewId', reviewController.deleteReview);

export default router;