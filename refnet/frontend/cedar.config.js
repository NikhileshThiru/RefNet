/** @type {import('cedar-os').CedarConfig} */
module.exports = {
  // Cedar configuration for RefNet
  components: {
    // Enable Cedar components
    enabled: true,
    // Custom styling
    theme: {
      primary: '#ffd700',
      secondary: '#ffed4e',
      dark: '#1a1a2e',
      light: '#b8c5d1'
    }
  },
  // Backend configuration
      backend: {
        // Your Flask backend URL
        url: process.env.REACT_APP_API_URL || 'https://api.refnet.wiki/flask/api',
        // API endpoints
        endpoints: {
          chat: 'https://api.refnet.wiki/mastra/chat',
          papers: '/papers',
          search: '/search'
        }
      },
  // Development settings
  dev: {
    // Enable debug mode
    debug: true,
    // Hot reload
    hotReload: true
  }
};
