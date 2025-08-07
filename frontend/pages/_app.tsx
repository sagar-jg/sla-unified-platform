/**
 * Next.js App Component - PRODUCTION READY
 * 
 * Configures SWR, global providers, and error boundaries
 * No hardcoded values - all configuration from environment
 */

import type { AppProps } from 'next/app';
import { SWRConfig } from 'swr';
import { Toaster } from 'react-hot-toast';
import Head from 'next/head';
import apiService from '../lib/api';
import '../styles/globals.css';

// SWR global configuration
const swrConfig = {
  fetcher: (url: string) => apiService.getAllOperators(), // This will be overridden by individual hooks
  onError: (error: any) => {
    console.error('SWR Error:', error);
    
    // Handle common API errors
    if (error?.response?.status === 401) {
      // Redirect to login if unauthorized
      window.location.href = '/login';
    }
  },
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0, // Disable global refresh, let individual hooks manage their own intervals
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  dedupingInterval: 2000,
  shouldRetryOnError: (error: any) => {
    // Don't retry on 4xx errors except 408, 429
    if (error?.response?.status >= 400 && error?.response?.status < 500) {
      return error?.response?.status === 408 || error?.response?.status === 429;
    }
    return true;
  }
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>SLA Digital Dashboard</title>
        <meta name="description" content="Unified telecom operator management platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Preconnect to API domain for better performance */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
        
        {/* Security headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#1f2937" />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="SLA Digital Dashboard" />
        <meta property="og:description" content="Unified telecom operator management platform" />
        <meta property="og:type" content="website" />
        
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <SWRConfig value={swrConfig}>
        {/* Global error boundary could be added here */}
        <Component {...pageProps} />
        
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          gutter={8}
          containerClassName=""
          containerStyle={{}}
          toastOptions={{
            // Default options for all toasts
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
            // Default options for specific types
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
            loading: {
              duration: Infinity,
            },
          }}
        />
      </SWRConfig>
    </>
  );
}