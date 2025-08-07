'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check current table structure
    console.log('Checking operators table structure...');
    const tableDescription = await queryInterface.describeTable('operators');
    console.log('Current columns:', Object.keys(tableDescription));
    
    // Rename timestamp columns (most critical)
    if (tableDescription.createdAt && !tableDescription.created_at) {
      console.log('Renaming createdAt to created_at');
      await queryInterface.renameColumn('operators', 'createdAt', 'created_at');
    }
    
    if (tableDescription.updatedAt && !tableDescription.updated_at) {
      console.log('Renaming updatedAt to updated_at');
      await queryInterface.renameColumn('operators', 'updatedAt', 'updated_at');
    }
    
    // Rename other camelCase columns
    if (tableDescription.healthScore && !tableDescription.health_score) {
      console.log('Renaming healthScore to health_score');
      await queryInterface.renameColumn('operators', 'healthScore', 'health_score');
    }
    
    if (tableDescription.lastHealthCheck && !tableDescription.last_health_check) {
      console.log('Renaming lastHealthCheck to last_health_check');
      await queryInterface.renameColumn('operators', 'lastHealthCheck', 'last_health_check');
    }
    
    if (tableDescription.disableReason && !tableDescription.disable_reason) {
      console.log('Renaming disableReason to disable_reason');
      await queryInterface.renameColumn('operators', 'disableReason', 'disable_reason');
    }
    
    if (tableDescription.disabledBy && !tableDescription.disabled_by) {
      console.log('Renaming disabledBy to disabled_by');
      await queryInterface.renameColumn('operators', 'disabledBy', 'disabled_by');
    }
    
    if (tableDescription.disabledAt && !tableDescription.disabled_at) {
      console.log('Renaming disabledAt to disabled_at');
      await queryInterface.renameColumn('operators', 'disabledAt', 'disabled_at');
    }
    
    // Add missing columns
    if (!tableDescription.last_modified_by) {
      console.log('Adding last_modified_by column');
      await queryInterface.addColumn('operators', 'last_modified_by', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who last modified the operator'
      });
    }
    
    if (!tableDescription.last_modified_at) {
      console.log('Adding last_modified_at column');
      await queryInterface.addColumn('operators', 'last_modified_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when operator was last modified'
      });
    }
    
    if (!tableDescription.deleted_at) {
      console.log('Adding deleted_at column');
      await queryInterface.addColumn('operators', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    
    console.log('Column fixes completed successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse all changes
    const tableDescription = await queryInterface.describeTable('operators');
    
    if (tableDescription.created_at && !tableDescription.createdAt) {
      await queryInterface.renameColumn('operators', 'created_at', 'createdAt');
    }
    
    if (tableDescription.updated_at && !tableDescription.updatedAt) {
      await queryInterface.renameColumn('operators', 'updated_at', 'updatedAt');
    }
    
    if (tableDescription.health_score && !tableDescription.healthScore) {
      await queryInterface.renameColumn('operators', 'health_score', 'healthScore');
    }
    
    if (tableDescription.last_health_check && !tableDescription.lastHealthCheck) {
      await queryInterface.renameColumn('operators', 'last_health_check', 'lastHealthCheck');
    }
    
    if (tableDescription.disable_reason && !tableDescription.disableReason) {
      await queryInterface.renameColumn('operators', 'disable_reason', 'disableReason');
    }
    
    if (tableDescription.disabled_by && !tableDescription.disabledBy) {
      await queryInterface.renameColumn('operators', 'disabled_by', 'disabledBy');
    }
    
    if (tableDescription.disabled_at && !tableDescription.disabledAt) {
      await queryInterface.renameColumn('operators', 'disabled_at', 'disabledAt');
    }
    
    if (tableDescription.last_modified_by) {
      await queryInterface.removeColumn('operators', 'last_modified_by');
    }
    
    if (tableDescription.last_modified_at) {
      await queryInterface.removeColumn('operators', 'last_modified_at');
    }
    
    if (tableDescription.deleted_at) {
      await queryInterface.removeColumn('operators', 'deleted_at');
    }
  }
};
