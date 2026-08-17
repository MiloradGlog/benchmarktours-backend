import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as userService from './user.service';

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.status(200).json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /users/me — self-service rectification of own name (Art. 16). Email and
// role are intentionally NOT self-editable (email is the login identity; role
// is an admin decision).
export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { first_name, last_name } = req.body || {};
    const first = typeof first_name === 'string' ? first_name.trim() : undefined;
    const last = typeof last_name === 'string' ? last_name.trim() : undefined;
    if (!first && !last) {
      res.status(400).json({ error: 'Provide first_name and/or last_name' });
      return;
    }
    if ((first !== undefined && first.length === 0) || (last !== undefined && last.length === 0)) {
      res.status(400).json({ error: 'Name fields cannot be empty' });
      return;
    }
    const updated = await import('./user.service').then(m =>
      m.updateOwnProfile(req.user!.id, { first_name: first, last_name: last })
    );
    res.status(200).json({ user: updated });
  } catch (error) {
    console.error('Update own profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportMyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const exportData = await userService.exportUserData(userId);

    if (!exportData) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log only the user id and counts - never the exported content itself
    console.log('GDPR data export generated:', {
      userId,
      tours: exportData.tours.length,
      chat_messages: exportData.chat_messages.length,
      notes: exportData.notes.length,
      questions: exportData.questions.length,
      team_suggestions: exportData.team_suggestions.length,
      photos: exportData.photos.length,
      ai_chat_sessions: exportData.ai_chat_sessions.length,
      survey_responses: exportData.survey_responses.length,
      activity_reviews: exportData.activity_reviews.length,
      message_reactions: exportData.message_reactions.length,
      shopping_comments: exportData.shopping_comments.length,
      shopping_votes: exportData.shopping_votes.length,
      device_push_tokens: exportData.device_push_tokens.length,
      message_reports: exportData.message_reports.length
    });

    res.status(200)
      .setHeader('Content-Disposition', 'attachment; filename="my-data-export.json"');
    res.json(exportData);
  } catch (error) {
    console.error('GDPR data export error for user:', req.user?.id, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { email, password, first_name, last_name, role } = req.body;

    const userData = {
      email,
      password, // Optional - if not provided, setup code will be generated
      first_name,
      last_name,
      role
    };

    const result = await userService.createUser(userData);

    const response: any = {
      success: true,
      message: result.setupCode
        ? 'User created successfully. Setup code generated for first-time password setup.'
        : 'User created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        role: result.user.role,
        created_at: result.user.created_at
      }
    };

    // Include setup code if generated (user created without password)
    if (result.setupCode) {
      response.setup_code = result.setupCode;
      response.setup_instructions = 'Share this code with the user. They will use it along with their email to set their password on first login.';
    }

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Create user error:', error);

    if (error.message === 'User with this email already exists') {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { id } = req.params;
    const updateData = req.body;

    const user = await userService.updateUser(id, updateData);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error: any) {
    console.error('Update user error:', error);

    if (error.message === 'Email is already taken by another user') {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    // Prevent user from deleting themselves
    if (id === currentUserId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const success = await userService.deleteUser(id);

    if (!success) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsersStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await userService.getUsersCount();
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get users stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const users = await userService.searchUsers(q);
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsersByRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    
    if (!['Admin', 'User', 'Guide'].includes(role)) {
      res.status(400).json({ error: 'Invalid role specified' });
      return;
    }

    const users = await userService.getUsersByRole(role as 'Admin' | 'User' | 'Guide');
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};