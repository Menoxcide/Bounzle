// AdMob service for handling ads in the Bounzle game
/// <reference lib="dom" />

class AdMobService {
  private initialized: boolean = false;
  private bannerAdUnitId: string = 'ca-app-pub-3940256099942544/6300978111'; // Test ad unit ID
  private rewardedAdUnitId: string = 'ca-app-pub-3940256099942544/5224354917'; // Test ad unit ID
  
  // In a real implementation, you would replace these with your actual AdMob ad unit IDs
  // private bannerAdUnitId: string = 'YOUR_BANNER_AD_UNIT_ID';
  // private rewardedAdUnitId: string = 'YOUR_REWARDED_AD_UNIT_ID';

  async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    
    try {
      // Load AdMob script
      await this.loadAdMobScript();
      
      // Wait for adsbygoogle to be available with retry logic
      let retries = 0;
      const maxRetries = 10;
      while (typeof window === 'undefined' || !window.adsbygoogle) {
        if (retries >= maxRetries) {
          throw new Error('AdMob script loaded but adsbygoogle not available after retries');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      console.log('AdMob initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize AdMob:', error);
      throw error;
    }
  }

  private loadAdMobScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is undefined'));
        return;
      }

      // Check if script is already loaded
      if (document.querySelector('script[src*="adsbygoogle"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load AdMob script'));
      document.head.appendChild(script);
    });
  }

  showBannerAd(): void {
    if (!this.initialized) {
      console.warn('AdMob not initialized - banner ad will not be shown');
      return;
    }

    // Double-check that adsbygoogle is available
    if (typeof window === 'undefined' || !window.adsbygoogle) {
      console.warn('AdMob script not loaded - banner ad will not be shown');
      return;
    }

    // Use requestIdleCallback to avoid blocking the main thread
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => this._showBannerAdInternal(), { timeout: 1000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this._showBannerAdInternal(), 0);
    }
  }

  private _showBannerAdInternal(): void {
    try {
      // Create or update the banner ad element
      let adElement = document.getElementById('admob-banner');
      if (!adElement) {
        adElement = document.createElement('div');
        adElement.id = 'admob-banner';
        // Use CSS classes instead of inline styles to avoid forced reflow
        adElement.className = 'admob-banner-container';
        // Apply styles in a single batch to avoid multiple reflows
        requestAnimationFrame(() => {
          if (adElement) {
            adElement.style.cssText = `
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              height: 50px;
              z-index: 1000;
              background: transparent;
            `;
          }
        });
        document.body.appendChild(adElement);
      }

      // Use DocumentFragment to batch DOM operations and avoid reflows
      const fragment = document.createDocumentFragment();
      
      // Clear previous content efficiently
      while (adElement.firstChild) {
        adElement.removeChild(adElement.firstChild);
      }

      // Create the ad container
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', 'ca-pub-3940256099942544'); // Test publisher ID
      ins.setAttribute('data-ad-slot', this.bannerAdUnitId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');

      fragment.appendChild(ins);
      adElement.appendChild(fragment);

      // Push the ad asynchronously to avoid blocking
      if (window.adsbygoogle) {
        requestAnimationFrame(() => {
          try {
            window.adsbygoogle.push({});
          } catch (error) {
            console.error('Failed to push ad:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to show banner ad:', error);
    }
  }

  hideBannerAd() {
    const adElement = document.getElementById('admob-banner');
    if (adElement) {
      adElement.remove();
    }
  }

  async showRewardedAd(): Promise<boolean> {
    if (!this.initialized) {
      console.warn('AdMob not initialized');
      return false;
    }

    try {
      // In a real implementation, you would use the AdMob SDK to show a rewarded ad
      // For now, we'll simulate the process
      
      console.log('Showing rewarded ad...');
      
      // Simulate ad loading and viewing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful ad completion
      console.log('Rewarded ad completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      return false;
    }
  }

  // Set custom ad unit IDs (for production)
  setAdUnitIds(bannerId: string, rewardedId: string) {
    this.bannerAdUnitId = bannerId;
    this.rewardedAdUnitId = rewardedId;
  }
}

// Export singleton instance
export const admobService = new AdMobService();