import { query } from '../../config/db';
import pool from '../../config/db';
import {
  GetTourContextResponse,
  GetActivitiesByDateResponse,
  BulkUpdateActivitiesResponse,
  ActivityResponse,
  ActivityUpdateOperation,
  ActivityUpdateResult,
  ActivityValidationError,
} from './tour-context.types';

/**
 * Japanese timezone constant (JST = UTC+9)
 */
const JAPAN_TIMEZONE = 'Asia/Tokyo';

/**
 * Get current date in Japanese timezone (YYYY-MM-DD)
 */
const getJapaneseDate = (): string => {
  return new Date().toLocaleString('en-CA', {
    timeZone: JAPAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).split(',')[0]; // Returns YYYY-MM-DD
};

/**
 * Get current datetime in Japanese timezone
 */
const getJapaneseDateTime = (): Date => {
  const nowInJapan = new Date().toLocaleString('en-US', {
    timeZone: JAPAN_TIMEZONE,
  });
  return new Date(nowInJapan);
};

/**
 * Verify user is a participant of the tour
 */
const verifyUserTourAccess = async (userId: string, tourId: number): Promise<boolean> => {
  const result = await query(
    `SELECT 1 FROM tour_participants WHERE user_id = $1 AND tour_id = $2`,
    [userId, tourId]
  );
  return result.rows.length > 0;
};

/**
 * Get tour context with boundaries and current date
 */
export const getTourContext = async (
  tourId: number,
  userId: string
): Promise<GetTourContextResponse> => {
  // Verify user access
  const hasAccess = await verifyUserTourAccess(userId, tourId);
  if (!hasAccess) {
    throw new Error('User does not have access to this tour');
  }

  // Get tour info
  const result = await query(
    `SELECT id, name, description, start_date, end_date, status
     FROM tours
     WHERE id = $1`,
    [tourId]
  );

  if (result.rows.length === 0) {
    throw new Error('Tour not found');
  }

  const tour = result.rows[0];
  const currentDate = getJapaneseDate(); // Current date in Japanese timezone

  return {
    tour: {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      start_date: tour.start_date.toISOString().split('T')[0],
      end_date: tour.end_date.toISOString().split('T')[0],
      status: tour.status,
      current_date: currentDate,
    },
  };
};

/**
 * Parse date input - handles "today", single date, or array of dates
 * All dates are interpreted in Japanese timezone
 */
const parseDateInput = (dateInput?: string | string[]): string[] => {
  if (!dateInput || dateInput === 'today') {
    const today = getJapaneseDate(); // Use Japanese date for "today"
    return [today];
  }

  if (Array.isArray(dateInput)) {
    return dateInput;
  }

  return [dateInput];
};

/**
 * Get activities by date(s) for a tour
 */
export const getActivitiesByDate = async (
  tourId: number,
  userId: string,
  dateInput?: string | string[],
  includeMetadata: boolean = true
): Promise<GetActivitiesByDateResponse> => {
  // Verify user access
  const hasAccess = await verifyUserTourAccess(userId, tourId);
  if (!hasAccess) {
    throw new Error('User does not have access to this tour');
  }

  const dates = parseDateInput(dateInput);

  // Build query - compare dates in JST timezone
  const dateConditions = dates.map((_, idx) => `DATE(a.start_time AT TIME ZONE 'Asia/Tokyo') = $${idx + 2}::date`).join(' OR ');

  const queryText = includeMetadata
    ? `SELECT
        a.id, a.tour_id, a.type, a.title, a.description,
        a.start_time, a.end_time, a.location_details, a.survey_url, a.image_url,
        a.company_id, a.linked_activity_id,
        c.name as company_name
      FROM activities a
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.tour_id = $1 AND (${dateConditions})
      ORDER BY a.start_time ASC`
    : `SELECT
        a.id, a.tour_id, a.type, a.title, a.description,
        a.start_time, a.end_time, a.location_details, a.survey_url, a.image_url,
        a.company_id, a.linked_activity_id
      FROM activities a
      WHERE a.tour_id = $1 AND (${dateConditions})
      ORDER BY a.start_time ASC`;

  const result = await query(queryText, [tourId, ...dates]);

  const activities: ActivityResponse[] = result.rows.map((row) => ({
    id: row.id,
    tour_id: row.tour_id,
    type: row.type,
    title: row.title,
    description: row.description,
    start_time: row.start_time.toISOString(),
    end_time: row.end_time.toISOString(),
    location_details: row.location_details,
    company_id: row.company_id,
    company_name: row.company_name,
    survey_url: row.survey_url,
    image_url: row.image_url,
    linked_activity_id: row.linked_activity_id,
  }));

  return {
    activities,
    request_date: dates.length === 1 ? dates[0] : dates.join(', '),
  };
};

/**
 * Calculate new times based on operation
 */
const calculateNewTimes = (
  operation: ActivityUpdateOperation,
  oldStartTime: Date,
  oldEndTime: Date
): { newStartTime: Date; newEndTime: Date } => {
  const preserveDuration = operation.preserveDuration !== false; // Default true
  const durationMs = oldEndTime.getTime() - oldStartTime.getTime();

  switch (operation.type) {
    case 'shift_time': {
      const shiftMs = operation.shiftMinutes * 60 * 1000;
      const newStartTime = new Date(oldStartTime.getTime() + shiftMs);
      const newEndTime = new Date(oldEndTime.getTime() + shiftMs);
      return { newStartTime, newEndTime };
    }

    case 'move_to_date': {
      const targetDate = new Date(operation.targetDate);

      let newStartTime: Date;
      if (operation.targetTime) {
        // Use specified time
        const [hours, minutes] = operation.targetTime.split(':').map(Number);
        newStartTime = new Date(targetDate);
        newStartTime.setHours(hours, minutes, 0, 0);
      } else {
        // Preserve time-of-day
        newStartTime = new Date(targetDate);
        newStartTime.setHours(
          oldStartTime.getHours(),
          oldStartTime.getMinutes(),
          oldStartTime.getSeconds(),
          oldStartTime.getMilliseconds()
        );
      }

      const newEndTime = preserveDuration
        ? new Date(newStartTime.getTime() + durationMs)
        : new Date(oldEndTime);

      return { newStartTime, newEndTime };
    }

    case 'reschedule': {
      const newStartTime = new Date(operation.newStartTime);
      const newEndTime = preserveDuration
        ? new Date(newStartTime.getTime() + durationMs)
        : new Date(oldEndTime);

      return { newStartTime, newEndTime };
    }

    default:
      throw new Error('Invalid operation type');
  }
};

/**
 * Validate new activity times against tour boundaries
 */
const validateActivityTimes = (
  activityId: number,
  activityTitle: string,
  newStartTime: Date,
  newEndTime: Date,
  tourStartDate: Date,
  tourEndDate: Date
): ActivityValidationError | null => {
  // Check if new times are outside tour boundaries
  if (newStartTime < tourStartDate || newEndTime > tourEndDate) {
    return {
      activity_id: activityId,
      activity_title: activityTitle,
      error_type: 'outside_tour_dates',
      message: `Activity times (${newStartTime.toISOString()} - ${newEndTime.toISOString()}) fall outside tour dates (${tourStartDate.toISOString()} - ${tourEndDate.toISOString()})`,
      attempted_time: newStartTime.toISOString(),
    };
  }

  // Check if end time is after start time
  if (newEndTime <= newStartTime) {
    return {
      activity_id: activityId,
      activity_title: activityTitle,
      error_type: 'invalid_time',
      message: 'End time must be after start time',
      attempted_time: newStartTime.toISOString(),
    };
  }

  return null;
};

/**
 * Bulk update activities with atomic transaction
 */
export const bulkUpdateActivities = async (
  tourId: number,
  userId: string,
  activityIds: number[],
  operation: ActivityUpdateOperation
): Promise<BulkUpdateActivitiesResponse> => {
  // Verify user access
  const hasAccess = await verifyUserTourAccess(userId, tourId);
  if (!hasAccess) {
    throw new Error('User does not have access to this tour');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get tour boundaries
    const tourResult = await client.query(
      `SELECT start_date, end_date FROM tours WHERE id = $1`,
      [tourId]
    );

    if (tourResult.rows.length === 0) {
      throw new Error('Tour not found');
    }

    const { start_date: tourStartDate, end_date: tourEndDate } = tourResult.rows[0];

    // Get all activities
    const activitiesResult = await client.query(
      `SELECT id, title, start_time, end_time, tour_id
       FROM activities
       WHERE id = ANY($1)`,
      [activityIds]
    );

    const activities = activitiesResult.rows;

    // Validate all activities belong to the tour
    const invalidActivities = activities.filter((a) => a.tour_id !== tourId);
    if (invalidActivities.length > 0) {
      const errors: ActivityValidationError[] = invalidActivities.map((a) => ({
        activity_id: a.id,
        activity_title: a.title,
        error_type: 'access_denied',
        message: 'Activity does not belong to this tour',
      }));

      await client.query('ROLLBACK');
      return {
        success: false,
        updated: [],
        failed: errors,
        message: 'Some activities do not belong to this tour',
      };
    }

    // Check if all activities exist
    if (activities.length !== activityIds.length) {
      const foundIds = new Set(activities.map((a) => a.id));
      const missingIds = activityIds.filter((id) => !foundIds.has(id));
      const errors: ActivityValidationError[] = missingIds.map((id) => ({
        activity_id: id,
        activity_title: 'Unknown',
        error_type: 'not_found',
        message: 'Activity not found',
      }));

      await client.query('ROLLBACK');
      return {
        success: false,
        updated: [],
        failed: errors,
        message: 'Some activities were not found',
      };
    }

    // Calculate new times and validate
    const updates: Array<{
      id: number;
      title: string;
      oldStart: Date;
      oldEnd: Date;
      newStart: Date;
      newEnd: Date;
    }> = [];
    const validationErrors: ActivityValidationError[] = [];

    for (const activity of activities) {
      const { newStartTime, newEndTime } = calculateNewTimes(
        operation,
        activity.start_time,
        activity.end_time
      );

      const validationError = validateActivityTimes(
        activity.id,
        activity.title,
        newStartTime,
        newEndTime,
        tourStartDate,
        tourEndDate
      );

      if (validationError) {
        validationErrors.push(validationError);
      } else {
        updates.push({
          id: activity.id,
          title: activity.title,
          oldStart: activity.start_time,
          oldEnd: activity.end_time,
          newStart: newStartTime,
          newEnd: newEndTime,
        });
      }
    }

    // If any validation errors, rollback
    if (validationErrors.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        updated: [],
        failed: validationErrors,
        message: 'Validation failed for some activities',
      };
    }

    // Perform updates
    const updateResults: ActivityUpdateResult[] = [];
    for (const update of updates) {
      await client.query(
        `UPDATE activities
         SET start_time = $1, end_time = $2, updated_at = NOW()
         WHERE id = $3`,
        [update.newStart, update.newEnd, update.id]
      );

      const durationMinutes = Math.round(
        (update.newEnd.getTime() - update.newStart.getTime()) / (60 * 1000)
      );

      updateResults.push({
        id: update.id,
        title: update.title,
        old_start_time: update.oldStart.toISOString(),
        new_start_time: update.newStart.toISOString(),
        old_end_time: update.oldEnd.toISOString(),
        new_end_time: update.newEnd.toISOString(),
        duration_minutes: durationMinutes,
      });
    }

    await client.query('COMMIT');

    return {
      success: true,
      updated: updateResults,
      message: `Successfully updated ${updateResults.length} activities`,
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
