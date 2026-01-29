import { Request, Response } from 'express';
import * as shoppingService from './shopping.service';

export const getShoppingItems = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tourId = parseInt(req.params.tourId);

    const items = await shoppingService.getShoppingItems(tourId, userId);
    res.json({ items, total_count: items.length });
  } catch (error) {
    console.error('Error fetching shopping items:', error);
    res.status(500).json({ error: 'Failed to fetch shopping items' });
  }
};

export const getShoppingItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    const item = await shoppingService.getShoppingItem(itemId, userId);

    if (!item) {
      return res.status(404).json({ error: 'Shopping item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching shopping item:', error);
    res.status(500).json({ error: 'Failed to fetch shopping item' });
  }
};

export const createShoppingItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tourId = parseInt(req.params.tourId);

    const item = await shoppingService.createShoppingItem(tourId, userId, req.body);
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating shopping item:', error);
    res.status(500).json({ error: 'Failed to create shopping item' });
  }
};

export const updateShoppingItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    const item = await shoppingService.updateShoppingItem(itemId, userId, req.body);

    if (!item) {
      return res.status(404).json({ error: 'Shopping item not found' });
    }

    res.json(item);
  } catch (error: any) {
    console.error('Error updating shopping item:', error);

    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update shopping item' });
  }
};

export const deleteShoppingItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    const deleted = await shoppingService.deleteShoppingItem(itemId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Shopping item not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting shopping item:', error);

    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to delete shopping item' });
  }
};

export const voteOnItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    await shoppingService.voteOnItem(itemId, userId, req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error voting on shopping item:', error);
    res.status(500).json({ error: 'Failed to vote on shopping item' });
  }
};

export const removeVote = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    await shoppingService.removeVote(itemId, userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.itemId);

    const comment = await shoppingService.addComment(itemId, userId, req.body);
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};