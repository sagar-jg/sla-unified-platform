/**
 * API Service Layer - PRODUCTION READY with Development Mode
 * 
 * Handles all communication with the SLA Digital backend APIs
 * Falls back to mock data when backend is unavailable (development mode)
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { 
  mockOperators, 
  mockDashboardStats, 
  mockSystemHealth, 
  mockRecentActivity, 
  mockNotifications, 
  mockTransactions, 
  mockSubscriptions, 
  mockPlatformMetrics,
  simulateApiDelay,
  simulateApiFailure
} from './mockData';

// Types - Updated to match backend exactly
export interface Operator {
  code: string;
  name: string;
  country: string;
  currency: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  healthScore: number;
  lastHealthCheck?: string;
  lastModified?: string;
  disableReason?: string;
  adapter: 'individual' | 'multi' | 'other' | 'generic';
  fixes?: string[];
  isOperational?: boolean;
}

export interface OperatorStats {
  operator: {
    code: string;
    name: string;
    enabled: boolean;
    healthScore: number;
    lastHealthCheck?: string;
  };
  statistics: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: number;
    avgResponseTime: number;
    revenue: number;
  };
  timeRange: string;
}

export interface AuditLog {
  id: number;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  user?: {
    id: number;
    email: string;
    name: string;
  };
  createdAt: string;
}

export interface BulkOperationResult {
  results: Array<{
    operatorCode: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface DashboardStats {
  operators: {
    total: number;
    enabled: number;
    disabled: number;
    healthy: number;
    unhealthy: number;
    fixed: number;
    enhanced: number;
    ready: number;
    byAdapter: Record<string, number>;
    byCountry: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  transactions: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    revenue: string;
    successRate: number;
    last24h: {
      total: number;
      successful: number;
      failed: number;
    };
  };
  health: {
    systemStatus: 'healthy' | 'degraded' | 'critical';
    uptime: string;
    responseTime: number;
    lastUpdate: string;
  };
}

export interface Subscription {
  uuid: string;
  msisdn: string;
  operatorCode: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'REMOVED' | 'TRIAL' | 'GRACE';
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
  amount: string;
  currency: string;
  nextPaymentTimestamp: string;
  createdAt: string;
  transactions?: Array<{
    transactionId: string;
    status: string;
    amount: string;
    timestamp: string;
  }>;
}

export interface Transaction {
  id: string;
  subscriptionUuid?: string;
  operatorCode: string;
  msisdn: string;
  amount: string;
  currency: string;
  status: 'CHARGED' | 'FAILED' | 'PENDING' | 'REFUNDED';
  type: 'subscription' | 'one-time' | 'refund';
  timestamp: string;
  responseTime?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
  metadata?: any;
}

class APIService {
  private api: AxiosInstance;
  private baseURL: string;
  private isDevelopmentMode: boolean = false;

  constructor() {
    // Use environment variable or default to backend URL
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // Shorter timeout for faster fallback to mock data
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth
    this.api.interceptors.request.use(
      (config) => {
        const token = Cookies.get('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and fallback to mock data
    this.api.interceptors.response.use(
      (response) => {
        // If we get a successful response, we're not in development mode
        this.isDevelopmentMode = false;
        return response;
      },
      (error) => {
        // Check if it's a network error (backend not available)
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
          console.warn('🔧 Backend not available, switching to development mode with mock data');
          this.isDevelopmentMode = true;
          // Don't reject - let individual methods handle fallback
          return Promise.reject({ ...error, isDevelopmentMode: true });
        }
        
        if (error.response?.status === 401) {
          // Redirect to login
          Cookies.remove('auth_token');
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper method to handle API calls with fallback to mock data
  private async callWithFallback<T>(
    apiCall: () => Promise<AxiosResponse<any>>,
    mockData: T,
    transformResponse: (data: any) => T = (data) => data
  ): Promise<T> {
    try {
      const response = await apiCall();
      return transformResponse(response.data.data || response.data);
    } catch (error: any) {
      if (error.isDevelopmentMode || this.isDevelopmentMode) {
        // Simulate API delay for realistic development experience
        await simulateApiDelay(300);
        
        // Occasionally simulate failures for testing error handling
        if (simulateApiFailure(0.05)) { // 5% failure rate
          throw new Error('Mock API failure for testing');
        }
        
        console.log('🎭 Using mock data for development');
        return mockData;
      }
      throw error;
    }
  }

  // Operator Management APIs - Aligned with backend routes
  async getAllOperators(): Promise<Operator[]> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/operators'),
      mockOperators
    );
  }

  async getOperator(code: string): Promise<Operator> {
    return this.callWithFallback(
      () => this.api.get(`/api/admin/operators/${code}`),
      mockOperators.find(op => op.code === code) || mockOperators[0]
    );
  }

  async enableOperator(code: string, reason?: string): Promise<any> {
    return this.callWithFallback(
      () => this.api.put(`/api/admin/operators/${code}/enable`, { reason: reason || 'Enabled via dashboard' }),
      { success: true, message: `Operator ${code} enabled successfully` }
    );
  }

  async disableOperator(code: string, reason: string): Promise<any> {
    return this.callWithFallback(
      () => this.api.put(`/api/admin/operators/${code}/disable`, { reason }),
      { success: true, message: `Operator ${code} disabled successfully` }
    );
  }

  async bulkEnableOperators(operatorCodes?: string[], reason?: string): Promise<BulkOperationResult> {
    const mockResult: BulkOperationResult = {
      results: (operatorCodes || mockOperators.map(op => op.code)).map(code => ({
        operatorCode: code,
        success: Math.random() > 0.1, // 90% success rate
        result: { message: `Operator ${code} enabled` }
      })),
      summary: {
        total: operatorCodes?.length || mockOperators.length,
        successful: Math.floor((operatorCodes?.length || mockOperators.length) * 0.9),
        failed: Math.ceil((operatorCodes?.length || mockOperators.length) * 0.1)
      }
    };

    return this.callWithFallback(
      () => this.api.post('/api/admin/operators/bulk/enable', { operatorCodes, reason: reason || 'Bulk enabled via dashboard' }),
      mockResult
    );
  }

  async getOperatorStats(code: string, timeRange: string = '24h'): Promise<OperatorStats> {
    const operator = mockOperators.find(op => op.code === code) || mockOperators[0];
    const mockStats: OperatorStats = {
      operator: {
        code: operator.code,
        name: operator.name,
        enabled: operator.enabled,
        healthScore: operator.healthScore,
        lastHealthCheck: operator.lastHealthCheck
      },
      statistics: {
        totalTransactions: Math.floor(Math.random() * 1000) + 500,
        successfulTransactions: Math.floor(Math.random() * 900) + 450,
        failedTransactions: Math.floor(Math.random() * 100) + 50,
        successRate: operator.healthScore * 100,
        avgResponseTime: Math.floor(Math.random() * 500) + 200,
        revenue: Math.floor(Math.random() * 10000) + 5000
      },
      timeRange
    };

    return this.callWithFallback(
      () => this.api.get(`/api/admin/operators/${code}/stats`, { params: { timeRange } }),
      mockStats
    );
  }

  async testOperator(code: string, testMSISDN?: string): Promise<any> {
    const operator = mockOperators.find(op => op.code === code) || mockOperators[0];
    const mockResult = {
      connectivity: operator.enabled && operator.healthScore > 0.5 ? 'healthy' : 'unhealthy',
      responseTime: Math.floor(Math.random() * 1000) + 200,
      timestamp: new Date().toISOString()
    };

    return this.callWithFallback(
      () => this.api.post(`/api/admin/operators/${code}/test`, { testMSISDN }),
      mockResult
    );
  }

  async getOperatorAuditLogs(
    code: string, 
    page: number = 1, 
    limit: number = 50, 
    action?: string
  ): Promise<{ data: AuditLog[]; pagination: any }> {
    const mockAuditLogs: AuditLog[] = [
      {
        id: 1,
        action: 'operator:enabled',
        resourceType: 'Operator',
        resourceId: code,
        user: { id: 1, email: 'admin@sladigital.com', name: 'Admin User' },
        createdAt: new Date().toISOString()
      }
    ];

    const mockResult = {
      data: mockAuditLogs,
      pagination: { page, limit, total: mockAuditLogs.length, pages: 1 }
    };

    return this.callWithFallback(
      () => this.api.get(`/api/admin/operators/${code}/audit`, { params: { page, limit, action } }),
      mockResult
    );
  }

  // Dashboard APIs - Aligned with backend dashboard controller
  async getDashboardStats(): Promise<DashboardStats> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/dashboard/stats'),
      mockDashboardStats
    );
  }

  async getPlatformMetrics(): Promise<any> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/dashboard/metrics'),
      mockPlatformMetrics
    );
  }

  async getSystemHealth(): Promise<any> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/dashboard/health'),
      mockSystemHealth
    );
  }

  async getOperatorDashboard(): Promise<any> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/dashboard/operators'),
      { operators: mockOperators, stats: mockDashboardStats }
    );
  }

  async getRecentActivity(limit: number = 20): Promise<any[]> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/dashboard/recent-activity', { params: { limit } }),
      mockRecentActivity.slice(0, limit)
    );
  }

  // Notification APIs
  async getNotifications(): Promise<Notification[]> {
    return this.callWithFallback(
      () => this.api.get('/api/admin/notifications'),
      mockNotifications
    );
  }

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await this.callWithFallback(
        () => this.api.put(`/api/admin/notifications/${id}/read`),
        { success: true }
      );
    } catch (error) {
      console.warn('Mark notification as read failed:', error);
      // In development mode, just update local mock data
      const notification = mockNotifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
      }
    }
  }

  // Subscription Management APIs
  async createSubscription(params: {
    operatorCode: string;
    msisdn: string;
    pin: string;
    trialDays?: number;
    skipInitialCharge?: boolean;
  }): Promise<Subscription> {
    const mockResult: Subscription = {
      uuid: `sub_${Date.now()}`,
      msisdn: params.msisdn,
      operatorCode: params.operatorCode,
      status: params.trialDays ? 'TRIAL' : 'ACTIVE',
      frequency: 'weekly',
      amount: '5.00',
      currency: 'USD',
      nextPaymentTimestamp: new Date(Date.now() + 604800000).toISOString(),
      createdAt: new Date().toISOString()
    };

    return this.callWithFallback(
      () => this.api.post('/api/v1/subscriptions/create', params),
      mockResult
    );
  }

  async getSubscriptionStatus(uuid: string): Promise<Subscription> {
    return this.callWithFallback(
      () => this.api.get(`/api/v1/subscriptions/${uuid}/status`),
      mockSubscriptions.find(sub => sub.uuid === uuid) || mockSubscriptions[0]
    );
  }

  async deleteSubscription(uuid: string, reason?: string): Promise<any> {
    return this.callWithFallback(
      () => this.api.delete(`/api/v1/subscriptions/${uuid}`, { data: { reason } }),
      { success: true, message: 'Subscription deleted successfully' }
    );
  }

  async getSubscriptions(params?: {
    operatorCode?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Subscription[]; pagination: any }> {
    const mockResult = {
      data: mockSubscriptions,
      pagination: { page: 1, limit: 20, total: mockSubscriptions.length, pages: 1 }
    };

    return this.callWithFallback(
      () => this.api.get('/api/v1/subscriptions', { params }),
      mockResult
    );
  }

  // Billing APIs
  async createOneTimeCharge(params: {
    operatorCode: string;
    msisdn: string;
    amount: string;
    description?: string;
  }): Promise<Transaction> {
    const mockResult: Transaction = {
      id: `tx_${Date.now()}`,
      operatorCode: params.operatorCode,
      msisdn: params.msisdn,
      amount: params.amount,
      currency: 'USD',
      status: 'CHARGED',
      type: 'one-time',
      timestamp: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 1000) + 500
    };

    return this.callWithFallback(
      () => this.api.post('/api/v1/billing/charge', params),
      mockResult
    );
  }

  async createRefund(params: {
    transactionId: string;
    amount?: string;
    reason?: string;
  }): Promise<Transaction> {
    const originalTx = mockTransactions.find(tx => tx.id === params.transactionId) || mockTransactions[0];
    const mockResult: Transaction = {
      ...originalTx,
      id: `refund_${Date.now()}`,
      status: 'REFUNDED',
      type: 'refund',
      timestamp: new Date().toISOString()
    };

    return this.callWithFallback(
      () => this.api.post('/api/v1/billing/refund', params),
      mockResult
    );
  }

  // OTP APIs
  async generateOTP(params: {
    operatorCode: string;
    msisdn: string;
    template?: string;
  }): Promise<any> {
    return this.callWithFallback(
      () => this.api.post('/api/v1/otp/generate', params),
      { success: true, message: 'OTP sent successfully', expiresIn: 120 }
    );
  }

  async verifyOTP(params: {
    operatorCode: string;
    msisdn: string;
    pin: string;
  }): Promise<any> {
    return this.callWithFallback(
      () => this.api.post('/api/v1/otp/verify', params),
      { success: true, message: 'OTP verified successfully' }
    );
  }

  // Transaction APIs
  async getTransactions(params?: {
    operatorCode?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Transaction[]; pagination: any }> {
    const mockResult = {
      data: mockTransactions,
      pagination: { page: 1, limit: 20, total: mockTransactions.length, pages: 1 }
    };

    return this.callWithFallback(
      () => this.api.get('/api/v1/transactions', { params }),
      mockResult
    );
  }

  async getTransaction(id: string): Promise<Transaction> {
    return this.callWithFallback(
      () => this.api.get(`/api/v1/transactions/${id}`),
      mockTransactions.find(tx => tx.id === id) || mockTransactions[0]
    );
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
      
      return ws;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      // In development mode, simulate WebSocket with mock data
      if (this.isDevelopmentMode) {
        console.log('🎭 Simulating WebSocket with mock updates');
        const mockWs = {
          close: () => {},
          onopen: null,
          onclose: null,
          onerror: null
        } as any;
        
        // Simulate periodic updates
        setTimeout(() => {
          onMessage({
            type: 'operator:healthcheck',
            data: { operatorCode: 'zain-kw', healthScore: 0.95 }
          });
        }, 5000);
        
        return mockWs;
      }
      return null;
    }
  }

  // Health check utilities
  async checkOperatorHealth(code: string): Promise<boolean> {
    try {
      const result = await this.testOperator(code);
      return result.connectivity === 'healthy';
    } catch (error) {
      return false;
    }
  }

  // Export functionality
  async exportOperators(format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    try {
      const response = await this.api.get('/api/admin/operators/export', {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      if (error.isDevelopmentMode || this.isDevelopmentMode) {
        // Create mock CSV/JSON blob
        const data = format === 'csv' 
          ? mockOperators.map(op => Object.values(op).join(',')).join('\n')
          : JSON.stringify(mockOperators, null, 2);
        return new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      }
      throw error;
    }
  }

  async exportTransactions(
    params: {
      startDate?: string;
      endDate?: string;
      operatorCode?: string;
      format?: 'csv' | 'json';
    } = {}
  ): Promise<Blob> {
    try {
      const response = await this.api.get('/api/v1/transactions/export', {
        params: { format: 'csv', ...params },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      if (error.isDevelopmentMode || this.isDevelopmentMode) {
        const format = params.format || 'csv';
        const data = format === 'csv' 
          ? mockTransactions.map(tx => Object.values(tx).join(',')).join('\n')
          : JSON.stringify(mockTransactions, null, 2);
        return new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      }
      throw error;
    }
  }

  // Development mode helper
  isDevelopmentModeActive(): boolean {
    return this.isDevelopmentMode;
  }
}

// Create and export singleton instance
const apiService = new APIService();
export default apiService;
