# Cedar OS Integration

This project now includes Cedar OS CLI integration for enhanced AI-powered chat capabilities.

## What's Included

- **Cedar OS CLI**: Installed and configured
- **Tailwind CSS**: Required for Cedar components
- **Cedar Configuration**: Set up in `src/cedar/` directory
- **Updated Components**: FloatingCedarChat now uses CedarCopilot

## Available Scripts

- `npm run cedar:dev` - Start Cedar development server
- `npm run cedar:build` - Build Cedar components
- `npm run cedar:deploy` - Deploy Cedar application
- `npm run cedar:start` - Start Cedar application

## Configuration Files

- `cedar.config.js` - Main Cedar configuration
- `src/cedar/messageRenderers.js` - Custom message renderers
- `src/cedar/responseHandlers.js` - Custom response handlers
- `tailwind.config.js` - Tailwind CSS configuration

## Usage

The FloatingCedarChat component now uses Cedar OS's CedarCopilot for enhanced AI chat capabilities with:

- State management for selected papers
- Graph data context
- Custom message handling
- Integration with your Flask backend

## Next Steps

1. Test the integration by running `npm start`
2. Customize message renderers and response handlers as needed
3. Configure backend endpoints in `cedar.config.js`
4. Add additional Cedar components as required
