// Base interfaces for onboarding
export interface OnboardingProgressResponse {
  userId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  lastUpdated: string;
  isCompleted: boolean;
  paymentStatus: 'pending' | 'completed' | 'failed';
  completionPercentage: number;
}

export interface OnboardingStepResponse {
  userId: string;
  step: number;
  stepName: string;
  data: any;
  completedAt: string | null;
  updatedAt: string;
}

export interface OnboardingFileInfo {
  id: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  filePath: string;
  fileType: string;
  metadata?: any;
}

// Step-specific data structures
export interface IncomeTypesData {
  selectedIncomeTypes: string[];
  timestamp: string;
}

export interface FileData {
  id: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  uploadedAt: string;
  fileId: string;
  mimeType: string;
}

export interface DocumentsData {
  form16: FileData | null;
  payslips: FileData | null;
  offerLetter: FileData | null;
  additionalDocuments: FileData[];
}

export interface IncomeDetailsData {
  businessType: string;
  grossReceipts: string;
  bankStatements: FileData[];
  gstReturns: FileData[];
  profitLossStatements: FileData[];
  businessRegistration: FileData[];
}

export interface CapitalGainsData {
  stocks: {
    plStatements: FileData[];
    contractNotes: FileData[];
  };
  rsus: {
    plStatements: FileData[];
    vestingDocuments: FileData[];
  };
  foreignAssets: {
    statements: FileData[];
    exchangeRates: FileData[];
  };
  property: {
    saleDeed: FileData[];
    purchaseDeed: FileData[];
    costReceipts: FileData[];
    valuationReport: FileData[];
    form16b: FileData[];
    doc54ec: FileData[];
  };
  jewellery: {
    receipts: FileData[];
    valuationCertificate: FileData[];
  };
  mutualFunds: {
    statements: FileData[];
    capitalGainsStatement: FileData[];
  };
}

export interface OtherIncomesData {
  bankInterest: {
    amount: string;
    documents: FileData[];
  };
  dividends: {
    amount: string;
    documents: FileData[];
  };
  agriculture: {
    grossReceipts: string;
    expenses: string;
    netProceeds: string;
    documents: FileData[];
  };
  gaming: {
    amount: string;
    documents: FileData[];
  };
  other: {
    sourceName: string;
    amount: string;
    documents: FileData[];
  };
  rental: {
    amount: string;
    documents: FileData[];
  };
  freelance: {
    amount: string;
    documents: FileData[];
  };
}

export interface SummaryData {
  whatsappUpdates: boolean;
  reviewedSections: string[];
  confirmationTimestamp: string;
  additionalNotes: string;
  preferredCommunication: 'email' | 'sms' | 'whatsapp';
  urgentContact: boolean;
}

export interface PaymentData {
  selectedPackageId: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  amount: number;
  currency: string;
  paymentTimestamp?: string;
  paymentGateway?: string;
  orderId?: string;
  discountCode?: string;
  discountAmount?: number;
}

// Request/Response interfaces
export interface SaveStepDataRequest {
  userId: string;
  step: number;
  stepName: string;
  data: any;
  markAsCompleted?: boolean;
}

export interface UpdateProgressRequest {
  userId: string;
  currentStep?: number;
  action?: 'navigate' | 'complete_payment' | 'fail_payment' | 'reset';
  additionalData?: any;
}

export interface OnboardingApiResponse {
  progress: OnboardingProgressResponse;
  stepData?: OnboardingStepResponse;
  allStepsData?: OnboardingStepResponse[];
  files?: OnboardingFileInfo[];
  stepConfig?: any;
}

export interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OnboardingStepConfig {
  stepNumber: number;
  stepName: string;
  title: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  fileUploads: {
    required: string[];
    optional: string[];
    maxFiles: number;
    maxFileSize: number;
    allowedTypes: string[];
  };
  validation: {
    [key: string]: any;
  };
}

// Enums for better type safety
export enum OnboardingSteps {
  INCOME_TYPES = 1,
  DOCUMENTS = 2,
  INCOME_DETAILS = 3,
  CAPITAL_GAINS = 4,
  OTHER_INCOMES = 5,
  SUMMARY = 6,
  PAYMENT = 7,
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum FileTypes {
  FORM16 = 'form16',
  PAYSLIP = 'payslip',
  OFFER_LETTER = 'offer_letter',
  BANK_STATEMENT = 'bank_statement',
  GST_RETURN = 'gst_return',
  PL_STATEMENT = 'pl_statement',
  CAPITAL_GAINS = 'capital_gains',
  PROPERTY_DEED = 'property_deed',
  VALUATION_REPORT = 'valuation_report',
  FORM16B = 'form16b',
  OTHER = 'other',
}

export const STEP_NAMES = {
  [OnboardingSteps.INCOME_TYPES]: 'income-types',
  [OnboardingSteps.DOCUMENTS]: 'documents',
  [OnboardingSteps.INCOME_DETAILS]: 'income-details',
  [OnboardingSteps.CAPITAL_GAINS]: 'capital-gains',
  [OnboardingSteps.OTHER_INCOMES]: 'other-incomes',
  [OnboardingSteps.SUMMARY]: 'summary',
  [OnboardingSteps.PAYMENT]: 'payment',
};

export const STEP_CONFIGS: Record<number, OnboardingStepConfig> = {
  [OnboardingSteps.INCOME_TYPES]: {
    stepNumber: 1,
    stepName: 'income-types',
    title: 'Income Type Selection',
    description: 'Select your income sources',
    requiredFields: ['selectedIncomeTypes'],
    optionalFields: [],
    fileUploads: {
      required: [],
      optional: [],
      maxFiles: 0,
      maxFileSize: 0,
      allowedTypes: [],
    },
    validation: {
      selectedIncomeTypes: {
        required: true,
        minLength: 1,
      },
    },
  },
  [OnboardingSteps.DOCUMENTS]: {
    stepNumber: 2,
    stepName: 'documents',
    title: 'Document Upload',
    description: 'Upload required documents',
    requiredFields: [],
    optionalFields: ['form16', 'payslips', 'offerLetter'],
    fileUploads: {
      required: ['form16'],
      optional: ['payslips', 'offerLetter'],
      maxFiles: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    validation: {},
  },
  [OnboardingSteps.INCOME_DETAILS]: {
    stepNumber: 3,
    stepName: 'income-details',
    title: 'Income Details',
    description: 'Business income details, bank statements, GST returns',
    requiredFields: ['businessType'],
    optionalFields: ['grossReceipts', 'bankStatements', 'gstReturns'],
    fileUploads: {
      required: [],
      optional: ['bankStatements', 'gstReturns', 'profitLossStatements'],
      maxFiles: 15,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    validation: {
      businessType: {
        required: true,
      },
    },
  },
  [OnboardingSteps.CAPITAL_GAINS]: {
    stepNumber: 4,
    stepName: 'capital-gains',
    title: 'Capital Gains',
    description: 'Upload capital gains documents (stocks, property, etc.)',
    requiredFields: [],
    optionalFields: ['stocks', 'rsus', 'property', 'mutualFunds'],
    fileUploads: {
      required: [],
      optional: ['stocks', 'property', 'mutualFunds'],
      maxFiles: 20,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    validation: {},
  },
  [OnboardingSteps.OTHER_INCOMES]: {
    stepNumber: 5,
    stepName: 'other-incomes',
    title: 'Other Incomes',
    description: 'Interest/dividends, agriculture, gaming income',
    requiredFields: [],
    optionalFields: ['bankInterest', 'dividends', 'agriculture', 'gaming', 'rental'],
    fileUploads: {
      required: [],
      optional: ['bankInterest', 'dividends', 'agriculture'],
      maxFiles: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    validation: {},
  },
  [OnboardingSteps.SUMMARY]: {
    stepNumber: 6,
    stepName: 'summary',
    title: 'Summary',
    description: 'Review all data with edit options',
    requiredFields: ['reviewedSections', 'confirmationTimestamp'],
    optionalFields: ['whatsappUpdates', 'additionalNotes'],
    fileUploads: {
      required: [],
      optional: [],
      maxFiles: 0,
      maxFileSize: 0,
      allowedTypes: [],
    },
    validation: {
      reviewedSections: {
        required: true,
        minLength: 1,
      },
      confirmationTimestamp: {
        required: true,
      },
    },
  },
  [OnboardingSteps.PAYMENT]: {
    stepNumber: 7,
    stepName: 'payment',
    title: 'Payment',
    description: 'Select package and complete payment',
    requiredFields: ['selectedPackageId', 'amount', 'paymentMethod'],
    optionalFields: ['discountCode', 'paymentGateway'],
    fileUploads: {
      required: [],
      optional: [],
      maxFiles: 0,
      maxFileSize: 0,
      allowedTypes: [],
    },
    validation: {
      selectedPackageId: {
        required: true,
      },
      amount: {
        required: true,
        min: 0,
      },
      paymentMethod: {
        required: true,
      },
    },
  },
}; 