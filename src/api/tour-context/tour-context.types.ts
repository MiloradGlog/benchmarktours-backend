/**
 * Tour Context API Types
 *
 * These types define the structure for AI-powered tour management operations.
 * Designed for Gemini structured outputs to enable natural language tour modifications.
 *
 * IMPORTANT: All dates and times are in Japanese Standard Time (JST, UTC+9).
 * When "today" is requested, it resolves to the current date in Japan.
 */

// ============================================================================
// Activity Types (shared)
// ============================================================================

export type ActivityType =
  | 'CompanyVisit'
  | 'Hotel'
  | 'Restaurant'
  | 'Travel'
  | 'Discussion';

/**
 * Activity response object with all relevant fields for AI operations
 */
export interface ActivityResponse {
  id: number;
  tour_id: number;
  type: ActivityType;
  title: string;
  description?: string;
  start_time: string; // ISO 8601 datetime string
  end_time: string;   // ISO 8601 datetime string
  location_details?: string;
  company_id?: number;
  company_name?: string;
  survey_url?: string;
  image_url?: string;
  linked_activity_id?: number;
}

// ============================================================================
// GET /api/tour-context - Get Tour Context
// ============================================================================

export interface GetTourContextRequest {
  tourId: number;
}

export interface GetTourContextResponse {
  tour: {
    id: number;
    name: string;
    description?: string;
    start_date: string; // ISO 8601 date string (YYYY-MM-DD)
    end_date: string;   // ISO 8601 date string (YYYY-MM-DD)
    status: 'Draft' | 'Pending' | 'Completed';
    current_date: string; // ISO 8601 date string (server's current date)
  };
}

// ============================================================================
// GET /api/tour-context/activities - Get Activities by Date
// ============================================================================

export interface GetActivitiesByDateRequest {
  tourId: number;
  date?: string | string[]; // "today", "YYYY-MM-DD", or array of dates
  includeMetadata?: boolean; // Include company names, etc.
}

export interface GetActivitiesByDateResponse {
  activities: ActivityResponse[];
  request_date: string; // The resolved date(s) that were queried
}

// ============================================================================
// PATCH /api/tour-context/activities/bulk-update - Bulk Update Activities
// ============================================================================

/**
 * Operation type for bulk updates
 */
export type BulkUpdateOperationType =
  | 'shift_time'      // Move activities by relative offset (minutes)
  | 'move_to_date'    // Move to different day, preserve time-of-day
  | 'reschedule';     // Set explicit new start time

/**
 * Shift time operation: move activities by X minutes
 */
export interface ShiftTimeOperation {
  type: 'shift_time';
  shiftMinutes: number; // Positive or negative (e.g., 60 = +1 hour, -30 = -30 min)
  preserveDuration?: boolean; // Default: true
}

/**
 * Move to date operation: move to different day
 */
export interface MoveToDateOperation {
  type: 'move_to_date';
  targetDate: string; // ISO date (YYYY-MM-DD)
  targetTime?: string; // Optional: HH:MM (24-hour format)
  preserveDuration?: boolean; // Default: true
}

/**
 * Reschedule operation: set exact new datetime
 */
export interface RescheduleOperation {
  type: 'reschedule';
  newStartTime: string; // ISO 8601 datetime string
  preserveDuration?: boolean; // Default: true
}

/**
 * Union type of all operation types
 */
export type ActivityUpdateOperation =
  | ShiftTimeOperation
  | MoveToDateOperation
  | RescheduleOperation;

export interface BulkUpdateActivitiesRequest {
  tourId: number;
  activityIds: number[];
  operation: ActivityUpdateOperation;
}

/**
 * Result of a single activity update
 */
export interface ActivityUpdateResult {
  id: number;
  title: string;
  old_start_time: string; // ISO 8601 datetime
  new_start_time: string;
  old_end_time: string;
  new_end_time: string;
  duration_minutes: number;
}

/**
 * Validation error for an activity update
 */
export interface ActivityValidationError {
  activity_id: number;
  activity_title: string;
  error_type:
    | 'outside_tour_dates'   // New date is outside tour start/end
    | 'invalid_time'         // Invalid time format or logic
    | 'not_found'            // Activity doesn't exist
    | 'access_denied';       // Activity doesn't belong to tour
  message: string;
  attempted_time?: string; // The time that was attempted
}

export interface BulkUpdateActivitiesResponse {
  success: boolean;
  updated: ActivityUpdateResult[];
  failed?: ActivityValidationError[];
  message: string;
}
