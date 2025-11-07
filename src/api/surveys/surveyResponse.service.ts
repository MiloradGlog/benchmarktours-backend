import { query } from '../../config/db';
import { getSurveyById } from './survey.service';

export interface SurveyResponse {
  id: number;
  survey_id: number;
  user_id?: string;
  started_at: Date;
  submitted_at?: Date;
  is_complete: boolean;
  metadata?: any;
  respondent_email?: string;
  respondent_name?: string;
  is_anonymous?: boolean;
  responses?: QuestionResponse[];
}

export interface QuestionResponse {
  id: number;
  response_id: number;
  question_id: number;
  text_response?: string;
  number_response?: number;
  date_response?: Date;
  selected_option_ids?: number[];
  rating_response?: number;
}

export interface CreateResponseData {
  survey_id: number;
  responses: CreateQuestionResponseData[];
  metadata?: any;
  respondent_email?: string;
  respondent_name?: string;
  is_anonymous?: boolean;
}

export interface CreateQuestionResponseData {
  question_id: number;
  text_response?: string;
  number_response?: number;
  date_response?: Date;
  selected_option_ids?: number[];
  rating_response?: number;
}

export interface SurveyResponseStats {
  survey_id: number;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  average_completion_time?: number;
  question_stats: QuestionStats[];
}

export interface QuestionStats {
  question_id: number;
  question_text: string;
  question_type: string;
  response_count: number;
  // For rating questions
  average_rating?: number;
  rating_distribution?: { [key: number]: number };
  // For multiple choice/checkbox
  option_counts?: { [optionId: number]: { text: string; count: number; percentage: number } };
  // For text responses
  sample_responses?: string[];
  // For yes/no questions
  yes_count?: number;
  no_count?: number;
}

// Create or update a survey response
export const submitSurveyResponse = async (userId: string, responseData: CreateResponseData): Promise<SurveyResponse> => {
  const client = await query('BEGIN');
  
  try {
    // Check if user already has a response for this survey
    const existingResult = await query(`
      SELECT id FROM survey_responses 
      WHERE survey_id = $1 AND user_id = $2
    `, [responseData.survey_id, userId]);
    
    let responseId: number;
    
    if (existingResult.rows.length > 0) {
      // Update existing response
      responseId = existingResult.rows[0].id;
      
      // Delete existing question responses
      await query('DELETE FROM survey_question_responses WHERE response_id = $1', [responseId]);
      
      // Update the response record
      await query(`
        UPDATE survey_responses 
        SET submitted_at = NOW(), is_complete = true, metadata = $1
        WHERE id = $2
      `, [responseData.metadata ? JSON.stringify(responseData.metadata) : null, responseId]);
    } else {
      // Create new response
      const responseResult = await query(`
        INSERT INTO survey_responses (survey_id, user_id, submitted_at, is_complete, metadata)
        VALUES ($1, $2, NOW(), true, $3)
        RETURNING id
      `, [responseData.survey_id, userId, responseData.metadata ? JSON.stringify(responseData.metadata) : null]);
      
      responseId = responseResult.rows[0].id;
    }
    
    // Insert question responses
    for (const questionResponse of responseData.responses) {
      await query(`
        INSERT INTO survey_question_responses 
        (response_id, question_id, text_response, number_response, date_response, selected_option_ids, rating_response)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        responseId,
        questionResponse.question_id,
        questionResponse.text_response || null,
        questionResponse.number_response || null,
        questionResponse.date_response || null,
        questionResponse.selected_option_ids || null,
        questionResponse.rating_response || null
      ]);
    }
    
    await query('COMMIT');
    
    return getSurveyResponse(responseId);
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

// Save partial response (for saving progress)
export const saveSurveyProgress = async (userId: string, surveyId: number, responses: CreateQuestionResponseData[]): Promise<SurveyResponse> => {
  const client = await query('BEGIN');
  
  try {
    // Check if user already has a response for this survey
    const existingResult = await query(`
      SELECT id FROM survey_responses 
      WHERE survey_id = $1 AND user_id = $2
    `, [surveyId, userId]);
    
    let responseId: number;
    
    if (existingResult.rows.length > 0) {
      responseId = existingResult.rows[0].id;
      
      // Delete existing question responses for the questions being saved
      const questionIds = responses.map(r => r.question_id);
      await query(
        `DELETE FROM survey_question_responses WHERE response_id = $1 AND question_id = ANY($2::int[])`,
        [responseId, questionIds]
      );
    } else {
      // Create new response (not complete)
      const responseResult = await query(`
        INSERT INTO survey_responses (survey_id, user_id, is_complete)
        VALUES ($1, $2, false)
        RETURNING id
      `, [surveyId, userId]);
      
      responseId = responseResult.rows[0].id;
    }
    
    // Insert/update question responses
    for (const questionResponse of responses) {
      await query(`
        INSERT INTO survey_question_responses 
        (response_id, question_id, text_response, number_response, date_response, selected_option_ids, rating_response)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (response_id, question_id) 
        DO UPDATE SET 
          text_response = EXCLUDED.text_response,
          number_response = EXCLUDED.number_response,
          date_response = EXCLUDED.date_response,
          selected_option_ids = EXCLUDED.selected_option_ids,
          rating_response = EXCLUDED.rating_response,
          updated_at = NOW()
      `, [
        responseId,
        questionResponse.question_id,
        questionResponse.text_response || null,
        questionResponse.number_response || null,
        questionResponse.date_response || null,
        questionResponse.selected_option_ids || null,
        questionResponse.rating_response || null
      ]);
    }
    
    await query('COMMIT');
    
    return getSurveyResponse(responseId);
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

// Get a specific survey response
export const getSurveyResponse = async (responseId: number): Promise<SurveyResponse> => {
  const responseResult = await query(`
    SELECT id, survey_id, user_id, started_at, submitted_at, is_complete, metadata
    FROM survey_responses
    WHERE id = $1
  `, [responseId]);
  
  if (responseResult.rows.length === 0) {
    throw new Error('Response not found');
  }
  
  const response = responseResult.rows[0];
  
  // Get question responses
  const questionsResult = await query(`
    SELECT id, response_id, question_id, text_response, number_response, 
           date_response, selected_option_ids, rating_response
    FROM survey_question_responses
    WHERE response_id = $1
  `, [responseId]);
  
  response.responses = questionsResult.rows;
  
  return response;
};

// Get user's response for a specific survey
export const getUserSurveyResponse = async (userId: string, surveyId: number): Promise<SurveyResponse | null> => {
  const responseResult = await query(`
    SELECT id, survey_id, user_id, started_at, submitted_at, is_complete, metadata
    FROM survey_responses
    WHERE user_id = $1 AND survey_id = $2
  `, [userId, surveyId]);
  
  if (responseResult.rows.length === 0) {
    return null;
  }
  
  const response = responseResult.rows[0];
  
  // Get question responses
  const questionsResult = await query(`
    SELECT id, response_id, question_id, text_response, number_response, 
           date_response, selected_option_ids, rating_response
    FROM survey_question_responses
    WHERE response_id = $1
  `, [response.id]);
  
  response.responses = questionsResult.rows;
  
  return response;
};

// Get all responses for a survey
export const getSurveyResponses = async (surveyId: number, includeDetails: boolean = false): Promise<SurveyResponse[]> => {
  const responseResult = await query(`
    SELECT r.id, r.survey_id, r.user_id, r.started_at, r.submitted_at, r.is_complete, r.metadata,
           r.respondent_email, r.respondent_name, r.is_anonymous,
           u.email, u.first_name, u.last_name
    FROM survey_responses r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.survey_id = $1
    ORDER BY r.submitted_at DESC NULLS LAST
  `, [surveyId]);
  
  const responses = responseResult.rows.map(row => ({
    ...row,
    user_email: row.is_anonymous ? row.respondent_email : (row.email || null),
    user_name: row.is_anonymous ? row.respondent_name : (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.first_name || row.last_name || null),
    completed_at: row.submitted_at
  }));
  
  if (includeDetails) {
    // Get question responses for each survey response
    for (const response of responses) {
      const questionsResult = await query(`
        SELECT id, response_id, question_id, text_response, number_response, 
               date_response, selected_option_ids, rating_response
        FROM survey_question_responses
        WHERE response_id = $1
      `, [response.id]);
      
      response.responses = questionsResult.rows;
    }
  }
  
  return responses;
};;;;

// Get survey response statistics
export const getSurveyResponseStats = async (surveyId: number): Promise<SurveyResponseStats> => {
  // Get survey details
  const survey = await getSurveyById(surveyId);
  if (!survey) {
    throw new Error('Survey not found');
  }
  
  // Get response counts
  const countResult = await query(`
    SELECT 
      COUNT(*) as total_responses,
      COUNT(CASE WHEN is_complete = true THEN 1 END) as completed_responses,
      AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))/60) as avg_completion_time
    FROM survey_responses
    WHERE survey_id = $1
  `, [surveyId]);
  
  const counts = countResult.rows[0];
  
  // Get statistics for each question
  const questionStats: QuestionStats[] = [];
  
  if (survey.questions) {
    for (const question of survey.questions) {
      const stats: QuestionStats = {
        question_id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        response_count: 0
      };
      
      if (question.question_type === 'RATING') {
        // Get rating statistics
        const ratingResult = await query(`
          SELECT 
            COUNT(*) as count,
            AVG(rating_response) as avg_rating,
            rating_response,
            COUNT(*) as rating_count
          FROM survey_question_responses
          WHERE question_id = $1 AND rating_response IS NOT NULL
          GROUP BY rating_response
        `, [question.id]);
        
        if (ratingResult.rows.length > 0) {
          stats.response_count = ratingResult.rows.reduce((sum, row) => sum + parseInt(row.rating_count), 0);
          stats.average_rating = parseFloat(ratingResult.rows[0].avg_rating) || 0;
          stats.rating_distribution = {};
          
          for (const row of ratingResult.rows) {
            if (row.rating_response) {
              stats.rating_distribution[row.rating_response] = parseInt(row.rating_count);
            }
          }
        }
      } else if (question.question_type === 'YES_NO') {
        // Get yes/no statistics
        const yesNoResult = await query(`
          SELECT 
            SUM(CASE WHEN text_response = 'Yes' THEN 1 ELSE 0 END) as yes_count,
            SUM(CASE WHEN text_response = 'No' THEN 1 ELSE 0 END) as no_count,
            COUNT(*) as total
          FROM survey_question_responses
          WHERE question_id = $1 AND text_response IS NOT NULL
        `, [question.id]);
        
        const row = yesNoResult.rows[0];
        stats.response_count = parseInt(row.total);
        stats.yes_count = parseInt(row.yes_count);
        stats.no_count = parseInt(row.no_count);
      } else if (['MULTIPLE_CHOICE', 'CHECKBOX'].includes(question.question_type)) {
        // Get option selection statistics
        if (question.options) {
          stats.option_counts = {};
          
          for (const option of question.options) {
            const optionResult = await query(`
              SELECT COUNT(*) as count
              FROM survey_question_responses
              WHERE question_id = $1 AND $2 = ANY(selected_option_ids)
            `, [question.id, option.id]);
            
            const count = parseInt(optionResult.rows[0].count);
            stats.option_counts[option.id] = {
              text: option.option_text,
              count: count,
              percentage: stats.response_count > 0 ? (count / stats.response_count) * 100 : 0
            };
          }
          
          // Update response count
          const totalResult = await query(`
            SELECT COUNT(*) as count
            FROM survey_question_responses
            WHERE question_id = $1 AND selected_option_ids IS NOT NULL
          `, [question.id]);
          
          stats.response_count = parseInt(totalResult.rows[0].count);
        }
      } else if (['TEXT', 'TEXTAREA'].includes(question.question_type)) {
        // Get sample text responses
        const textResult = await query(`
          SELECT text_response
          FROM survey_question_responses
          WHERE question_id = $1 AND text_response IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 5
        `, [question.id]);
        
        stats.response_count = textResult.rows.length;
        stats.sample_responses = textResult.rows.map(row => row.text_response);
      }
      
      questionStats.push(stats);
    }
  }
  
  const totalResponses = parseInt(counts.total_responses);
  const completedResponses = parseInt(counts.completed_responses);
  const partialResponses = totalResponses - completedResponses;
  
  return {
    survey_id: surveyId,
    total_responses: totalResponses,
    completed_responses: completedResponses,
    partial_responses: partialResponses,
    completion_rate: totalResponses > 0 
      ? (completedResponses / totalResponses) 
      : 0,
    average_completion_time: counts.avg_completion_time ? parseFloat(counts.avg_completion_time) : undefined,
    question_stats: questionStats
  };
};;

// Check if user has completed a survey
export const hasUserCompletedSurvey = async (userId: string, surveyId: number): Promise<boolean> => {
  const result = await query(`
    SELECT is_complete
    FROM survey_responses
    WHERE user_id = $1 AND survey_id = $2
  `, [userId, surveyId]);
  
  return result.rows.length > 0 && result.rows[0].is_complete === true;
};

// Get available surveys for a user (not completed)
export const getAvailableSurveysForUser = async (userId: string, tourId?: number): Promise<any[]> => {
  let queryStr = `
    SELECT DISTINCT s.id, s.title, s.description, s.type, s.status, s.tour_id, s.activity_id,
           sr.is_complete, sr.started_at
    FROM surveys s
    LEFT JOIN survey_responses sr ON s.id = sr.survey_id AND sr.user_id = $1
    WHERE s.status = 'ACTIVE'
  `;
  
  const params: any[] = [userId];
  let paramCount = 2;
  
  if (tourId) {
    queryStr += ` AND (s.tour_id = $${paramCount} OR s.id IN (
      SELECT application_survey_id FROM tours WHERE id = $${paramCount} AND application_survey_id IS NOT NULL
      UNION
      SELECT completion_survey_id FROM tours WHERE id = $${paramCount} AND completion_survey_id IS NOT NULL
      UNION
      SELECT feedback_survey_id FROM activities WHERE tour_id = $${paramCount} AND feedback_survey_id IS NOT NULL
    ))`;
    params.push(tourId);
    paramCount++;
  }
  
  queryStr += ' ORDER BY s.created_at DESC';
  
  const result = await query(queryStr, params);
  return result.rows;
};

// Submit anonymous survey response for public surveys
export const submitAnonymousResponse = async (
  token: string,
  responseData: CreateResponseData
): Promise<SurveyResponse | null> => {
  // Validate that this is for a public survey
  const surveyResult = await query(`
    SELECT id FROM surveys
    WHERE public_access_token = $1
      AND allow_public_access = true
      AND status = 'ACTIVE'
      AND (public_access_expires_at IS NULL OR public_access_expires_at > NOW())
  `, [token]);

  if (surveyResult.rows.length === 0) {
    throw new Error('Invalid or expired public survey token');
  }

  const surveyId = surveyResult.rows[0].id;

  // Validate email format if provided
  if (responseData.respondent_email && !isValidEmail(responseData.respondent_email)) {
    throw new Error('Invalid email format');
  }

  // Create the response record
  const responseResult = await query(`
    INSERT INTO survey_responses (
      survey_id, user_id, started_at, submitted_at, is_complete, metadata,
      respondent_email, respondent_name, is_anonymous
    )
    VALUES ($1, NULL, NOW(), NOW(), true, $2, $3, $4, true)
    RETURNING *
  `, [
    surveyId,
    responseData.metadata || {},
    responseData.respondent_email,
    responseData.respondent_name,
  ]);

  const responseId = responseResult.rows[0].id;

  // Insert individual question responses
  for (const qResponse of responseData.responses) {
    await query(`
      INSERT INTO survey_question_responses (
        response_id, question_id, text_response, number_response,
        date_response, selected_option_ids, rating_response
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      responseId,
      qResponse.question_id,
      qResponse.text_response,
      qResponse.number_response,
      qResponse.date_response,
      qResponse.selected_option_ids,
      qResponse.rating_response,
    ]);
  }

  return responseResult.rows[0];
};

// Save anonymous survey progress for public surveys
export const saveAnonymousProgress = async (
  token: string,
  responseData: CreateResponseData
): Promise<SurveyResponse | null> => {
  // Validate that this is for a public survey
  const surveyResult = await query(`
    SELECT id FROM surveys
    WHERE public_access_token = $1
      AND allow_public_access = true
      AND status = 'ACTIVE'
      AND (public_access_expires_at IS NULL OR public_access_expires_at > NOW())
  `, [token]);

  if (surveyResult.rows.length === 0) {
    throw new Error('Invalid or expired public survey token');
  }

  const surveyId = surveyResult.rows[0].id;

  // For anonymous responses, we'll use a session-based approach
  // This is simplified - in production you might want to use cookies or temporary tokens
  const responseResult = await query(`
    INSERT INTO survey_responses (
      survey_id, user_id, started_at, is_complete, metadata,
      respondent_email, respondent_name, is_anonymous
    )
    VALUES ($1, NULL, NOW(), false, $2, $3, $4, true)
    ON CONFLICT DO NOTHING
    RETURNING *
  `, [
    surveyId,
    responseData.metadata || {},
    responseData.respondent_email,
    responseData.respondent_name,
  ]);

  return responseResult.rows[0] || null;
};

// Get aggregated responses for a survey (for discussion view)
export const getAggregatedSurveyResponses = async (surveyId: number): Promise<any> => {
  // Get survey details including questions
  const survey = await getSurveyById(surveyId);
  if (!survey || !survey.questions) {
    throw new Error('Survey not found');
  }

  const aggregated: any = {};

  // For each question, get all user responses
  for (const question of survey.questions) {
    const responses = await query(`
      SELECT
        sqr.text_response,
        sqr.number_response,
        sqr.date_response,
        sqr.selected_option_ids,
        sqr.rating_response,
        sqr.created_at,
        u.first_name,
        u.last_name,
        u.email,
        sr.respondent_name,
        sr.is_anonymous
      FROM survey_question_responses sqr
      JOIN survey_responses sr ON sqr.response_id = sr.id
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sqr.question_id = $1 AND sr.is_complete = true
      ORDER BY sqr.created_at ASC
    `, [question.id]);

    // Calculate statistics based on question type
    let stats: any = {};

    if (question.question_type === 'RATING' && responses.rows.length > 0) {
      const ratings = responses.rows.map(r => r.rating_response).filter(r => r != null);
      stats.average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      stats.distribution = ratings.reduce((acc, rating) => {
        acc[rating] = (acc[rating] || 0) + 1;
        return acc;
      }, {} as any);
    } else if (['MULTIPLE_CHOICE', 'CHECKBOX'].includes(question.question_type) && question.options) {
      stats.option_counts = {};
      const totalResponses = responses.rows.length;

      for (const option of question.options) {
        const count = responses.rows.filter(r =>
          r.selected_option_ids && r.selected_option_ids.includes(option.id)
        ).length;

        stats.option_counts[option.id] = {
          text: option.option_text,
          count: count,
          percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0
        };
      }
    } else if (question.question_type === 'YES_NO') {
      const yesCount = responses.rows.filter(r => r.text_response === 'Yes').length;
      const noCount = responses.rows.filter(r => r.text_response === 'No').length;
      stats.yes_count = yesCount;
      stats.no_count = noCount;
    }

    // Format user responses
    const userResponses = responses.rows.map(row => ({
      user_name: row.is_anonymous
        ? row.respondent_name
        : (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.first_name || row.last_name || 'Unknown'),
      answer: formatAnswer(question.question_type, row, question.options),
      submitted_at: row.created_at
    }));

    aggregated[question.id] = {
      question_id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options || [],
      response_count: responses.rows.length,
      stats,
      responses: userResponses
    };
  }

  return aggregated;
};

// Helper to format answer based on question type
function formatAnswer(questionType: string, row: any, options?: any[]): any {
  switch (questionType) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'YES_NO':
      return row.text_response;
    case 'NUMBER':
      return row.number_response;
    case 'DATE':
      return row.date_response;
    case 'RATING':
      return row.rating_response;
    case 'MULTIPLE_CHOICE':
    case 'CHECKBOX':
      if (row.selected_option_ids && options) {
        const selectedOptions = options.filter(opt =>
          row.selected_option_ids.includes(opt.id)
        );
        return selectedOptions.map(opt => opt.option_text);
      }
      return [];
    default:
      return null;
  }
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}