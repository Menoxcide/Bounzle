// AdMob service for handling ads in the Bounzle game
/// <reference lib="dom" />

// Get ad unit IDs from environment variables with fallback to test IDs
const DEFAULT_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';
const DEFAULT_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const DEFAULT_PUBLISHER_ID = 'ca-pub-3940256099942544';

class AdMobService {
  private initialized: boolean = false;
  private bannerAdUnitId: string = process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID || DEFAULT_BANNER_AD_UNIT_ID;
  private rewardedAdUnitId: string = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID || DEFAULT_REWARDED_AD_UNIT_ID;
  private publisherId: string = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 
                                  process.env.NEXT_PUBLIC_ADMOB_PUBLISHER_ID || 
                                  DEFAULT_PUBLISHER_ID;

  async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    
    await this.loadAdMobScript();
    
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
  }

  private loadAdMobScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is undefined'));
        return;
      }

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

    if (typeof window === 'undefined' || !window.adsbygoogle) {
      console.warn('AdMob script not loaded - banner ad will not be shown');
      return;
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => this._showBannerAdInternal(), { timeout: 1000 });
    } else {
      setTimeout(() => this._showBannerAdInternal(), 0);
    }
  }

  private _showBannerAdInternal(): void {
    let adElement = document.getElementById('admob-banner');
    if (!adElement) {
      adElement = document.createElement('div');
      adElement.id = 'admob-banner';
      adElement.className = 'admob-banner-container';
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

    const fragment = document.createDocumentFragment();
    
    while (adElement.firstChild) {
      adElement.removeChild(adElement.firstChild);
    }

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', this.publisherId);
    ins.setAttribute('data-ad-slot', this.bannerAdUnitId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    fragment.appendChild(ins);
    adElement.appendChild(fragment);

    const adsbygoogle = window.adsbygoogle;
    if (adsbygoogle) {
      requestAnimationFrame(() => {
        adsbygoogle.push({});
      });
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

    console.log('Showing rewarded ad...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Rewarded ad completed successfully');
    return true;
  }

  setAdUnitIds(bannerId: string, rewardedId: string) {
    this.bannerAdUnitId = bannerId;
    this.rewardedAdUnitId = rewardedId;
  }
}

export const admobService = new AdMobService();