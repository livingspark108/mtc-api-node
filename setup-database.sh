#!/bin/bash

# MTC Backend Database Setup Script
# This script sets up the complete database for the MTC Backend application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed. Please install $1 and try again."
        exit 1
    fi
}

# Function to check Node.js version
check_node_version() {
    local required_version="20.0.0"
    local current_version=$(node --version | sed 's/v//')
    
    if ! printf '%s\n%s\n' "$required_version" "$current_version" | sort -V -C; then
        print_error "Node.js version $required_version or higher is required. Current version: $current_version"
        exit 1
    fi
}

# Main setup function
main() {
    print_status "Starting MTC Backend Database Setup..."
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    check_command node
    check_command npm
    check_command mysql
    check_node_version
    print_success "Prerequisites check passed"
    
    # Check if .env exists
    if [[ ! -f .env ]]; then
        print_warning ".env file not found"
        if [[ -f env.template ]]; then
            print_status "Creating .env from template..."
            cp env.template .env
            print_warning "Please update the database credentials in .env file"
            print_status "Opening .env file for editing..."
            ${EDITOR:-nano} .env
        else
            print_error "env.template not found. Please create .env file manually."
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
    
    # Install dependencies
    print_status "Installing Node.js dependencies..."
    npm install
    print_success "Dependencies installed"
    
    # Parse command line arguments
    INSTALL_ARGS=""
    VERBOSE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                INSTALL_ARGS="$INSTALL_ARGS --force"
                shift
                ;;
            --no-seed)
                INSTALL_ARGS="$INSTALL_ARGS --no-seed"
                shift
                ;;
            --verbose|-v)
                INSTALL_ARGS="$INSTALL_ARGS --verbose"
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --force       Force clean installation (drops existing database)"
                echo "  --no-seed     Skip seeding initial data"
                echo "  --verbose,-v  Enable verbose output"
                echo "  --help,-h     Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                    # Standard installation"
                echo "  $0 --force           # Clean installation"
                echo "  $0 --verbose         # Verbose output"
                echo "  $0 --force --verbose # Clean installation with verbose output"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Test database connection
    print_status "Testing database connection..."
    
    # Read database config from .env
    if [[ -f .env ]]; then
        source .env
        
        # Test MySQL connection
        if mysql -h"${DB_HOST:-localhost}" -P"${DB_PORT:-3306}" -u"${DB_USER:-root}" -p"${DB_PASSWORD}" -e "SELECT 1;" &> /dev/null; then
            print_success "Database connection successful"
        else
            print_error "Cannot connect to database. Please check your credentials in .env file"
            print_status "Current database configuration:"
            echo "  Host: ${DB_HOST:-localhost}"
            echo "  Port: ${DB_PORT:-3306}"
            echo "  User: ${DB_USER:-root}"
            echo "  Database: ${DB_NAME:-mct_dev}"
            exit 1
        fi
    else
        print_warning "Cannot test database connection without .env file"
    fi
    
    # Run database installation
    print_status "Running database installation..."
    if [[ $VERBOSE == true ]]; then
        print_status "Command: npm run db:install -- $INSTALL_ARGS"
    fi
    
    npm run db:install -- $INSTALL_ARGS
    
    if [[ $? -eq 0 ]]; then
        print_success "Database installation completed successfully!"
        
        # Show summary
        echo ""
        print_status "Installation Summary:"
        echo "  📚 Database: ${DB_NAME:-mct_dev}"
        echo "  🏠 Host: ${DB_HOST:-localhost}:${DB_PORT:-3306}"
        echo "  👥 Default users created:"
        echo "     - admin@mytaxclub.com (Admin)"
        echo "     - ca@mytaxclub.com (CA)"
        echo "     - customer@mytaxclub.com (Customer)"
        echo "  🔐 Default password: admin123"
        echo ""
        print_warning "Remember to change default passwords in production!"
        echo ""
        print_status "Next steps:"
        echo "  1. Start the application: npm run dev"
        echo "  2. Test API endpoints"
        echo "  3. Change default passwords"
        echo "  4. Configure additional services (Redis, Email, etc.)"
        
    else
        print_error "Database installation failed!"
        echo ""
        print_status "Troubleshooting tips:"
        echo "  1. Check database credentials in .env"
        echo "  2. Ensure MySQL server is running"
        echo "  3. Verify user permissions"
        echo "  4. Run with --verbose for detailed output"
        echo "  5. Check logs in logs/app.log"
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 