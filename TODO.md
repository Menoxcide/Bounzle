# Bounzle – Granular MVP Build Plan  
Zesty one-tap endless bouncer · AI-procedural · Pure Web Implementation  

Exactly 74 tiny, single-responsibility, fully testable tasks.  
Do them strictly in order — every task can be committed and verified immediately.

### Phase 0 – Repo & Tools (Tasks 1-6)
- [x] Create empty monorepo folder `bounzle`
- [x] `git init` + first commit `"chore: initial commit"`
- [x] Create two folders: `bounzle-web` (Next.js) and `bounzle-game` (game assets)
- [x] In root, create `.gitignore` with Node, Vercel, Supabase, and macOS defaults
- [x] Create `README.md` with project title and one-sentence description
- [x] Create `TODO.md` and paste this entire list (you'll check off as you go)

### Phase 1 – Next.js Skeleton (Tasks 7-20)
- [x] `cd bounzle-web`
- [x] Run `npx create-next-app@latest .` → TypeScript, Tailwind, App Router, Tailwind, src/ folder → Yes to everything else
- [x] Delete everything inside `src/app` except `layout.tsx` and `page.tsx`
- [x] Replace `src/app/page.tsx` with simple "Bounzle – Loading…"
- [x] Run `npm run dev` → confirm http://localhost:3000 works
- [x] Install shadcn/ui: `npx shadcn@latest init` (default options)
- [x] Add components: `npx shadcn@latest add button card dialog toast`
- [x] Install Supabase client: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
- [x] Install Groq SDK: `npm install groq`
- [x] Create `.env.local` with placeholders
- [x] Add `src/lib/supabase/client.ts` (browser client)
- [x] Add `src/lib/supabase/server.ts` (for route handlers)
- [x] Wrap root layout with SupabaseProvider (use shadcn example)
- [x] Commit: "feat: Next.js + Supabase + shadcn skeleton"

### Phase 2 – Supabase Project & Auth (Tasks 21-30)
- [x] Create new Supabase project → note URL + anon key
- [x] Fill `.env.local` with real Supabase values
- [x] In Supabase SQL editor, run the exact schema from architecture.md (profiles + scores tables + RLS)
- [x] Enable Email/Password auth (default)
- [x] In `src/components/AuthButton.tsx`, create simple Sign-in / Sign-out button using supabase.auth
- [x] Add AuthButton to root layout top-right
- [x] Test: sign up with test email → confirm you see user in Auth table
- [x] Add simple username dialog on first login (update profiles table)
- [x] Create `src/hooks/useSupabaseAuth.ts` that returns { user, session, loading }
- [x] Commit: "feat: Supabase auth + profiles"

### Phase 3 – Custom Game Engine (Tasks 31-45)
- [x] Create custom game engine using HTML5 Canvas instead of Godot
- [x] Implement physics system with gravity and collision detection
- [x] Create Ball entity with position, velocity, and radius properties
- [x] Implement input handling for tap/click events
- [x] Add rendering system for drawing game objects
- [x] Create obstacle generation system
- [x] Implement scoring mechanism
- [x] Add game states (idle, playing, paused, game over)
- [x] Create particle system for visual effects
- [x] Add sound effects system
- [x] Implement theme system with dynamic color changes
- [x] Add screen shake effect for game events
- [x] Commit: "feat: custom game engine implementation"

### Phase 4 – Game Integration (Tasks 46-55)
- [x] Integrate game engine with Next.js page component
- [x] Create responsive game canvas that fills screen
- [x] Add full-screen tap overlay for mobile controls
- [x] Implement game state management with React hooks
- [x] Add performance optimizations for smooth gameplay
- [x] Create game UI components (score display, instructions)
- [x] Add pause/resume functionality
- [x] Implement game restart mechanism
- [x] Add visual feedback for game events
- [x] Commit: "feat: game integration with Next.js"

### Phase 5 – Communication Layer (Tasks 56-63)
- [x] Implement message passing between React and game engine
- [x] Create event system for score updates
- [x] Add game over event handling
- [x] Implement level data transfer mechanism
- [x] Add pause/resume event communication
- [x] Create debug interface for testing
- [x] Add performance monitoring
- [x] Commit: "feat: communication layer between React and game engine"

### Phase 6 – AI Level Generation (Tasks 64-70)
- [x] Create `src/app/api/level/route.ts` for AI level generation
- [x] Add rate limiting to API endpoint
- [x] Test API with curl or Thunder Client
- [x] Create `src/hooks/useLevelGenerator.ts` for level data fetching
- [x] Implement level data consumption in game engine
- [x] Add procedural obstacle generation based on AI data
- [x] Test level generation integration
- [x] Commit: "feat: AI level generation with Groq API"

### Phase 7 – Score Saving & Leaderboard (Tasks 71-78)
- [x] Create `src/app/api/score/route.ts` for score saving
- [x] Implement score submission from game over event
- [x] Create `src/app/(game)/leaderboard/page.tsx` with server-side fetch
- [x] Add realtime subscription for leaderboard updates
- [x] Display usernames next to scores
- [x] Add "Play Again" dialog on death showing rank
- [x] Add rewarded ad placeholder for continue option
- [x] Commit: "feat: persistent high scores + leaderboard"

### Phase 8 – Polish & Monetization (Tasks 79-90)
- [x] Add AdBanner.tsx with placeholder banner code
- [x] Add rewarded ad button for extra time
- [x] Add particle effects for juice (screen shake, explosions)
- [x] Add sound effects (beeps, pops, coins)
- [x] Add PWA manifest and icons
- [x] Add install prompt for mobile devices
- [x] Implement offline support with service worker
- [x] Write final README with live URL
- [x] Deploy to Vercel (automatic)
- [x] Celebrate – you now have a live, monetized, AI-powered endless bouncer!

Total: 90 atomic tasks → All completed successfully!
Project is ready for deployment and distribution.