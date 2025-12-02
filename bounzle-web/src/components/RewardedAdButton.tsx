'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admob?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adsbygoogle?: any;
  }
}

export default function RewardedAdButton({ 
  onReward, 
  disabled = false,
  continueCount = 0
}: { 
  onReward: () => void;
  disabled?: boolean;
  continueCount?: number;
}) {
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
    if (disabled) {
      toast({
        title: "Maximum continues reached",
        description: "You've already continued 3 times!",
        variant: "destructive",
      });
      return;
    }

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
        description: "You'll be able to continue after watching the ad!",
      });
      
      // Simulate ad viewing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate successful ad completion
      toast({
        title: "Ad completed!",
        description: "You can now continue playing!",
      });
      
      // Give reward (continue ability) - call after a brief delay to ensure toast is visible
      setTimeout(() => {
        onReward();
      }, 100);
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

  const remainingContinues = 3 - continueCount;
  const buttonText = disabled 
    ? "Maximum Continues Reached" 
    : continueCount > 0 
      ? `Watch Ad to Continue (${remainingContinues} left)`
      : "Watch Ad to Continue";

  return (
    <Button 
      onClick={showRewardedAd}
      disabled={!isAdReady || isLoading || disabled}
      className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin">⏳</span>
          Watching Ad...
        </>
      ) : (
        <>
          <span className="mr-2">🎁</span>
          {buttonText}
        </>
      )}
    </Button>
  );
}