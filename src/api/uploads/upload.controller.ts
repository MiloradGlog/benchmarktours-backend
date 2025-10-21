import { Request, Response } from 'express';
import { fileStorageService } from '../../services/FileStorageService';
import { query } from '../../config/db';

export const uploadCompanyImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    // Verify company exists and get current image URL
    const companyResult = await query('SELECT id, image_url FROM companies WHERE id = $1', [companyId]);
    if (companyResult.rows.length === 0) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const oldImageUrl = companyResult.rows[0].image_url;

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadCompanyImage(
      companyId, 
      req.file.buffer, 
      req.file.originalname
    );

    // Update company record with new image URL
    await query(
      'UPDATE companies SET image_url = $1, updated_at = NOW() WHERE id = $2',
      [uploadResult.url, companyId]
    );

    // Delete old image if it existed
    if (oldImageUrl) {
      await fileStorageService.deleteFileByUrl(oldImageUrl);
    }

    res.json({
      message: 'Company image uploaded successfully',
      imageUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading company image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const uploadActivityImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const activityId = parseInt(req.params.id);
    if (isNaN(activityId)) {
      res.status(400).json({ error: 'Invalid activity ID' });
      return;
    }

    // Verify activity exists and get current image URL
    const activityResult = await query('SELECT id, image_url FROM activities WHERE id = $1', [activityId]);
    if (activityResult.rows.length === 0) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const oldImageUrl = activityResult.rows[0].image_url;

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadActivityImage(
      activityId, 
      req.file.buffer, 
      req.file.originalname
    );

    // Update activity record with new image URL
    await query(
      'UPDATE activities SET image_url = $1, updated_at = NOW() WHERE id = $2',
      [uploadResult.url, activityId]
    );

    // Delete old image if it existed
    if (oldImageUrl) {
      await fileStorageService.deleteFileByUrl(oldImageUrl);
    }

    res.json({
      message: 'Activity image uploaded successfully',
      imageUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading activity image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const uploadDiscussionImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // For discussion images, we'll create a temporary messageId or allow frontend to specify
    // This is a placeholder approach - in real implementation, this might be tied to message creation
    const tempMessageId = Date.now(); // Temporary ID for file naming

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadDiscussionImage(
      tempMessageId, 
      req.file.buffer, 
      req.file.originalname
    );

    res.json({
      message: 'Discussion image uploaded successfully',
      imageUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading discussion image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const uploadDiscussionVoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // For discussion voice, we'll create a temporary messageId or allow frontend to specify
    const tempMessageId = Date.now(); // Temporary ID for file naming

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadDiscussionVoice(
      tempMessageId, 
      req.file.buffer, 
      req.file.originalname
    );

    res.json({
      message: 'Discussion voice recording uploaded successfully',
      voiceUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading discussion voice:', error);
    res.status(500).json({ error: 'Failed to upload voice recording' });
  }
};

export const uploadNoteAudioController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // For note audio, we'll create a temporary noteId or allow frontend to specify
    const tempNoteId = Date.now(); // Temporary ID for file naming

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadNoteAudio(
      tempNoteId,
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      message: 'Note audio uploaded successfully',
      audioUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading note audio:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
};

export const uploadNoteImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // For note images, we'll create a temporary noteId or allow frontend to specify
    const tempNoteId = Date.now(); // Temporary ID for file naming

    // Upload file to GCP
    const uploadResult = await fileStorageService.uploadNoteImage(
      tempNoteId,
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      message: 'Note image uploaded successfully',
      imageUrl: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size
    });

  } catch (error) {
    console.error('Error uploading note image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};