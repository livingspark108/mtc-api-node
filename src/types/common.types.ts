// Common response types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

// File upload types
export interface FileUploadInfo {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  hash: string;
  uploadedAt: Date;
}

// Database query types
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  include?: string[];
  attributes?: string[];
}

export interface WhereClause {
  [key: string]: any;
}

export interface FindOptions extends QueryOptions {
  where?: WhereClause;
}

// Notification types
export interface NotificationData {
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'error';
  category: 'filing' | 'payment' | 'document' | 'system';
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
}

export interface SMSData {
  to: string;
  message: string;
  templateId?: string;
  variables?: Record<string, string>;
}

// Audit log types
export interface AuditLogEntry {
  id: number;
  userId?: number;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Cache types
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[];
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  tags?: string[];
}

// Health check types
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime?: number;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: HealthCheck[];
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
}

// Job queue types
export interface JobData {
  type: string;
  payload: Record<string, any>;
  userId?: number;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

// Analytics types
export interface AnalyticsEvent {
  event: string;
  userId?: number;
  sessionId?: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

// External API types
export interface ExternalAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
  responseTime: number;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Search types
export interface SearchQuery {
  term: string;
  filters?: Record<string, any>;
  facets?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, SearchFacet>;
  suggestions?: string[];
  queryTime: number;
}

export interface SearchFacet {
  name: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Webhook types
export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp: Date;
  signature?: string;
}

export interface WebhookEndpoint {
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  retryAttempts: number;
  timeout: number;
}

// Feature flag types
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  conditions?: FeatureFlagCondition[];
  rolloutPercentage?: number;
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'user_role' | 'custom';
  operator: 'equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

// Localization types
export interface LocalizedString {
  [locale: string]: string;
}

export interface TranslationKey {
  key: string;
  defaultValue: string;
  namespace?: string;
  interpolation?: Record<string, any>;
}

// Generic utility types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Environment types
export type Environment = 'development' | 'staging' | 'production' | 'test';

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Sort order types
export type SortOrder = 'asc' | 'desc';

// Status types
export type Status = 'active' | 'inactive' | 'pending' | 'suspended' | 'deleted'; 