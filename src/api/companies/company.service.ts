import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';
import { cleanupService } from '../../services/CleanupService';

export interface Company {
  id: number;
  name: string;
  address?: string;
  website?: string;
  description?: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCompanyData {
  name: string;
  address?: string;
  website?: string;
  description?: string;
  image_url?: string;
}

export interface UpdateCompanyData {
  name?: string;
  address?: string;
  website?: string;
  description?: string;
  image_url?: string;
}

export const createCompany = async (companyData: CreateCompanyData): Promise<Company> => {
  const { name, address, website, description, image_url } = companyData;
  
  const result = await query(`
    INSERT INTO companies (name, address, website, description, image_url)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, address, website, description, image_url, created_at, updated_at
  `, [name, address || null, website || null, description || null, image_url || null]);

  return result.rows[0];
};

export const getAllCompanies = async (): Promise<Company[]> => {
  const result = await query(`
    SELECT id, name, address, website, description, image_url, created_at, updated_at
    FROM companies
    ORDER BY name ASC
  `);
  
  return result.rows;
};

export const getCompanyById = async (id: number): Promise<Company | null> => {
  const result = await query(`
    SELECT id, name, address, website, description, image_url, created_at, updated_at
    FROM companies
    WHERE id = $1
  `, [id]);
  
  return result.rows[0] || null;
};

export const updateCompany = async (id: number, updateData: UpdateCompanyData): Promise<Company | null> => {
  const { name, address, website, description, image_url } = updateData;
  
  // Get current company to check if we need to delete old image
  let oldImageUrl: string | null = null;
  if (image_url !== undefined) {
    const current = await getCompanyById(id);
    if (current && current.image_url && current.image_url !== image_url) {
      oldImageUrl = current.image_url;
    }
  }
  
  const result = await query(`
    UPDATE companies 
    SET 
      name = COALESCE($2, name),
      address = COALESCE($3, address),
      website = COALESCE($4, website),
      description = COALESCE($5, description),
      image_url = COALESCE($6, image_url),
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, address, website, description, image_url, created_at, updated_at
  `, [id, name, address, website, description, image_url]);
  
  // If update was successful and we have an old image to delete
  if (result.rows[0] && oldImageUrl) {
    await fileStorageService.deleteFileByUrl(oldImageUrl);
  }
  
  return result.rows[0] || null;
};

export const deleteCompany = async (id: number): Promise<boolean> => {
  // Get company first to retrieve image URL
  const company = await getCompanyById(id);
  
  // Get activities that will have their company_id set to NULL (ON DELETE SET NULL)
  // We don't need to cleanup their images as activities can exist without companies
  // The database trigger will handle any necessary cleanup logging
  
  const result = await query('DELETE FROM companies WHERE id = $1', [id]);
  
  // If deletion was successful and company had an image, clean it up immediately
  if (result.rowCount > 0 && company?.image_url) {
    // Try immediate cleanup, fall back to queue if needed
    await cleanupService.immediateCleanup(company.image_url, 'company_image');
  }
  
  return result.rowCount > 0;
};