/**
 * System Health Indicator Component
 * 
 * Shows system health and WebSocket connection status
 * No hardcoded data - all status from props
 */

import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  WifiIcon,
  SignalSlashIcon
} from '@heroicons/react/24/outline';

interface SystemHealthIndicatorProps {
  health?: {
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
      database: 'healthy' | 'degraded' | 'critical';
      redis: 'healthy' | 'degraded' | 'critical';
      operators: 'healthy' | 'degraded' | 'critical';
      api: 'healthy' | 'degraded' | 'critical';
    };
    uptime: {
      percentage: number;
      duration: string;
    };
    performance: {
      averageResponseTime: number;
      requestsPerSecond: number;
      errorRate: number;
    };
    lastUpdate: string;
  };
  isConnected: boolean;
}

export default function SystemHealthIndicator({ health, isConnected }: SystemHealthIndicatorProps) {
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircleIcon;
      case 'degraded':
        return ExclamationTriangleIcon;
      case 'critical':
        return XCircleIcon;
      default:
        return ExclamationTriangleIcon;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!health) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <WifiIcon className="h-5 w-5 text-green-600" />
          ) : (
            <SignalSlashIcon className="h-5 w-5 text-red-600" />
          )}
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="h-6 w-px bg-gray-200" />
        
        <div className="animate-pulse">
          <div className="h-6 w-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const HealthIcon = getHealthIcon(health.overall);
  const healthColor = getHealthColor(health.overall);
  const badgeColor = getHealthBadgeColor(health.overall);

  return (
    <div className="flex items-center space-x-4">
      {/* WebSocket Connection Status */}
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <WifiIcon className="h-5 w-5 text-green-600" />
        ) : (
          <SignalSlashIcon className="h-5 w-5 text-red-600" />
        )}
        <span className="text-sm text-gray-600">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
      
      <div className="h-6 w-px bg-gray-200" />
      
      {/* System Health */}
      <div className="flex items-center space-x-2">
        <HealthIcon className={`h-5 w-5 ${healthColor}`} />
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
          {health.overall}
        </span>
      </div>
      
      {/* System Metrics */}
      <div className="hidden lg:flex items-center space-x-4 text-sm text-gray-600">
        <div>
          <span className="font-medium">{health.uptime.percentage}%</span>
          <span className="ml-1">uptime</span>
        </div>
        
        <div>
          <span className="font-medium">{health.performance.averageResponseTime}ms</span>
          <span className="ml-1">avg</span>
        </div>
        
        <div>
          <span className="font-medium">{(health.performance.errorRate * 100).toFixed(1)}%</span>
          <span className="ml-1">errors</span>
        </div>
      </div>
      
      {/* Detailed Health Popover (could be expanded) */}
      <div className="relative">
        <button
          className="text-gray-400 hover:text-gray-600 p-1"
          title="View system health details"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}