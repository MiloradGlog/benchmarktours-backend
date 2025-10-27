// TypeScript types for Discussion activities

export interface DiscussionTeam {
  id: number;
  discussion_activity_id: number;
  name: string;
  description?: string;
  order_index: number;
  created_at: Date;
  updated_at: Date;
}

export interface DiscussionTeamMember {
  id: number;
  team_id: number;
  user_id: string;
  joined_at: Date;
  // Populated fields
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
}

export interface DiscussionQuestion {
  id: number;
  discussion_activity_id: number;
  question_text: string;
  order_index: number;
  is_required: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DiscussionTeamNote {
  id: number;
  team_id: number;
  question_id?: number;
  content: string;
  attachments?: any[]; // For photo attachments
  created_by: string;
  created_at: Date;
  updated_at: Date;
  // Populated fields
  question_text?: string;
  author_name?: string;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  order_index: number;
}

export interface CreateQuestionData {
  question_text: string;
  order_index: number;
  is_required?: boolean;
}

export interface CreateTeamNoteData {
  team_id: number;
  question_id?: number;
  content: string;
  attachments?: any[]; // For photo attachments
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  order_index?: number;
}

export interface UpdateQuestionData {
  question_text?: string;
  order_index?: number;
  is_required?: boolean;
}

export interface UpdateTeamNoteData {
  content?: string;
}

export interface AssignTeamMemberData {
  team_id: number;
  user_id: string;
}

// Combined interface for full discussion data with teams, questions, and members
export interface DiscussionActivityDetails {
  activity_id: number;
  teams: Array<DiscussionTeam & {
    members: DiscussionTeamMember[];
    notes: DiscussionTeamNote[];
  }>;
  questions: DiscussionQuestion[];
}
