/**
 * Mock Data for Development - SLA Digital Platform
 * 
 * Provides realistic mock data when backend is not available
 */

import { Operator, DashboardStats, Notification, Transaction, Subscription } from './api';

// Mock Operators Data
export const mockOperators: Operator[] = [
  {
    code: 'zain-kw',
    name: 'Zain Kuwait',
    country: 'Kuwait',
    currency: 'KWD',
    enabled: true,
    status: 'active',
    healthScore: 0.95,
    lastHealthCheck: new Date().toISOString(),
    lastModified: new Date(Date.now() - 3600000).toISOString(),
    adapter: 'individual',
    fixes: ['Enhanced error handling', 'Improved response times'],
    isOperational: true
  },
  {
    code: 'etisalat-ae',
    name: 'Etisalat UAE',
    country: 'UAE',
    currency: 'AED',
    enabled: true,
    status: 'active',
    healthScore: 0.88,
    lastHealthCheck: new Date().toISOString(),
    adapter: 'multi',
    isOperational: true
  },
  {
    code: 'vodafone-eg',
    name: 'Vodafone Egypt',
    country: 'Egypt',
    currency: 'EGP',
    enabled: false,
    status: 'maintenance',
    healthScore: 0.45,
    lastHealthCheck: new Date(Date.now() - 7200000).toISOString(),
    disableReason: 'Scheduled maintenance',
    adapter: 'individual',
    isOperational: false
  },
  {
    code: 'orange-eg',
    name: 'Orange Egypt',
    country: 'Egypt',
    currency: 'EGP',
    enabled: true,
    status: 'active',
    healthScore: 0.92,
    lastHealthCheck: new Date().toISOString(),
    adapter: 'generic',
    isOperational: true
  },
  {
    code: 'stc-sa',
    name: 'STC Saudi Arabia',
    country: 'Saudi Arabia',
    currency: 'SAR',
    enabled: true,
    status: 'active',
    healthScore: 0.78,
    lastHealthCheck: new Date().toISOString(),
    adapter: 'multi',
    fixes: ['Connection timeout improvements'],
    isOperational: true
  },
  {
    code: 'du-ae',
    name: 'du UAE',
    country: 'UAE',
    currency: 'AED',
    enabled: false,
    status: 'inactive',
    healthScore: 0.23,
    lastHealthCheck: new Date(Date.now() - 14400000).toISOString(),
    disableReason: 'API endpoint issues',
    adapter: 'other',
    isOperational: false
  }
];

// Mock Dashboard Stats
export const mockDashboardStats: DashboardStats = {
  operators: {
    total: 6,
    enabled: 4,
    disabled: 2,
    healthy: 4,
    unhealthy: 2,
    fixed: 3,
    enhanced: 2,
    ready: 4,
    byAdapter: {
      individual: 2,
      multi: 2,
      generic: 1,
      other: 1
    },
    byCountry: {
      'Kuwait': 1,
      'UAE': 2,
      'Egypt': 2,
      'Saudi Arabia': 1
    },
    byCurrency: {
      'KWD': 1,
      'AED': 2,
      'EGP': 2,
      'SAR': 1
    }
  },
  transactions: {
    total: 15847,
    successful: 14523,
    failed: 1324,
    pending: 0,
    revenue: '45,892.50',
    successRate: 91.6,
    last24h: {
      total: 487,
      successful: 453,
      failed: 34
    }
  },
  health: {
    systemStatus: 'healthy',
    uptime: '99.8%',
    responseTime: 145,
    lastUpdate: new Date().toISOString()
  }
};

// Mock System Health
export const mockSystemHealth = {
  systemStatus: 'healthy' as const,
  uptime: '99.8%',
  responseTime: 145,
  lastUpdate: new Date().toISOString(),
  services: {
    database: 'healthy',
    redis: 'healthy',
    api: 'healthy',
    websocket: 'healthy'
  },
  performance: {
    cpuUsage: 23.5,
    memoryUsage: 67.2,
    diskUsage: 34.8
  }
};

// Mock Recent Activity - Updated structure to match ActivityFeed expectations
export const mockRecentActivity = [
  {
    id: '1',
    type: 'operator:enabled',
    message: 'Operator Orange Egypt was enabled',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    user: 'admin@sladigital.com',
    metadata: { operatorCode: 'orange-eg' }
  },
  {
    id: '2',
    type: 'transaction:completed',
    message: 'Transaction completed successfully for Zain Kuwait',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    metadata: { operatorCode: 'zain-kw', amount: '2.50', currency: 'KWD' }
  },
  {
    id: '3',
    type: 'operator:disabled',
    message: 'Operator du UAE was disabled due to API endpoint issues',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    user: 'admin@sladigital.com',
    metadata: { operatorCode: 'du-ae', reason: 'API endpoint issues' }
  },
  {
    id: '4',
    type: 'subscription:created',
    message: 'New subscription created for Etisalat UAE',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    metadata: { operatorCode: 'etisalat-ae', msisdn: '+971501234567' }
  },
  {
    id: '5',
    type: 'system:maintenance',
    message: 'Scheduled maintenance completed for Vodafone Egypt',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    user: 'system',
    metadata: { operatorCode: 'vodafone-eg' }
  },
  {
    id: '6',
    type: 'transaction:failed',
    message: 'Transaction failed for Orange Egypt - insufficient funds',
    timestamp: new Date(Date.now() - 2100000).toISOString(),
    metadata: { operatorCode: 'orange-eg', errorCode: 'INSUFFICIENT_FUNDS' }
  },
  {
    id: '7',
    type: 'operator:enabled',
    message: 'Operator STC Saudi Arabia was re-enabled after fixes',
    timestamp: new Date(Date.now() - 2700000).toISOString(),
    user: 'admin@sladigital.com',
    metadata: { operatorCode: 'stc-sa', fixes: ['Connection timeout improvements'] }
  },
  {
    id: '8',
    type: 'subscription:cancelled',
    message: 'Subscription cancelled for Zain Kuwait',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    user: 'customer_request',
    metadata: { operatorCode: 'zain-kw', reason: 'Customer request' }
  }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Operator Status Update',
    message: 'Orange Egypt has been successfully enabled and is now operational',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    read: false,
    type: 'success',
    metadata: { operatorCode: 'orange-eg' }
  },
  {
    id: '2',
    title: 'High Success Rate Alert',
    message: 'Zain Kuwait is showing excellent performance with 98.5% success rate',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    type: 'info',
    metadata: { operatorCode: 'zain-kw', successRate: 98.5 }
  },
  {
    id: '3',
    title: 'Maintenance Required',
    message: 'du UAE requires immediate attention due to connectivity issues',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: true,
    type: 'warning',
    metadata: { operatorCode: 'du-ae' }
  }
];

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'tx_001',
    operatorCode: 'zain-kw',
    msisdn: '+96550123456',
    amount: '2.50',
    currency: 'KWD',
    status: 'CHARGED',
    type: 'subscription',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    responseTime: 1200
  },
  {
    id: 'tx_002',
    operatorCode: 'etisalat-ae',
    msisdn: '+971501234567',
    amount: '10.00',
    currency: 'AED',
    status: 'CHARGED',
    type: 'one-time',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    responseTime: 890
  },
  {
    id: 'tx_003',
    operatorCode: 'orange-eg',
    msisdn: '+201012345678',
    amount: '25.00',
    currency: 'EGP',
    status: 'FAILED',
    type: 'subscription',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    errorCode: 'INSUFFICIENT_FUNDS',
    errorMessage: 'Customer has insufficient balance'
  }
];

// Mock Subscriptions
export const mockSubscriptions: Subscription[] = [
  {
    uuid: 'sub_001',
    msisdn: '+96550123456',
    operatorCode: 'zain-kw',
    status: 'ACTIVE',
    frequency: 'weekly',
    amount: '2.50',
    currency: 'KWD',
    nextPaymentTimestamp: new Date(Date.now() + 604800000).toISOString(), // +7 days
    createdAt: new Date(Date.now() - 604800000).toISOString(), // -7 days
    transactions: [
      {
        transactionId: 'tx_001',
        status: 'CHARGED',
        amount: '2.50',
        timestamp: new Date(Date.now() - 300000).toISOString()
      }
    ]
  },
  {
    uuid: 'sub_002',
    msisdn: '+971501234567',
    operatorCode: 'etisalat-ae',
    status: 'TRIAL',
    frequency: 'monthly',
    amount: '15.00',
    currency: 'AED',
    nextPaymentTimestamp: new Date(Date.now() + 2592000000).toISOString(), // +30 days
    createdAt: new Date(Date.now() - 86400000).toISOString() // -1 day
  }
];

// Mock Platform Metrics
export const mockPlatformMetrics = {
  performance: {
    avgResponseTime: 234,
    uptime: 99.8,
    throughput: 1247,
    errorRate: 0.8
  },
  usage: {
    totalRequests: 156789,
    uniqueUsers: 8934,
    peakConcurrency: 423
  },
  revenue: {
    today: 1234.56,
    thisWeek: 8567.89,
    thisMonth: 34567.12
  }
};

// Utility function to simulate API delay
export const simulateApiDelay = (ms: number = 500) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Utility function to simulate occasional API failures
export const simulateApiFailure = (failureRate: number = 0.1) => 
  Math.random() < failureRate;
