@echo off
REM MTC Backend Database Setup Script for Windows
REM This script sets up the complete database for the MTC Backend application

setlocal enabledelayedexpansion

REM Colors for output (using PowerShell for colored output)
set "info=[INFO]"
set "success=[SUCCESS]"
set "warning=[WARNING]"
set "error=[ERROR]"

echo %info% Starting MTC Backend Database Setup...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo %error% Node.js is not installed. Please install Node.js and try again.
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo %error% npm is not installed. Please install npm and try again.
    exit /b 1
)

REM Check if MySQL is available
mysql --version >nul 2>&1
if errorlevel 1 (
    echo %warning% MySQL command line client not found in PATH.
    echo %warning% Please ensure MySQL is installed and accessible.
)

echo %success% Prerequisites check completed

REM Check if .env exists
if not exist .env (
    echo %warning% .env file not found
    if exist env.template (
        echo %info% Creating .env from template...
        copy env.template .env >nul
        echo %warning% Please update the database credentials in .env file
        echo %info% Opening .env file for editing...
        notepad .env
    ) else (
        echo %error% env.template not found. Please create .env file manually.
        exit /b 1
    )
) else (
    echo %success% .env file already exists
)

REM Install dependencies
echo %info% Installing Node.js dependencies...
npm install
if errorlevel 1 (
    echo %error% Failed to install dependencies
    exit /b 1
)
echo %success% Dependencies installed

REM Parse command line arguments
set "install_args="
set "verbose=false"

:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--force" (
    set "install_args=%install_args% --force"
    shift
    goto parse_args
)
if "%~1"=="--no-seed" (
    set "install_args=%install_args% --no-seed"
    shift
    goto parse_args
)
if "%~1"=="--verbose" (
    set "install_args=%install_args% --verbose"
    set "verbose=true"
    shift
    goto parse_args
)
if "%~1"=="-v" (
    set "install_args=%install_args% --verbose"
    set "verbose=true"
    shift
    goto parse_args
)
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help

echo %error% Unknown option: %~1
echo Use --help for usage information
exit /b 1

:show_help
echo Usage: %0 [options]
echo.
echo Options:
echo   --force       Force clean installation (drops existing database)
echo   --no-seed     Skip seeding initial data
echo   --verbose,-v  Enable verbose output
echo   --help,-h     Show this help message
echo.
echo Examples:
echo   %0                    # Standard installation
echo   %0 --force           # Clean installation
echo   %0 --verbose         # Verbose output
echo   %0 --force --verbose # Clean installation with verbose output
exit /b 0

:end_parse

REM Test database connection if .env exists
if exist .env (
    echo %info% Testing database connection...
    REM Note: Advanced connection testing would require reading .env file
    REM For now, we'll rely on the Node.js installer to test the connection
    echo %info% Database connection will be tested during installation
)

REM Run database installation
echo %info% Running database installation...
if "%verbose%"=="true" (
    echo %info% Command: npm run db:install -- %install_args%
)

npm run db:install -- %install_args%
if errorlevel 1 (
    echo %error% Database installation failed!
    echo.
    echo %info% Troubleshooting tips:
    echo   1. Check database credentials in .env
    echo   2. Ensure MySQL server is running
    echo   3. Verify user permissions
    echo   4. Run with --verbose for detailed output
    echo   5. Check logs in logs\app.log
    exit /b 1
)

echo %success% Database installation completed successfully!
echo.
echo %info% Installation Summary:
echo   📚 Database: Configured in .env file
echo   🏠 Host: Check .env for connection details
echo   👥 Default users created:
echo      - admin@mytaxclub.com (Admin)
echo      - ca@mytaxclub.com (CA)
echo      - customer@mytaxclub.com (Customer)
echo   🔐 Default password: admin123
echo.
echo %warning% Remember to change default passwords in production!
echo.
echo %info% Next steps:
echo   1. Start the application: npm run dev
echo   2. Test API endpoints
echo   3. Change default passwords
echo   4. Configure additional services (Redis, Email, etc.)

pause 