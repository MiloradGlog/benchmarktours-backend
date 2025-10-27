import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as controller from './discussion-activity.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ==================== DISCUSSION DETAILS (Combined) ====================
// GET /api/discussion-activities/:activityId - Get full discussion details (teams, questions, members, notes)
router.get('/:activityId', controller.getDiscussionDetails);

// POST /api/discussion-activities/:activityId/initialize - Initialize discussion with teams and questions
router.post('/:activityId/initialize', controller.initializeDiscussion);

// ==================== TEAMS ====================
// GET /api/discussion-activities/:activityId/teams - Get all teams for a discussion
router.get('/:activityId/teams', controller.getTeamsByDiscussion);

// POST /api/discussion-activities/:activityId/teams - Create a new team
router.post('/:activityId/teams', controller.createTeam);

// PUT /api/discussion-activities/teams/:teamId - Update a team
router.put('/teams/:teamId', controller.updateTeam);

// DELETE /api/discussion-activities/teams/:teamId - Delete a team
router.delete('/teams/:teamId', controller.deleteTeam);

// ==================== TEAM MEMBERS ====================
// GET /api/discussion-activities/teams/:teamId/members - Get team members
router.get('/teams/:teamId/members', controller.getTeamMembers);

// POST /api/discussion-activities/team-members - Assign a member to a team
router.post('/team-members', controller.assignTeamMember);

// DELETE /api/discussion-activities/teams/:teamId/members/:userId - Remove team member
router.delete('/teams/:teamId/members/:userId', controller.removeTeamMember);

// ==================== REMOVED: PRESENTER (not needed for simplified discussion) ====================
// router.put('/teams/:teamId/members/:userId/presenter', controller.setPresenter);

// ==================== REMOVED: QUESTIONS (not needed for photo-only discussion) ====================
// router.get('/:activityId/questions', controller.getQuestionsByDiscussion);
// router.post('/:activityId/questions', controller.createQuestion);
// router.put('/questions/:questionId', controller.updateQuestion);
// router.delete('/questions/:questionId', controller.deleteQuestion);

// ==================== TEAM NOTES ====================
// GET /api/discussion-activities/teams/:teamId/notes - Get all notes for a team
router.get('/teams/:teamId/notes', controller.getNotesByTeam);

// POST /api/discussion-activities/notes - Create a new note
router.post('/notes', controller.createTeamNote);

// PUT /api/discussion-activities/notes/:noteId - Update a note (author only)
router.put('/notes/:noteId', controller.updateTeamNote);

// DELETE /api/discussion-activities/notes/:noteId - Delete a note (author only)
router.delete('/notes/:noteId', controller.deleteTeamNote);

export default router;
