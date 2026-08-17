import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { query } from '../config/db';

const expo = new Expo();

/**
 * Send a chat push notification to all participants of a tour except the sender
 * and except users who have blocked the sender.
 *
 * NOTE: Never log message content — only ids and counts.
 */
export const sendChatPush = async (
  tourId: number,
  senderId: string,
  senderFirstName: string,
  tourName: string,
  content: string,
  discussionId: number
): Promise<void> => {
  // Tokens of tour participants, minus the sender, minus users who blocked the sender
  const tokensResult = await query(`
    SELECT dpt.token
    FROM device_push_tokens dpt
    JOIN tour_participants tp ON tp.user_id = dpt.user_id
    WHERE tp.tour_id = $1
      AND dpt.user_id <> $2
      AND dpt.user_id NOT IN (
        SELECT blocker_id FROM user_blocks WHERE blocked_id = $2
      )
  `, [tourId, senderId]);

  const tokens: string[] = tokensResult.rows
    .map((row: { token: string }) => row.token)
    .filter((token: string) => Expo.isExpoPushToken(token));

  if (tokens.length === 0) {
    return;
  }

  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: tourName,
    body: `${senderFirstName}: ${content.slice(0, 120)}`,
    data: { tourId, tourName, type: 'chat' }
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunks[i]);
      tickets.push(...chunkTickets);
    } catch (error: any) {
      // Never log content — ids and counts only
      console.error(
        `[push] Failed to send chat push chunk (discussion ${discussionId}, ${chunks[i].length} recipients):`,
        error?.message || error
      );
      // Keep ticket indexing aligned with tokens for subsequent chunks
      tickets.push(...chunks[i].map((): ExpoPushTicket => ({ status: 'ok', id: '' })));
    }
  }

  // Handle DeviceNotRegistered — remove stale token rows
  const staleTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const token = tokens[index];
      if (token) {
        staleTokens.push(token);
      }
    }
  });

  if (staleTokens.length > 0) {
    await query('DELETE FROM device_push_tokens WHERE token = ANY($1::text[])', [staleTokens]);
    console.log(`[push] Removed ${staleTokens.length} unregistered device token(s)`);
  }

  console.log(
    `[push] Chat push dispatched (discussion ${discussionId}, tour ${tourId}, ${tokens.length} recipient token(s))`
  );
};
