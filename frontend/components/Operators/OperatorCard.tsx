/**
 * Operator Card Component
 * 
 * Individual operator management card with real-time status
 * No hardcoded data - all data from props
 */

import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon,
  WrenchScrewdriverIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { Operator } from '../../lib/api';

interface OperatorCardProps {
  operator: Operator;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEnable: (code: string, reason?: string) => Promise<void>;
  onDisable: (code: string, reason: string) => Promise<void>;
  onTest: (code: string) => Promise<void>;
}

export default function OperatorCard({
  operator,
  isSelected,
  onSelect,
  onEnable,
  onDisable,
  onTest
}: OperatorCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      await onEnable(operator.code);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableReason.trim()) {
      alert('Please provide a reason for disabling the operator');
      return;
    }
    
    setIsLoading(true);
    try {
      await onDisable(operator.code, disableReason);
      setShowDisableModal(false);
      setDisableReason('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    try {
      await onTest(operator.code);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!operator.enabled) return 'text-gray-400';
    if (operator.healthScore >= 0.8) return 'text-green-500';
    if (operator.healthScore >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (!operator.enabled) return XCircleIcon;
    if (operator.healthScore >= 0.8) return CheckCircleIcon;
    return ExclamationTriangleIcon;
  };

  const StatusIcon = getStatusIcon();

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
      }`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {operator.name}
                </h3>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <GlobeAltIcon className="h-4 w-4 mr-1" />
                  {operator.country} • {operator.currency}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <StatusIcon className={`h-6 w-6 ${getStatusColor()}`} />
              <span className={`text-sm font-medium ${
                operator.enabled ? 'text-green-600' : 'text-gray-400'
              }`}>
                {operator.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Operator Details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Code</p>
              <p className="text-sm font-mono font-medium text-gray-900">{operator.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Adapter</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{operator.adapter}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Health Score</p>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      operator.healthScore >= 0.8 ? 'bg-green-500' :
                      operator.healthScore >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${operator.healthScore * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {Math.round(operator.healthScore * 100)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Last Check</p>
              <p className="text-sm text-gray-700">
                {operator.lastHealthCheck ? 
                  new Date(operator.lastHealthCheck).toLocaleTimeString() : 
                  'Never'
                }
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              operator.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {operator.enabled ? 'Active' : 'Inactive'}
            </span>
            
            {operator.fixes && operator.fixes.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <WrenchScrewdriverIcon className="h-3 w-3 mr-1" />
                {operator.fixes.length} fixes
              </span>
            )}
            
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              operator.isOperational ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {operator.isOperational ? 'Operational' : 'Issues'}
            </span>
          </div>

          {/* Disable Reason */}
          {!operator.enabled && operator.disableReason && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Disable Reason</p>
              <p className="text-sm text-gray-700">{operator.disableReason}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {operator.enabled ? (
              <button
                onClick={() => setShowDisableModal(true)}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <StopIcon className="h-4 w-4 mr-1" />
                {isLoading ? 'Disabling...' : 'Disable'}
              </button>
            ) : (
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                {isLoading ? 'Enabling...' : 'Enable'}
              </button>
            )}
            
            <button
              onClick={handleTest}
              disabled={isLoading}
              className="px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Testing...' : 'Test'}
            </button>
          </div>
        </div>
      </div>

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Disable {operator.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for disabling this operator:
            </p>
            <textarea
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="Enter reason for disabling..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={!disableReason.trim() || isLoading}
                className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Disabling...' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}