import { query } from '../config/db';
import { fileStorageService } from './FileStorageService';

export class CleanupService {
  
  /**
   * Process pending file cleanup operations
   * This should be called periodically by a background job
   */
  async processPendingCleanups(limit: number = 100): Promise<number> {
    try {
      // Get unprocessed cleanup records
      const result = await query(`
        SELECT id, file_url, file_type
        FROM file_cleanup_log
        WHERE cleaned = FALSE
        ORDER BY deleted_at ASC
        LIMIT $1
      `, [limit]);

      let processedCount = 0;

      for (const record of result.rows) {
        try {
          // Attempt to delete the file
          await fileStorageService.deleteFileByUrl(record.file_url);
          
          // Mark as cleaned
          await query(`
            UPDATE file_cleanup_log
            SET cleaned = TRUE, cleanup_attempted_at = NOW()
            WHERE id = $1
          `, [record.id]);
          
          processedCount++;
          console.log(`Cleaned up ${record.file_type}: ${record.file_url}`);
          
        } catch (error: any) {
          // Log the error but continue processing
          await query(`
            UPDATE file_cleanup_log
            SET cleanup_attempted_at = NOW(), error_message = $2
            WHERE id = $1
          `, [record.id, error.message]);
          
          console.error(`Failed to cleanup ${record.file_type} ${record.file_url}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      console.error('Error processing pending cleanups:', error);
      return 0;
    }
  }

  /**
   * Clean old cleanup log entries
   */
  async cleanupOldLogEntries(daysOld: number = 30): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM file_cleanup_log
        WHERE cleaned = TRUE
        AND cleanup_attempted_at < NOW() - INTERVAL '${daysOld} days'
      `);
      
      console.log(`Cleaned up ${result.rowCount} old log entries`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old log entries:', error);
      return 0;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
  }> {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE cleaned = FALSE AND cleanup_attempted_at IS NULL) as pending,
          COUNT(*) FILTER (WHERE cleaned = TRUE) as completed,
          COUNT(*) FILTER (WHERE cleaned = FALSE AND cleanup_attempted_at IS NOT NULL) as failed
        FROM file_cleanup_log
      `);
      
      return result.rows[0] || { pending: 0, completed: 0, failed: 0 };
    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      return { pending: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Manually queue a file for cleanup
   */
  async queueFileForCleanup(fileUrl: string, fileType: string): Promise<void> {
    if (!fileUrl) return;
    
    try {
      await query(`
        INSERT INTO file_cleanup_log (file_url, file_type)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [fileUrl, fileType]);
      
      console.log(`Queued ${fileType} for cleanup: ${fileUrl}`);
    } catch (error) {
      console.error(`Error queuing file for cleanup: ${fileUrl}`, error);
    }
  }

  /**
   * Immediate cleanup - attempts to delete file right away
   * Falls back to queuing if immediate deletion fails
   */
  async immediateCleanup(fileUrl: string, fileType: string): Promise<boolean> {
    if (!fileUrl) return true;
    
    try {
      await fileStorageService.deleteFileByUrl(fileUrl);
      return true;
    } catch (error) {
      console.warn(`Immediate cleanup failed for ${fileType}: ${fileUrl}, queuing for later`);
      await this.queueFileForCleanup(fileUrl, fileType);
      return false;
    }
  }
}

export const cleanupService = new CleanupService();