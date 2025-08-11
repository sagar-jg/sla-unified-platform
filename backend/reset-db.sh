#!/bin/bash

# 🔧 Complete Database Reset and Setup Script
# This script ensures clean database state and fixes any schema mismatches

echo "🚀 Starting complete database reset for SLA Unified Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Reset database (drop and recreate)
echo -e "${YELLOW}📂 Step 1: Resetting database...${NC}"
npx sequelize-cli db:drop --env development
npx sequelize-cli db:create --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database reset successfully${NC}"
else
    echo -e "${RED}❌ Database reset failed${NC}"
    exit 1
fi

echo ""

# Step 2: Run all migrations
echo -e "${YELLOW}📂 Step 2: Running migrations...${NC}"
npx sequelize-cli db:migrate --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

echo ""

# Step 3: Run seeder
echo -e "${YELLOW}📂 Step 3: Running seeders...${NC}"
npx sequelize-cli db:seed:all --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Seeders completed successfully${NC}"
else
    echo -e "${RED}❌ Seeding failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ===== DATABASE SETUP COMPLETE =====${NC}"
echo -e "${GREEN}👤 Admin User:${NC}"
echo -e "   📧 Email: admin@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   👑 Role: admin"
echo ""
echo -e "${GREEN}👤 Operator User:${NC}"
echo -e "   📧 Email: operator@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   🔧 Role: operator"
echo ""
echo -e "${GREEN}🚀 Ready to start the server with: npm run dev${NC}"
echo ""
