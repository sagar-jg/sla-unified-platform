/**
 * Main Dashboard Page - PRODUCTION READY
 * 
 * Real-time dashboard for SLA Digital unified platform
 * All data comes from backend APIs - NO hardcoded values
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout/Layout';
import StatCard from '../components/Dashboard/StatCard';
import OperatorCard from '../components/Operators/OperatorCard';
import OperatorFilters from '../components/Operators/OperatorFilters';
import BulkActions from '../components/Operators/BulkActions';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import SystemHealthIndicator from '../components/Dashboard/SystemHealthIndicator';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { 
  useOperators, 
  useDashboardStats, 
  useRecentActivity, 
  useWebSocket,
  useSystemHealth 
} from '../hooks';
import { Operator } from '../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ChartBarIcon, 
  ServerStackIcon, 
  CurrencyDollarIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    country: 'all',
    adapter: 'all',
    search: ''
  });

  // Fetch real data from backend
  const { 
    operators, 
    isLoading: operatorsLoading, 
    error: operatorsError,
    enableOperator,
    disableOperator,
    bulkEnableOperators,
    testOperator
  } = useOperators();

  const { 
    stats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useDashboardStats();

  const { 
    activities, 
    isLoading: activitiesLoading 
  } = useRecentActivity(10);

  const { 
    health: systemHealth, 
    isLoading: healthLoading 
  } = useSystemHealth();

  const { isConnected: wsConnected, lastMessage } = useWebSocket();

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'operator:enabled' || lastMessage.type === 'operator:disabled') {
        toast.success(`Operator ${lastMessage.data.operatorCode} ${lastMessage.type.split(':')[1]}`);
      }
    }
  }, [lastMessage]);

  // Filter operators based on current filters
  const filteredOperators = operators.filter(operator => {
    if (filters.status !== 'all') {
      if (filters.status === 'enabled' && !operator.enabled) return false;
      if (filters.status === 'disabled' && operator.enabled) return false;
      if (filters.status === 'healthy' && (!operator.enabled || operator.healthScore < 0.7)) return false;
      if (filters.status === 'unhealthy' && (operator.enabled && operator.healthScore >= 0.7)) return false;
    }
    
    if (filters.country !== 'all' && operator.country !== filters.country) return false;
    if (filters.adapter !== 'all' && operator.adapter !== filters.adapter) return false;
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        operator.name.toLowerCase().includes(searchLower) ||
        operator.code.toLowerCase().includes(searchLower) ||
        operator.country.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Handle operator actions
  const handleEnableOperator = async (code: string, reason?: string) => {
    try {
      await enableOperator(code, reason);
    } catch (error) {
      console.error('Failed to enable operator:', error);
    }
  };

  const handleDisableOperator = async (code: string, reason: string) => {
    try {
      await disableOperator(code, reason);
    } catch (error) {
      console.error('Failed to disable operator:', error);
    }
  };

  const handleTestOperator = async (code: string) => {
    try {
      await testOperator(code);
    } catch (error) {
      console.error('Failed to test operator:', error);
    }
  };

  const handleBulkEnable = async (reason?: string) => {
    try {
      await bulkEnableOperators(selectedOperators.length > 0 ? selectedOperators : undefined, reason);
      setSelectedOperators([]);
    } catch (error) {
      console.error('Failed to bulk enable operators:', error);
    }
  };

  // Show loading state
  if (operatorsLoading || statsLoading || healthLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center space-x-2">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-lg text-gray-600">Loading dashboard...</span>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (operatorsError || statsError) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
            <p className="text-gray-600 mb-4">
              {operatorsError?.message || statsError?.message || 'Unknown error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>SLA Digital Dashboard - Unified Telecom Platform</title>
        <meta name="description" content="Real-time dashboard for managing SLA Digital operators" />
      </Head>

      <Layout>
        <ErrorBoundary>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  SLA Digital Dashboard
                </h1>
                <p className="text-gray-600">
                  Real-time operator management and monitoring
                </p>
              </div>
              
              <SystemHealthIndicator 
                health={systemHealth}
                isConnected={wsConnected}
              />
            </div>

            {/* Statistics Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Operators"
                  value={stats.operators.total}
                  icon={<ServerStackIcon className="h-6 w-6" />}
                  trend={`${stats.operators.enabled} enabled`}
                  trendUp={stats.operators.enabled > stats.operators.disabled}
                />
                
                <StatCard
                  title="Success Rate"
                  value={`${stats.transactions.successRate}%`}
                  icon={<ChartBarIcon className="h-6 w-6" />}
                  trend={`${stats.transactions.successful} successful`}
                  trendUp={stats.transactions.successRate > 90}
                />
                
                <StatCard
                  title="Revenue"
                  value={`$${stats.transactions.revenue}`}
                  icon={<CurrencyDollarIcon className="h-6 w-6" />}
                  trend={`${stats.transactions.last24h.total} today`}
                  trendUp={true}
                />
                
                <StatCard
                  title="System Health"
                  value={stats.health.systemStatus}
                  icon={<CheckCircleIcon className="h-6 w-6" />}
                  trend={`${stats.health.responseTime}ms avg`}
                  trendUp={stats.health.systemStatus === 'healthy'}
                />
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Operators Section */}
              <div className="lg:col-span-2 space-y-6">
                {/* Filters and Bulk Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Operators ({filteredOperators.length})
                    </h2>
                    
                    {selectedOperators.length > 0 && (
                      <BulkActions
                        selectedCount={selectedOperators.length}
                        onBulkEnable={handleBulkEnable}
                        onClearSelection={() => setSelectedOperators([])}
                      />
                    )}
                  </div>
                  
                  <OperatorFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    operators={operators}
                  />
                </div>

                {/* Operators Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredOperators.map((operator) => (
                    <OperatorCard
                      key={operator.code}
                      operator={operator}
                      isSelected={selectedOperators.includes(operator.code)}
                      onSelect={(selected) => {
                        if (selected) {
                          setSelectedOperators(prev => [...prev, operator.code]);
                        } else {
                          setSelectedOperators(prev => prev.filter(code => code !== operator.code));
                        }
                      }}
                      onEnable={handleEnableOperator}
                      onDisable={handleDisableOperator}
                      onTest={handleTestOperator}
                    />
                  ))}
                </div>

                {filteredOperators.length === 0 && (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <ServerStackIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No operators found
                    </h3>
                    <p className="text-gray-600">
                      Try adjusting your filters or search criteria.
                    </p>
                  </div>
                )}
              </div>

              {/* Activity Feed Sidebar */}
              <div className="space-y-6">
                <ActivityFeed
                  activities={activities}
                  isLoading={activitiesLoading}
                />
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </Layout>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </>
  );
}