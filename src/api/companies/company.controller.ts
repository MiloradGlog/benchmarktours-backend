import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  CreateCompanyData,
  UpdateCompanyData
} from './company.service';

export const createCompanyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const companyData: CreateCompanyData = req.body;
    const company = await createCompany(companyData);

    res.status(201).json({
      message: 'Company created successfully',
      company
    });
  } catch (error: any) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllCompaniesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await getAllCompanies();
    res.status(200).json({ companies });
  } catch (error: any) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompanyByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const company = await getCompanyById(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.status(200).json({ company });
  } catch (error: any) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCompanyController = async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const updateData: UpdateCompanyData = req.body;
    const company = await updateCompany(id, updateData);

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.status(200).json({
      message: 'Company updated successfully',
      company
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCompanyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const deleted = await deleteCompany(id);
    if (!deleted) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.status(200).json({ message: 'Company deleted successfully' });
  } catch (error: any) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};