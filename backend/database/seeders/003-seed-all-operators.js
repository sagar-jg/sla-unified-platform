'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const operators = [
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'zain-kw',
        name: 'Zain Kuwait',
        country: 'KW',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+965|965)?[569]\\d{7}$',
          currency: 'KWD',
          maxAmount: 30,
          minAmount: 0.1,
          pinLength: 5,
          language: 'ar',
          endpoints: {
            checkout: 'https://checkout.sla-alacrity.com',
            api: 'https://api.sla-alacrity.com'
          },
          supportedFeatures: ['subscription', 'oneTimeCharge', 'pin', 'checkout', 'refund', 'eligibility'],
          healthCheckMSISDN: '96550000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 1,
        status: 'active',
        healthScore: 1.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'zain-sa',
        name: 'Zain Saudi Arabia',
        country: 'SA',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+966|966)?5[0-9]\\d{7}$',
          currency: 'SAR',
          maxAmount: 30,
          minAmount: 1,
          language: 'ar',
          healthCheckMSISDN: '966500000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 2,
        status: 'active',
        healthScore: 0.95,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'etisalat-ae',
        name: 'Etisalat UAE',
        country: 'AE',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+971|971)?5[0-9]\\d{7}$',
          currency: 'AED',
          maxAmount: 365,
          minAmount: 1,
          language: 'en',
          monthlyLimit: { postpaid: 200, prepaid: 1000 },
          healthCheckMSISDN: '971500000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 3,
        status: 'active',
        healthScore: 0.90,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'ooredoo-kw',
        name: 'Ooredoo Kuwait',
        country: 'KW',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+965|965)?[24]\\d{7}$',
          currency: 'KWD',
          maxAmount: 30,
          minAmount: 0.1,
          pinLength: 4,
          language: 'en',
          supportedFeatures: ['subscription', 'oneTimeCharge', 'pin', 'checkout', 'refund', 'eligibility'],
          healthCheckMSISDN: '96520000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 4,
        status: 'active',
        healthScore: 0.85,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'stc-kw',
        name: 'STC Kuwait',
        country: 'KW',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+965|965)?[3]\\d{7}$',
          currency: 'KWD',
          maxAmount: 20,
          minAmount: 0.1,
          language: 'ar',
          monthlyLimit: { postpaid: 20, prepaid: 90 },
          healthCheckMSISDN: '96530000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 5,
        status: 'active',
        healthScore: 0.88,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'telenor-dk',
        name: 'Telenor Denmark',
        country: 'DK',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+45|45)?\\d{8}$',
          currency: 'DKK',
          maxAmount: 5000,
          language: 'da',
          monthlyLimit: 2500,
          dailyLimit: 750,
          healthCheckMSISDN: '4520000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 6,
        status: 'active',
        healthScore: 0.92,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'telenor-digi',
        name: 'Telenor Digi Malaysia',
        country: 'MY',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+60|60)?1[0-9]\\d{7,8}$',
          currency: 'MYR',
          maxAmount: 100,
          language: 'en',
          monthlyLimit: 300,
          subscriptionCooldown: 7,
          healthCheckMSISDN: '60100000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 7,
        status: 'active',
        healthScore: 0.89,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'voda-uk',
        name: 'Vodafone UK',
        country: 'GB',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+44|44)?7[0-9]\\d{8}$',
          currency: 'GBP',
          maxAmount: 240,
          language: 'en',
          checkoutOnly: true,
          healthCheckMSISDN: '447000000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 8,
        status: 'active',
        healthScore: 0.94,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'three-uk',
        name: 'Three UK',
        country: 'GB',
        enabled: true,
        config: JSON.stringify({
          msisdnRegex: '^(\\+44|44)?7[0-9]\\d{8}$',
          currency: 'GBP',
          maxAmount: 240,
          language: 'en',
          checkoutOnly: true,
          healthCheckMSISDN: '447000000001'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 9,
        status: 'active',
        healthScore: 0.91,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: Sequelize.literal('gen_random_uuid()'),
        code: 'mobile-ng',
        name: '9mobile Nigeria',
        country: 'NG',
        enabled: false,
        config: JSON.stringify({
          msisdnRegex: '^(\\+234|234)?[789][01]\\d{8}$',
          currency: 'NGN',
          maxAmount: 10000,
          language: 'en',
          checkoutOnly: true,
          healthCheckMSISDN: '234800000000'
        }),
        credentials: JSON.stringify({ encrypted: false, demo: true }),
        environment: 'sandbox',
        priority: 10,
        status: 'inactive',
        healthScore: 0.0,
        disableReason: 'Integration in progress',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await queryInterface.bulkInsert('operators', operators);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('operators', {
      code: [
        'zain-kw', 'zain-sa', 'etisalat-ae', 'ooredoo-kw', 'stc-kw',
        'telenor-dk', 'telenor-digi', 'voda-uk', 'three-uk', 'mobile-ng'
      ]
    });
  }
};