import { query } from '../../config/db';

export interface DashboardStats {
  totalCompanies: number;
  activeTours: number;
  totalUsers: number;
  upcomingTours: number;
}

export interface RecentActivity {
  type: 'user' | 'tour' | 'company' | 'activity' | 'message';
  description: string;
  timestamp: Date;
  user_name?: string;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  // Get total companies
  const companiesResult = await query('SELECT COUNT(*) as count FROM companies');
  const totalCompanies = parseInt(companiesResult.rows[0].count);

  // Get active tours (tours with status 'Pending' - currently running)
  const activeToursResult = await query(
    "SELECT COUNT(*) as count FROM tours WHERE status = 'Pending'"
  );
  const activeTours = parseInt(activeToursResult.rows[0].count);

  // Get total users
  const usersResult = await query('SELECT COUNT(*) as count FROM users');
  const totalUsers = parseInt(usersResult.rows[0].count);

  // Get upcoming tours (tours with status 'Draft' that haven't started yet)
  const upcomingToursResult = await query(
    "SELECT COUNT(*) as count FROM tours WHERE status = 'Draft' AND start_date > NOW()"
  );
  const upcomingTours = parseInt(upcomingToursResult.rows[0].count);

  return {
    totalCompanies,
    activeTours,
    totalUsers,
    upcomingTours
  };
};

export const getRecentActivity = async (): Promise<RecentActivity[]> => {
  const activities: RecentActivity[] = [];

  // Get recent user registrations (last 5)
  const usersResult = await query(`
    SELECT
      first_name,
      last_name,
      created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 5
  `);

  usersResult.rows.forEach(row => {
    activities.push({
      type: 'user',
      description: `New user registered: ${row.first_name} ${row.last_name}`,
      timestamp: row.created_at,
      user_name: `${row.first_name} ${row.last_name}`
    });
  });

  // Get recent tour creations (last 5)
  const toursResult = await query(`
    SELECT
      name,
      created_at
    FROM tours
    ORDER BY created_at DESC
    LIMIT 5
  `);

  toursResult.rows.forEach(row => {
    activities.push({
      type: 'tour',
      description: `Tour "${row.name}" created`,
      timestamp: row.created_at
    });
  });

  // Get recent company creations (last 5)
  const companiesResult = await query(`
    SELECT
      name,
      created_at,
      updated_at
    FROM companies
    ORDER BY updated_at DESC
    LIMIT 5
  `);

  companiesResult.rows.forEach(row => {
    const isNew = new Date(row.created_at).getTime() === new Date(row.updated_at).getTime();
    activities.push({
      type: 'company',
      description: isNew ? `Company "${row.name}" added` : `Company "${row.name}" updated`,
      timestamp: row.updated_at
    });
  });

  // Get recent activities created (last 5)
  const activitiesResult = await query(`
    SELECT
      title,
      created_at
    FROM activities
    ORDER BY created_at DESC
    LIMIT 5
  `);

  activitiesResult.rows.forEach(row => {
    activities.push({
      type: 'activity',
      description: `Activity "${row.title}" created`,
      timestamp: row.created_at
    });
  });

  // Get recent discussion messages (last 5)
  const messagesResult = await query(`
    SELECT
      dm.content,
      dm.created_at,
      u.first_name,
      u.last_name
    FROM discussion_messages dm
    JOIN users u ON dm.user_id = u.id
    ORDER BY dm.created_at DESC
    LIMIT 5
  `);

  messagesResult.rows.forEach(row => {
    const truncatedContent = row.content.length > 50
      ? row.content.substring(0, 50) + '...'
      : row.content;
    activities.push({
      type: 'message',
      description: `${row.first_name} ${row.last_name} posted: "${truncatedContent}"`,
      timestamp: row.created_at,
      user_name: `${row.first_name} ${row.last_name}`
    });
  });

  // Sort all activities by timestamp (most recent first) and return top 10
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
};
