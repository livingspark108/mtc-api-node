import dotenv from "dotenv";

// Load environment variables
import fs from "fs";

// Try .env.production first
if (fs.existsSync(".env.development.local")) {
  dotenv.config({ path: ".env.development.local" });
  console.log("[INFO] Loaded environment file: .env.development.local");
} else if (fs.existsSync(".env.ec2")) {
  dotenv.config({ path: ".env.ec2" });
  console.log("[INFO] Loaded environment file: .env.ec2");
} else {
  dotenv.config();
}

export interface Config {
  app: {
    env: string;
    port: number;
    apiVersion: string;
    frontendOrigin: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    dialect: string;
    logging: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshSecret: string;
    jwtRefreshExpiresIn: string;
    bcryptRounds: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  storage: {
    type: "local" | "s3";
    bucket: string;
    awsRegion?: string | undefined;
    awsAccessKeyId?: string | undefined;
    awsSecretAccessKey?: string | undefined;
  };
  email: {
    service: string;
    from: string;
    sendgridApiKey?: string | undefined;
  };
  payment: {
    razorpayKeyId?: string | undefined;
    razorpayKeySecret?: string | undefined;
    razorpayWebhookSecret?: string | undefined;
  };
  logging: {
    level: string;
    file: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  externalApis: {
    incomeTaxApiKey?: string | undefined;
    gstApiKey?: string | undefined;
  };
}

// Create Redis config conditionally
const createRedisConfig = () => {
  const redisConfig: any = {
    host: process.env["REDIS_HOST"] || "localhost",
    port: parseInt(process.env["REDIS_PORT"] || "6379", 10),
    db: parseInt(process.env["REDIS_DB"] || "0", 10),
  };

  if (process.env["REDIS_PASSWORD"]) {
    redisConfig.password = process.env["REDIS_PASSWORD"];
  }

  return redisConfig;
};

const config: Config = {
  app: {
    env: process.env["NODE_ENV"] || "development",
    port: parseInt(process.env["PORT"] || "4000", 10),
    apiVersion: process.env["API_VERSION"] || "v1",
    frontendOrigin: process.env["FRONTEND_ORIGIN"] || "http://localhost:3000",
  },
  database: {
    host: process.env["DB_HOST"] || "localhost",
    port: parseInt(process.env["DB_PORT"] || "3306", 10),
    name: process.env["DB_NAME"] || "mct_dev",
    user: process.env["DB_USER"] || "root",
    password: process.env["DB_PASSWORD"] || "password",
    dialect: process.env["DB_DIALECT"] || "mysql",
    logging: process.env["DB_LOGGING"] === "true",
  },
  auth: {
    jwtSecret:
      process.env["JWT_SECRET"] || "fallback-secret-change-in-production",
    jwtExpiresIn: process.env["JWT_EXPIRES_IN"] || "15m",
    jwtRefreshSecret:
      process.env["JWT_REFRESH_SECRET"] || "fallback-refresh-secret",
    jwtRefreshExpiresIn: process.env["JWT_REFRESH_EXPIRES_IN"] || "7d",
    bcryptRounds: parseInt(process.env["BCRYPT_ROUNDS"] || "12", 10),
  },
  redis: createRedisConfig(),
  storage: {
    type: (process.env["STORAGE_TYPE"] as "local" | "s3") || "local",
    bucket: process.env["STORAGE_BUCKET"] || "mct-documents",
    awsRegion: process.env["AWS_REGION"] || undefined,
    awsAccessKeyId: process.env["AWS_ACCESS_KEY_ID"] || undefined,
    awsSecretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] || undefined,
  },
  email: {
    service: process.env["EMAIL_SERVICE"] || "sendgrid",
    from: process.env["EMAIL_FROM"] || "noreply@mytaxclub.com",
    sendgridApiKey: process.env["SENDGRID_API_KEY"] || undefined,
  },
  payment: {
    razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || undefined,
    razorpayKeySecret: process.env["RAZORPAY_KEY_SECRET"] || undefined,
    razorpayWebhookSecret: process.env["RAZORPAY_WEBHOOK_SECRET"] || undefined,
  },
  logging: {
    level: process.env["LOG_LEVEL"] || "debug",
    file: process.env["LOG_FILE"] || "logs/app.log",
  },
  rateLimit: {
    windowMs: parseInt(process.env["RATE_LIMIT_WINDOW_MS"] || "900000", 10),
    maxRequests: parseInt(process.env["RATE_LIMIT_MAX_REQUESTS"] || "100", 10),
  },
  externalApis: {
    incomeTaxApiKey: process.env["INCOME_TAX_API_KEY"] || undefined,
    gstApiKey: process.env["GST_API_KEY"] || undefined,
  },
};

// Validation
const requiredEnvVars = ["JWT_SECRET", "JWT_REFRESH_SECRET"];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0 && config.app.env === "production") {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

export default config;
