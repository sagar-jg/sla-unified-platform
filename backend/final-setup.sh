#!/bin/bash

# 🎯 FINAL CLEAN SETUP - Single User Model
# Uses only User.js (from UserComplete) - no more conflicts

echo "🚀 Final clean setup with single User.js model..."
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

# Step 2: Run migrations 
echo -e "${YELLOW}📂 Step 2: Running migrations...${NC}"
npx sequelize-cli db:migrate --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

echo ""

# Step 3: Run the final verified seeder
echo -e "${YELLOW}📂 Step 3: Running final seeder (005-final-verified-users)...${NC}"
npx sequelize-cli db:seed --seed 005-final-verified-users.js --env development

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Final seeder completed successfully${NC}"
else
    echo -e "${RED}❌ Seeding failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ===== FINAL SETUP COMPLETE =====${NC}"
echo -e "${BLUE}📋 Model Status:${NC}"
echo -e "   ✅ Single User.js model (from UserComplete)"
echo -e "   ✅ No more model conflicts"
echo -e "   ✅ Perfect schema alignment"
echo -e "   ✅ Field mappings verified"
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
echo -e "${GREEN}🚀 Start server: npm run dev${NC}"
echo -e "${GREEN}🧪 Test authentication:${NC}"
echo -e "${BLUE}curl -X POST http://localhost:3000/api/auth/login \\${NC}"
echo -e "${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${BLUE}  -d '{\"email\":\"admin@sla-platform.com\",\"password\":\"admin123!\"}'${NC}"
echo ""
echo -e "${YELLOW}🔍 Model Field Mappings:${NC}"
echo -e "   • Database: name → Model: name"
echo -e "   • Database: is_active → Model: isActive"  
echo -e "   • Database: email_verified → Model: emailVerified"
echo -e "   • Database: created_at → Model: createdAt"
echo ""