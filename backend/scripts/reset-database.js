#!/usr/bin/env node

/**
 * Database Reset Script for Column Naming Fixes
 * 
 * This script helps reset and rebuild the database with correct column naming.
 * Use this if manual migration doesn't work as expected.
 */

const { execSync } = require('child_process');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 SLA Digital Platform - Database Reset Script');
console.log('===============================================\n');

console.log('This script will:');
console.log('1. Drop all existing tables');
console.log('2. Re-run all migrations with corrected column naming');
console.log('3. Recreate the database schema with proper snake_case columns');
console.log('\n⚠️  WARNING: This will DELETE ALL DATA in your database!');

rl.question('\nDo you want to continue? (type "yes" to proceed): ', (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Operation cancelled.');
    process.exit(0);
  }
  
  try {
    console.log('\n🗑️  Step 1: Undoing all migrations...');
    execSync('npx sequelize-cli db:migrate:undo:all', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('\n✅ Step 2: Running all migrations with fixes...');
    execSync('npx sequelize-cli db:migrate', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('\n🎉 Database reset completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run dev');
    console.log('2. The application should start without column naming errors');
    console.log('3. Check the logs to confirm all models load properly');
    
  } catch (error) {
    console.error('\n❌ Error during database reset:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Check your database connection settings in .env');
    console.log('3. Ensure you have proper database permissions');
    process.exit(1);
  }
  
  rl.close();
});
