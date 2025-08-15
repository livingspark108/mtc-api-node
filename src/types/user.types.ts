import { 
  UserRole, 
  ClientStatus, 
  FilingType, 
  FilingStatus, 
  FilingPriority,
  Theme,
  Language 
} from '../utils/constants';

// User interfaces
export interface User {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  profileImageUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  fullName?: string;
  phone?: string;
  profileImageUrl?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  profileImageUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  client?: ClientProfile;
  caProfile?: CAProfile;
  settings?: UserSettings;
}

// Client interfaces
export interface Client {
  id: number;
  userId: number;
  caId?: number;
  panNumber: string;
  aadharNumber?: string;
  dateOfBirth: Date;
  addressJson: AddressInfo;
  occupation?: string;
  annualIncome?: number;
  status: ClientStatus;
  onboardingCompleted: boolean;
  profileJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientProfile extends Client {
  user: User;
  assignedCA?: User;
  filings?: Filing[];
  documents?: Document[];
  payments?: Payment[];
}

export interface CreateClientRequest {
  userId: number;
  panNumber: string;
  aadharNumber?: string;
  dateOfBirth: string;
  address: AddressInfo;
  occupation?: string;
  annualIncome?: number;
}

export interface UpdateClientRequest {
  caId?: number;
  aadharNumber?: string;
  dateOfBirth?: string;
  address?: AddressInfo;
  occupation?: string;
  annualIncome?: number;
  status?: ClientStatus;
  onboardingCompleted?: boolean;
  profileJson?: Record<string, any>;
}

// CA Profile interfaces
export interface CAProfile {
  userId: number;
  licenseNumber: string;
  experienceYears: number;
  specializationsJson: string[];
  hourlyRate?: number;
  availabilityJson: AvailabilityInfo;
  maxClients: number;
  currentClients: number;
  rating: number;
  totalReviews: number;
  bio?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCAProfileRequest {
  userId: number;
  licenseNumber: string;
  experienceYears: number;
  specializations: string[];
  hourlyRate?: number;
  availability: AvailabilityInfo;
  maxClients?: number;
  bio?: string;
}

export interface UpdateCAProfileRequest {
  experienceYears?: number;
  specializations?: string[];
  hourlyRate?: number;
  availability?: AvailabilityInfo;
  maxClients?: number;
  bio?: string;
  isAvailable?: boolean;
}

// Address interface
export interface AddressInfo {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

// Availability interface
export interface AvailabilityInfo {
  workingHours: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  workingDays: string[]; // ['monday', 'tuesday', ...]
  timezone: string;
  breakHours?: {
    start: string;
    end: string;
  };
}

// Filing interfaces
export interface Filing {
  id: number;
  clientId: number;
  caId?: number;
  taxYear: string;
  filingType: FilingType;
  status: FilingStatus;
  priority: FilingPriority;
  incomeSourcesJson?: Record<string, any>;
  deductionsJson?: Record<string, any>;
  summaryJson?: Record<string, any>;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFilingRequest {
  clientId: number;
  taxYear: string;
  filingType: FilingType;
  dueDate?: string;
  priority?: FilingPriority;
}

export interface UpdateFilingRequest {
  caId?: number;
  status?: FilingStatus;
  priority?: FilingPriority;
  incomeSourcesJson?: Record<string, any>;
  deductionsJson?: Record<string, any>;
  summaryJson?: Record<string, any>;
  notes?: string;
  dueDate?: string;
}

// Document interfaces
export interface Document {
  id: number;
  filingId: number;
  uploadedBy: number;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType?: string;
  isVerified: boolean;
  verifiedBy?: number;
  verifiedAt?: Date;
  metadataJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Payment interfaces
export interface Payment {
  id: number;
  clientId: number;
  filingId?: number;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  gatewayProvider?: string;
  gatewayTransactionId?: string;
  gatewayResponseJson?: Record<string, any>;
  receiptUrl?: string;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Settings interfaces
export interface UserSettings {
  userId: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  language: Language;
  timezone: string;
  theme: Theme;
  preferencesJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserSettingsRequest {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  language?: Language;
  timezone?: string;
  theme?: Theme;
  preferencesJson?: Record<string, any>;
}

// Dashboard interfaces
export interface AdminDashboard {
  totalUsers: number;
  totalClients: number;
  totalCAs: number;
  totalFilings: number;
  pendingFilings: number;
  completedFilings: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentActivity: ActivityItem[];
}

export interface CADashboard {
  assignedClients: number;
  activeFilings: number;
  completedFilings: number;
  pendingReviews: number;
  monthlyEarnings: number;
  rating: number;
  recentFilings: Filing[];
  upcomingDeadlines: Filing[];
}

export interface CustomerDashboard {
  activeFilings: number;
  completedFilings: number;
  pendingDocuments: number;
  assignedCA?: User;
  recentActivity: ActivityItem[];
  upcomingDeadlines: Filing[];
}

export interface ActivityItem {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Search and filter interfaces
export interface UserSearchFilters {
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ClientSearchFilters {
  status?: ClientStatus;
  caId?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilingSearchFilters {
  status?: FilingStatus;
  filingType?: FilingType;
  priority?: FilingPriority;
  clientId?: number;
  caId?: number;
  taxYear?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} 