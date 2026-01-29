import { query } from '../../config/db';
import {
  ShoppingItem,
  ShoppingItemComment,
  ShoppingItemDetail,
  CreateShoppingItemData,
  UpdateShoppingItemData,
  CreateCommentData,
  VoteData
} from './shopping.types';

export async function getShoppingItems(tourId: number, userId: string): Promise<ShoppingItem[]> {
  const sql = `
    SELECT
      si.id,
      si.tour_id,
      si.created_by,
      si.text,
      si.value,
      si.company_id,
      si.company_note,
      si.created_at,
      si.updated_at,
      u.first_name || ' ' || u.last_name as creator_name,
      c.name as company_name,
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'upvote') as upvotes,
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'downvote') as downvotes,
      (SELECT vote_type FROM shopping_item_votes WHERE item_id = si.id AND user_id = $2) as user_vote,
      (SELECT COUNT(*) FROM shopping_item_comments WHERE item_id = si.id) as comment_count,
      COALESCE(
        (SELECT json_agg(image_url ORDER BY created_at)
         FROM shopping_item_images
         WHERE item_id = si.id),
        '[]'::json
      ) as images
    FROM shopping_items si
    LEFT JOIN users u ON si.created_by = u.id
    LEFT JOIN companies c ON si.company_id = c.id
    WHERE si.tour_id = $1
    ORDER BY
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'upvote') -
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'downvote') DESC,
      si.created_at DESC
  `;

  const result = await query(sql, [tourId, userId]);
  return result.rows.map(row => ({
    ...row,
    upvotes: parseInt(row.upvotes),
    downvotes: parseInt(row.downvotes),
    comment_count: parseInt(row.comment_count)
  }));
}

export async function getShoppingItem(itemId: number, userId: string): Promise<ShoppingItemDetail | null> {
  const itemSql = `
    SELECT
      si.id,
      si.tour_id,
      si.created_by,
      si.text,
      si.value,
      si.company_id,
      si.company_note,
      si.created_at,
      si.updated_at,
      u.first_name || ' ' || u.last_name as creator_name,
      c.name as company_name,
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'upvote') as upvotes,
      (SELECT COUNT(*) FROM shopping_item_votes WHERE item_id = si.id AND vote_type = 'downvote') as downvotes,
      (SELECT vote_type FROM shopping_item_votes WHERE item_id = si.id AND user_id = $2) as user_vote,
      (SELECT COUNT(*) FROM shopping_item_comments WHERE item_id = si.id) as comment_count,
      COALESCE(
        (SELECT json_agg(image_url ORDER BY created_at)
         FROM shopping_item_images
         WHERE item_id = si.id),
        '[]'::json
      ) as images
    FROM shopping_items si
    LEFT JOIN users u ON si.created_by = u.id
    LEFT JOIN companies c ON si.company_id = c.id
    WHERE si.id = $1
  `;

  const commentsSql = `
    SELECT
      sic.id,
      sic.item_id,
      sic.user_id,
      sic.text,
      sic.created_at,
      u.first_name,
      u.last_name,
      u.first_name || ' ' || u.last_name as user_name
    FROM shopping_item_comments sic
    LEFT JOIN users u ON sic.user_id = u.id
    WHERE sic.item_id = $1
    ORDER BY sic.created_at DESC
  `;

  const [itemResult, commentsResult] = await Promise.all([
    query(itemSql, [itemId, userId]),
    query(commentsSql, [itemId])
  ]);

  if (itemResult.rows.length === 0) {
    return null;
  }

  const item = itemResult.rows[0];
  return {
    ...item,
    upvotes: parseInt(item.upvotes),
    downvotes: parseInt(item.downvotes),
    comment_count: parseInt(item.comment_count),
    comments: commentsResult.rows
  };
}

export async function createShoppingItem(tourId: number, userId: string, data: CreateShoppingItemData): Promise<ShoppingItem> {
  // Start transaction
  await query('BEGIN');

  try {
    // Insert the shopping item
    const insertSql = `
      INSERT INTO shopping_items (tour_id, created_by, text, value, company_id, company_note)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(insertSql, [
      tourId,
      userId,
      data.text,
      data.value || null,
      data.company_id || null,
      data.company_note || null
    ]);

    const itemId = result.rows[0].id;

    // Insert images if provided
    if (data.images && data.images.length > 0) {
      for (const imageUrl of data.images) {
        await query(
          'INSERT INTO shopping_item_images (item_id, image_url) VALUES ($1, $2)',
          [itemId, imageUrl]
        );
      }
    }

    await query('COMMIT');

    // Fetch the complete item with all details
    const items = await getShoppingItems(tourId, userId);
    return items.find(item => item.id === itemId)!;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function updateShoppingItem(itemId: number, userId: string, data: UpdateShoppingItemData): Promise<ShoppingItem | null> {
  // Start transaction
  await query('BEGIN');

  try {
    // Check if user is the creator
    const checkSql = 'SELECT created_by, tour_id FROM shopping_items WHERE id = $1';
    const checkResult = await query(checkSql, [itemId]);

    if (checkResult.rows.length === 0) {
      await query('ROLLBACK');
      return null;
    }

    if (checkResult.rows[0].created_by !== userId) {
      await query('ROLLBACK');
      throw new Error('Unauthorized: You can only edit your own items');
    }

    // Update the shopping item
    const updateFields = [];
    const values = [itemId];
    let paramCount = 1;

    if (data.text !== undefined) {
      updateFields.push(`text = $${++paramCount}`);
      values.push(data.text);
    }
    if (data.value !== undefined) {
      updateFields.push(`value = $${++paramCount}`);
      values.push(data.value || null);
    }
    if (data.company_id !== undefined) {
      updateFields.push(`company_id = $${++paramCount}`);
      values.push(data.company_id || null);
    }
    if (data.company_note !== undefined) {
      updateFields.push(`company_note = $${++paramCount}`);
      values.push(data.company_note || null);
    }

    if (updateFields.length > 0) {
      const updateSql = `
        UPDATE shopping_items
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
      `;
      await query(updateSql, values);
    }

    // Update images if provided
    if (data.images !== undefined) {
      // Delete existing images
      await query('DELETE FROM shopping_item_images WHERE item_id = $1', [itemId]);

      // Insert new images
      if (data.images.length > 0) {
        for (const imageUrl of data.images) {
          await query(
            'INSERT INTO shopping_item_images (item_id, image_url) VALUES ($1, $2)',
            [itemId, imageUrl]
          );
        }
      }
    }

    await query('COMMIT');

    // Fetch the updated item
    const tourId = checkResult.rows[0].tour_id;
    const items = await getShoppingItems(tourId, userId);
    return items.find(item => item.id === itemId) || null;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function deleteShoppingItem(itemId: number, userId: string): Promise<boolean> {
  // Check if user is the creator
  const checkSql = 'SELECT created_by FROM shopping_items WHERE id = $1';
  const checkResult = await query(checkSql, [itemId]);

  if (checkResult.rows.length === 0) {
    return false;
  }

  if (checkResult.rows[0].created_by !== userId) {
    throw new Error('Unauthorized: You can only delete your own items');
  }

  // Delete the item (cascade will handle related records)
  const deleteSql = 'DELETE FROM shopping_items WHERE id = $1';
  const result = await query(deleteSql, [itemId]);

  return (result.rowCount ?? 0) > 0;
}

export async function voteOnItem(itemId: number, userId: string, voteData: VoteData): Promise<void> {
  // First, remove any existing vote
  await query(
    'DELETE FROM shopping_item_votes WHERE item_id = $1 AND user_id = $2',
    [itemId, userId]
  );

  // Then add the new vote
  await query(
    'INSERT INTO shopping_item_votes (item_id, user_id, vote_type) VALUES ($1, $2, $3)',
    [itemId, userId, voteData.vote_type]
  );
}

export async function removeVote(itemId: number, userId: string): Promise<void> {
  await query(
    'DELETE FROM shopping_item_votes WHERE item_id = $1 AND user_id = $2',
    [itemId, userId]
  );
}

export async function addComment(itemId: number, userId: string, commentData: CreateCommentData): Promise<ShoppingItemComment> {
  const insertSql = `
    INSERT INTO shopping_item_comments (item_id, user_id, text)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const result = await query(insertSql, [itemId, userId, commentData.text]);
  const commentId = result.rows[0].id;

  // Fetch the complete comment with user info
  const fetchSql = `
    SELECT
      sic.id,
      sic.item_id,
      sic.user_id,
      sic.text,
      sic.created_at,
      u.first_name,
      u.last_name,
      u.first_name || ' ' || u.last_name as user_name
    FROM shopping_item_comments sic
    LEFT JOIN users u ON sic.user_id = u.id
    WHERE sic.id = $1
  `;

  const fetchResult = await query(fetchSql, [commentId]);
  return fetchResult.rows[0];
}