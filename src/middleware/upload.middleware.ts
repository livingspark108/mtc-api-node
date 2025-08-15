import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AWS from 'aws-sdk';
import { Request, Response, NextFunction } from 'express';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import { DOCUMENT_TYPES } from '../utils/constants';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.STORAGE_BUCKET || 'mct-documents';
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 's3'

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Multer configuration for local storage
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'documents');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    cb(null, `${basename}-${uniqueSuffix}${extension}`);
  },
});

// Multer configuration for memory storage (for S3 upload)
const memoryStorage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} is not allowed`));
  }

  // Check file extension
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt', '.xls', '.xlsx'];
  
  if (!allowedExtensions.includes(extension)) {
    return cb(new Error(`File extension ${extension} is not allowed`));
  }

  // Additional security checks
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return cb(new Error('Invalid file name'));
  }

  cb(null, true);
};

// Create multer instances
const localUpload = multer({
  storage: localStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Maximum 5 files per request
  },
});

const s3Upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

// S3 upload function
export const uploadToS3 = async (file: Express.Multer.File, folder: string = 'documents'): Promise<string> => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const extension = path.extname(file.originalname);
  const basename = path.basename(file.originalname, extension);
  const key = `${folder}/${basename}-${uniqueSuffix}${extension}`;

  const params: AWS.S3.PutObjectRequest = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'private', // Files are private by default
    Metadata: {
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
    },
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    logger.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

// Get signed URL for S3 file access
export const getS3SignedUrl = async (fileUrl: string, expiresIn: number = 3600): Promise<string> => {
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn, // URL expires in 1 hour by default
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw new Error('Failed to generate file access URL');
  }
};

// Delete file from S3
export const deleteFromS3 = async (fileUrl: string): Promise<void> => {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(params).promise();
  } catch (error) {
    logger.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

// Main upload middleware
export const uploadDocument = (fieldName: string = 'document') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const upload = STORAGE_TYPE === 's3' ? s3Upload : localUpload;
      
      upload.single(fieldName)(req, res, async (err: any) => {
        if (err) {
          logger.error('File upload error:', err);
          
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              ResponseUtil.error(res, 'File size exceeds 10MB limit', 400);
              return;
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
              ResponseUtil.error(res, 'Unexpected file field', 400);
              return;
            }
          }
          
          ResponseUtil.error(res, err.message || 'File upload failed', 400);
          return;
        }

        if (!req.file) {
          ResponseUtil.error(res, 'No file uploaded', 400);
          return;
        }

        try {
          // If using S3, upload the file
          if (STORAGE_TYPE === 's3') {
            const s3Url = await uploadToS3(req.file, 'documents');
            req.file.path = s3Url; // Store S3 URL in file.path
          }

          // Add additional file metadata
          (req.file as any).uploadedAt = new Date();
          (req.file as any).isSecure = STORAGE_TYPE === 's3';

          next();
        } catch (uploadError) {
          logger.error('Storage upload error:', uploadError);
          ResponseUtil.error(res, 'Failed to store file', 500);
          return;
        }
      });
    } catch (error) {
      logger.error('Upload middleware error:', error);
      ResponseUtil.error(res, 'Upload middleware failed', 500);
      return;
    }
  };
};

// Multiple files upload middleware
export const uploadMultipleDocuments = (fieldName: string = 'documents', maxCount: number = 5) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const upload = STORAGE_TYPE === 's3' ? s3Upload : localUpload;
      
      upload.array(fieldName, maxCount)(req, res, async (err: any) => {
        if (err) {
          logger.error('Multiple file upload error:', err);
          
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              ResponseUtil.error(res, 'One or more files exceed 10MB limit', 400);
              return;
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
              ResponseUtil.error(res, 'Too many files uploaded', 400);
              return;
            }
          }
          
          ResponseUtil.error(res, err.message || 'File upload failed', 400);
          return;
        }

        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
          ResponseUtil.error(res, 'No files uploaded', 400);
          return;
        }

        try {
          const files = req.files as Express.Multer.File[];
          
          // If using S3, upload all files
          if (STORAGE_TYPE === 's3') {
            const uploadPromises = files.map(async (file) => {
              const s3Url = await uploadToS3(file, 'documents');
              file.path = s3Url;
              (file as any).uploadedAt = new Date();
              (file as any).isSecure = true;
              return file;
            });

            await Promise.all(uploadPromises);
          } else {
            // For local storage, just add metadata
            files.forEach(file => {
              (file as any).uploadedAt = new Date();
              (file as any).isSecure = false;
            });
          }

          next();
        } catch (uploadError) {
          logger.error('Storage upload error:', uploadError);
          ResponseUtil.error(res, 'Failed to store files', 500);
          return;
        }
      });
    } catch (error) {
      logger.error('Multiple upload middleware error:', error);
      ResponseUtil.error(res, 'Upload middleware failed', 500);
      return;
    }
  };
};

// Validate document type middleware
export const validateDocumentType = (req: Request, res: Response, next: NextFunction): void => {
  const { documentType } = req.body;

  if (!documentType) {
    ResponseUtil.error(res, 'Document type is required', 400);
    return;
  }

  if (!Object.values(DOCUMENT_TYPES).includes(documentType)) {
    ResponseUtil.error(res, 'Invalid document type', 400);
    return;
  }

  next();
};

// File access middleware for serving local files
export const serveFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileUrl } = req.params;
    
    if (STORAGE_TYPE === 's3') {
      // Generate signed URL for S3 files
      const signedUrl = await getS3SignedUrl(fileUrl);
      return res.redirect(signedUrl);
    } else {
      // Serve local files
      const filePath = path.join(process.cwd(), 'uploads', fileUrl);
      
      if (!fs.existsSync(filePath)) {
        return ResponseUtil.error(res, 'File not found', 404);
      }

      // Security check - ensure file is within uploads directory
      const resolvedPath = path.resolve(filePath);
      const uploadsPath = path.resolve(path.join(process.cwd(), 'uploads'));
      
      if (!resolvedPath.startsWith(uploadsPath)) {
        return ResponseUtil.error(res, 'Access denied', 403);
      }

      res.sendFile(resolvedPath);
    }
  } catch (error) {
    logger.error('File serve error:', error);
    return ResponseUtil.error(res, 'Failed to serve file', 500);
  }
};

// Cleanup local files
export const deleteLocalFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error('Failed to delete local file:', error);
  }
};

export default {
  uploadDocument,
  uploadMultipleDocuments,
  validateDocumentType,
  serveFile,
  uploadToS3,
  getS3SignedUrl,
  deleteFromS3,
  deleteLocalFile,
}; 