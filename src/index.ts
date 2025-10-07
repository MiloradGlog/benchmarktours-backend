import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectToDatabase } from './config/db';
import { runMigrations } from './config/migrate';
import authRoutes from './api/auth/auth.routes';
import userRoutes from './api/users/user.routes';
import companyRoutes from './api/companies/company.routes';
import tourRoutes from './api/tours/tour.routes';
import noteRoutes from './api/notes/note.routes';
import discussionRoutes from './api/discussions/discussion.routes';
import uploadRoutes from './api/uploads/upload.routes';
import cleanupRoutes from './api/cleanup/cleanup.routes';
import reviewRoutes from './api/reviews/review.routes';
import surveyRoutes from './api/surveys/survey.routes';
import publicSurveyRoutes from './api/surveys/publicSurvey.routes';
import questionRoutes from './api/questions/question.routes';
import activityGeneralRoutes from './api/activities/activityGeneral.routes';
import dashboardRoutes from './api/dashboard/dashboard.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
  : ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:19006']; // Admin web ports + Expo dev

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Public routes MUST come first to avoid auth middleware
app.use('/api/public', publicSurveyRoutes);

// API Routes (with authentication)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api', noteRoutes);
app.use('/api', discussionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api', reviewRoutes);
app.use('/api', surveyRoutes);
app.use('/api', questionRoutes);
app.use('/api', activityGeneralRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Start server
const startServer = async () => {
  try {
    await connectToDatabase();
    await runMigrations();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();