#!/bin/bash

# 🎯 MIGRATIONS & SEEDERS ONLY
# 
# Use this script AFTER manually creating the database

echo "🚀 Running Fresh Migrations & Seeders"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 This script assumes database already exists${NC}"
echo -e "${BLUE}If database doesn't exist, create it manually first${NC}"
echo ""

# Step 1: Run fresh migrations 
echo -e "${YELLOW}📂 Step 1: Running fresh migrations (CREATE TABLE only)...${NC}"
npx sequelize-cli db:migrate --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Fresh migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    echo -e "${YELLOW}💡 Make sure database exists and connection works${NC}"
    exit 1
fi

echo ""

# Step 2: Run fresh seeder
echo -e "${YELLOW}📂 Step 2: Running fresh seeder (model-based)...${NC}"
npx sequelize-cli db:seed:all --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Fresh seeder completed successfully${NC}"
else
    echo -e "${RED}❌ Seeding failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ===== MIGRATIONS & SEEDERS COMPLETE =====${NC}"
echo -e "${GREEN}👤 Admin User Created:${NC}"
echo -e "   📧 Email: admin@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   👑 Role: admin"
echo ""
echo -e "${GREEN}👤 Operator User Created:${NC}"
echo -e "   📧 Email: operator@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   🔧 Role: operator"
echo ""
echo -e "${GREEN}🚀 Start Server:${NC}"
echo -e "   npm run dev"
echo ""
echo -e "${GREEN}🧪 Test Authentication:${NC}"
echo -e "${BLUE}curl -X POST http://localhost:3000/api/auth/login \\${NC}"
echo -e "${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${BLUE}  -d '{\"email\":\"admin@sla-platform.com\",\"password\":\"admin123!\"}'${NC}"
echo ""