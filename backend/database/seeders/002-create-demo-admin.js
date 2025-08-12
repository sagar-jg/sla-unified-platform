"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash("admin123!", 12);

    const users = [
      {
        id: Sequelize.literal("gen_random_uuid()"),
        email: "admin@sla-platform.com",
        password: hashedPassword,
        // firstName: 'Admin',
        // lastName: 'User',
        name: "Sagar Gurav",

        role: "admin",
        status: "active",
        // loginCount: 0,
        metadata: JSON.stringify({
          description: "Default admin user for SLA Digital Unified Platform",
          createdBy: "system",
          permissions: [
            "operator_management",
            "system_admin",
            "analytics_access",
          ],
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: Sequelize.literal("gen_random_uuid()"),
        email: "operator@sla-platform.com",
        password: hashedPassword,
        // firstName: 'Operator',
        // lastName: 'User',
        name: "Sagar Gurav",
        // phone: '+919999999999',
        role: "operator",
        status: "active",
        // loginCount: 0,
        metadata: JSON.stringify({
          description: "Demo operator user with subscription management access",
          createdBy: "admin",
          permissions: ["subscription_management", "billing_operations"],
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("users", users);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("users", {
      email: ["admin@sla-platform.com", "operator@sla-platform.com"],
    });
  },
};
