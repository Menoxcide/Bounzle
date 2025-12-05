'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Get ad credentials from environment variables with fallback to test IDs
const AD_PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 
                        process.env.NEXT_PUBLIC_ADMOB_PUBLISHER_ID || 
                        'ca-pub-3940256099942544'; // Test publisher ID
const AD_REWARDED_SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT_ID || 
                            process.env.NEXT_PUBLIC_ADMOB_REWARDED_SLOT_ID || 
                            '5224354917'; // Test ad slot

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
  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adElementRef = useRef<HTMLElement | null>(null);
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
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_PUBLISHER_ID}`;
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

  // Cleanup effect when modal closes
  useEffect(() => {
    if (!showAdModal) {
      // Clean up observer
      if (observerRef.current) {
        try {
          observerRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting observer:', error);
        }
        observerRef.current = null;
      }
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Clean up ad container safely
      if (adContainerRef.current) {
        try {
          // Safely remove ad element if it exists and is actually a child of the container
          if (adElementRef.current) {
            const parent = adElementRef.current.parentNode;
            // Verify the element is actually a child of our container before removing
            if (parent === adContainerRef.current) {
              adContainerRef.current.removeChild(adElementRef.current);
            } else if (parent) {
              // Element is in a different parent, remove from that parent
              parent.removeChild(adElementRef.current);
            }
            adElementRef.current = null;
          }
        } catch (error) {
          // Element may have already been removed or parent changed
          console.warn('Error removing ad element during cleanup:', error);
          adElementRef.current = null;
        }
        
        // Clear container content safely as fallback
        try {
          if (adContainerRef.current) {
            adContainerRef.current.innerHTML = '';
          }
        } catch (error) {
          console.warn('Error clearing ad container:', error);
        }
      }
    }
  }, [showAdModal]);

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
    
    // Load ad after modal is shown and rendered
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        loadRewardedAd();
      }, 300);
    });
  };

  const loadRewardedAd = () => {
    if (!adContainerRef.current) {
      console.error('Ad container not available');
      // Fallback: allow completion after delay
      timeoutRef.current = setTimeout(() => {
        handleAdComplete();
      }, 3000);
      return;
    }

    // Check if container is visible and has dimensions
    const rect = adContainerRef.current.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && 
                      adContainerRef.current.offsetParent !== null;
    
    if (!isVisible) {
      console.warn('Ad container not visible or has no dimensions, retrying...');
      // Retry after a short delay
      timeoutRef.current = setTimeout(() => {
        loadRewardedAd();
      }, 200);
      return;
    }

    try {
      // Clear any existing ad content
      adContainerRef.current.innerHTML = '';
      
      // Create ad element for interstitial/rewarded ad
      const adElement = document.createElement('ins');
      adElement.className = 'adsbygoogle';
      adElement.style.display = 'block';
      adElement.style.width = '100%';
      adElement.style.height = '100%';
      adElement.style.minWidth = '320px';
      adElement.style.minHeight = '250px';
      adElement.setAttribute('data-ad-client', AD_PUBLISHER_ID);
      adElement.setAttribute('data-ad-slot', AD_REWARDED_SLOT_ID);
      adElement.setAttribute('data-ad-format', 'auto');
      adElement.setAttribute('data-full-width-responsive', 'true');
      
      adContainerRef.current.appendChild(adElement);
      adElementRef.current = adElement;
      
      // Push ad to Google AdSense only if container is visible
      if (window.adsbygoogle && isVisible) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          console.log('Rewarded ad pushed to AdSense');
        } catch (error) {
          console.error('Error pushing ad:', error);
          // Fallback: allow completion after delay
          timeoutRef.current = setTimeout(() => {
            handleAdComplete();
          }, 3000);
          return;
        }
      } else {
        console.warn('AdSense not available or container not visible');
        // Fallback: allow completion after delay
        timeoutRef.current = setTimeout(() => {
          handleAdComplete();
        }, 3000);
        return;
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
      
      observerRef.current = observer;
      
      if (adContainerRef.current) {
        observer.observe(adContainerRef.current, {
          childList: true,
          subtree: true
        });
      }
      
      // Allow completion after minimum viewing time (15 seconds)
      // This ensures users actually see the ad
      timeoutRef.current = setTimeout(() => {
        if (!adCompleted) {
          console.log('Minimum viewing time reached - allowing completion');
          handleAdComplete();
        }
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      }, 15000);
      
    } catch (error) {
      console.error('Failed to load rewarded ad:', error);
      // Fallback: allow completion after delay
      timeoutRef.current = setTimeout(() => {
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
    
    // Execute reward callback first before cleanup to ensure it always runs
    // Use try-catch to ensure reward executes even if there are errors
    try {
      onReward();
    } catch (error) {
      console.error('Error executing reward callback:', error);
      // Still continue - don't block the user
    }
    
    // Close modal after reward callback
    setTimeout(() => {
      setShowAdModal(false);
    }, 500);
  };

  const handleCloseAd = () => {
    if (adCompleted) {
      // Execute reward callback before closing
      try {
        onReward();
      } catch (error) {
        console.error('Error executing reward callback:', error);
      }
      setShowAdModal(false);
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