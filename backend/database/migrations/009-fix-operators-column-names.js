'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename existing camelCase columns to snake_case to match Sequelize underscored configuration
    
    // First, check if old columns exist and new ones don't, then rename them
    const tableDescription = await queryInterface.describeTable('operators');
    
    if (tableDescription.healthScore && !tableDescription.health_score) {
      await queryInterface.renameColumn('operators', 'healthScore', 'health_score');
    }
    
    if (tableDescription.lastHealthCheck && !tableDescription.last_health_check) {
      await queryInterface.renameColumn('operators', 'lastHealthCheck', 'last_health_check');
    }
    
    if (tableDescription.disableReason && !tableDescription.disable_reason) {
      await queryInterface.renameColumn('operators', 'disableReason', 'disable_reason');
    }
    
    if (tableDescription.disabledBy && !tableDescription.disabled_by) {
      await queryInterface.renameColumn('operators', 'disabledBy', 'disabled_by');
    }
    
    if (tableDescription.disabledAt && !tableDescription.disabled_at) {
      await queryInterface.renameColumn('operators', 'disabledAt', 'disabled_at');
    }
    
    // Fix timestamp columns
    if (tableDescription.createdAt && !tableDescription.created_at) {
      await queryInterface.renameColumn('operators', 'createdAt', 'created_at');
    }
    
    if (tableDescription.updatedAt && !tableDescription.updated_at) {
      await queryInterface.renameColumn('operators', 'updatedAt', 'updated_at');
    }
    
    // Add missing columns that should exist based on the model
    if (!tableDescription.last_modified_by) {
      await queryInterface.addColumn('operators', 'last_modified_by', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who last modified the operator'
      });
    }
    
    if (!tableDescription.last_modified_at) {
      await queryInterface.addColumn('operators', 'last_modified_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when operator was last modified'
      });
    }
    
    // Add deleted_at for paranoid deletion if it doesn't exist
    if (!tableDescription.deleted_at) {
      await queryInterface.addColumn('operators', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    
    // Update index names if they changed
    try {
      await queryInterface.removeIndex('operators', 'operators_health_score_idx');
    } catch (e) {
      // Index might not exist, ignore error
    }
    
    await queryInterface.addIndex('operators', ['health_score'], {
      name: 'operators_health_score_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse the changes
    const tableDescription = await queryInterface.describeTable('operators');
    
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
    
    // Reverse timestamp columns
    if (tableDescription.created_at && !tableDescription.createdAt) {
      await queryInterface.renameColumn('operators', 'created_at', 'createdAt');
    }
    
    if (tableDescription.updated_at && !tableDescription.updatedAt) {
      await queryInterface.renameColumn('operators', 'updated_at', 'updatedAt');
    }
    
    // Remove added columns
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
