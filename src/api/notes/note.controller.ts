import { Request, Response } from 'express';
import * as noteService from './note.service';

export const createNote = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = req.user!.id;
    const { title, content, is_private = false, tags = [], attachments = [] } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const noteData = {
      user_id: userId,
      activity_id: parseInt(activityId),
      title,
      content,
      is_private,
      tags,
      attachments
    };

    const note = await noteService.createNote(noteData);
    
    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

export const getNotesByActivity = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = req.user?.id;

    const notes = await noteService.getNotesByActivity(parseInt(activityId), userId);
    
    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching notes by activity:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

export const getNotesByTour = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;
    const userId = req.user?.id;

    const notes = await noteService.getNotesByTour(parseInt(tourId), userId);
    
    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching notes by tour:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

export const getUserNotes = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const notes = await noteService.getNotesByUser(userId);
    
    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching user notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

export const getNoteById = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.id;

    const note = await noteService.getNoteById(parseInt(noteId), userId);
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error fetching note by ID:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const userId = req.user!.id;
    const { title, content, is_private, tags, attachments } = req.body;

    const note = await noteService.updateNote(
      parseInt(noteId), 
      { title, content, is_private, tags, attachments }, 
      userId
    );
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const userId = req.user!.id;

    const success = await noteService.deleteNote(parseInt(noteId), userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
};