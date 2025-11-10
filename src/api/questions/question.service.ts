import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';

export interface ActivityQuestion {
  id: number;
  activity_id: number;
  user_id: string;
  question_text: string;
  created_at: Date;
  // Joined fields
  user_name?: string;
  activity_title?: string;
  answers?: Array<{
    note_id: number;
    content: string;
    created_at: Date;
    attachments?: Array<{ type: string; url: string }>;
  }>;
}

export interface CreateQuestionData {
  question_text: string;
}

/**
 * Transform attachment URLs in question answers from file paths to signed URLs
 */
async function transformQuestionAnswersAttachments(question: ActivityQuestion): Promise<ActivityQuestion> {
  if (!question || !question.answers || question.answers.length === 0) {
    return question;
  }

  const transformedAnswers = await Promise.all(
    question.answers.map(async (answer: any) => {
      if (answer.attachments && Array.isArray(answer.attachments) && answer.attachments.length > 0) {
        const transformedAttachments = await Promise.all(
          answer.attachments.map(async (attachment: any) => {
            if (attachment && attachment.url) {
              const signedUrl = await fileStorageService.getSignedUrlFromPathOrUrl(attachment.url);
              return {
                ...attachment,
                url: signedUrl
              };
            }
            return attachment;
          })
        );
        return {
          ...answer,
          attachments: transformedAttachments
        };
      }
      return answer;
    })
  );

  return {
    ...question,
    answers: transformedAnswers
  };
}

/**
 * Transform attachment URLs in an array of questions from file paths to signed URLs
 */
async function transformQuestionsAnswersAttachments(questions: ActivityQuestion[]): Promise<ActivityQuestion[]> {
  if (!questions || questions.length === 0) {
    return questions;
  }

  return Promise.all(questions.map(q => transformQuestionAnswersAttachments(q)));
}

const createQuestion = async (
  activityId: number,
  userId: string,
  data: CreateQuestionData
): Promise<ActivityQuestion> => {
  const sql = `
    INSERT INTO activity_questions (activity_id, user_id, question_text)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const result = await query(sql, [activityId, userId, data.question_text]);
  return result.rows[0];
};

const getQuestionsByActivity = async (
  activityId: number,
  currentUserId?: string,
  filterToUserOnly?: boolean
): Promise<ActivityQuestion[]> => {
  const sql = `
    SELECT
      aq.*,
      u.first_name || ' ' || u.last_name as user_name,
      a.title as activity_title,
      COALESCE(
        json_agg(
          json_build_object(
            'note_id', n.id,
            'content', n.content,
            'created_at', n.created_at,
            'attachments', n.attachments
          ) ORDER BY n.created_at ASC
        ) FILTER (WHERE n.id IS NOT NULL),
        '[]'
      ) as answers
    FROM activity_questions aq
    LEFT JOIN users u ON aq.user_id = u.id
    LEFT JOIN activities a ON aq.activity_id = a.id
    LEFT JOIN notes n ON n.question_id = aq.id
      AND (n.is_private = false OR n.user_id = $2)
    WHERE aq.activity_id = $1
    ${filterToUserOnly ? 'AND aq.user_id = $2' : ''}
    GROUP BY aq.id, u.first_name, u.last_name, a.title
    ORDER BY aq.created_at DESC
  `;

  const params = [activityId, currentUserId];
  const result = await query(sql, params);

  const questions = result.rows.map((row: any) => ({
    id: row.id,
    activity_id: row.activity_id,
    user_id: row.user_id,
    question_text: row.question_text,
    created_at: row.created_at,
    user_name: row.user_name,
    activity_title: row.activity_title,
    answers: row.answers || []
  }));

  return transformQuestionsAnswersAttachments(questions);
};

const getQuestionById = async (questionId: number): Promise<ActivityQuestion | null> => {
  const sql = `
    SELECT
      aq.*,
      u.first_name || ' ' || u.last_name as user_name,
      a.title as activity_title
    FROM activity_questions aq
    LEFT JOIN users u ON aq.user_id = u.id
    LEFT JOIN activities a ON aq.activity_id = a.id
    WHERE aq.id = $1
  `;

  const result = await query(sql, [questionId]);
  return result.rows[0] || null;
};

const deleteQuestion = async (questionId: number, userId: string, deleteAnswers: boolean = false): Promise<boolean> => {
  // If deleteAnswers is true, delete related notes first
  if (deleteAnswers) {
    await query(
      'DELETE FROM notes WHERE question_id = $1 AND user_id = $2',
      [questionId, userId]
    );
  }

  const sql = `
    DELETE FROM activity_questions
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;

  const result = await query(sql, [questionId, userId]);
  return (result.rowCount ?? 0) > 0;
};

const getUnansweredQuestions = async (
  activityId: number,
  userId: string
): Promise<ActivityQuestion[]> => {
  const sql = `
    SELECT
      aq.*,
      a.title as activity_title
    FROM activity_questions aq
    LEFT JOIN activities a ON aq.activity_id = a.id
    LEFT JOIN notes n ON n.question_id = aq.id AND n.user_id = aq.user_id
    WHERE aq.activity_id = $1
    AND aq.user_id = $2
    AND n.id IS NULL
    ORDER BY aq.created_at ASC
  `;

  const result = await query(sql, [activityId, userId]);
  return result.rows;
};

export default {
  createQuestion,
  getQuestionsByActivity,
  getQuestionById,
  deleteQuestion,
  getUnansweredQuestions
};