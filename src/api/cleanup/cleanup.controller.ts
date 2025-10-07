import { Request, Response } from 'express';
import { cleanupService } from '../../services/CleanupService';

export const getCleanupStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow admin users to view cleanup stats
    if (req.user.role !== 'Admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const stats = await cleanupService.getCleanupStats();
    
    res.json({
      message: 'Cleanup statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({ error: 'Failed to get cleanup statistics' });
  }
};

export const processCleanupController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow admin users to trigger cleanup
    if (req.user.role !== 'Admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const limit = parseInt(req.body.limit) || 50;
    const processedCount = await cleanupService.processPendingCleanups(limit);
    
    res.json({
      message: 'Cleanup processing completed',
      processedCount
    });

  } catch (error) {
    console.error('Error processing cleanup:', error);
    res.status(500).json({ error: 'Failed to process cleanup' });
  }
};