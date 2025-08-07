/**
 * Activity Feed Component
 * 
 * Real-time activity stream from backend
 * No hardcoded data - all activities from API
 */

import React from 'react';
import {
  ClockIcon,
  UserIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

interface Activity {
  id: string | number;
  type: string;
  action?: string;
  message: string;
  description?: string;
  user?: string;
  timestamp: string;
  metadata?: any;
}

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
}

export default function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    if (!type) return ClockIcon;
    
    const typeStr = type.toLowerCase();
    
    if (typeStr.includes('operator')) return ServerStackIcon;
    if (typeStr.includes('transaction')) return CurrencyDollarIcon;
    if (typeStr.includes('subscription')) return DocumentTextIcon;
    if (typeStr.includes('user')) return UserIcon;
    if (typeStr.includes('system') || typeStr.includes('maintenance')) return WrenchScrewdriverIcon;
    if (typeStr.includes('success') || typeStr.includes('completed')) return CheckCircleIcon;
    if (typeStr.includes('error') || typeStr.includes('failed')) return ExclamationTriangleIcon;
    
    return ClockIcon;
  };

  const getActivityColor = (type: string) => {
    if (!type) return 'text-blue-600';
    
    const typeStr = type.toLowerCase();
    
    if (typeStr.includes('enabled') || typeStr.includes('success') || typeStr.includes('completed')) {
      return 'text-green-600';
    }
    if (typeStr.includes('disabled') || typeStr.includes('error') || typeStr.includes('failed')) {
      return 'text-red-600';
    }
    if (typeStr.includes('warning') || typeStr.includes('maintenance')) {
      return 'text-yellow-600';
    }
    
    return 'text-blue-600';
  };

  const getActivityBackground = (type: string) => {
    if (!type) return 'bg-blue-100';
    
    const typeStr = type.toLowerCase();
    
    if (typeStr.includes('enabled') || typeStr.includes('success') || typeStr.includes('completed')) {
      return 'bg-green-100';
    }
    if (typeStr.includes('disabled') || typeStr.includes('error') || typeStr.includes('failed')) {
      return 'bg-red-100';
    }
    if (typeStr.includes('warning') || typeStr.includes('maintenance')) {
      return 'bg-yellow-100';
    }
    
    return 'bg-blue-100';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown time';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
      </div>
      
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No recent activity
            </h4>
            <p className="text-gray-600">
              Activity will appear here as operators are managed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const activityType = activity.type || activity.action || '';
              const ActivityIcon = getActivityIcon(activityType);
              const iconColor = getActivityColor(activityType);
              const backgroundColor = getActivityBackground(activityType);
              
              return (
                <div key={activity.id} className="flex space-x-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${backgroundColor}`}>
                    <ActivityIcon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {activity.message || activity.description || 'Activity occurred'}
                    </p>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      {activity.user && (
                        <span className="text-xs text-gray-500">
                          by {activity.user}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-2">
                        <details className="text-xs text-gray-500">
                          <summary className="cursor-pointer hover:text-gray-700">
                            View details
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {activities.length > 0 && (
          <div className="mt-6 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
              View all activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
