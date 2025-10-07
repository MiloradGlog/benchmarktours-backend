-- Migration to create survey system tables
-- This creates a comprehensive survey system for tours and activities

-- Create survey type enum
CREATE TYPE survey_type AS ENUM ('TOUR_APPLICATION', 'ACTIVITY_FEEDBACK', 'TOUR_COMPLETION', 'CUSTOM');

-- Create survey status enum
CREATE TYPE survey_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- Create question type enum
CREATE TYPE question_type AS ENUM ('TEXT', 'TEXTAREA', 'MULTIPLE_CHOICE', 'CHECKBOX', 'RATING', 'DATE', 'NUMBER', 'YES_NO');

-- Main surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type survey_type NOT NULL,
    status survey_status DEFAULT 'DRAFT',
    tour_id INTEGER REFERENCES tours(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    -- Ensure a survey is linked to either a tour, activity, or is standalone
    CONSTRAINT survey_link_check CHECK (
        (tour_id IS NOT NULL AND activity_id IS NULL) OR 
        (tour_id IS NULL AND activity_id IS NOT NULL) OR 
        (tour_id IS NULL AND activity_id IS NULL)
    )
);

-- Survey questions table
CREATE TABLE IF NOT EXISTS survey_questions (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL,
    description TEXT,
    validation_rules JSONB, -- For storing min/max values, regex patterns, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(survey_id, order_index)
);

-- Question options for multiple choice/checkbox questions
CREATE TABLE IF NOT EXISTS survey_question_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    is_other BOOLEAN DEFAULT FALSE, -- For "Other" option with text input
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, order_index)
);

-- Survey responses from users
CREATE TABLE IF NOT EXISTS survey_responses (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    is_complete BOOLEAN DEFAULT FALSE,
    metadata JSONB, -- For storing additional context (device, location, etc.)
    UNIQUE(survey_id, user_id) -- One response per user per survey
);

-- Individual question responses
CREATE TABLE IF NOT EXISTS survey_question_responses (
    id SERIAL PRIMARY KEY,
    response_id INTEGER NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    text_response TEXT,
    number_response NUMERIC,
    date_response DATE,
    selected_option_ids INTEGER[], -- For multiple choice/checkbox
    rating_response INTEGER CHECK (rating_response >= 1 AND rating_response <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(response_id, question_id)
);

-- Survey templates for common survey types
CREATE TABLE IF NOT EXISTS survey_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type survey_type NOT NULL,
    template_data JSONB NOT NULL, -- Stores the survey structure
    is_system BOOLEAN DEFAULT FALSE, -- System templates can't be edited
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_surveys_tour_id ON surveys(tour_id);
CREATE INDEX idx_surveys_activity_id ON surveys(activity_id);
CREATE INDEX idx_surveys_type ON surveys(type);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_survey_questions_survey_id ON survey_questions(survey_id);
CREATE INDEX idx_survey_question_options_question_id ON survey_question_options(question_id);
CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX idx_survey_responses_submitted_at ON survey_responses(submitted_at);
CREATE INDEX idx_survey_question_responses_response_id ON survey_question_responses(response_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_survey_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER surveys_updated_at_trigger
    BEFORE UPDATE ON surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_updated_at();

CREATE TRIGGER survey_questions_updated_at_trigger
    BEFORE UPDATE ON survey_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_updated_at();

CREATE TRIGGER survey_question_responses_updated_at_trigger
    BEFORE UPDATE ON survey_question_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_updated_at();

-- Insert default survey templates
INSERT INTO survey_templates (name, description, type, template_data, is_system) VALUES
('Tour Application Survey', 'Default survey for tour applications', 'TOUR_APPLICATION', 
'{
  "questions": [
    {
      "text": "What is your current job title/position?",
      "type": "TEXT",
      "required": true
    },
    {
      "text": "What are your main interests in this tour?",
      "type": "TEXTAREA",
      "required": true
    },
    {
      "text": "Have you attended similar tours before?",
      "type": "YES_NO",
      "required": true
    },
    {
      "text": "What do you hope to learn from this tour?",
      "type": "TEXTAREA",
      "required": true
    },
    {
      "text": "Do you have any dietary restrictions?",
      "type": "TEXT",
      "required": false
    },
    {
      "text": "Do you require any special accommodations?",
      "type": "TEXTAREA",
      "required": false
    }
  ]
}', true),
('Activity Feedback Survey', 'Default survey for activity feedback', 'ACTIVITY_FEEDBACK',
'{
  "questions": [
    {
      "text": "How would you rate this activity?",
      "type": "RATING",
      "required": true
    },
    {
      "text": "What did you find most valuable about this activity?",
      "type": "TEXTAREA",
      "required": true
    },
    {
      "text": "What could be improved?",
      "type": "TEXTAREA",
      "required": false
    },
    {
      "text": "Would you recommend this activity to colleagues?",
      "type": "YES_NO",
      "required": true
    }
  ]
}', true),
('Tour Completion Survey', 'Default survey for completed tours', 'TOUR_COMPLETION',
'{
  "questions": [
    {
      "text": "Overall, how satisfied were you with the tour?",
      "type": "RATING",
      "required": true
    },
    {
      "text": "Which activities were most valuable to you?",
      "type": "TEXTAREA",
      "required": true
    },
    {
      "text": "How likely are you to recommend this tour to others?",
      "type": "RATING",
      "required": true
    },
    {
      "text": "What was the highlight of the tour for you?",
      "type": "TEXTAREA",
      "required": true
    },
    {
      "text": "What suggestions do you have for improvement?",
      "type": "TEXTAREA",
      "required": false
    },
    {
      "text": "Would you be interested in future tours?",
      "type": "YES_NO",
      "required": true
    }
  ]
}', true);