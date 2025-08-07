#!/bin/bash

# Database Migration Script
# Usage: ./scripts/migrate.sh [up|down|status]

set -e

ACTION=${1:-up}

echo "🗄️  Database Migration: $ACTION"

cd backend

case $ACTION in
  "up")
    echo "⬆️  Running migrations..."
    npm run migrate
    echo "✅ Migrations completed!"
    ;;
  "down")
    echo "⬇️  Rolling back last migration..."
    npm run migrate:undo
    echo "✅ Rollback completed!"
    ;;
  "status")
    echo "📊 Migration status:"
    npx sequelize-cli db:migrate:status
    ;;
  "seed")
    echo "🌱 Running seeders..."
    npm run seed
    echo "✅ Seeding completed!"
    ;;
  "seed:undo")
    echo "🗑️  Undoing seeders..."
    npm run seed:undo
    echo "✅ Seed rollback completed!"
    ;;
  *)
    echo "❌ Unknown action: $ACTION"
    echo "Usage: ./scripts/migrate.sh [up|down|status|seed|seed:undo]"
    exit 1
    ;;
esac