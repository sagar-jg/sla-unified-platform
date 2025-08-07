/**
 * TypeScript type definitions for the SLA Digital frontend
 * 
 * Shared types used across components
 */

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// Re-export types from API service
export type {
  Operator,
  OperatorStats,
  AuditLog,
  BulkOperationResult,
  DashboardStats,
  Subscription,
  Transaction
} from '../lib/api';

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: Error | null;
}

// Filter types
export interface OperatorFilters {
  status: 'all' | 'enabled' | 'disabled' | 'healthy' | 'unhealthy';
  country: string;
  adapter: string;
  search: string;
}

// Event types for real-time updates
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface OperatorEvent extends WebSocketMessage {
  type: 'operator:enabled' | 'operator:disabled' | 'operator:health:updated';
  data: {
    operatorCode: string;
    userId?: number;
    reason?: string;
    healthScore?: number;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface OperatorActionForm {
  reason: string;
}

// Chart/Analytics types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface MetricSummary {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

// Navigation types
export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
  disabled?: boolean;
}

// Status types
export type HealthStatus = 'healthy' | 'degraded' | 'critical';
export type OperatorStatus = 'enabled' | 'disabled';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Environment types
export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  appName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    websockets: boolean;
    exports: boolean;
    notifications: boolean;
  };
}