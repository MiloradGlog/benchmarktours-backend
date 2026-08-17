import { Request, Response } from 'express';
import * as moderationService from './moderation.service';

export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status filter' });
      return;
    }
    const reports = await moderationService.listReports(status);
    res.json({ reports, pending_count: await moderationService.countPendingReports() });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
};

export const resolveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = parseInt(req.params.reportId);
    if (isNaN(reportId)) {
      res.status(400).json({ error: 'Invalid report id' });
      return;
    }
    const action = req.body?.action;
    if (action !== 'delete' && action !== 'dismiss') {
      res.status(400).json({ error: "action must be 'delete' or 'dismiss'" });
      return;
    }
    const ok = await moderationService.resolveReport(reportId, action, req.user!.id);
    if (!ok) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ message: action === 'delete' ? 'Message deleted' : 'Report dismissed' });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};
