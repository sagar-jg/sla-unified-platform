#!/bin/bash

# SLA Digital Unified Platform Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environment: development | staging | production

set -e

# Default environment
ENVIRONMENT=${1:-development}

echo "🚀 Deploying SLA Digital Unified Platform to $ENVIRONMENT..."

# Load environment-specific variables
case $ENVIRONMENT in
  "development")
    echo "📦 Setting up development environment..."
    COMPOSE_FILE="docker-compose.yml"
    ;;
  "staging")
    echo "📦 Setting up staging environment..."
    COMPOSE_FILE="docker-compose.staging.yml"
    ;;
  "production")
    echo "📦 Setting up production environment..."
    COMPOSE_FILE="docker-compose.prod.yml"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: ./scripts/deploy.sh [development|staging|production]"
    exit 1
    ;;
esac

# Check if required files exist
if [ ! -f "backend/$COMPOSE_FILE" ]; then
  echo "❌ Docker compose file not found: backend/$COMPOSE_FILE"
  exit 1
fi

# Navigate to backend directory
cd backend

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Pull latest images (for production)
if [ "$ENVIRONMENT" = "production" ]; then
  echo "⬇️  Pulling latest images..."
  docker-compose -f $COMPOSE_FILE pull
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f $COMPOSE_FILE up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Run database migrations
if [ "$ENVIRONMENT" != "production" ]; then
  echo "🗄️  Running database migrations..."
  docker-compose -f $COMPOSE_FILE exec -T backend npm run migrate
  
  echo "🌱 Running database seeders..."
  docker-compose -f $COMPOSE_FILE exec -T backend npm run seed
fi

# Health check
echo "🏥 Performing health check..."
HEALTH_CHECK_URL="http://localhost:3001/health/detailed"

for i in {1..10}; do
  if curl -f -s $HEALTH_CHECK_URL > /dev/null; then
    echo "✅ Health check passed!"
    break
  else
    echo "⏳ Health check attempt $i/10 failed, retrying in 10 seconds..."
    sleep 10
  fi
  
  if [ $i -eq 10 ]; then
    echo "❌ Health check failed after 10 attempts"
    echo "📋 Service logs:"
    docker-compose -f $COMPOSE_FILE logs --tail=50 backend
    exit 1
  fi
done

# Show running services
echo "📊 Service status:"
docker-compose -f $COMPOSE_FILE ps

# Show useful information
echo "
🎉 Deployment completed successfully!"
echo "
📋 Service Information:"
echo "   Backend API: http://localhost:3001"
echo "   Health Check: http://localhost:3001/health"
echo "   API Documentation: http://localhost:3001/api/docs"

if [ "$ENVIRONMENT" = "development" ]; then
  echo "   Database Admin: http://localhost:5050 (admin@sla-platform.com / admin123)"
  echo "   PostgreSQL: localhost:5432 (slauser / slapassword123)"
  echo "   Redis: localhost:6379 (redispassword123)"
fi

echo "
📝 Demo Credentials:"
echo "   Admin: admin@sla-platform.com / admin123!"
echo "   Operator: operator@sla-platform.com / admin123!"

echo "
🔧 Useful Commands:"
echo "   View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   Stop all: docker-compose -f $COMPOSE_FILE down"
echo "   Restart: docker-compose -f $COMPOSE_FILE restart"
echo "   Shell access: docker-compose -f $COMPOSE_FILE exec backend sh"

echo "
✨ Happy coding!"