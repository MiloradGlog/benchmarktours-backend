import { tool } from '@langchain/core/tools';
import * as z from 'zod';
import { Pool } from 'pg';
import {
  ScheduleAdjustmentParams,
  ScheduleAdjustmentResult,
  ActivityTimeChange,
  ScheduleConflict,
  Activity
} from '../types/ai';

/**
 * Creates a schedule adjustment tool for the AI agent
 * @param pool Database connection pool
 * @param tourId The tour ID (baked into the tool, not exposed to AI) - SECURITY: prevents cross-tour access
 */
export function scheduleAdjustmentTool(pool: Pool, tourId: number) {
  return tool(
    async ({
      activityIds,
      offsetMinutes,
      effectiveFrom,
      reason,
      executeImmediately = false
    }: ScheduleAdjustmentParams): Promise<ScheduleAdjustmentResult> => {
      const client = await pool.connect();

      try {
        // Query current activities
        // Note: PostgreSQL handles timezone conversion automatically
        // effectiveFrom can be in any format (JST, UTC, ISO) - PostgreSQL will parse it correctly
        // SECURITY: tour_id filter prevents AI from modifying activities in other tours
        const activitiesQuery = `
          SELECT a.*, t.name as tour_name
          FROM activities a
          JOIN tours t ON a.tour_id = t.id
          WHERE a.tour_id = $1
          AND a.id = ANY($2::int[])
          AND a.start_time >= $3::timestamptz
          ORDER BY a.start_time
        `;

        const activitiesResult = await client.query(activitiesQuery, [
          tourId,
          activityIds,
          effectiveFrom
        ]);

        if (activitiesResult.rows.length === 0) {
          return {
            success: false,
            proposedChanges: [],
            requiresApproval: false,
            conflicts: [{
              type: 'error' as const,
              activityId: 0,
              description: 'No activities found matching the criteria',
              severity: 'error' as const
            }]
          };
        }

        const proposedChanges: ActivityTimeChange[] = [];
        const conflicts: ScheduleConflict[] = [];

        // Calculate new times for each activity
        // NOTE: DB stores in UTC, we manipulate in UTC, but AI thinks in JST
        // The offset is timezone-agnostic (e.g., +60 mins is same in any TZ)
        for (const activity of activitiesResult.rows) {
          const oldStartTime = new Date(activity.start_time); // UTC from DB
          const oldEndTime = new Date(activity.end_time);     // UTC from DB
          const newStartTime = new Date(oldStartTime.getTime() + offsetMinutes * 60000);
          const newEndTime = new Date(oldEndTime.getTime() + offsetMinutes * 60000);

          console.log(`⏰ Time adjustment for "${activity.title}":`, {
            offsetMinutes,
            oldUTC: `${oldStartTime.toISOString()} - ${oldEndTime.toISOString()}`,
            newUTC: `${newStartTime.toISOString()} - ${newEndTime.toISOString()}`,
            oldJST: `${oldStartTime.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'})} - ${oldEndTime.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'})}`,
            newJST: `${newStartTime.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'})} - ${newEndTime.toLocaleString('en-US', {timeZone: 'Asia/Tokyo'})}`
          });

          // Check for basic time validity
          if (newStartTime >= newEndTime) {
            conflicts.push({
              type: 'error' as const,
              activityId: activity.id,
              description: `Invalid time range for ${activity.title}: start time would be after end time`,
              severity: 'error' as const
            });
            continue;
          }

          // Check for conflicts with other activities in the same tour
          const conflictQuery = `
            SELECT id, title, start_time, end_time
            FROM activities
            WHERE tour_id = $1
            AND id != $2
            AND NOT (
              end_time <= $3 OR start_time >= $4
            )
          `;

          const conflictResult = await client.query(conflictQuery, [
            activity.tour_id,
            activity.id,
            newStartTime,
            newEndTime
          ]);

          if (conflictResult.rows.length > 0) {
            conflictResult.rows.forEach(conflict => {
              conflicts.push({
                type: 'overlap',
                activityId: activity.id,
                description: `${activity.title} would overlap with ${conflict.title}`,
                severity: 'warning'
              });
            });
          }

          // Check for too early (before 6 AM JST) and too late (after 11 PM JST)
          // Convert to JST hours for validation
          const newStartJSTHour = parseInt(newStartTime.toLocaleString('en-US', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            hour12: false
          }));
          const newEndJSTHour = parseInt(newEndTime.toLocaleString('en-US', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            hour12: false
          }));

          if (newStartJSTHour < 6) {
            conflicts.push({
              type: 'too_early',
              activityId: activity.id,
              description: `${activity.title} would start before 6:00 AM JST`,
              severity: 'warning'
            });
          }

          if (newEndJSTHour >= 23) {
            conflicts.push({
              type: 'too_late',
              activityId: activity.id,
              description: `${activity.title} would end after 11:00 PM JST`,
              severity: 'warning'
            });
          }

          // Count affected participants — never embed names/emails here: this
          // object is persisted, returned to clients, traced to LangSmith,
          // and fed back to the LLM.
          const participantsResult = await client.query(
            'SELECT COUNT(*)::int AS count FROM tour_participants WHERE tour_id = $1',
            [activity.tour_id]
          );
          const affectedParticipantCount: number = participantsResult.rows[0]?.count ?? 0;

          proposedChanges.push({
            activityId: activity.id,
            activityName: activity.title,
            tourId: activity.tour_id,
            oldStartTime,
            newStartTime,
            oldEndTime,
            newEndTime,
            affectedParticipantCount
          });
        }

        // If there are any error-level conflicts, don't proceed
        const hasErrors = conflicts.some(c => c.severity === 'error');
        if (hasErrors) {
          return {
            success: false,
            proposedChanges: [],
            requiresApproval: false,
            conflicts
          };
        }

        // If executeImmediately is true, apply changes directly
        if (executeImmediately) {
          try {
            await client.query('BEGIN');

            // Apply all the changes in a transaction
            // SECURITY: Also verify tour_id in UPDATE to prevent race conditions
            for (const change of proposedChanges) {
              const updateResult = await client.query(
                `UPDATE activities
                 SET start_time = $1, end_time = $2, updated_at = NOW()
                 WHERE id = $3 AND tour_id = $4`,
                [change.newStartTime, change.newEndTime, change.activityId, tourId]
              );

              // If no rows updated, activity doesn't belong to this tour (security violation)
              if (updateResult.rowCount === 0) {
                throw new Error(`Security violation: Activity ${change.activityId} does not belong to tour ${tourId}`);
              }
            }

            await client.query('COMMIT');

            return {
              success: true,
              appliedChanges: proposedChanges,
              requiresApproval: false,
              conflicts: conflicts.length > 0 ? conflicts : undefined,
              message: `Successfully adjusted ${proposedChanges.length} ${proposedChanges.length === 1 ? 'activity' : 'activities'} by ${offsetMinutes > 0 ? '+' : ''}${offsetMinutes} minutes.${conflicts.length > 0 ? ' Note: There are warnings to review.' : ''}`
            };
          } catch (applyError) {
            await client.query('ROLLBACK');
            console.error('Error applying schedule changes:', applyError);
            return {
              success: false,
              requiresApproval: false,
              conflicts: [{
                type: 'error' as const,
                activityId: 0,
                description: `Failed to apply changes: ${applyError instanceof Error ? applyError.message : 'Unknown error'}`,
                severity: 'error' as const
              }]
            };
          }
        }

        // Standard approval flow - return proposed changes
        return {
          success: true,
          proposedChanges,
          requiresApproval: true,
          conflicts: conflicts.length > 0 ? conflicts : undefined
        };
      } catch (error) {
        console.error('Schedule adjustment tool error:', error);
        return {
          success: false,
          requiresApproval: false,
          conflicts: [{
            type: 'error' as const,
            activityId: 0,
            description: error instanceof Error ? error.message : 'Unknown error occurred',
            severity: 'error' as const
          }]
        };
      } finally {
        client.release();
      }
    },
    {
      name: 'adjust_activity_times',
      description: 'Adjust start and end times for tour activities by a specified offset in minutes. NOTE: When calculating offsets, use the JST times shown in the schedule. For example, if an activity is at 20:00 JST and needs to move to 12:00 JST, the offset is -480 minutes (-8 hours). For Guides actively managing tours, use executeImmediately=true to apply changes instantly. For Admins planning tours, use executeImmediately=false (default) to propose changes for approval.',
      schema: z.object({
        activityIds: z.array(z.number()).describe('Array of activity IDs to adjust'),
        offsetMinutes: z.number().describe('Minutes to add (positive) or subtract (negative) from current times. Calculate offset based on JST times shown in schedule. Example: to move from 20:00 JST to 12:00 JST, use -480 minutes.'),
        effectiveFrom: z.string().describe('Datetime string - only adjust activities starting from this time. Can be in JST format ("YYYY-MM-DD HH:mm JST") or ISO format. JST times will be automatically converted to UTC for database comparison.'),
        reason: z.string().optional().describe('Optional reason for the adjustment'),
        executeImmediately: z.boolean().optional().describe('If true, apply changes immediately without approval (for Guides). If false/omitted, propose changes for approval (for Admins). Default: false')
      })
    }
  );
}

/**
 * Creates a tool to view the current schedule for a tour
 * @param pool Database connection pool
 * @param tourId The tour ID (baked into the tool, not exposed to AI)
 */
export function viewScheduleTool(pool: Pool, tourId: number) {
  return tool(
    async ({ date }: { date?: string }) => {
      const client = await pool.connect();

      try {
        let query = `
          SELECT
            a.id,
            a.title,
            a.type,
            a.location_details,
            a.start_time,
            a.end_time,
            c.name as company_name
          FROM activities a
          LEFT JOIN companies c ON a.company_id = c.id
          WHERE a.tour_id = $1
        `;

        const params: any[] = [tourId];

        if (date) {
          // Compare dates in JST timezone, not UTC
          query += ` AND DATE(a.start_time AT TIME ZONE 'Asia/Tokyo') = DATE($2::date)`;
          params.push(date);
        }

        query += ` ORDER BY a.start_time`;

        const result = await client.query(query, params);

        // Helper function to format time in JST
        const formatJST = (date: Date): string => {
          return new Date(date).toLocaleString('en-US', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(/(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)/, '$3-$1-$2 $4:$5 JST');
        };

        return {
          success: true,
          tourId,
          date: date || 'all dates',
          timezone: 'Asia/Tokyo (JST)',
          activities: result.rows.map(row => ({
            id: row.id,
            name: row.title,
            type: row.type,
            location: row.location_details,
            startTime: formatJST(row.start_time),
            endTime: formatJST(row.end_time),
            company: row.company_name
          }))
        };
      } catch (error) {
        console.error('View schedule tool error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        client.release();
      }
    },
    {
      name: 'view_schedule',
      description: 'View the current schedule for the active tour in JST timezone, optionally filtered by date. All times returned are in Asia/Tokyo timezone (JST). The tour context is automatically provided - do not specify a tour ID.',
      schema: z.object({
        date: z.string().optional().describe('Optional date filter (YYYY-MM-DD format)')
      })
    }
  );
}

/**
 * Creates a tool to check for schedule conflicts
 * @param pool Database connection pool
 * @param tourId The tour ID (baked into the tool, not exposed to AI)
 */
export function checkConflictsTool(pool: Pool, tourId: number) {
  return tool(
    async () => {
      const client = await pool.connect();

      try {
        // Find overlapping activities
        const query = `
          SELECT
            a1.id as activity1_id,
            a1.title as activity1_name,
            a1.start_time as activity1_start,
            a1.end_time as activity1_end,
            a2.id as activity2_id,
            a2.title as activity2_name,
            a2.start_time as activity2_start,
            a2.end_time as activity2_end
          FROM activities a1
          JOIN activities a2 ON a1.tour_id = a2.tour_id AND a1.id < a2.id
          WHERE a1.tour_id = $1
          AND NOT (
            a1.end_time <= a2.start_time OR a1.start_time >= a2.end_time
          )
          ORDER BY a1.start_time
        `;

        const result = await client.query(query, [tourId]);

        const conflicts = result.rows.map(row => ({
          type: 'overlap',
          activity1: {
            id: row.activity1_id,
            name: row.activity1_name,
            startTime: row.activity1_start,
            endTime: row.activity1_end
          },
          activity2: {
            id: row.activity2_id,
            name: row.activity2_name,
            startTime: row.activity2_start,
            endTime: row.activity2_end
          },
          description: `${row.activity1_name} overlaps with ${row.activity2_name}`
        }));

        return {
          success: true,
          tourId,
          hasConflicts: conflicts.length > 0,
          conflicts
        };
      } catch (error) {
        console.error('Check conflicts tool error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        client.release();
      }
    },
    {
      name: 'check_conflicts',
      description: 'Check for scheduling conflicts in the active tour. The tour context is automatically provided - do not specify a tour ID.',
      schema: z.object({})
    }
  );
}

/**
 * Creates a tool to get tour information
 * @param pool Database connection pool
 * @param tourId The tour ID (baked into the tool, not exposed to AI)
 */
export function getTourInfoTool(pool: Pool, tourId: number) {
  return tool(
    async () => {
      const client = await pool.connect();

      try {
        const tourQuery = `
          SELECT
            t.id,
            t.name,
            t.description,
            t.start_date,
            t.end_date,
            t.status,
            COUNT(DISTINCT a.id) as activity_count,
            COUNT(DISTINCT tp.user_id) as participant_count
          FROM tours t
          LEFT JOIN activities a ON t.id = a.tour_id
          LEFT JOIN tour_participants tp ON t.id = tp.tour_id
          WHERE t.id = $1
          GROUP BY t.id
        `;

        const result = await client.query(tourQuery, [tourId]);

        if (result.rows.length === 0) {
          return {
            success: false,
            error: 'Tour not found'
          };
        }

        const tour = result.rows[0];

        return {
          success: true,
          tour: {
            id: tour.id,
            name: tour.name,
            description: tour.description,
            startDate: tour.start_date,
            endDate: tour.end_date,
            status: tour.status,
            activityCount: tour.activity_count,
            participantCount: tour.participant_count
          }
        };
      } catch (error) {
        console.error('Get tour info tool error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        client.release();
      }
    },
    {
      name: 'get_tour_info',
      description: 'Get detailed information about the active tour. The tour context is automatically provided - do not specify a tour ID.',
      schema: z.object({})
    }
  );
}