import { Request, Response } from 'express';
import * as discussionService from './discussion.service';

// Discussion endpoints
export const createDiscussion = async (req: Request, res: Response) => {
  try {
    const { tour_id, activity_id, title, description } = req.body;
    const userId = req.user!.id;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Discussion title is required' });
    }

    const discussionData = {
      tour_id,
      activity_id,
      created_by: userId,
      title,
      description
    };

    const discussion = await discussionService.createDiscussion(discussionData);
    
    res.status(201).json({
      success: true,
      discussion
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
};

export const getDiscussionsByTour = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;
    const userId = req.user!.id;

    // Check post-tour access
    const hasAccess = await discussionService.checkPostTourAccess(parseInt(tourId));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Post-tour access period has expired' });
    }

    const discussions = await discussionService.getDiscussionsByTour(parseInt(tourId), userId);
    
    res.json({
      success: true,
      discussions
    });
  } catch (error) {
    console.error('Error fetching discussions:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
};

export const getDiscussionById = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;

    const discussion = await discussionService.getDiscussionById(parseInt(discussionId), userId);
    
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    res.json({
      success: true,
      discussion
    });
  } catch (error) {
    console.error('Error fetching discussion:', error);
    res.status(500).json({ error: 'Failed to fetch discussion' });
  }
};

export const updateDiscussion = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { title, description, is_pinned, is_locked } = req.body;

    // Check if user is admin or discussion creator
    const discussion = await discussionService.getDiscussionById(parseInt(discussionId), userId);
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    if (discussion.created_by !== userId && userRole !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to update this discussion' });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    
    // Only admins can pin or lock discussions
    if (userRole === 'Admin') {
      if (is_pinned !== undefined) updates.is_pinned = is_pinned;
      if (is_locked !== undefined) updates.is_locked = is_locked;
    }

    const updatedDiscussion = await discussionService.updateDiscussion(
      parseInt(discussionId),
      updates
    );

    res.json({
      success: true,
      discussion: updatedDiscussion
    });
  } catch (error) {
    console.error('Error updating discussion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update discussion';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to update discussion' });
  }
};

export const deleteDiscussion = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if user is admin or discussion creator
    const discussion = await discussionService.getDiscussionById(parseInt(discussionId), userId);
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    if (discussion.created_by !== userId && userRole !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to delete this discussion' });
    }

    const success = await discussionService.deleteDiscussion(parseInt(discussionId));
    
    if (!success) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    res.json({
      success: true,
      message: 'Discussion deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting discussion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete discussion';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to delete discussion' });
  }
};

// Message endpoints
export const createMessage = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;
    const { content, parent_message_id } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const messageData = {
      discussion_id: parseInt(discussionId),
      user_id: userId,
      parent_message_id,
      content
    };

    const message = await discussionService.createMessage(messageData);
    
    res.status(201).json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('Error creating message:', error);
    const errorMessage = error.message || 'Failed to create message';
    if (errorMessage === 'Discussion is locked' || errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to create message' });
  }
};

export const getMessagesByDiscussion = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;

    const messages = await discussionService.getMessagesByDiscussion(
      parseInt(discussionId),
      userId
    );
    
    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = await discussionService.updateMessage(
      parseInt(messageId),
      userId,
      content
    );
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error updating message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update message';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to update message' });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    const success = await discussionService.deleteMessage(parseInt(messageId), userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// Reaction endpoints
export const addReaction = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({ error: 'Reaction is required' });
    }

    await discussionService.addReaction(parseInt(messageId), userId, reaction);
    
    res.status(201).json({
      success: true,
      message: 'Reaction added successfully'
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add reaction';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};

export const removeReaction = async (req: Request, res: Response) => {
  try {
    const { messageId, reaction } = req.params;
    const userId = req.user!.id;

    const success = await discussionService.removeReaction(
      parseInt(messageId),
      userId,
      reaction
    );
    
    if (!success) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove reaction';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
};

// Mark discussion as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user!.id;

    await discussionService.markDiscussionAsRead(parseInt(discussionId), userId);
    
    res.json({
      success: true,
      message: 'Discussion marked as read'
    });
  } catch (error) {
    console.error('Error marking discussion as read:', error);
    res.status(500).json({ error: 'Failed to mark discussion as read' });
  }
};

// Activity message endpoints (simplified for Phase 6)
export const createActivityMessage = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const messageData = {
      discussion_id: 0, // We'll use activity_id instead
      user_id: userId,
      content
    };

    // For now, create a simple message entry - in a full implementation, 
    // you'd want to create a separate activity_messages table
    const message = await discussionService.createActivityMessage(parseInt(activityId), messageData);
    
    res.status(201).json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('Error creating activity message:', error);
    const errorMessage = error.message || 'Failed to create message';
    if (errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    res.status(500).json({ error: 'Failed to create message' });
  }
};

export const getActivityMessages = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;

    const messages = await discussionService.getActivityMessages(parseInt(activityId));
    
    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching activity messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};