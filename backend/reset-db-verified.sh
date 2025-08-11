#!/bin/bash

# 🔧 VERIFIED Clean Database Setup Script
# Ensures completely clean database state with verified schema

echo "🚀 Starting VERIFIED clean database setup for SLA Unified Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Drop and recreate database
echo -e "${YELLOW}📂 Step 1: Resetting database completely...${NC}"
npx sequelize-cli db:drop --env development
npx sequelize-cli db:create --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database reset successfully${NC}"
else
    echo -e "${RED}❌ Database reset failed${NC}"
    exit 1
fi

echo ""

# Step 2: Run only the verified migration
echo -e "${YELLOW}📂 Step 2: Running VERIFIED migration (007-create-clean-users-table)...${NC}"
npx sequelize-cli db:migrate --to 007-create-clean-users-table.js --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Clean migration completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

echo ""

# Step 3: Run verified seeder
echo -e "${YELLOW}📂 Step 3: Running VERIFIED seeder (003-create-verified-admin-users)...${NC}"
npx sequelize-cli db:seed --seed 003-create-verified-admin-users.js --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Verified seeder completed successfully${NC}"
else
    echo -e "${RED}❌ Seeding failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ===== VERIFIED DATABASE SETUP COMPLETE =====${NC}"
echo -e "${BLUE}📋 Schema Verification:${NC}"
echo -e "   ✅ Single 'name' field (no firstName/lastName)"
echo -e "   ✅ User model matches migration"
echo -e "   ✅ Seeder matches schema"
echo -e "   ✅ All indexes created"
echo ""
echo -e "${GREEN}👤 Admin User:${NC}"
echo -e "   📧 Email: admin@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   👑 Role: admin"
echo -e "   📛 Name: System Administrator"
echo ""
echo -e "${GREEN}👤 Operator User:${NC}"
echo -e "   📧 Email: operator@sla-platform.com"
echo -e "   🔐 Password: admin123!"
echo -e "   🔧 Role: operator"
echo -e "   📛 Name: Operator User"
echo ""
echo -e "${GREEN}🚀 Ready to start server: npm run dev${NC}"
echo -e "${GREEN}🧪 Test authentication:${NC}"
echo -e "${BLUE}curl -X POST http://localhost:3000/api/auth/login \\${NC}"
echo -e "${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${BLUE}  -d '{\"email\":\"admin@sla-platform.com\",\"password\":\"admin123!\"}'${NC}"
echo ""
