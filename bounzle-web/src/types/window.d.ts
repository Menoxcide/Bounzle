// Window interface extensions for third-party APIs

interface Window {
  admob?: {
    [key: string]: unknown;
  };
  adsbygoogle?: {
    push: (config: Record<string, unknown>) => void;
    [key: string]: unknown;
  };
  googletag?: {
    [key: string]: unknown;
  };
  webkitAudioContext?: typeof AudioContext;
}

