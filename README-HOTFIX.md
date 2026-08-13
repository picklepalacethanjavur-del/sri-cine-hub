# Sri Cine Hub V3.1 Hotfix

This hotfix addresses the failed Vercel build.

## Fixes included
1. Restores the missing Supabase client/server files.
2. Restores the missing `components/AdminNav.tsx`.
3. Adds `@/*` path alias configuration to `tsconfig.json`.
4. Upgrades Next.js from 15.4.6 to 15.5.21 (Maintenance LTS security release).
5. Includes middleware files required by Supabase SSR auth.

## Upload these paths to the ROOT of the GitHub repository

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `components/AdminNav.tsx`
- `middleware.ts`
- `tsconfig.json`
- `package.json`

Preserve the folders exactly. Do not put these files inside another `sri-cine-hub` folder.

## After pushing
Vercel should automatically redeploy from the `main` branch.

If it does not:
Vercel > sri-cine-hub > Deployments > Redeploy.

## Required Vercel environment variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
