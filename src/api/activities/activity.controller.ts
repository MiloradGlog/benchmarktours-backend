import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  createActivity,
  getActivitiesByTour,
  getAllActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getCurrentActivity,
  CreateActivityData,
  UpdateActivityData
} from './activity.service';

export const createActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const tourId = parseInt(req.params.tourId);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const activityData: CreateActivityData = {
      ...req.body,
      tour_id: tourId,
      start_time: new Date(req.body.start_time),
      end_time: new Date(req.body.end_time)
    };

    const activity = await createActivity(activityData);

    res.status(201).json({
      message: 'Activity created successfully',
      activity
    });
  } catch (error: any) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActivitiesByTourController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tourId = parseInt(req.params.tourId);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const activities = await getActivitiesByTour(tourId);
    res.status(200).json({ activities });
  } catch (error: any) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActivityByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.activityId);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid activity ID' });
      return;
    }

    const activity = await getActivityById(id);
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    res.status(200).json({ activity });
  } catch (error: any) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const id = parseInt(req.params.activityId);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid activity ID' });
      return;
    }

    const updateData: UpdateActivityData = { ...req.body };
    if (req.body.start_time) updateData.start_time = new Date(req.body.start_time);
    if (req.body.end_time) updateData.end_time = new Date(req.body.end_time);

    const activity = await updateActivity(id, updateData);

    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    res.status(200).json({
      message: 'Activity updated successfully',
      activity
    });
  } catch (error: any) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.activityId);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid activity ID' });
      return;
    }

    const deleted = await deleteActivity(id);
    if (!deleted) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    res.status(200).json({ message: 'Activity deleted successfully' });
  } catch (error: any) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllActivitiesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const activities = await getAllActivities();
    res.json({ activities });
  } catch (error: any) {
    console.error('Get all activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurrentActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const currentActivity = await getCurrentActivity(userId);

    if (!currentActivity) {
      res.status(404).json({
        message: 'No activity currently in progress',
        current_activity: null
      });
      return;
    }

    res.json({
      current_activity: currentActivity
    });
  } catch (error: any) {
    console.error('Get current activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
