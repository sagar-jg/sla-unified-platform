#!/bin/bash

# 🔍 EMERGENCY DIAGNOSIS - Check current table structure
echo "🚨 DIAGNOSING CURRENT TABLE STRUCTURE..."
echo ""

# Check current users table structure
echo "📋 Current users table columns:"
psql $DATABASE_URL -c "\d users" 2>/dev/null || psql "postgresql://postgres:password@localhost:5432/sla_digital_dev" -c "\d users" 2>/dev/null

echo ""
echo "📊 Migration status:"
npx sequelize-cli db:migrate:status

echo ""
echo "🌱 Available seeders:"
ls -la src/database/seeders/

echo ""
echo "🗂️ Available migrations:"
ls -la src/database/migrations/

echo ""
echo "💡 To fix this:"
echo "1. Run: npx sequelize-cli db:drop"
echo "2. Run: npx sequelize-cli db:create"  
echo "3. Run: npx sequelize-cli db:migrate"
echo "4. Run specific seeder: npx sequelize-cli db:seed --seed 005-final-verified-users.js"