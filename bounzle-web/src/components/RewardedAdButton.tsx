'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

declare global {
  interface Window {
    admob?: any;
    adsbygoogle?: any;
  }
}

export default function RewardedAdButton({ onReward }: { onReward: (seconds: number) => void }) {
  const [isAdReady, setIsAdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    // Load AdMob script
    const loadAdMobScript = () => {
      if (window.admob) return;
      
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.onload = () => {
        console.log('AdMob script loaded');
        initializeRewardedAd();
      };
      document.head.appendChild(script);
    };

    // Initialize rewarded ad
    const initializeRewardedAd = () => {
      try {
        // For web implementation, we'll prepare for rewarded ads
        setIsAdReady(true);
      } catch (error) {
        console.error('Failed to initialize rewarded ad:', error);
      }
    };

    // Load the script when component mounts
    loadAdMobScript();

    // Clean up
    return () => {
      // Remove any event listeners if needed
    };
  }, []);

  const showRewardedAd = async () => {
    if (!isAdReady) {
      toast({
        title: "Ad not ready",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate showing a rewarded ad
      // In a real implementation, you would use the AdMob SDK to show the ad
      toast({
        title: "Watching rewarded ad",
        description: "You'll get extra time after watching the ad!",
      });
      
      // Simulate ad viewing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate successful ad completion
      toast({
        title: "Ad completed!",
        description: "You've earned 5 extra seconds!",
      });
      
      // Give reward
      onReward(5);
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      toast({
        title: "Ad error",
        description: "Failed to show ad. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={showRewardedAd}
      disabled={!isAdReady || isLoading}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      {isLoading ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin">⏳</span>
          Watching Ad...
        </>
      ) : (
        <>
          <span className="mr-2">🎁</span>
          Watch Ad for +5s
        </>
      )}
    </Button>
  );
}