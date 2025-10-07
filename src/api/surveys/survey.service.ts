import { query } from '../../config/db';

export type SurveyType = 'TOUR_APPLICATION' | 'ACTIVITY_FEEDBACK' | 'TOUR_COMPLETION' | 'CUSTOM';
export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type QuestionType = 'TEXT' | 'TEXTAREA' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'RATING' | 'DATE' | 'NUMBER' | 'YES_NO';

export interface Survey {
  id: number;
  title: string;
  description?: string;
  type: SurveyType;
  status: SurveyStatus;
  tour_id?: number;
  activity_id?: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
  archived_at?: Date;
  public_access_token?: string;
  allow_public_access?: boolean;
  public_access_created_at?: Date;
  public_access_expires_at?: Date;
  questions?: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  order_index: number;
  description?: string;
  validation_rules?: any;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  order_index: number;
  is_other: boolean;
}

export interface CreateSurveyData {
  title: string;
  description?: string;
  type: SurveyType;
  tour_id?: number;
  activity_id?: number;
  questions?: CreateQuestionData[];
}

export interface CreateQuestionData {
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  order_index: number;
  description?: string;
  validation_rules?: any;
  options?: CreateOptionData[];
}

export interface CreateOptionData {
  option_text: string;
  order_index: number;
  is_other?: boolean;
}

export interface UpdateSurveyData {
  title?: string;
  description?: string;
  status?: SurveyStatus;
}

export interface SurveyTemplate {
  id: number;
  name: string;
  description?: string;
  type: SurveyType;
  template_data: any;
  is_system: boolean;
}

// Survey CRUD operations
export const createSurvey = async (surveyData: CreateSurveyData, createdBy: string): Promise<Survey> => {
  const client = await query('BEGIN');
  
  try {
    // Create the survey
    const surveyResult = await query(`
      INSERT INTO surveys (title, description, type, tour_id, activity_id, created_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
      RETURNING id, title, description, type, status, tour_id, activity_id, created_by, created_at, updated_at
    `, [
      surveyData.title,
      surveyData.description || null,
      surveyData.type,
      surveyData.tour_id || null,
      surveyData.activity_id || null,
      createdBy
    ]);
    
    const survey = surveyResult.rows[0];
    
    // Create questions if provided
    if (surveyData.questions && surveyData.questions.length > 0) {
      for (const questionData of surveyData.questions) {
        const questionResult = await query(`
          INSERT INTO survey_questions (survey_id, question_text, question_type, is_required, order_index, description, validation_rules)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          survey.id,
          questionData.question_text,
          questionData.question_type,
          questionData.is_required,
          questionData.order_index,
          questionData.description || null,
          questionData.validation_rules ? JSON.stringify(questionData.validation_rules) : null
        ]);
        
        const questionId = questionResult.rows[0].id;
        
        // Create options for multiple choice/checkbox questions
        if (questionData.options && questionData.options.length > 0) {
          for (const optionData of questionData.options) {
            await query(`
              INSERT INTO survey_question_options (question_id, option_text, order_index, is_other)
              VALUES ($1, $2, $3, $4)
            `, [
              questionId,
              optionData.option_text,
              optionData.order_index,
              optionData.is_other || false
            ]);
          }
        }
      }
    }
    
    await query('COMMIT');
    return survey;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

export const getSurveyById = async (id: number): Promise<Survey | null> => {
  const surveyResult = await query(`
    SELECT id, title, description, type, status, tour_id, activity_id, 
           created_by, created_at, updated_at, published_at, archived_at
    FROM surveys
    WHERE id = $1
  `, [id]);
  
  if (surveyResult.rows.length === 0) {
    return null;
  }
  
  const survey = surveyResult.rows[0];
  
  // Get questions
  const questionsResult = await query(`
    SELECT id, survey_id, question_text, question_type, is_required, 
           order_index, description, validation_rules
    FROM survey_questions
    WHERE survey_id = $1
    ORDER BY order_index ASC
  `, [id]);
  
  const questions = questionsResult.rows;
  
  // Get options for each question
  for (const question of questions) {
    if (['MULTIPLE_CHOICE', 'CHECKBOX'].includes(question.question_type)) {
      const optionsResult = await query(`
        SELECT id, question_id, option_text, order_index, is_other
        FROM survey_question_options
        WHERE question_id = $1
        ORDER BY order_index ASC
      `, [question.id]);
      
      question.options = optionsResult.rows;
    }
  }
  
  survey.questions = questions;
  return survey;
};

export const getAllSurveys = async (filters?: { type?: SurveyType; status?: SurveyStatus; tour_id?: number; activity_id?: number }): Promise<Survey[]> => {
  let queryStr = `
    SELECT id, title, description, type, status, tour_id, activity_id, 
           created_by, created_at, updated_at, published_at, archived_at
    FROM surveys
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 1;
  
  if (filters) {
    if (filters.type) {
      queryStr += ` AND type = $${paramCount++}`;
      params.push(filters.type);
    }
    if (filters.status) {
      queryStr += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.tour_id) {
      queryStr += ` AND tour_id = $${paramCount++}`;
      params.push(filters.tour_id);
    }
    if (filters.activity_id) {
      queryStr += ` AND activity_id = $${paramCount++}`;
      params.push(filters.activity_id);
    }
  }
  
  queryStr += ' ORDER BY created_at DESC';
  
  const result = await query(queryStr, params);
  return result.rows;
};

export const updateSurvey = async (id: number, updateData: UpdateSurveyData): Promise<Survey | null> => {
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  if (updateData.title !== undefined) {
    fields.push(`title = $${paramCount++}`);
    values.push(updateData.title);
  }
  if (updateData.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updateData.description);
  }
  if (updateData.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(updateData.status);
    
    // Set published_at when status changes to ACTIVE
    if (updateData.status === 'ACTIVE') {
      fields.push(`published_at = NOW()`);
    } else if (updateData.status === 'ARCHIVED') {
      fields.push(`archived_at = NOW()`);
    }
  }
  
  if (fields.length === 0) {
    return null;
  }
  
  values.push(id);
  
  const result = await query(`
    UPDATE surveys
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING id, title, description, type, status, tour_id, activity_id, 
              created_by, created_at, updated_at, published_at, archived_at
  `, values);
  
  return result.rows[0] || null;
};

export const deleteSurvey = async (id: number): Promise<boolean> => {
  const result = await query('DELETE FROM surveys WHERE id = $1', [id]);
  return result.rowCount > 0;
};

// Question CRUD operations
export const addQuestionToSurvey = async (surveyId: number, questionData: CreateQuestionData): Promise<SurveyQuestion> => {
  const client = await query('BEGIN');
  
  try {
    const questionResult = await query(`
      INSERT INTO survey_questions (survey_id, question_text, question_type, is_required, order_index, description, validation_rules)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, survey_id, question_text, question_type, is_required, order_index, description, validation_rules
    `, [
      surveyId,
      questionData.question_text,
      questionData.question_type,
      questionData.is_required,
      questionData.order_index,
      questionData.description || null,
      questionData.validation_rules ? JSON.stringify(questionData.validation_rules) : null
    ]);
    
    const question = questionResult.rows[0];
    
    // Create options if provided
    if (questionData.options && questionData.options.length > 0) {
      const options = [];
      for (const optionData of questionData.options) {
        const optionResult = await query(`
          INSERT INTO survey_question_options (question_id, option_text, order_index, is_other)
          VALUES ($1, $2, $3, $4)
          RETURNING id, question_id, option_text, order_index, is_other
        `, [
          question.id,
          optionData.option_text,
          optionData.order_index,
          optionData.is_other || false
        ]);
        options.push(optionResult.rows[0]);
      }
      question.options = options;
    }
    
    await query('COMMIT');
    return question;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

export const updateQuestion = async (questionId: number, updateData: Partial<CreateQuestionData>): Promise<SurveyQuestion | null> => {
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  if (updateData.question_text !== undefined) {
    fields.push(`question_text = $${paramCount++}`);
    values.push(updateData.question_text);
  }
  if (updateData.is_required !== undefined) {
    fields.push(`is_required = $${paramCount++}`);
    values.push(updateData.is_required);
  }
  if (updateData.order_index !== undefined) {
    fields.push(`order_index = $${paramCount++}`);
    values.push(updateData.order_index);
  }
  if (updateData.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updateData.description);
  }
  if (updateData.validation_rules !== undefined) {
    fields.push(`validation_rules = $${paramCount++}`);
    values.push(JSON.stringify(updateData.validation_rules));
  }
  
  if (fields.length === 0) {
    return null;
  }
  
  values.push(questionId);
  
  const result = await query(`
    UPDATE survey_questions
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING id, survey_id, question_text, question_type, is_required, order_index, description, validation_rules
  `, values);
  
  return result.rows[0] || null;
};

export const deleteQuestion = async (questionId: number): Promise<boolean> => {
  const result = await query('DELETE FROM survey_questions WHERE id = $1', [questionId]);
  return result.rowCount > 0;
};

// Survey Template operations
export const getSurveyTemplates = async (type?: SurveyType): Promise<SurveyTemplate[]> => {
  let queryStr = 'SELECT id, name, description, type, template_data, is_system FROM survey_templates';
  const params: any[] = [];
  
  if (type) {
    queryStr += ' WHERE type = $1';
    params.push(type);
  }
  
  queryStr += ' ORDER BY is_system DESC, name ASC';
  
  const result = await query(queryStr, params);
  return result.rows;
};

export const createSurveyFromTemplate = async (templateId: number, title: string, tourId?: number, activityId?: number, createdBy?: string): Promise<Survey> => {
  // Get the template
  const templateResult = await query(`
    SELECT template_data, type FROM survey_templates WHERE id = $1
  `, [templateId]);
  
  if (templateResult.rows.length === 0) {
    throw new Error('Template not found');
  }
  
  const template = templateResult.rows[0];
  const templateData = template.template_data;
  
  // Create survey data from template
  const surveyData: CreateSurveyData = {
    title,
    type: template.type,
    tour_id: tourId,
    activity_id: activityId,
    questions: templateData.questions?.map((q: any, index: number) => ({
      question_text: q.text,
      question_type: q.type,
      is_required: q.required || false,
      order_index: index,
      description: q.description,
      validation_rules: q.validation,
      options: q.options?.map((opt: any, optIndex: number) => ({
        option_text: opt,
        order_index: optIndex,
        is_other: false
      }))
    }))
  };
  
  return createSurvey(surveyData, createdBy || 'system');
};

// Get surveys for a specific tour
export const getSurveysForTour = async (tourId: number): Promise<Survey[]> => {
  const result = await query(`
    SELECT s.id, s.title, s.description, s.type, s.status, s.tour_id, s.activity_id, 
           s.created_by, s.created_at, s.updated_at, s.published_at, s.archived_at
    FROM surveys s
    WHERE s.tour_id = $1 OR s.id IN (
      SELECT application_survey_id FROM tours WHERE id = $1 AND application_survey_id IS NOT NULL
      UNION
      SELECT completion_survey_id FROM tours WHERE id = $1 AND completion_survey_id IS NOT NULL
    )
    ORDER BY s.created_at DESC
  `, [tourId]);
  
  return result.rows;
};

// Get surveys for a specific activity
export const getSurveysForActivity = async (activityId: number): Promise<Survey[]> => {
  const result = await query(`
    SELECT s.id, s.title, s.description, s.type, s.status, s.tour_id, s.activity_id, 
           s.created_by, s.created_at, s.updated_at, s.published_at, s.archived_at
    FROM surveys s
    WHERE s.activity_id = $1 OR s.id IN (
      SELECT feedback_survey_id FROM activities WHERE id = $1 AND feedback_survey_id IS NOT NULL
    )
    ORDER BY s.created_at DESC
  `, [activityId]);
  
  return result.rows;
};

// Duplicate a survey with a new title
export const duplicateSurvey = async (surveyId: number, newTitle: string, createdBy: string): Promise<Survey | null> => {
  // Get the original survey with all its questions and options
  const originalSurvey = await getSurveyById(surveyId);
  
  if (!originalSurvey) {
    return null;
  }
  
  // Create survey data for duplication
  const surveyData: CreateSurveyData = {
    title: newTitle,
    description: originalSurvey.description,
    type: originalSurvey.type,
    tour_id: originalSurvey.tour_id,
    activity_id: originalSurvey.activity_id,
    questions: originalSurvey.questions?.map(q => ({
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      order_index: q.order_index,
      description: q.description,
      validation_rules: q.validation_rules,
      options: q.options?.map(opt => ({
        option_text: opt.option_text,
        order_index: opt.order_index,
        is_other: opt.is_other,
      })),
    })),
  };
  
  return createSurvey(surveyData, createdBy);
};

// Generate public access token for a survey
export const generatePublicAccessToken = async (surveyId: number): Promise<string | null> => {
  const result = await query(
    'SELECT generate_public_access_token($1) as token',
    [surveyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].token;
};

// Revoke public access for a survey
export const revokePublicAccess = async (surveyId: number): Promise<boolean> => {
  const result = await query(
    'SELECT revoke_public_access($1) as success',
    [surveyId]
  );

  return result.rows[0]?.success || false;
};

// Get survey by public access token
export const getSurveyByPublicToken = async (token: string): Promise<Survey | null> => {
  const result = await query(`
    SELECT
      s.*,
      CASE WHEN COUNT(sq.id) > 0 THEN
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', sq.id,
            'survey_id', sq.survey_id,
            'question_text', sq.question_text,
            'question_type', sq.question_type,
            'is_required', sq.is_required,
            'order_index', sq.order_index,
            'description', sq.description,
            'validation_rules', sq.validation_rules,
            'options', sq.options
          ) ORDER BY sq.order_index
        )
      ELSE '[]'::json
      END as questions
    FROM surveys s
    LEFT JOIN (
      SELECT
        sq.*,
        CASE WHEN COUNT(sop.id) > 0 THEN
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', sop.id,
              'question_id', sop.question_id,
              'option_text', sop.option_text,
              'order_index', sop.order_index,
              'is_other', sop.is_other
            ) ORDER BY sop.order_index
          )
        ELSE '[]'::json
        END as options
      FROM survey_questions sq
      LEFT JOIN survey_question_options sop ON sq.id = sop.question_id
      GROUP BY sq.id, sq.survey_id, sq.question_text, sq.question_type,
               sq.is_required, sq.order_index, sq.description, sq.validation_rules
    ) sq ON s.id = sq.survey_id
    WHERE s.public_access_token = $1
      AND s.allow_public_access = true
      AND s.status = 'ACTIVE'
      AND (s.public_access_expires_at IS NULL OR s.public_access_expires_at > NOW())
    GROUP BY s.id
  `, [token]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};