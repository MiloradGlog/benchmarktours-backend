import { query } from '../../config/db';

/**
 * GDPR facility for public / anonymous survey respondents (survey_responses with
 * user_id IS NULL, keyed by respondent_email). These respondents have no account,
 * so their access (DSAR) and erasure requests are handled admin-side after the
 * DPO verifies identity out of band.
 *
 * Every query matches respondent_email case-insensitively and is restricted to
 * anonymous responses (user_id IS NULL) so authenticated users' data is never touched.
 */

export interface PublicSurveyResponseExport {
  id: number;
  survey_id: number;
  survey_title: string | null;
  respondent_email: string | null;
  respondent_name: string | null;
  is_anonymous: boolean;
  started_at: Date;
  submitted_at: Date | null;
  is_complete: boolean;
  answers: any[];
}

/**
 * Returns all public survey responses (and their per-question answers) submitted
 * by the given respondent email. For DSAR access requests.
 */
export const exportPublicSurveyData = async (email: string): Promise<PublicSurveyResponseExport[]> => {
  const responsesResult = await query(`
    SELECT sr.id, sr.survey_id, s.title AS survey_title,
           sr.respondent_email, sr.respondent_name, sr.is_anonymous,
           sr.started_at, sr.submitted_at, sr.is_complete
    FROM survey_responses sr
    LEFT JOIN surveys s ON s.id = sr.survey_id
    WHERE sr.user_id IS NULL AND LOWER(sr.respondent_email) = LOWER($1)
    ORDER BY sr.started_at ASC
  `, [email]);

  if (responsesResult.rows.length === 0) {
    return [];
  }

  const responseIds = responsesResult.rows.map(r => r.id);

  const answersResult = await query(`
    SELECT sqr.response_id, sqr.question_id, sq.question_text,
           sqr.text_response, sqr.number_response, sqr.date_response,
           sqr.selected_option_ids, sqr.rating_response, sqr.created_at
    FROM survey_question_responses sqr
    LEFT JOIN survey_questions sq ON sq.id = sqr.question_id
    WHERE sqr.response_id = ANY($1::int[])
    ORDER BY sqr.response_id ASC, sqr.created_at ASC
  `, [responseIds]);

  const answersByResponse: Record<string, any[]> = {};
  answersResult.rows.forEach(row => {
    const list = answersByResponse[row.response_id] || (answersByResponse[row.response_id] = []);
    list.push({
      question_id: row.question_id,
      question_text: row.question_text,
      text_response: row.text_response,
      number_response: row.number_response,
      date_response: row.date_response,
      selected_option_ids: row.selected_option_ids,
      rating_response: row.rating_response,
      created_at: row.created_at
    });
  });

  return responsesResult.rows.map(response => ({
    id: response.id,
    survey_id: response.survey_id,
    survey_title: response.survey_title,
    respondent_email: response.respondent_email,
    respondent_name: response.respondent_name,
    is_anonymous: response.is_anonymous,
    started_at: response.started_at,
    submitted_at: response.submitted_at,
    is_complete: response.is_complete,
    answers: answersByResponse[response.id] || []
  }));
};

/**
 * Deletes all public survey responses submitted by the given respondent email.
 * survey_question_responses are removed automatically via ON DELETE CASCADE.
 * For erasure requests. Returns the number of survey_responses deleted.
 */
export const erasePublicSurveyData = async (email: string): Promise<number> => {
  const result = await query(`
    DELETE FROM survey_responses
    WHERE user_id IS NULL AND LOWER(respondent_email) = LOWER($1)
  `, [email]);

  return result.rowCount ?? 0;
};
