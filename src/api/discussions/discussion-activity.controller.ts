import { Request, Response } from 'express';
import * as discussionActivityService from './discussion-activity.service';

// Helper function to handle read-only errors
const handleReadOnlyError = (error: unknown, res: Response, defaultMessage: string): boolean => {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  if (errorMessage.includes('tour has ended and is now read-only')) {
    res.status(403).json({ error: errorMessage });
    return true;
  }
  return false;
};

// ==================== DISCUSSION TEAMS ====================

export const getTeamsByDiscussion = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const teams = await discussionActivityService.getTeamsByDiscussion(activityId);
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const createTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const team = await discussionActivityService.createTeam(activityId, req.body);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    if (handleReadOnlyError(error, res, 'Failed to create team')) return;
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId);
    const team = await discussionActivityService.updateTeam(teamId, req.body);
    res.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    if (handleReadOnlyError(error, res, 'Failed to update team')) return;
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId);
    await discussionActivityService.deleteTeam(teamId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting team:', error);
    if (handleReadOnlyError(error, res, 'Failed to delete team')) return;
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

// ==================== TEAM MEMBERS ====================

export const getTeamMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId);
    const members = await discussionActivityService.getTeamMembers(teamId);
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};

export const assignTeamMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const member = await discussionActivityService.assignTeamMember(req.body);
    res.status(201).json(member);
  } catch (error) {
    console.error('Error assigning team member:', error);
    if (handleReadOnlyError(error, res, 'Failed to assign team member')) return;
    res.status(500).json({ error: 'Failed to assign team member' });
  }
};

export const removeTeamMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId);
    const userId = req.params.userId;
    await discussionActivityService.removeTeamMember(teamId, userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing team member:', error);
    if (handleReadOnlyError(error, res, 'Failed to remove team member')) return;
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};

// ==================== REMOVED: PRESENTER (not needed for simplified discussion) ====================

// export const setPresenter = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const teamId = parseInt(req.params.teamId);
//     const userId = req.params.userId;
//     const { is_presenter } = req.body;
//     await discussionActivityService.setPresenter(teamId, userId, is_presenter);
//     res.status(200).json({ message: 'Presenter status updated' });
//   } catch (error) {
//     console.error('Error setting presenter:', error);
//     res.status(500).json({ error: 'Failed to set presenter' });
//   }
// };

// ==================== DISCUSSION QUESTIONS ====================

export const getQuestionsByDiscussion = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const questions = await discussionActivityService.getQuestionsByDiscussion(activityId);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

export const createQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const question = await discussionActivityService.createQuestion(activityId, req.body);
    res.status(201).json(question);
  } catch (error) {
    console.error('Error creating question:', error);
    if (handleReadOnlyError(error, res, 'Failed to create question')) return;
    res.status(500).json({ error: 'Failed to create question' });
  }
};

export const updateQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const questionId = parseInt(req.params.questionId);
    const question = await discussionActivityService.updateQuestion(questionId, req.body);
    res.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    if (handleReadOnlyError(error, res, 'Failed to update question')) return;
    res.status(500).json({ error: 'Failed to update question' });
  }
};

export const deleteQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const questionId = parseInt(req.params.questionId);
    await discussionActivityService.deleteQuestion(questionId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting question:', error);
    if (handleReadOnlyError(error, res, 'Failed to delete question')) return;
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

// ==================== TEAM NOTES ====================

export const getNotesByTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId);
    const notes = await discussionActivityService.getNotesByTeam(teamId);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

export const createTeamNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const note = await discussionActivityService.createTeamNote(userId, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    if (handleReadOnlyError(error, res, 'Failed to create note')) return;
    res.status(500).json({ error: 'Failed to create note' });
  }
};

export const updateTeamNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const noteId = parseInt(req.params.noteId);
    const userId = (req as any).user.id;
    const note = await discussionActivityService.updateTeamNote(noteId, userId, req.body);
    res.json(note);
  } catch (error: any) {
    console.error('Error updating note:', error);
    if (handleReadOnlyError(error, res, 'Failed to update note')) return;
    if (error.message === 'Only the author can update this note') {
      res.status(403).json({ error: error.message });
    } else if (error.message === 'Note not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update note' });
    }
  }
};

export const deleteTeamNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const noteId = parseInt(req.params.noteId);
    const userId = (req as any).user.id;
    await discussionActivityService.deleteTeamNote(noteId, userId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting note:', error);
    if (handleReadOnlyError(error, res, 'Failed to delete note')) return;
    if (error.message === 'Only the author can delete this note') {
      res.status(403).json({ error: error.message });
    } else if (error.message === 'Note not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete note' });
    }
  }
};

// ==================== COMBINED OPERATIONS ====================

export const getDiscussionDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const details = await discussionActivityService.getDiscussionDetails(activityId);
    res.json(details);
  } catch (error) {
    console.error('Error fetching discussion details:', error);
    res.status(500).json({ error: 'Failed to fetch discussion details' });
  }
};

export const initializeDiscussion = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityId = parseInt(req.params.activityId);
    const { team_count } = req.body;
    const details = await discussionActivityService.initializeDiscussion(
      activityId,
      team_count
    );
    res.status(201).json(details);
  } catch (error) {
    console.error('Error initializing discussion:', error);
    res.status(500).json({ error: 'Failed to initialize discussion' });
  }
};
