import { Router } from 'express';
import multer from 'multer';
import {
  uploadCompanyImageController,
  uploadActivityImageController,
  uploadDiscussionImageController,
  uploadDiscussionVoiceController,
  uploadNoteAudioController,
  uploadNoteImageController
} from './upload.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and audio files
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/mpeg',
      'audio/wav',
      'audio/m4a',
      'audio/mp4',      // m4a files often use audio/mp4
      'audio/x-m4a',    // alternate m4a MIME type
      'audio/aac',
      'audio/mp3'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error(`Rejected file with MIME type: ${file.mimetype}`);
      cb(new Error('Invalid file type. Only images and audio files are allowed.'));
    }
  }
});

// Company image upload
router.post('/company/:id/image', 
  authenticateToken, 
  upload.single('image'), 
  uploadCompanyImageController
);

// Activity image upload
router.post('/activity/:id/image', 
  authenticateToken, 
  upload.single('image'), 
  uploadActivityImageController
);

// Discussion image upload
router.post('/discussion/image', 
  authenticateToken, 
  upload.single('image'), 
  uploadDiscussionImageController
);

// Discussion voice recording upload
router.post('/discussion/voice',
  authenticateToken,
  upload.single('voice'),
  uploadDiscussionVoiceController
);

// Note audio upload
router.post('/note/audio',
  authenticateToken,
  upload.single('audio'),
  uploadNoteAudioController
);

// Note image upload
router.post('/note/image',
  authenticateToken,
  upload.single('image'),
  uploadNoteImageController
);

export default router;