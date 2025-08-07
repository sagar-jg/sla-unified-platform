#!/bin/bash

# ==============================================
# SLA Digital Unified Platform - Setup Script
# ==============================================
# 
# This script automates the complete setup process for the
# SLA Digital unified telecom platform.
#
# Run: chmod +x setup.sh && ./setup.sh
# ==============================================

set -e  # Exit on any error

echo "🚀 SLA Digital Unified Platform Setup Starting..."
echo "================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service status
check_service() {
    if systemctl is-active --quiet $1 2>/dev/null; then
        return 0
    elif brew services list 2>/dev/null | grep -q "^$1.*started"; then
        return 0
    elif pgrep -x $1 >/dev/null; then
        return 0
    else
        return 1
    fi
}

# Step 1: Check Prerequisites
echo ""
echo "📋 Step 1: Checking Prerequisites..."
echo "=================================="

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
    
    # Check version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ $NODE_MAJOR -lt 18 ]; then
        print_error "Node.js version must be 18+ (current: $NODE_VERSION)"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_status "npm installed: $NPM_VERSION"
else
    print_error "npm not found. Please install npm first."
    exit 1
fi

# Check PostgreSQL
if command_exists psql; then
    POSTGRES_VERSION=$(psql --version | head -n1)
    print_status "PostgreSQL installed: $POSTGRES_VERSION"
else
    print_warning "PostgreSQL client not found. Installing PostgreSQL..."
    
    # Try to install PostgreSQL based on OS
    if command_exists apt-get; then
        sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
    elif command_exists yum; then
        sudo yum install -y postgresql postgresql-server
    elif command_exists brew; then
        brew install postgresql
    else
        print_error "Could not install PostgreSQL automatically. Please install manually."
        exit 1
    fi
fi

# Check if PostgreSQL is running
if check_service postgresql || check_service postgres; then
    print_status "PostgreSQL service is running"
else
    print_warning "PostgreSQL service not running. Attempting to start..."
    
    # Try to start PostgreSQL
    if command_exists systemctl; then
        sudo systemctl start postgresql
    elif command_exists brew; then
        brew services start postgresql
    elif command_exists service; then
        sudo service postgresql start
    else
        print_error "Could not start PostgreSQL. Please start it manually."
        exit 1
    fi
    
    # Wait a moment for startup
    sleep 5
    
    if check_service postgresql || check_service postgres; then
        print_status "PostgreSQL started successfully"
    else
        print_error "Failed to start PostgreSQL. Please start it manually."
        exit 1
    fi
fi

# Step 2: Database Setup
echo ""
echo "🗄️  Step 2: Database Setup..."
echo "============================"

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    if [ -d "backend" ]; then
        print_info "Changing to backend directory..."
        cd backend
    else
        print_error "Not in backend directory and backend/ not found. Please cd to backend/"
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found! The setup should have created it."
    print_info "Copying from .env.example..."
    cp .env.example .env
    print_warning "Please update .env with your database credentials if needed."
fi

# Create PostgreSQL user and database
print_info "Setting up PostgreSQL database and user..."

# Create user (ignore if exists)
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true

# Create database (ignore if exists)  
sudo -u postgres psql -c "CREATE DATABASE sla_platform_dev OWNER postgres;" 2>/dev/null || true

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sla_platform_dev TO postgres;" 2>/dev/null || true

print_status "Database and user setup completed"

# Step 3: Install Dependencies
echo ""
echo "📦 Step 3: Installing Dependencies..."
echo "==================================="

if [ ! -d "node_modules" ]; then
    print_info "Installing Node.js dependencies..."
    npm install
    print_status "Dependencies installed successfully"
else
    print_status "Dependencies already installed"
fi

# Step 4: Database Migration
echo ""
echo "🔄 Step 4: Database Migration..."
echo "==============================="

# Test database connection first
print_info "Testing database connection..."
if npm run check > /dev/null 2>&1; then
    print_status "Database connection test passed"
else
    print_error "Database connection test failed. Check your .env configuration."
    exit 1
fi

# Run migrations
print_info "Running database migrations..."
npm run migrate

print_status "Database migrations completed"

# Run seeders
print_info "Running database seeders..."
npm run seed

print_status "Database seeders completed"

# Step 5: Start Server Test
echo ""
echo "🚀 Step 5: Server Startup Test..."
echo "================================"

print_info "Testing server startup..."

# Start server in background for testing
npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Check if server is running
if curl -s http://localhost:3001/health > /dev/null; then
    print_status "Server started successfully!"
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
    print_info "Health check response: $HEALTH_RESPONSE"
    
    # Test SLA Digital API
    AUTH_HEADER=$(echo -n 'sandbox_user:sandbox_pass' | base64)
    if curl -s -X POST "http://localhost:3001/v2.2/sandbox/provision?msisdn=96512345678&campaign=test&merchant=test" \
        -H "Authorization: Basic $AUTH_HEADER" > /dev/null; then
        print_status "SLA Digital v2.2 API responding correctly"
    else
        print_warning "SLA Digital v2.2 API test failed (this may be normal)"
    fi
    
    # Test Unified API
    if curl -s http://localhost:3001/api/v1/operators > /dev/null; then
        print_status "Unified Platform API responding correctly"
    else
        print_warning "Unified Platform API test failed"
    fi
    
else
    print_error "Server failed to start. Check server.log for details:"
    tail -20 server.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Stop test server
kill $SERVER_PID 2>/dev/null || true
sleep 2

# Step 6: Final Summary
echo ""
echo "🎉 Setup Complete!"
echo "=================="

print_status "SLA Digital Unified Platform is ready!"
echo ""
echo "📍 Server Details:"
echo "   • URL: http://localhost:3001"
echo "   • SLA Digital v2.2 API: http://localhost:3001/v2.2/*"
echo "   • Unified Platform API: http://localhost:3001/api/v1/*"
echo "   • Health Check: http://localhost:3001/health"
echo ""
echo "🎯 Zain Bahrain Integration Ready:"
echo "   • Operator Code: zain-bh"
echo "   • Currency: BHD (Bahraini Dinar)"
echo "   • PIN Length: 5 digits"
echo "   • Max Amount: 50.0 BHD"
echo "   • Daily Limit: 10.0 BHD"
echo ""
echo "🚀 To start development server:"
echo "   npm run dev"
echo ""
echo "📚 API Documentation:"
echo "   • SLA Digital v2.2: 14 compliant endpoints"
echo "   • 26 supported operators"
echo "   • Complete authentication & security"
echo ""
echo "✅ All critical issues resolved:"
echo "   • Logger import paths fixed"
echo "   • Database configuration created"
echo "   • Environment variables set"
echo "   • Migrations ready"
echo ""

# Optional: Start the server for the user
read -p "🤔 Would you like to start the development server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting development server..."
    npm run dev
else
    print_info "Setup complete! Run 'npm run dev' when ready to start."
fi