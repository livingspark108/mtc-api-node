#!/usr/bin/env ts-node

import { promises as fs } from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import sequelize from '../config/database';
import config from '../config';
import logger from '../utils/logger';

// Import all models to register them
import User from '../models/user.model';
import Client from '../models/client.model';
import Filing from '../models/filing.model';
import Document from '../models/document.model';
import NotificationSetting from '../models/notification_setting.model';
import PricingPlan from '../models/pricing_plan.model';
import TaxSlab from '../models/tax_slab.model';
import AdminRole from '../models/admin_role.model';
import OnboardingProgress from '../models/onboarding_progress.model';
import OnboardingData from '../models/onboarding_data.model';
import OnboardingFiles from '../models/onboarding_files.model';

interface DatabaseInstallOptions {
  createDatabase?: boolean;
  dropExisting?: boolean;
  seedInitialData?: boolean;
  force?: boolean;
  verbose?: boolean;
}

class DatabaseInstaller {
  private readonly dbConfig = config.database;
  private connection: mysql.Connection | null = null;

  constructor(private options: DatabaseInstallOptions = {}) {
    this.options = {
      createDatabase: true,
      dropExisting: false,
      seedInitialData: true,
      force: false,
      verbose: false,
      ...options,
    };
  }

  /**
   * Main installation method
   */
  async install(): Promise<void> {
    try {
      logger.info('🚀 Starting database installation...');
      
      if (this.options.verbose) {
        logger.info('Installation options:', this.options);
        logger.info('Database config:', {
          host: this.dbConfig.host,
          port: this.dbConfig.port,
          database: this.dbConfig.name,
          user: this.dbConfig.user,
        });
      }

      // Step 1: Create database if needed
      if (this.options.createDatabase) {
        await this.createDatabase();
      }

      // Step 2: Test connection to the application database
      await this.testConnection();

      // Step 3: Drop existing tables if force flag is set
      if (this.options.dropExisting || this.options.force) {
        await this.dropTables();
      }

      // Step 4: Create all tables with proper relationships
      await this.createTables();

      // Step 5: Seed initial data
      if (this.options.seedInitialData) {
        await this.seedInitialData();
      }

      // Step 6: Create indexes for performance
      await this.createIndexes();

      // Step 7: Verify installation
      await this.verifyInstallation();

      logger.info('✅ Database installation completed successfully!');
      
    } catch (error) {
      logger.error('❌ Database installation failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Create the database if it doesn't exist
   */
  private async createDatabase(): Promise<void> {
    try {
      logger.info('📋 Step 1: Creating database...');

      // Connect to MySQL without specifying database
      this.connection = await mysql.createConnection({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        user: this.dbConfig.user,
        password: this.dbConfig.password,
      });

      // Check if database exists
      const [rows] = await this.connection.execute(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [this.dbConfig.name]
      );

      if ((rows as any[]).length > 0) {
        if (this.options.dropExisting || this.options.force) {
          logger.info(`🗑️  Dropping existing database: ${this.dbConfig.name}`);
          await this.connection.execute(`DROP DATABASE IF EXISTS \`${this.dbConfig.name}\``);
        } else {
          logger.info(`📊 Database ${this.dbConfig.name} already exists, skipping creation`);
          return;
        }
      }

      // Create database
      await this.connection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.dbConfig.name}\` 
        CHARACTER SET utf8mb4 
        COLLATE utf8mb4_unicode_ci`);
      
      logger.info(`✅ Database ${this.dbConfig.name} created successfully`);

    } catch (error) {
      logger.error('Failed to create database:', error);
      throw error;
    }
  }

  /**
   * Test connection to the application database
   */
  private async testConnection(): Promise<void> {
    try {
      logger.info('📋 Step 2: Testing database connection...');
      
      await sequelize.authenticate();
      logger.info('✅ Database connection established successfully');
      
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Drop all existing tables
   */
  private async dropTables(): Promise<void> {
    try {
      logger.info('📋 Step 3: Dropping existing tables...');
      
      // Disable foreign key checks temporarily
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop tables in reverse dependency order
      const tablesToDrop = ['documents', 'filings', 'clients', 'onboarding_files', 'onboarding_data', 'onboarding_progress', 'users', 'notification_settings', 'pricing_plans', 'tax_slabs', 'admin_roles'];
      
      for (const table of tablesToDrop) {
        try {
          await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
          logger.info(`🗑️  Dropped table: ${table}`);
        } catch (error) {
          if (this.options.verbose) {
            logger.warn(`Warning dropping table ${table}:`, error);
          }
        }
      }
      
      // Re-enable foreign key checks
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      logger.info('✅ Existing tables dropped successfully');
      
    } catch (error) {
      logger.error('Failed to drop tables:', error);
      throw error;
    }
  }

  /**
   * Create all tables with proper relationships
   */
  private async createTables(): Promise<void> {
    try {
      logger.info('📋 Step 4: Creating database tables...');
      
      // Sync models individually in dependency order to ensure proper creation
      logger.info('📋 Creating tables in dependency order...');
      
      // First, create independent tables (no foreign keys)
      await User.sync({ force: false, alter: true });
      logger.info('✅ Users table created');
      
      await NotificationSetting.sync({ force: false, alter: true });
      logger.info('✅ Notification settings table created');
      
      await PricingPlan.sync({ force: false, alter: true });
      logger.info('✅ Pricing plans table created');
      
      await TaxSlab.sync({ force: false, alter: true });
      logger.info('✅ Tax slabs table created');
      
      await AdminRole.sync({ force: false, alter: true });
      logger.info('✅ Admin roles table created');
      
      // Then create tables with foreign keys to users
      await Client.sync({ force: false, alter: true });
      logger.info('✅ Clients table created');
      
      await Filing.sync({ force: false, alter: true });
      logger.info('✅ Filings table created');
      
      // Create onboarding tables (depend on users)
      await OnboardingProgress.sync({ force: false, alter: true });
      logger.info('✅ Onboarding progress table created');
      
      await OnboardingData.sync({ force: false, alter: true });
      logger.info('✅ Onboarding data table created');
      
      await OnboardingFiles.sync({ force: false, alter: true });
      logger.info('✅ Onboarding files table created');
      
      // Finally, create tables with foreign keys to filings
      await Document.sync({ force: false, alter: true });
      logger.info('✅ Documents table created');
      
      // Verify all tables were created
      const [tables] = await sequelize.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `);
      
      const tableNames = (tables as any[]).map(row => row.TABLE_NAME);
      logger.info('✅ Tables created successfully:');
      logger.info(`   - Total tables: ${tableNames.length}`);
      if (this.options.verbose) {
        tableNames.forEach(tableName => {
          logger.info(`   - ${tableName}`);
        });
      }
      
    } catch (error) {
      logger.error('Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Seed initial data
   */
  private async seedInitialData(): Promise<void> {
    try {
      logger.info('📋 Step 5: Seeding initial data...');
      
      // Create admin user
      const adminUser = await User.findOrCreate({
        where: { email: 'admin@mytaxclub.com' },
        defaults: {
          email: 'admin@mytaxclub.com',
          passwordHash: '$2b$12$uAIVmQXdKDyO8j4nkfez6eNxf7JqiP0vITfHUNAPPa0kWlWjrt76S', // password: admin123
          fullName: 'System Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
        }
      });
      
      if (adminUser[1]) {
        logger.info('✅ Created admin user: admin@mytaxclub.com (password: admin123)');
      } else {
        logger.info('ℹ️  Admin user already exists');
      }

      // Create sample CA user
      const caUser = await User.findOrCreate({
        where: { email: 'ca@mytaxclub.com' },
        defaults: {
          email: 'ca@mytaxclub.com',
          passwordHash: '$2b$12$uAIVmQXdKDyO8j4nkfez6eNxf7JqiP0vITfHUNAPPa0kWlWjrt76S', // password: admin123
          fullName: 'Sample CA',
          phone: '9876543210',
          role: 'ca',
          isActive: true,
          isVerified: true,
        }
      });
      
      if (caUser[1]) {
        logger.info('✅ Created CA user: ca@mytaxclub.com (password: admin123)');
      } else {
        logger.info('ℹ️  CA user already exists');
      }

      // Create sample customer user
      const customerUser = await User.findOrCreate({
        where: { email: 'customer@mytaxclub.com' },
        defaults: {
          email: 'customer@mytaxclub.com',
          passwordHash: '$2b$12$uAIVmQXdKDyO8j4nkfez6eNxf7JqiP0vITfHUNAPPa0kWlWjrt76S', // password: admin123
          fullName: 'Sample Customer',
          phone: '9123456780',
          role: 'customer',
          isActive: true,
          isVerified: true,
        }
      });
      
      if (customerUser[1]) {
        logger.info('✅ Created customer user: customer@mytaxclub.com (password: admin123)');
        
        // Create sample client profile for the customer
        const sampleClient = await Client.findOrCreate({
          where: { userId: customerUser[0].id },
          defaults: {
            userId: customerUser[0].id,
            caId: caUser[0].id,
            panNumber: 'ABCDE1234F',
            aadharNumber: '123456789012',
            dateOfBirth: new Date('1990-01-01'),
            addressJson: {
              street: '123 Sample Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              pincode: '400001',
              country: 'India',
            },
            occupation: 'Software Engineer',
            annualIncome: 1200000.00,
            status: 'active',
            onboardingCompleted: true,
          }
        });
        
        if (sampleClient[1]) {
          logger.info('✅ Created sample client profile');
        }
      }
      
      // Seed default notification settings if not present
      await NotificationSetting.findOrCreate({
        where: { id: 1 },
        defaults: {
          email_notifications: true,
          sms_notifications: false,
          push_notifications: true,
          weekly_reports: true,
        },
      });

      // Seed sample pricing plan if none exists
      const pricingPlanCount = await PricingPlan.count();
      if (pricingPlanCount === 0) {
        await PricingPlan.bulkCreate([
          {
            name: 'Basic',
            price: 1200,
            features: 'ITR-1, Email Support',
            status: true,
          },
          {
            name: 'Standard',
            price: 1500,
            features: 'ITR-1/2, Chat Support, Investment Planning',
            status: false,
          },
        ]);
        logger.info('✅ Seeded sample pricing plans');
      }

      // Seed default tax slabs if none exist
      const taxSlabCount = await TaxSlab.count();
      if (taxSlabCount === 0) {
        await TaxSlab.bulkCreate([
          { regime: 'old', min_income: 0, max_income: 250000, tax_rate_percent: 0, surcharge_percent: 0 },
          { regime: 'old', min_income: 250001, max_income: 500000, tax_rate_percent: 5, surcharge_percent: 0 },
        ]);
        logger.info('✅ Seeded sample tax slabs');
      }

      // Seed admin roles for super and support admin based on users created
      const superAdminUser = await User.findOne({ where: { email: 'admin@mytaxclub.com' }});
      if (superAdminUser) {
        await AdminRole.findOrCreate({
          where: { email: superAdminUser.email },
          defaults: {
            email: superAdminUser.email,
            role: 'super_admin',
            permissions: ['all'],
            is_active: true,
          },
        });
      }

      if (caUser[0]) {
        // Example support admin using CA email for demonstration
        await AdminRole.findOrCreate({
          where: { email: caUser[0].email },
          defaults: {
            email: caUser[0].email,
            role: 'support_admin',
            permissions: ['read_users', 'manage_tickets', 'view_reports'],
            is_active: true,
          },
        });
      }
      
      logger.info('✅ Initial data seeded successfully');
      
    } catch (error) {
      logger.error('Failed to seed initial data:', error);
      throw error;
    }
  }

  /**
   * Create additional indexes for performance
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('📋 Step 6: Creating performance indexes...');
      
      const indexes = [
        // Users table indexes
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
        'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)',
        'CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)',
        
        // Clients table indexes
        'CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_clients_ca_id ON clients(ca_id)',
        'CREATE INDEX IF NOT EXISTS idx_clients_pan ON clients(pan_number)',
        'CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)',
        
        // Filings table indexes
        'CREATE INDEX IF NOT EXISTS idx_filings_client_id ON filings(client_id)',
        'CREATE INDEX IF NOT EXISTS idx_filings_ca_id ON filings(ca_id)',
        'CREATE INDEX IF NOT EXISTS idx_filings_status ON filings(status)',
        'CREATE INDEX IF NOT EXISTS idx_filings_tax_year ON filings(tax_year)',
        'CREATE INDEX IF NOT EXISTS idx_filings_due_date ON filings(due_date)',
        
        // Documents table indexes
        'CREATE INDEX IF NOT EXISTS idx_documents_filing_id ON documents(filing_id)',
        'CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)',
        'CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type)',
        'CREATE INDEX IF NOT EXISTS idx_documents_verified ON documents(is_verified)',

        // Pricing plans
        'CREATE INDEX IF NOT EXISTS idx_pricing_plans_status ON pricing_plans(status)',

        // Tax slabs
        'CREATE INDEX IF NOT EXISTS idx_tax_slabs_regime ON tax_slabs(regime)',

        // Admin roles
        'CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role)',
      ];
      
      for (const indexQuery of indexes) {
        try {
          await sequelize.query(indexQuery);
        } catch (error) {
          if (this.options.verbose) {
            logger.warn('Index creation warning:', error);
          }
        }
      }
      
      logger.info('✅ Performance indexes created successfully');
      
    } catch (error) {
      logger.error('Failed to create indexes:', error);
      throw error;
    }
  }

  /**
   * Verify the installation
   */
  private async verifyInstallation(): Promise<void> {
    try {
      logger.info('📋 Step 7: Verifying installation...');
      
      // Check tables exist using DATABASE() function for reliability
      const [tables] = await sequelize.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `);
      
      const tableNames = (tables as any[]).map(row => row.TABLE_NAME);
      const expectedTables = ['users', 'clients', 'filings', 'documents', 'notification_settings', 'pricing_plans', 'tax_slabs', 'admin_roles'];
      
      if (this.options.verbose) {
        logger.info('📋 All tables found in database:');
        tableNames.forEach(tableName => {
          logger.info(`  - ${tableName}`);
        });
      }
      
      for (const table of expectedTables) {
        if (tableNames.includes(table)) {
          logger.info(`✅ Table verified: ${table}`);
        } else {
          logger.error(`❌ Table missing: ${table}`);
          logger.error(`   Expected: ${expectedTables.join(', ')}`);
          logger.error(`   Found: ${tableNames.join(', ')}`);
          throw new Error(`Table missing: ${table}`);
        }
      }
      
      // Check row counts
      const userCount = await User.count();
      const clientCount = await Client.count();
      
      logger.info(`📊 Installation Summary:`);
      logger.info(`   - Users: ${userCount}`);
      logger.info(`   - Clients: ${clientCount}`);
      logger.info(`   - Database: ${this.dbConfig.name}`);
      logger.info(`   - Host: ${this.dbConfig.host}:${this.dbConfig.port}`);
      
      logger.info('✅ Installation verification completed successfully');
      
    } catch (error) {
      logger.error('Installation verification failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup connections
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.end();
        this.connection = null;
      }
      await sequelize.close();
    } catch (error) {
      if (this.options.verbose) {
        logger.warn('Cleanup warning:', error);
      }
    }
  }

  /**
   * Generate installation report
   */
  async generateReport(): Promise<string> {
    const report = `
# Database Installation Report

**Database Name:** ${this.dbConfig.name}
**Host:** ${this.dbConfig.host}:${this.dbConfig.port}
**Installation Date:** ${new Date().toISOString()}

## Tables Created:
- **users** - System users (admin, ca, customer)
- **clients** - Client profiles linked to customer users
- **filings** - Tax filing records with JSON data
- **documents** - File uploads linked to filings

## Initial Data:
- Admin user: admin@mytaxclub.com
- CA user: ca@mytaxclub.com  
- Customer user: customer@mytaxclub.com
- Sample client profile

## Default Password:
All initial users have password: **admin123**

## Next Steps:
1. Change default passwords
2. Update environment variables
3. Configure file upload storage
4. Set up Redis for sessions
5. Configure email service
    `;
    
    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: DatabaseInstallOptions = {
    createDatabase: !args.includes('--no-create-db'),
    dropExisting: args.includes('--drop-existing'),
    seedInitialData: !args.includes('--no-seed'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Installer for MTC Backend

Usage: npm run db:install [options]

Options:
  --no-create-db    Skip database creation
  --drop-existing   Drop existing tables before creation
  --no-seed         Skip seeding initial data
  --force           Force recreation (drops database)
  --verbose, -v     Verbose output
  --help, -h        Show this help message

Examples:
  npm run db:install                    # Standard installation
  npm run db:install --force            # Force clean installation
  npm run db:install --verbose          # Verbose output
  npm run db:install --no-seed          # Install without sample data
    `);
    process.exit(0);
  }

  const installer = new DatabaseInstaller(options);
  
  try {
    await installer.install();
    
    if (options.verbose) {
      const report = await installer.generateReport();
      console.log(report);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Installation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default DatabaseInstaller;
