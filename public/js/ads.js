/**
 * StreamHub - Adsterra Monetization & Dynamic Ad Injection Controller
 * 
 * Solves dynamic rendering issues by isolating banner execution inside dedicated iframes
 * and managing Popunder, Social Bar, and High CPM Smartlinks.
 */

const AdManager = {
  // Default fallback direct link (Adsterra High CPM Smartlink)
  directLinkUrl: 'https://watchingprefecture.com/f2gsd90e42?key=ecbf0487525e0567b68966ab79b16399',

  async init() {
    try {
      const res = await fetch('/api/ad-config');
      const config = await res.json();
      if (config && config.directLink) {
        this.directLinkUrl = config.directLink;
      }
    } catch (e) {
      console.log('[Ads] Using default direct link fallback.');
    }

    this.bindDirectLinks();
    this.renderDynamicBanners();
  },

  /**
   * Bind all direct link triggers on the page
   */
  bindDirectLinks() {
    document.querySelectorAll('.adsterra-direct-link').forEach(elem => {
      elem.setAttribute('href', this.directLinkUrl);
      elem.setAttribute('target', '_blank');
      elem.setAttribute('rel', 'noopener noreferrer');
      
      elem.addEventListener('click', (e) => {
        console.log('[Adsterra] Direct link triggered');
      });
    });
  },

  /**
   * Helper to open direct link in a new background tab
   */
  triggerDirectLink() {
    window.open(this.directLinkUrl, '_blank', 'noopener,noreferrer');
  },

  /**
   * Inject Adsterra Banner into any dynamic container using an isolated iframe
   * This guarantees that document.write inside invoke.js executes cleanly without
   * conflicting with dynamic DOM updates or SPA page navigations.
   * 
   * @param {string|HTMLElement} container - DOM element or selector ID
   * @param {Object} options - { key: string, width: number, height: number, format?: string }
   */
  injectBannerIframe(container, options) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const { key, width = 300, height = 250, format = 'iframe' } = options;

    // Create an isolated friendly iframe
    const iframe = document.createElement('iframe');
    iframe.width = `${width}`;
    iframe.height = `${height}`;
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('marginwidth', '0');
    iframe.setAttribute('marginheight', '0');
    iframe.setAttribute('allowtransparency', 'true');

    el.innerHTML = '';
    el.appendChild(iframe);

    // Write banner payload into the iframe document context
    const iframeDoc = iframe.contentWindow || iframe.contentDocument.document || iframe.contentDocument;
    const doc = iframe.contentDocument || iframeDoc.document;

    const bannerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style></head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${key}',
      'format' : '${format}',
      'height' : ${height},
      'width' : ${width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://watchingprefecture.com/${key}/invoke.js"></script>
</body>
</html>`;

    doc.open();
    doc.write(bannerHtml);
    doc.close();
  },

  /**
   * Re-inject all dynamic banners on the page
   */
  renderDynamicBanners() {
    // Top Leaderboard 728x90 Banner
    const topLeaderboard = document.getElementById('adsterra-banner-728x90');
    if (topLeaderboard) {
      this.injectBannerIframe(topLeaderboard, {
        key: '3f236d9a73ab7a628ff21d8aaf68195d',
        width: 728,
        height: 90
      });
    }

    // Sidebar 300x250 Banner
    const sidebarBanner = document.getElementById('adsterra-banner-300x250');
    if (sidebarBanner) {
      this.injectBannerIframe(sidebarBanner, {
        key: 'ac3b3e5e7a74ebe64f50435162f35a19',
        width: 300,
        height: 250
      });
    }

    // Player Bottom 300x250 Banner
    const playerBottomBanner = document.getElementById('adsterra-player-bottom-banner');
    if (playerBottomBanner) {
      this.injectBannerIframe(playerBottomBanner, {
        key: 'ac3b3e5e7a74ebe64f50435162f35a19',
        width: 300,
        height: 250
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdManager.init();
});

// Export for module/SPA frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdManager;
}
