import { Request, Response } from 'express';
import * as tourPhotoService from './tour-photos.service';

/**
 * Create a new tour photo
 * POST /api/tours/:tourId/photos
 */
export const createTourPhoto = async (req: Request, res: Response) => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = (req as any).user.id;
    const { image_url, caption, photo_date } = req.body;

    if (!image_url || !photo_date) {
      return res.status(400).json({ error: 'image_url and photo_date are required' });
    }

    const photo = await tourPhotoService.createTourPhoto(tourId, userId, {
      image_url,
      caption,
      photo_date,
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error('Error creating tour photo:', error);
    res.status(500).json({ error: 'Failed to create tour photo' });
  }
};

/**
 * Delete a tour photo
 * DELETE /api/tours/:tourId/photos/:photoId
 */
export const deleteTourPhoto = async (req: Request, res: Response) => {
  try {
    const photoId = parseInt(req.params.photoId);
    const userId = (req as any).user.id;

    await tourPhotoService.deleteTourPhoto(photoId, userId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting tour photo:', error);
    if (error.message === 'Photo not found') {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (error.message === 'Permission denied') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    res.status(500).json({ error: 'Failed to delete tour photo' });
  }
};
