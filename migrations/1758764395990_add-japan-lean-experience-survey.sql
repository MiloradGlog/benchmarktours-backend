-- Migration to add Japan Lean Experience (JLE) survey templates
-- This updates the TOUR_APPLICATION and TOUR_COMPLETION templates with JLE-specific questions

-- First, delete the existing templates if they exist
DELETE FROM survey_templates WHERE type = 'TOUR_APPLICATION' AND is_system = true;
DELETE FROM survey_templates WHERE type = 'TOUR_COMPLETION' AND is_system = true;

-- Insert the new Japan Lean Experience template
INSERT INTO survey_templates (name, description, type, template_data, is_system) VALUES
('Japan Lean Experience (JLE) Expectations Form',
 'General inquiry regarding your information and your expectations for JLE. This form helps our coordination staff and JLE consultants better understand your specific Lean/JLE needs so that we can optimize your Japan Lean Experience.',
 'TOUR_APPLICATION',
'{
  "questions": [
    {
      "text": "Your Name",
      "type": "TEXT",
      "required": true,
      "description": "Please provide your full name"
    },
    {
      "text": "Company Name",
      "type": "TEXT",
      "required": true,
      "description": "The name of your organization"
    },
    {
      "text": "Title",
      "type": "TEXT",
      "required": false,
      "description": "Your job title or position"
    },
    {
      "text": "Lean Experience",
      "type": "TEXTAREA",
      "required": false,
      "description": "Describe your previous experience with Lean methodologies"
    },
    {
      "text": "Type of Industry",
      "type": "TEXT",
      "required": false,
      "description": "What industry does your company operate in?"
    },
    {
      "text": "What are the current improvement (Kaizen) projects at your department?",
      "type": "TEXTAREA",
      "required": true,
      "description": "Please describe any ongoing continuous improvement initiatives"
    },
    {
      "text": "What issues or challenges are you facing in your operations/area/department?",
      "type": "TEXTAREA",
      "required": true,
      "description": "Help us understand the specific challenges you want to address"
    },
    {
      "text": "What are your main goals for this Japan Lean Experience?",
      "type": "TEXTAREA",
      "required": true,
      "description": "What do you hope to achieve or learn from this experience?"
    }
  ]
}', true);

-- Add a secondary template for general tour applications if needed
INSERT INTO survey_templates (name, description, type, template_data, is_system) VALUES
('General Tour Application',
 'Standard application form for general tours',
 'TOUR_APPLICATION',
'{
  "questions": [
    {
      "text": "Your Name",
      "type": "TEXT",
      "required": true
    },
    {
      "text": "Company/Organization",
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
}', false);

-- Update TOUR_COMPLETION template with JLE feedback survey
INSERT INTO survey_templates (name, description, type, template_data, is_system) VALUES
('Japan Lean Experience Feedback Survey',
 'Your feedback is used to help us continuously improve our Japan Lean Experience. Thank you for your thoughtful input!',
 'TOUR_COMPLETION',
'{
  "questions": [
    {
      "text": "What did you like about this program? What would you keep?",
      "type": "TEXTAREA",
      "required": false,
      "description": "Please share what aspects of the program were valuable to you"
    },
    {
      "text": "What would you change about the program?",
      "type": "TEXTAREA",
      "required": false,
      "description": "Your suggestions help us improve future experiences"
    },
    {
      "text": "Please share 3 key takeaways from the program:",
      "type": "TEXTAREA",
      "required": false,
      "description": "What are the most important things you learned or experienced?"
    },
    {
      "text": "On a scale of 1-5, how would you rate this week overall?",
      "type": "MULTIPLE_CHOICE",
      "required": false,
      "description": "Please select your rating",
      "options": [
        "1 - Not at all valuable",
        "2 - Somewhat valuable",
        "3 - Neutral",
        "4 - Valuable",
        "5 - Extremely valuable"
      ]
    },
    {
      "text": "Would you recommend this program to a colleague?",
      "type": "YES_NO",
      "required": false,
      "description": "Based on your experience, would you recommend this to others?"
    }
  ]
}', true);

-- Add a secondary template for general tour completion if needed
INSERT INTO survey_templates (name, description, type, template_data, is_system) VALUES
('General Tour Completion Survey',
 'Standard feedback survey for completed tours',
 'TOUR_COMPLETION',
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
}', false);