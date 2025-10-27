import { query } from '../../config/db';
import {
  DiscussionTeam,
  DiscussionTeamMember,
  DiscussionQuestion,
  DiscussionTeamNote,
  CreateTeamData,
  CreateQuestionData,
  CreateTeamNoteData,
  UpdateTeamData,
  UpdateQuestionData,
  UpdateTeamNoteData,
  AssignTeamMemberData,
  DiscussionActivityDetails
} from './discussion.types';

// ==================== DISCUSSION TEAMS ====================

export const getTeamsByDiscussion = async (discussionActivityId: number): Promise<DiscussionTeam[]> => {
  const result = await query(
    `SELECT * FROM discussion_teams
     WHERE discussion_activity_id = $1
     ORDER BY order_index ASC`,
    [discussionActivityId]
  );
  return result.rows;
};

export const getTeamById = async (teamId: number): Promise<DiscussionTeam | null> => {
  const result = await query(
    'SELECT * FROM discussion_teams WHERE id = $1',
    [teamId]
  );
  return result.rows[0] || null;
};

export const createTeam = async (
  discussionActivityId: number,
  data: CreateTeamData
): Promise<DiscussionTeam> => {
  const result = await query(
    `INSERT INTO discussion_teams
     (discussion_activity_id, name, description, order_index)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [discussionActivityId, data.name, data.description, data.order_index]
  );
  return result.rows[0];
};

export const updateTeam = async (
  teamId: number,
  data: UpdateTeamData
): Promise<DiscussionTeam> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.order_index !== undefined) {
    fields.push(`order_index = $${paramCount++}`);
    values.push(data.order_index);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(teamId);
  const result = await query(
    `UPDATE discussion_teams SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0];
};

export const deleteTeam = async (teamId: number): Promise<void> => {
  await query('DELETE FROM discussion_teams WHERE id = $1', [teamId]);
};

// ==================== TEAM MEMBERS ====================

export const getTeamMembers = async (teamId: number): Promise<DiscussionTeamMember[]> => {
  const result = await query(
    `SELECT
      dtm.*,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.email as user_email
     FROM discussion_team_members dtm
     JOIN users u ON dtm.user_id = u.id
     WHERE dtm.team_id = $1
     ORDER BY dtm.joined_at ASC`,
    [teamId]
  );
  return result.rows;
};

export const assignTeamMember = async (data: AssignTeamMemberData): Promise<DiscussionTeamMember> => {
  const result = await query(
    `INSERT INTO discussion_team_members
     (team_id, user_id)
     VALUES ($1, $2)
     RETURNING *`,
    [data.team_id, data.user_id]
  );
  return result.rows[0];
};

export const removeTeamMember = async (teamId: number, userId: string): Promise<void> => {
  await query(
    'DELETE FROM discussion_team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
};

// ==================== REMOVED: PRESENTER (not needed for simplified discussion) ====================

// export const setPresenter = async (teamId: number, userId: string, isPresenter: boolean): Promise<void> => {
//   await query(
//     `UPDATE discussion_team_members
//      SET is_presenter = $3
//      WHERE team_id = $1 AND user_id = $2`,
//     [teamId, userId, isPresenter]
//   );
// };

// ==================== DISCUSSION QUESTIONS ====================

export const getQuestionsByDiscussion = async (discussionActivityId: number): Promise<DiscussionQuestion[]> => {
  const result = await query(
    `SELECT * FROM discussion_questions
     WHERE discussion_activity_id = $1
     ORDER BY order_index ASC`,
    [discussionActivityId]
  );
  return result.rows;
};

export const getQuestionById = async (questionId: number): Promise<DiscussionQuestion | null> => {
  const result = await query(
    'SELECT * FROM discussion_questions WHERE id = $1',
    [questionId]
  );
  return result.rows[0] || null;
};

export const createQuestion = async (
  discussionActivityId: number,
  data: CreateQuestionData
): Promise<DiscussionQuestion> => {
  const result = await query(
    `INSERT INTO discussion_questions
     (discussion_activity_id, question_text, order_index, is_required)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [discussionActivityId, data.question_text, data.order_index, data.is_required ?? true]
  );
  return result.rows[0];
};

export const updateQuestion = async (
  questionId: number,
  data: UpdateQuestionData
): Promise<DiscussionQuestion> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.question_text !== undefined) {
    fields.push(`question_text = $${paramCount++}`);
    values.push(data.question_text);
  }
  if (data.order_index !== undefined) {
    fields.push(`order_index = $${paramCount++}`);
    values.push(data.order_index);
  }
  if (data.is_required !== undefined) {
    fields.push(`is_required = $${paramCount++}`);
    values.push(data.is_required);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(questionId);
  const result = await query(
    `UPDATE discussion_questions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0];
};

export const deleteQuestion = async (questionId: number): Promise<void> => {
  await query('DELETE FROM discussion_questions WHERE id = $1', [questionId]);
};

// ==================== TEAM NOTES ====================

export const getNotesByTeam = async (teamId: number): Promise<DiscussionTeamNote[]> => {
  const result = await query(
    `SELECT
      dtn.*,
      dq.question_text,
      u.first_name || ' ' || u.last_name as author_name
     FROM discussion_team_notes dtn
     LEFT JOIN discussion_questions dq ON dtn.question_id = dq.id
     JOIN users u ON dtn.created_by = u.id
     WHERE dtn.team_id = $1
     ORDER BY dtn.created_at DESC`,
    [teamId]
  );
  return result.rows;
};

export const getNotesByQuestion = async (teamId: number, questionId: number): Promise<DiscussionTeamNote[]> => {
  const result = await query(
    `SELECT
      dtn.*,
      u.first_name || ' ' || u.last_name as author_name
     FROM discussion_team_notes dtn
     JOIN users u ON dtn.created_by = u.id
     WHERE dtn.team_id = $1 AND dtn.question_id = $2
     ORDER BY dtn.created_at DESC`,
    [teamId, questionId]
  );
  return result.rows;
};

export const createTeamNote = async (
  userId: string,
  data: CreateTeamNoteData
): Promise<DiscussionTeamNote> => {
  const attachments = data.attachments || [];
  const result = await query(
    `INSERT INTO discussion_team_notes
     (team_id, question_id, content, created_by, attachments)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.team_id, data.question_id, data.content, userId, JSON.stringify(attachments)]
  );
  return result.rows[0];
};

export const updateTeamNote = async (
  noteId: number,
  userId: string,
  data: UpdateTeamNoteData
): Promise<DiscussionTeamNote> => {
  // Verify the user is the author
  const checkResult = await query(
    'SELECT created_by FROM discussion_team_notes WHERE id = $1',
    [noteId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error('Note not found');
  }

  if (checkResult.rows[0].created_by !== userId) {
    throw new Error('Only the author can update this note');
  }

  const result = await query(
    `UPDATE discussion_team_notes
     SET content = $1
     WHERE id = $2
     RETURNING *`,
    [data.content, noteId]
  );

  return result.rows[0];
};

export const deleteTeamNote = async (noteId: number, userId: string): Promise<void> => {
  // Verify the user is the author
  const checkResult = await query(
    'SELECT created_by FROM discussion_team_notes WHERE id = $1',
    [noteId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error('Note not found');
  }

  if (checkResult.rows[0].created_by !== userId) {
    throw new Error('Only the author can delete this note');
  }

  await query('DELETE FROM discussion_team_notes WHERE id = $1', [noteId]);
};

// ==================== COMBINED OPERATIONS ====================

export const getDiscussionDetails = async (discussionActivityId: number): Promise<DiscussionActivityDetails> => {
  // Get all teams
  const teams = await getTeamsByDiscussion(discussionActivityId);

  // Get all questions
  const questions = await getQuestionsByDiscussion(discussionActivityId);

  // For each team, get members and notes
  const teamsWithDetails = await Promise.all(
    teams.map(async (team) => {
      const members = await getTeamMembers(team.id);
      const notes = await getNotesByTeam(team.id);

      return {
        ...team,
        members,
        notes
      };
    })
  );

  return {
    activity_id: discussionActivityId,
    teams: teamsWithDetails,
    questions
  };
};

// Helper function to initialize a discussion with default teams (no questions for photo-only discussions)
export const initializeDiscussion = async (
  discussionActivityId: number,
  teamCount: number = 3
): Promise<DiscussionActivityDetails> => {
  // Create teams only
  for (let i = 0; i < teamCount; i++) {
    await createTeam(discussionActivityId, {
      name: `Team ${i + 1}`,
      order_index: i
    });
  }

  return getDiscussionDetails(discussionActivityId);
};
