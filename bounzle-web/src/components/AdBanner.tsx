'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admob?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adsbygoogle?: any;
  }
}

export default function AdBanner() {
  const [isAdReady, setIsAdReady] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    // Load AdMob script
    const loadAdMobScript = () => {
      if (window.admob) return;
      
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.setAttribute('data-ad-client', 'ca-pub-xxxxxxxxxxxxxxxx'); // Replace with your AdMob publisher ID
      script.onload = () => {
        console.log('AdMob script loaded');
        initializeAdMob();
      };
      document.head.appendChild(script);
    };

    // Initialize AdMob
    const initializeAdMob = () => {
      try {
        // For web implementation, we'll use adsbygoogle
        setIsAdReady(true);
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
      }
    };

    // Load the script when component mounts
    loadAdMobScript();

    // Clean up
    return () => {
      // Remove any event listeners if needed
    };
  }, []);

  useEffect(() => {
    if (isAdReady && !isAdLoaded) {
      // Load the ad after a short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        try {
          // Push ad configuration to adsbygoogle
          if (window.adsbygoogle) {
            window.adsbygoogle.push({});
            setIsAdLoaded(true);
          }
        } catch (error) {
          console.error('Failed to load ad:', error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isAdReady, isAdLoaded]);

  return (
    <div className="fixed bottom-0 left-0 right-0 w-full h-16 bg-transparent">
      {/* AdMob Banner Ad */}
      <ins 
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-xxxxxxxxxxxxxxxx" // Replace with your AdMob publisher ID
        data-ad-slot="xxxxxxxxxx" // Replace with your AdMob ad slot ID
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
      
      {/* Fallback content when ads are blocked */}
      {!isAdLoaded && (
        <div className="w-full h-16 bg-slate-800 flex items-center justify-center">
          <p className="text-slate-500 text-xs">Advertisement</p>
        </div>
      )}
    </div>
  );
}