/**
 * Stat Card Component
 * 
 * Displays dashboard statistics with trend indicators
 * No hardcoded data - all values from props
 */

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  loading = false,
  className = ''
}: StatCardProps) {
  if (loading) {
    return (
      <div className={`bg-white overflow-hidden shadow rounded-lg ${className}`}>
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          {trend && (
            <div className="mt-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="text-gray-400">
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-2xl font-semibold text-gray-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
        
        {trend && (
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${
              trendUp ? 'text-green-600' : 'text-red-600'
            }`}>
              {trendUp ? (
                <ArrowUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 mr-1" />
              )}
              <span className="font-medium">{trend}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}