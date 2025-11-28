# Bounzle Deployment Guide

This guide provides detailed instructions for deploying the Bounzle game to various platforms.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Vercel Deployment](#vercel-deployment)
4. [Netlify Deployment](#netlify-deployment)
5. [Self-hosted Deployment](#self-hosted-deployment)
6. [AdMob Configuration](#admob-configuration)
7. [Supabase Configuration](#supabase-configuration)
8. [Domain Setup](#domain-setup)

## Prerequisites

Before deploying, ensure you have:

1. A GitHub/GitLab/Bitbucket account
2. A Vercel/Netlify account (for cloud deployment)
3. A Supabase account
4. A Groq API key
5. An AdMob account (for monetization)
6. Node.js 18+ installed locally (for self-hosted deployment)

## Environment Variables

You'll need to set the following environment variables in your deployment platform:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

For AdMob (optional but recommended for monetization):
```env
ADMOB_PUBLISHER_ID=your_admob_publisher_id
BANNER_AD_UNIT_ID=your_banner_ad_unit_id
REWARDED_AD_UNIT_ID=your_rewarded_ad_unit_id
```

## Vercel Deployment

### Automatic Deployment (Recommended)

1. Push your code to a GitHub/GitLab/Bitbucket repository
2. Go to [https://vercel.com](https://vercel.com) and sign up/sign in
3. Click "New Project"
4. Import your repository
5. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: bounzle/bounzle-web
   - Build Command: `next build`
   - Output Directory: `.next`
6. Add environment variables in the "Environment Variables" section
7. Click "Deploy"

### Manual Deployment

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your project directory:
   ```bash
   cd bounzle/bounzle-web
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts to configure your deployment

## Netlify Deployment

1. Push your code to a GitHub/GitLab/Bitbucket repository
2. Go to [https://netlify.com](https://netlify.com) and sign up/sign in
3. Click "New site from Git"
4. Connect your Git provider and select your repository
5. Configure the deployment settings:
   - Branch to deploy: main (or your default branch)
   - Build command: `next build`
   - Publish directory: `.next`
6. Add environment variables in the "Environment" section
7. Click "Deploy site"

## Self-hosted Deployment

### Using Node.js Server

1. Build the project:
   ```bash
   cd bounzle/bounzle-web
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. The application will be available at `http://localhost:3000`

### Using Docker (Recommended for Production)

1. Create a Dockerfile in the `bounzle/bounzle-web` directory:
   ```dockerfile
   FROM node:18-alpine AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci

   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   FROM node:18-alpine AS runner
   WORKDIR /app

   ENV NODE_ENV production

   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static

   USER nextjs

   EXPOSE 3000

   ENV PORT 3000

   CMD ["node", "server.js"]
   ```

2. Create a `.dockerignore` file:
   ```
   node_modules
   .next
   .env*
   !.env.production
   README.md
   ```

3. Build and run the Docker container:
   ```bash
   docker build -t bounzle .
   docker run -p 3000:3000 bounzle
   ```

### Using Nginx

1. Build the project:
   ```bash
   cd bounzle/bounzle-web
   npm run build
   ```

2. Install nginx on your server

3. Configure nginx to serve the static files:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           root /path/to/bounzle/bounzle-web/.next;
           try_files $uri $uri/ /index.html;
       }

       location /_next/static {
           alias /path/to/bounzle/bounzle-web/.next/static;
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

## AdMob Configuration

### Getting AdMob Credentials

1. Sign up for an AdMob account at [https://admob.google.com](https://admob.google.com)
2. Create apps for Android and/or iOS
3. Create ad units for:
   - Banner ads
   - Rewarded video ads

### Configuring Ad Units

1. Replace the test ad unit IDs in `src/lib/admob.ts` with your real ad unit IDs:
   ```typescript
   // Replace these test IDs with your real AdMob ad unit IDs
   private bannerAdUnitId: string = 'YOUR_BANNER_AD_UNIT_ID';
   private rewardedAdUnitId: string = 'YOUR_REWARDED_AD_UNIT_ID';
   ```

2. For web deployment, add your domain to the AdMob allowlist:
   - Go to AdMob dashboard
   - Select your app
   - Go to "App settings"
   - Add your domain to the authorized domains list

## Supabase Configuration

### Setting up Supabase

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from the project settings
4. Run the SQL migration to create the necessary tables:
   ```sql
   create table profiles (
     id uuid references auth.users primary key,
     username text unique,
     avatar_url text
   );

   create table scores (
     id         bigint generated by default as identity primary key,
     user_id    uuid references auth.users not null,
     score      integer not null,
     created_at timestamp with time zone default now()
   );

   -- RLS
   alter table scores enable row level security;

   create policy "Users can insert own score"
     on scores for insert
     with check (auth.uid() = user_id);

   create policy "Everyone can read scores"
     on scores for select
     using (true);
   ```

5. Enable Email/Password authentication in the Supabase Auth settings

## Domain Setup

### Custom Domain on Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" > "Domains"
4. Add your custom domain
5. Follow the DNS configuration instructions

### Custom Domain on Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to "Site settings" > "Domain management"
4. Add your custom domain
5. Follow the DNS configuration instructions

### SSL Certificate

Both Vercel and Netlify automatically provision SSL certificates for custom domains. For self-hosted deployments, you'll need to obtain and configure SSL certificates manually.

## Monitoring and Analytics

### Performance Monitoring

Consider adding performance monitoring tools like:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for user behavior

### Analytics Setup

1. Create a Google Analytics 4 property
2. Get your Measurement ID
3. Add the GA4 tracking code to your application

## Troubleshooting

### Common Issues

1. **Environment variables not loading**: Ensure they are set in your deployment platform, not just locally
2. **CORS errors with Supabase**: Check that your domain is added to the Supabase project settings
3. **Ads not showing**: Verify your AdMob setup and domain allowlist
4. **Build failures**: Check that all dependencies are correctly installed

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Check the deployment logs
3. Verify all environment variables are set correctly
4. Ensure your Supabase and Groq credentials are valid

## Updates and Maintenance

### Updating Dependencies

Regularly update your dependencies to get security patches:
```bash
npm outdated
npm update
```

### Redeploying Changes

For Vercel and Netlify, simply push to your Git repository to trigger a new deployment.

For self-hosted deployments:
```bash
git pull origin main
npm run build
# Restart your server