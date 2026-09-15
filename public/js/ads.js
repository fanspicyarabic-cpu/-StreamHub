/**
 * StreamHub - Adsterra Monetization & Direct Link Manager
 * 
 * Centralized ad controller for Popunder, Social Bar, and Direct Links.
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
        // Safe logging of monetization click
        console.log('[Adsterra] Direct link triggered');
      });
    });
  },

  /**
   * Optional helper to open direct link in a new background tab
   */
  triggerDirectLink() {
    window.open(this.directLinkUrl, '_blank', 'noopener,noreferrer');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdManager.init();
});
