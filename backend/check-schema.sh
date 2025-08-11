#!/bin/bash

# 🔍 Database Schema Diagnostic Script
# This script will show us exactly what columns exist in your users table

echo "🔍 Checking current users table schema..."
echo ""

# Check if users table exists and show its structure
echo "📋 Current users table structure:"
psql $DATABASE_URL -c "\d users" 2>/dev/null || psql "postgresql://postgres:password@localhost:5432/sla_digital_dev" -c "\d users" 2>/dev/null

echo ""
echo "📊 Checking migration status:"
npx sequelize-cli db:migrate:status

echo ""
echo "🗂️ Available migrations:"
ls -la src/database/migrations/

echo ""
echo "🌱 Available seeders:"
ls -la src/database/seeders/

echo ""
echo "💡 If users table doesn't exist or has wrong columns, run:"
echo "   npx sequelize-cli db:drop"
echo "   npx sequelize-cli db:create"
echo "   npx sequelize-cli db:migrate"
echo "   npx sequelize-cli db:seed:all"