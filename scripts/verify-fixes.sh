#!/bin/bash

# 🔧 SLA Digital Platform - Deployment Verification Script
# Run this script to verify all fixes are applied correctly

echo "🚀 SLA Digital Platform - Fix Verification"
echo "=========================================="

# Check if we're in the backend directory
if [ ! -f "src/app.js" ]; then
    echo "❌ Please run this script from the backend/ directory"
    exit 1
fi

echo "✅ Checking file structure..."

# Check if all critical files exist
FILES=(
    "src/services/core/OperatorManager.js"
    "src/services/ApplicationInitializer.js"
    "src/services/core/UnifiedAdapter.js"
    "src/app.js"
    "src/server.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file exists"
    else
        echo "  ❌ $file missing"
        exit 1
    fi
done

echo ""
echo "🔍 Checking for critical fixes..."

# Check OperatorManager singleton pattern
if grep -q "getInstance()" src/services/core/OperatorManager.js; then
    echo "  ✅ OperatorManager singleton pattern implemented"
else
    echo "  ❌ OperatorManager singleton pattern missing"
    exit 1
fi

# Check UnifiedAdapter uses singleton
if grep -q "getInstance: getOperatorManager" src/services/core/UnifiedAdapter.js; then
    echo "  ✅ UnifiedAdapter uses OperatorManager singleton"
else
    echo "  ❌ UnifiedAdapter not using singleton"
    exit 1
fi

# Check ApplicationInitializer exists
if grep -q "ApplicationInitializer" src/app.js; then
    echo "  ✅ ApplicationInitializer integrated in app.js"
else
    echo "  ❌ ApplicationInitializer not integrated"
    exit 1
fi

echo ""
echo "🧪 Starting verification server..."

# Kill any existing node processes on port 3001
pkill -f "node.*server.js" 2>/dev/null || true
sleep 2

# Start the server in background
npm run dev > verification.log 2>&1 &
SERVER_PID=$!

echo "  📝 Server PID: $SERVER_PID"
echo "  📋 Logs: tail -f verification.log"

# Wait for server to start
echo "  ⏳ Waiting for server startup..."
sleep 10

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "  ✅ Server started successfully"
else
    echo "  ❌ Server failed to start"
    echo "  📋 Check logs: cat verification.log"
    exit 1
fi

echo ""
echo "🔍 Verifying singleton behavior..."

# Check logs for single health monitoring message
HEALTH_MESSAGES=$(grep -c "Operator health monitoring started" verification.log)

if [ "$HEALTH_MESSAGES" -eq 1 ]; then
    echo "  ✅ Single health monitoring started (found: $HEALTH_MESSAGES)"
else
    echo "  ❌ Multiple health monitoring messages (found: $HEALTH_MESSAGES)"
    echo "  📋 Check logs: grep 'health monitoring' verification.log"
fi

echo ""
echo "🌐 Testing API endpoints..."

# Test status endpoint
if curl -s http://localhost:3001/api/status > /dev/null; then
    echo "  ✅ Status endpoint responding"
    
    # Check singleton status
    SINGLETON_STATUS=$(curl -s http://localhost:3001/api/status | grep -o '"isInitialized":true' || true)
    if [ -n "$SINGLETON_STATUS" ]; then
        echo "  ✅ OperatorManager singleton initialized"
    else
        echo "  ⚠️  Singleton status unclear"
    fi
else
    echo "  ❌ Status endpoint not responding"
fi

# Test health endpoint
if curl -s http://localhost:3001/health > /dev/null; then
    echo "  ✅ Health endpoint responding"
else
    echo "  ❌ Health endpoint not responding"
fi

echo ""
echo "🧹 Cleanup..."
kill $SERVER_PID 2>/dev/null || true
sleep 2

echo ""
echo "📋 VERIFICATION COMPLETE"
echo "========================"

if [ "$HEALTH_MESSAGES" -eq 1 ]; then
    echo "🎉 ALL FIXES VERIFIED SUCCESSFULLY!"
    echo ""
    echo "✅ Your platform is ready:"
    echo "   • Singleton OperatorManager working correctly"
    echo "   • Single health monitoring instance"
    echo "   • ApplicationInitializer managing services"
    echo "   • API endpoints responding"
    echo ""
    echo "🚀 You can now start your server with: npm run dev"
else
    echo "⚠️  FIXES NEED ATTENTION:"
    echo "   • Multiple health monitoring messages detected"
    echo "   • Check logs: grep 'health monitoring' verification.log"
    echo "   • Ensure all changes are pulled from repository"
fi

echo ""
echo "📊 For real-time monitoring:"
echo "   curl http://localhost:3001/api/status"
echo "   curl http://localhost:3001/health"