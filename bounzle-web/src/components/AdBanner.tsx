'use client';

import { useEffect, useState } from 'react';

export default function AdBanner() {
  const [isAdReady, setIsAdReady] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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

    const initializeAdMob = () => {
      setIsAdReady(true);
    };

    loadAdMobScript();

    return () => {
    };
  }, []);

  useEffect(() => {
    if (isAdReady && !isAdLoaded) {
      const timer = setTimeout(() => {
        if (window.adsbygoogle) {
          window.adsbygoogle.push({});
          setIsAdLoaded(true);
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