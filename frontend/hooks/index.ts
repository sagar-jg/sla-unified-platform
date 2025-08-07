/**
 * React Hooks for SLA Digital Dashboard
 * 
 * Custom hooks that fetch real data from the backend APIs
 * No hardcoded data - all data comes from the backend
 */

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import apiService, { 
  Operator, 
  DashboardStats, 
  OperatorStats, 
  AuditLog, 
  BulkOperationResult,
  Transaction,
  Subscription
} from '../lib/api';
import toast from 'react-hot-toast';

// Hook for fetching all operators
export const useOperators = () => {
  const { data, error, mutate } = useSWR(
    '/api/admin/operators',
    () => apiService.getAllOperators(),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      errorRetryCount: 3
    }
  );

  const enableOperator = useCallback(async (code: string, reason?: string) => {
    try {
      await apiService.enableOperator(code, reason);
      await mutate(); // Refresh data
      toast.success(`Operator ${code} enabled successfully`);
    } catch (error) {
      toast.error(`Failed to enable operator ${code}`);
      throw error;
    }
  }, [mutate]);

  const disableOperator = useCallback(async (code: string, reason: string) => {
    try {
      await apiService.disableOperator(code, reason);
      await mutate(); // Refresh data
      toast.success(`Operator ${code} disabled successfully`);
    } catch (error) {
      toast.error(`Failed to disable operator ${code}`);
      throw error;
    }
  }, [mutate]);

  const bulkEnableOperators = useCallback(async (operatorCodes?: string[], reason?: string) => {
    try {
      const result = await apiService.bulkEnableOperators(operatorCodes, reason);
      await mutate(); // Refresh data
      toast.success(`Bulk operation completed: ${result.summary.successful} successful, ${result.summary.failed} failed`);
      return result;
    } catch (error) {
      toast.error('Bulk operation failed');
      throw error;
    }
  }, [mutate]);

  const testOperator = useCallback(async (code: string, testMSISDN?: string) => {
    try {
      const result = await apiService.testOperator(code, testMSISDN);
      if (result.connectivity === 'healthy') {
        toast.success(`Operator ${code} connectivity test passed`);
      } else {
        toast.error(`Operator ${code} connectivity test failed`);
      }
      return result;
    } catch (error) {
      toast.error(`Connectivity test failed for ${code}`);
      throw error;
    }
  }, []);

  return {
    operators: data || [],
    isLoading: !error && !data,
    error,
    mutate,
    enableOperator,
    disableOperator,
    bulkEnableOperators,
    testOperator
  };
};

// Hook for dashboard statistics
export const useDashboardStats = () => {
  const { data, error, mutate } = useSWR(
    '/api/admin/dashboard/stats',
    () => apiService.getDashboardStats(),
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true
    }
  );

  return {
    stats: data,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for operator dashboard data
export const useOperatorDashboard = () => {
  const { data, error, mutate } = useSWR(
    '/api/admin/dashboard/operators',
    () => apiService.getOperatorDashboard(),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  );

  return {
    dashboard: data,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for recent activity
export const useRecentActivity = (limit: number = 20) => {
  const { data, error, mutate } = useSWR(
    ['/api/admin/dashboard/recent-activity', limit],
    () => apiService.getRecentActivity(limit),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  );

  return {
    activities: data || [],
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for operator statistics
export const useOperatorStats = (code: string, timeRange: string = '24h') => {
  const { data, error, mutate } = useSWR(
    code ? ['/api/admin/operators/stats', code, timeRange] : null,
    () => apiService.getOperatorStats(code, timeRange),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  return {
    stats: data,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for operator audit logs
export const useOperatorAuditLogs = (
  code: string, 
  page: number = 1, 
  limit: number = 50, 
  action?: string
) => {
  const { data, error, mutate } = useSWR(
    code ? ['/api/admin/operators/audit', code, page, limit, action] : null,
    () => apiService.getOperatorAuditLogs(code, page, limit, action),
    {
      revalidateOnFocus: true
    }
  );

  return {
    auditLogs: data?.data || [],
    pagination: data?.pagination,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for system health
export const useSystemHealth = () => {
  const { data, error, mutate } = useSWR(
    '/api/admin/dashboard/health',
    () => apiService.getSystemHealth(),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  );

  return {
    health: data,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for notifications
export const useNotifications = () => {
  const { data, error, mutate } = useSWR(
    '/api/admin/notifications',
    () => apiService.getNotifications?.() || Promise.resolve([]),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  const notifications = data || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiService.markNotificationAsRead?.(id);
      await mutate();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [mutate]);

  return {
    notifications,
    unreadCount,
    isLoading: !error && !data,
    error,
    mutate,
    markAsRead
  };
};

// Hook for platform metrics
export const usePlatformMetrics = (timeRange: string = '24h') => {
  const { data, error, mutate } = useSWR(
    ['/api/admin/dashboard/metrics', timeRange],
    () => apiService.getPlatformMetrics(),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  return {
    metrics: data,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for transactions
export const useTransactions = (params?: {
  operatorCode?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  const { data, error, mutate } = useSWR(
    ['/api/v1/transactions', params],
    () => apiService.getTransactions(params),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  return {
    transactions: data?.data || [],
    pagination: data?.pagination,
    isLoading: !error && !data,
    error,
    mutate
  };
};

// Hook for subscriptions
export const useSubscriptions = (params?: {
  operatorCode?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const { data, error, mutate } = useSWR(
    ['/api/v1/subscriptions', params],
    () => apiService.getSubscriptions(params),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  const createSubscription = useCallback(async (subscriptionParams: {
    operatorCode: string;
    msisdn: string;
    pin: string;
    trialDays?: number;
    skipInitialCharge?: boolean;
  }) => {
    try {
      const result = await apiService.createSubscription(subscriptionParams);
      await mutate(); // Refresh data
      toast.success('Subscription created successfully');
      return result;
    } catch (error) {
      toast.error('Failed to create subscription');
      throw error;
    }
  }, [mutate]);

  const deleteSubscription = useCallback(async (uuid: string, reason?: string) => {
    try {
      await apiService.deleteSubscription(uuid, reason);
      await mutate(); // Refresh data
      toast.success('Subscription cancelled successfully');
    } catch (error) {
      toast.error('Failed to cancel subscription');
      throw error;
    }
  }, [mutate]);

  return {
    subscriptions: data?.data || [],
    pagination: data?.pagination,
    isLoading: !error && !data,
    error,
    mutate,
    createSubscription,
    deleteSubscription
  };
};

// Hook for real-time WebSocket connection
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const ws = apiService.connectWebSocket?.((data) => {
      setLastMessage(data);
    });

    if (ws) {
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);

      return () => {
        ws.close();
      };
    }
  }, []);

  return {
    isConnected,
    lastMessage
  };
};

// Hook for exporting data
export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportOperators = useCallback(async (format: 'csv' | 'json' = 'csv') => {
    setIsExporting(true);
    try {
      const blob = await apiService.exportOperators(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operators.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Operators exported successfully');
    } catch (error) {
      toast.error('Failed to export operators');
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportTransactions = useCallback(async (
    params: {
      startDate?: string;
      endDate?: string;
      operatorCode?: string;
      format?: 'csv' | 'json';
    } = {}
  ) => {
    setIsExporting(true);
    try {
      const blob = await apiService.exportTransactions(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions.${params.format || 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Transactions exported successfully');
    } catch (error) {
      toast.error('Failed to export transactions');
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    exportOperators,
    exportTransactions
  };
};

// Hook for operator health checking
export const useOperatorHealth = () => {
  const [healthChecks, setHealthChecks] = useState<Record<string, boolean>>({});
  const [isChecking, setIsChecking] = useState<Record<string, boolean>>({});

  const checkOperatorHealth = useCallback(async (code: string) => {
    setIsChecking(prev => ({ ...prev, [code]: true }));
    try {
      const isHealthy = await apiService.checkOperatorHealth(code);
      setHealthChecks(prev => ({ ...prev, [code]: isHealthy }));
      return isHealthy;
    } catch (error) {
      setHealthChecks(prev => ({ ...prev, [code]: false }));
      return false;
    } finally {
      setIsChecking(prev => ({ ...prev, [code]: false }));
    }
  }, []);

  return {
    healthChecks,
    isChecking,
    checkOperatorHealth
  };
};
