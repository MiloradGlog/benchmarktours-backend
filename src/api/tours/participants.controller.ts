import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  getAllUsers,
  getTourParticipants,
  assignUserToTour,
  unassignUserFromTour,
  getUserTours,
  getUserTourById,
  getUserTourActivities
} from './participants.service';

export const getAllUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ users });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTourParticipantsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tourId = parseInt(req.params.tourId);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    // For non-admin users, verify they're assigned to this tour
    if (req.user?.role !== 'Admin') {
      const userTour = await getUserTourById(req.user!.id, tourId);
      if (!userTour) {
        res.status(403).json({ error: 'Access denied - not assigned to this tour' });
        return;
      }
    }

    const participants = await getTourParticipants(tourId);
    res.status(200).json({ participants });
  } catch (error: any) {
    console.error('Get tour participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignUserToTourController = async (req: Request, res: Response): Promise<void> => {
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

    const { userId } = req.body;
    const participant = await assignUserToTour(tourId, userId);

    res.status(201).json({
      message: 'User assigned to tour successfully',
      participant
    });
  } catch (error: any) {
    console.error('Assign user to tour error:', error);
    
    if (error.message === 'User is already assigned to this tour') {
      res.status(409).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unassignUserFromTourController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.params.userId;
    
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const success = await unassignUserFromTour(tourId, userId);
    
    if (!success) {
      res.status(404).json({ error: 'User assignment not found' });
      return;
    }

    res.status(200).json({ message: 'User unassigned from tour successfully' });
  } catch (error: any) {
    console.error('Unassign user from tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserToursController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tours = await getUserTours(req.user.id);
    res.status(200).json({ tours });
  } catch (error: any) {
    console.error('Get user tours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserTourByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tourId = parseInt(req.params.tourId);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    // Check if user is assigned to this tour and get the tour details
    const tour = await getUserTourById(req.user.id, tourId);
    
    if (!tour) {
      res.status(403).json({ error: 'Access denied - not assigned to this tour' });
      return;
    }

    res.status(200).json({ tour });
  } catch (error: any) {
    console.error('Get user tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserTourActivitiesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tourId = parseInt(req.params.tourId);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    // Check if user is assigned to this tour and get the activities
    const activities = await getUserTourActivities(req.user.id, tourId);
    
    if (!activities) {
      res.status(403).json({ error: 'Access denied - not assigned to this tour' });
      return;
    }

    res.status(200).json({ activities });
  } catch (error: any) {
    console.error('Get user tour activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};