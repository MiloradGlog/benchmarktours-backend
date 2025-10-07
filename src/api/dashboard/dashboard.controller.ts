import { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';

export const getDashboardStatsController = async (req: Request, res: Response) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const getRecentActivityController = async (req: Request, res: Response) => {
  try {
    const activities = await dashboardService.getRecentActivity();
    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
};
