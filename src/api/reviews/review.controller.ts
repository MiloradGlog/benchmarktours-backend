import { Request, Response } from 'express';
import * as reviewService from './review.service';

export const createReview = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { rating, review_text } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if user already reviewed this activity
    const existingReview = await reviewService.getUserReviewForActivity(user_id, parseInt(activityId));
    if (existingReview) {
      return res.status(409).json({ error: 'User has already reviewed this activity' });
    }

    const review = await reviewService.createReview({
      user_id,
      activity_id: parseInt(activityId),
      rating,
      review_text
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { rating, review_text } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const review = await reviewService.updateReview(parseInt(reviewId), user_id, { rating, review_text });
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found or not authorized' });
    }

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const deleted = await reviewService.deleteReview(parseInt(reviewId), user_id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Review not found or not authorized' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};

export const getActivityReviews = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const reviews = await reviewService.getReviewsByActivity(parseInt(activityId));
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching activity reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const getTourReviews = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;
    const reviews = await reviewService.getReviewsByTour(parseInt(tourId));
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching tour reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const getUserReviewForActivity = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const review = await reviewService.getUserReviewForActivity(user_id, parseInt(activityId));
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json(review);
  } catch (error) {
    console.error('Error fetching user review:', error);
    res.status(500).json({ error: 'Failed to fetch user review' });
  }
};

export const getActivityReviewStats = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const stats = await reviewService.getActivityReviewStats(parseInt(activityId));
    res.json(stats);
  } catch (error) {
    console.error('Error fetching activity review stats:', error);
    res.status(500).json({ error: 'Failed to fetch review stats' });
  }
};

export const getTourReviewStats = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;
    const stats = await reviewService.getTourReviewStats(parseInt(tourId));
    res.json(stats);
  } catch (error) {
    console.error('Error fetching tour review stats:', error);
    res.status(500).json({ error: 'Failed to fetch tour review stats' });
  }
};