'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install prompt
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const installApp = () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        // Clear the saved prompt since it can't be used again
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      });
    }
  };

  const closePrompt = () => {
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-slate-800 rounded-lg p-4 shadow-lg z-50">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white font-bold">Install Bounzle</h3>
          <p className="text-slate-300 text-sm mt-1">
            Add to your home screen for the best experience
          </p>
        </div>
        <button 
          onClick={closePrompt}
          className="text-slate-400 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button 
          onClick={installApp}
          className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
        >
          Install
        </Button>
        <Button 
          onClick={closePrompt}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 flex-1"
        >
          Later
        </Button>
      </div>
    </div>
  );
}