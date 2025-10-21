import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  createTour,
  getAllTours,
  getTourById,
  updateTour,
  updateTourStatus,
  deleteTour,
  getUserTourStats,
  getRecentTourActivity,
  CreateTourData,
  UpdateTourData,
  TourStatus
} from './tour.service';

export const createTourController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const tourData: CreateTourData = {
      ...req.body,
      start_date: new Date(req.body.start_date),
      end_date: new Date(req.body.end_date)
    };

    const tour = await createTour(tourData);

    res.status(201).json({
      message: 'Tour created successfully',
      tour
    });
  } catch (error: any) {
    console.error('Create tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllToursController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tours = await getAllTours();
    res.status(200).json({ tours });
  } catch (error: any) {
    console.error('Get tours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTourByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const tour = await getTourById(id);
    if (!tour) {
      res.status(404).json({ error: 'Tour not found' });
      return;
    }

    res.status(200).json({ tour });
  } catch (error: any) {
    console.error('Get tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTourController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const updateData: UpdateTourData = { ...req.body };
    if (req.body.start_date) updateData.start_date = new Date(req.body.start_date);
    if (req.body.end_date) updateData.end_date = new Date(req.body.end_date);

    const tour = await updateTour(id, updateData);

    if (!tour) {
      res.status(404).json({ error: 'Tour not found' });
      return;
    }

    res.status(200).json({
      message: 'Tour updated successfully',
      tour
    });
  } catch (error: any) {
    console.error('Update tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTourStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const { status } = req.body;
    if (!status || !['Draft', 'Pending', 'Completed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be Draft, Pending, or Completed' });
      return;
    }

    const tour = await updateTourStatus(id, status as TourStatus);
    
    res.status(200).json({
      message: 'Tour status updated successfully',
      tour
    });
  } catch (error: any) {
    console.error('Update tour status error:', error);
    if (error.message.includes('Invalid status transition') || error.message.includes('Tour not found')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const deleteTourController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const deleted = await deleteTour(id);
    if (!deleted) {
      res.status(404).json({ error: 'Tour not found' });
      return;
    }

    res.status(200).json({ message: 'Tour deleted successfully' });
  } catch (error: any) {
    console.error('Delete tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const uploadTourLogoController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const tour = await getTourById(id);
    if (!tour) {
      res.status(404).json({ error: 'Tour not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { fileStorageService } = await import('../../services/FileStorageService');
    
    const uploadResult = await fileStorageService.uploadTourLogo(
      id,
      req.file.buffer,
      req.file.originalname
    );

    // Validate URL length before database update
    if (uploadResult.url.length > 2000) {
      res.status(400).json({ 
        error: 'Generated URL is too long for storage',
        details: `URL length: ${uploadResult.url.length}, maximum allowed: 2000`
      });
      return;
    }

    const updatedTour = await updateTour(id, {
      theme_logo_url: uploadResult.url
    });

    res.status(200).json({
      message: 'Tour logo uploaded successfully',
      tour: updatedTour,
      upload: uploadResult
    });
  } catch (error: any) {
    console.error('Upload tour logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};;


export const getUserTourStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tourId = parseInt(req.params.id);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const stats = await getUserTourStats(tourId, userId);
    res.status(200).json({ stats });
  } catch (error: any) {
    console.error('Get user tour stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const getRecentTourActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    const tourId = parseInt(req.params.id);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const activities = await getRecentTourActivity(tourId, userId);
    res.status(200).json({ activities });
  } catch (error: any) {
    console.error('Get recent tour activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
