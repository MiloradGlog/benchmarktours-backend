import { Request, Response } from 'express';
import * as service from './publicSurveyErasure.service';

const getEmailParam = (req: Request): string | null => {
  const email = req.query.email;
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return null;
  }
  return email.trim();
};

/**
 * GET /api/admin/public-survey-data?email=<email>
 * Admin-only DSAR access facility for anonymous survey respondents.
 */
export const getPublicSurveyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = getEmailParam(req);
    if (!email) {
      res.status(400).json({ error: 'email query parameter is required' });
      return;
    }

    const data = await service.exportPublicSurveyData(email);

    // Log only counts / admin id — never the exported PII content itself.
    console.log('Public survey DSAR export generated:', {
      adminId: req.user?.id,
      responses: data.length
    });

    res.status(200).json({ responses: data });
  } catch (error) {
    console.error('Public survey DSAR export error for admin:', req.user?.id, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/admin/public-survey-data?email=<email>
 * Admin-only erasure facility for anonymous survey respondents.
 */
export const deletePublicSurveyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = getEmailParam(req);
    if (!email) {
      res.status(400).json({ error: 'email query parameter is required' });
      return;
    }

    const deleted = await service.erasePublicSurveyData(email);

    console.log('Public survey erasure executed:', {
      adminId: req.user?.id,
      deleted
    });

    res.status(200).json({ deleted });
  } catch (error) {
    console.error('Public survey erasure error for admin:', req.user?.id, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
