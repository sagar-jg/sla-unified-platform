/**
 * Operator Filters Component
 * 
 * Filter controls for operator list
 * No hardcoded data - filter options derived from actual operators
 */

import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Operator } from '../../lib/api';

interface OperatorFiltersProps {
  filters: {
    status: string;
    country: string;
    adapter: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  operators: Operator[];
}

export default function OperatorFilters({
  filters,
  onFiltersChange,
  operators
}: OperatorFiltersProps) {
  // Extract unique values from operators for filter options
  const countries = Array.from(new Set(operators.map(op => op.country))).sort();
  const adapters = Array.from(new Set(operators.map(op => op.adapter))).sort();

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      country: 'all',
      adapter: 'all',
      search: ''
    });
  };

  const hasActiveFilters = filters.status !== 'all' || 
                          filters.country !== 'all' || 
                          filters.adapter !== 'all' || 
                          filters.search !== '';

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search operators..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="healthy">Healthy</option>
            <option value="unhealthy">Unhealthy</option>
          </select>
        </div>

        {/* Country Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <select
            value={filters.country}
            onChange={(e) => handleFilterChange('country', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>

        {/* Adapter Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adapter
          </label>
          <select
            value={filters.adapter}
            onChange={(e) => handleFilterChange('adapter', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Adapters</option>
            {adapters.map(adapter => (
              <option key={adapter} value={adapter} className="capitalize">
                {adapter}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.status !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Status: {filters.status}
              <button
                onClick={() => handleFilterChange('status', 'all')}
                className="ml-1 text-blue-600 hover:text-blue-500"
              >
                ×
              </button>
            </span>
          )}
          {filters.country !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Country: {filters.country}
              <button
                onClick={() => handleFilterChange('country', 'all')}
                className="ml-1 text-blue-600 hover:text-blue-500"
              >
                ×
              </button>
            </span>
          )}
          {filters.adapter !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Adapter: {filters.adapter}
              <button
                onClick={() => handleFilterChange('adapter', 'all')}
                className="ml-1 text-blue-600 hover:text-blue-500"
              >
                ×
              </button>
            </span>
          )}
          {filters.search && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Search: "{filters.search}"
              <button
                onClick={() => handleSearchChange('')}
                className="ml-1 text-blue-600 hover:text-blue-500"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}