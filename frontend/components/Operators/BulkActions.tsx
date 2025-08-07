/**
 * Bulk Actions Component
 * 
 * Bulk operations for multiple operators
 * No hardcoded data - all actions use provided callbacks
 */

import React, { useState } from 'react';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BulkActionsProps {
  selectedCount: number;
  onBulkEnable: (reason?: string) => Promise<void>;
  onClearSelection: () => void;
}

export default function BulkActions({
  selectedCount,
  onBulkEnable,
  onClearSelection
}: BulkActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkReason, setBulkReason] = useState('');

  const handleBulkEnable = async () => {
    setIsLoading(true);
    try {
      await onBulkEnable(bulkReason || 'Bulk enabled via dashboard');
      setShowBulkModal(false);
      setBulkReason('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
        <span className="text-sm font-medium text-blue-900">
          {selectedCount} operator{selectedCount !== 1 ? 's' : ''} selected
        </span>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon className="h-3 w-3 mr-1" />
            {isLoading ? 'Enabling...' : 'Enable All'}
          </button>
          
          <button
            onClick={onClearSelection}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <XMarkIcon className="h-3 w-3 mr-1" />
            Clear
          </button>
        </div>
      </div>

      {/* Bulk Enable Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Enable {selectedCount} Operator{selectedCount !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to enable {selectedCount} operator{selectedCount !== 1 ? 's' : ''}. 
              Optionally provide a reason:
            </p>
            <textarea
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Optional: Enter reason for bulk enable..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEnable}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enabling...' : 'Enable All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}