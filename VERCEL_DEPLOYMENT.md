# Vercel Deployment Guide for RefNet Frontend

## Prerequisites
- Vercel account
- Node.js installed locally
- Git repository with your code

## Environment Variables

Set these environment variables in your Vercel project settings:

```
REACT_APP_API_URL=https://3.142.93.250:8000/api
REACT_APP_MASTRA_URL=https://3.142.93.250:4111
```

## Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Navigate to the frontend directory:
```bash
cd refnet/frontend
```

3. Login to Vercel:
```bash
vercel login
```

4. Deploy:
```bash
vercel
```

5. Follow the prompts:
   - Set up and deploy? `Y`
   - Which scope? (select your account)
   - Link to existing project? `N`
   - Project name: `refnet-frontend` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings? `N`

### Method 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Set the root directory to `refnet/frontend`
6. Add environment variables in project settings
7. Deploy

## Configuration Files

The following files have been created/updated for Vercel deployment:

- `vercel.json` - Vercel configuration
- `cedar.config.js` - Updated with production URLs
- `package.json` - Already configured with build scripts

## Build Configuration

The project uses:
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

## Troubleshooting

### CORS Issues
If you encounter CORS issues with your backend, ensure your Flask app allows requests from your Vercel domain.

### Environment Variables
Make sure all environment variables are set in Vercel dashboard under Project Settings > Environment Variables.

### Build Failures
Check the build logs in Vercel dashboard for specific error messages. Common issues:
- Missing dependencies
- TypeScript errors
- Environment variable issues

## Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Enable SSL certificate

## Monitoring

- Check deployment status in Vercel dashboard
- Monitor function logs for any runtime errors
- Use Vercel Analytics for performance insights
