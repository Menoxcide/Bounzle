'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admob?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adsbygoogle?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    googletag?: any;
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
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCompleted, setAdCompleted] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adSlotRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    // Load Google AdSense script
    const loadAdSenseScript = () => {
      if (document.querySelector('script[src*="adsbygoogle"]')) {
        setIsAdReady(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3940256099942544';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        console.log('AdSense script loaded');
        setIsAdReady(true);
      };
      script.onerror = () => {
        console.error('Failed to load AdSense script');
        // Still allow ads to work, they might be blocked but we'll try
        setIsAdReady(true);
      };
      document.head.appendChild(script);
    };

    // Load the script when component mounts
    loadAdSenseScript();
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
    setShowAdModal(true);
    setAdCompleted(false);
    
    // Load ad after modal is shown
    setTimeout(() => {
      loadRewardedAd();
    }, 100);
  };

  const loadRewardedAd = () => {
    if (!adContainerRef.current) {
      console.error('Ad container not available');
      // Fallback: allow completion after delay
      setTimeout(() => {
        handleAdComplete();
      }, 3000);
      return;
    }

    try {
      // Clear any existing ad content
      adContainerRef.current.innerHTML = '';
      
      // Create ad element for interstitial/rewarded ad
      const adElement = document.createElement('ins');
      adElement.className = 'adsbygoogle';
      adElement.style.display = 'block';
      adElement.setAttribute('data-ad-client', 'ca-pub-3940256099942544'); // Test publisher ID
      adElement.setAttribute('data-ad-slot', '5224354917'); // Test ad slot (interstitial style)
      adElement.setAttribute('data-ad-format', 'auto');
      adElement.setAttribute('data-full-width-responsive', 'true');
      
      adContainerRef.current.appendChild(adElement);
      
      // Push ad to Google AdSense
      if (window.adsbygoogle) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          console.log('Rewarded ad pushed to AdSense');
        } catch (error) {
          console.error('Error pushing ad:', error);
        }
      }
      
      // Set up observer to detect when ad is loaded
      let adLoaded = false;
      const observer = new MutationObserver(() => {
        const adIframe = adContainerRef.current?.querySelector('iframe');
        if (adIframe && !adLoaded) {
          adLoaded = true;
          console.log('Ad loaded and displayed');
        }
      });
      
      if (adContainerRef.current) {
        observer.observe(adContainerRef.current, {
          childList: true,
          subtree: true
        });
      }
      
      // Allow completion after minimum viewing time (15 seconds)
      // This ensures users actually see the ad
      setTimeout(() => {
        if (!adCompleted) {
          console.log('Minimum viewing time reached - allowing completion');
          handleAdComplete();
        }
        observer.disconnect();
      }, 15000);
      
    } catch (error) {
      console.error('Failed to load rewarded ad:', error);
      // Fallback: allow completion after delay
      setTimeout(() => {
        handleAdComplete();
      }, 3000);
    }
  };

  const handleAdComplete = () => {
    if (adCompleted) return;
    
    setAdCompleted(true);
    setIsLoading(false);
    
    toast({
      title: "Ad completed!",
      description: "You can now continue playing!",
    });
    
    // Close modal and give reward
    setTimeout(() => {
      setShowAdModal(false);
      onReward();
    }, 500);
  };

  const handleCloseAd = () => {
    if (adCompleted) {
      setShowAdModal(false);
      onReward();
    } else {
      toast({
        title: "Please watch the ad",
        description: "You need to watch the ad to continue.",
        variant: "destructive",
      });
    }
  };

  const remainingContinues = 3 - continueCount;
  const buttonText = disabled 
    ? "Maximum Continues Reached" 
    : continueCount > 0 
      ? `Watch Ad to Continue (${remainingContinues} left)`
      : "Watch Ad to Continue";

  return (
    <>
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

      <Dialog open={showAdModal} onOpenChange={(open) => {
        if (!open && adCompleted) {
          handleCloseAd();
        } else if (!open && !adCompleted) {
          // Don't allow closing if ad not completed
          toast({
            title: "Please watch the ad",
            description: "You need to watch the ad to continue.",
            variant: "destructive",
          });
        }
      }}>
        <DialogContent 
          className="bg-slate-900 border-slate-700 max-w-4xl w-full h-[90vh] flex flex-col"
          showCloseButton={adCompleted}
          onInteractOutside={(e) => {
            if (!adCompleted) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!adCompleted) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Watch Ad to Continue</DialogTitle>
            <DialogDescription className="text-slate-400">
              {adCompleted 
                ? "Ad completed! Click continue to resume playing."
                : "Please watch the ad to continue playing."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-lg overflow-hidden min-h-0 relative">
            <div 
              ref={adContainerRef}
              className="w-full h-full flex items-center justify-center"
              style={{ minHeight: '400px' }}
            >
              {!adCompleted && (
                <div className="text-slate-400 text-center p-8 absolute inset-0 flex flex-col items-center justify-center bg-slate-800/90 z-10">
                  <div className="animate-spin mb-4 text-2xl">⏳</div>
                  <p className="mb-2">Loading ad...</p>
                  <p className="text-xs text-slate-500">Please wait while the ad loads</p>
                  <p className="text-xs text-slate-500 mt-2">If no ad appears, it may be blocked by an ad blocker</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center gap-2 mt-4">
            {!adCompleted ? (
              <p className="text-sm text-slate-400">
                Please watch the ad to continue (minimum 15 seconds)
              </p>
            ) : (
              <>
                <p className="text-sm text-green-400">✓ Ad completed!</p>
                <Button 
                  onClick={handleCloseAd}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Continue Playing
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}