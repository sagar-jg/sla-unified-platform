/**
 * Development Mode Indicator Component
 * 
 * Shows when the frontend is running with mock data (backend unavailable)
 * Helps developers understand the current state of the application
 */

import React, { useState, useEffect } from 'react';
import { 
  ExclamationTriangleIcon, 
  XMarkIcon,
  ServerIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import apiService from '../../lib/api';

export default function DevelopmentModeIndicator() {
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    // Check backend availability on component mount
    const checkBackendStatus = async () => {
      try {
        // Try to make a simple API call
        await apiService.getSystemHealth();
        setBackendStatus('available');
        setIsDevelopmentMode(false);
      } catch (error) {
        setBackendStatus('unavailable');
        setIsDevelopmentMode(apiService.isDevelopmentModeActive());
      }
    };

    checkBackendStatus();
    
    // Recheck every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Don't show if backend is available or if user has dismissed
  if (backendStatus === 'available' || !isVisible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <WrenchScrewdriverIcon className="h-6 w-6 animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm sm:text-base">
                  🔧 Development Mode Active
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white bg-opacity-20">
                  Mock Data
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-amber-100 mt-1">
                Backend unavailable - using realistic mock data for development
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Backend status indicator */}
            <div className="flex items-center space-x-2 text-xs">
              <ServerIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {backendStatus === 'checking' ? 'Checking...' : 
                 backendStatus === 'unavailable' ? 'Backend Offline' : 'Backend Online'}
              </span>
            </div>
            
            {/* Dismiss button */}
            <button
              onClick={() => setIsVisible(false)}
              className="flex-shrink-0 p-1 rounded-md hover:bg-white hover:bg-opacity-20 transition-colors"
              aria-label="Dismiss development mode indicator"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Additional info for developers */}
      <div className="bg-black bg-opacity-10 border-t border-white border-opacity-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-wrap items-center justify-between text-xs text-amber-100">
            <div className="flex items-center space-x-4">
              <span>📊 6 Mock Operators</span>
              <span>💰 Simulated Transactions</span>
              <span>🔔 Mock Notifications</span>
            </div>
            <div className="mt-1 sm:mt-0">
              <span>Start backend to see real data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check development mode status
export function useDevelopmentMode() {
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

  useEffect(() => {
    const checkMode = () => {
      setIsDevelopmentMode(apiService.isDevelopmentModeActive());
    };

    checkMode();
    
    // Check periodically
    const interval = setInterval(checkMode, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return isDevelopmentMode;
}
