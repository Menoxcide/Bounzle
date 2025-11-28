# Bounzle – Granular MVP Build Plan  
Zesty one-tap endless bouncer · AI-procedural · Godot + Next.js + Supabase + Groq  

Exactly 74 tiny, single-responsibility, fully testable tasks.  
Do them strictly in order — every task can be committed and verified immediately.

### Phase 0 – Repo & Tools (Tasks 1-6)
1. Create empty monorepo folder `bounzle`
2. `git init` + first commit `"chore: initial commit"`
3. Create two folders: `bounzle-web` (Next.js) and `bounzle-godot` (Godot project)
4. In root, create `.gitignore` with Node, Godot, Vercel, Supabase, and macOS defaults
5. Create `README.md` with project title and one-sentence description
6. Create `TODO.md` and paste this entire list (you'll check off as you go)

### Phase 1 – Next.js Skeleton (Tasks 7-20)
7. `cd bounzle-web`
8. Run `npx create-next-app@latest .` → TypeScript, Tailwind, App Router, Tailwind, src/ folder → Yes to everything else
9. Delete everything inside `src/app` except `layout.tsx` and `page.tsx`
10. Replace `src/app/page.tsx` with simple "Bounzle – Loading…"
11. Run `npm run dev` → confirm http://localhost:3000 works
12. Install shadcn/ui: `npx shadcn@latest init` (default options)
13. Add components: `npx shadcn@latest add button card dialog toast`
14. Install Supabase client: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
15. Install Groq SDK: `npm install groq`
16. Create `.env.local` with placeholders:
    ```
    NEXT_PUBLIC_SUPABASE_URL=your_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
    GROQ_API_KEY=your_groq_key
    ```
17. Add `src/lib/supabase/client.ts` (browser client)
    ```ts
    import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
    export const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    ```
18. Add `src/lib/supabase/server.ts` (for route handlers)
19. Wrap root layout with SupabaseProvider (use shadcn example)
20. Commit: "feat: Next.js + Supabase + shadcn skeleton"

### Phase 2 – Supabase Project & Auth (Tasks 21-30)
21. Create new Supabase project → note URL + anon key
22. Fill `.env.local` with real Supabase values
23. In Supabase SQL editor, run the exact schema from architecture.md (profiles + scores tables + RLS)
24. Enable Email/Password auth (default)
25. In `src/components/AuthButton.tsx`, create simple Sign-in / Sign-out button using supabase.auth
26. Add AuthButton to root layout top-right
27. Test: sign up with test email → confirm you see user in Auth table
28. Add simple username dialog on first login (update profiles table)
29. Create `src/hooks/useSupabaseAuth.ts` that returns { user, session, loading }
30. Commit: "feat: Supabase auth + profiles"

### Phase 3 – Godot Minimal Playable (Tasks 31-45)
31. Download & install Godot 4.3.1 (standard, not .NET)
32. `cd ../bounzle-godot`
33. Open Godot → New Project → 2D → name "BounzleGodot"
34. Set window size 450×800 (portrait mobile)
35. Create scene `Main.tscn`
36. Add Node2D → rename to GameRoot
37. Add RigidBody2D → rename to Player → Circle shape + sprite (or just colored circle)
38. Set Player gravity_scale = 3, linear_damp = 0
39. Add script PlayerBall.gd:
    ```gdscript
    extends RigidBody2D
    func _input(event):
        if event is InputEventScreenTouch and event.pressed:
            linear_velocity.y = -400
    ```
40. Add two Wall obstacles (StaticBody2D) left/right) + floor/ceiling
41. Add Camera2D as child of Player, current = true
42. Add Auto-scroll: in GameRoot add script that translates everything left at constant speed
43. Add Score label that increases every passed obstacle
44. Play in editor → confirm you can tap/space makes ball jump and you can survive a few gaps
45. Commit Godot: "feat: minimal playable bouncer (no web export yet)"

### Phase 4 – Godot Web Export & Embedding (Tasks 46-55)
46. In Godot → Project → Export → Add "Web" → Web (HTML5)
47. Enable "Experimental Virtual Keyboard"
48. Export to `../bounzle-web/src/godot-build/` (overwrite everything)
49. In Next.js, create page `src/app/(game)/play/page.tsx` containing only:
    ```tsx
    <div className="w-screen h-screen bg-black">
      <iframe src="/godot-build/index.html" className="w-full h-full border-0" />
    </div>
    ```
50. Visit /play → confirm Godot game runs full-screen in browser
51. Add full-screen tap overlay `src/components/MobileControls.tsx` (transparent div that forwards click → do nothing yet)
52. Replace iframe with direct canvas loading (better performance):
    - Delete iframe
    - Add `GameCanvas.tsx` that dynamically loads `/godot-build/bounce-blitz.js` and instantiates Engine
53. Confirm direct canvas loading works and is faster
54. Add resize handler so canvas always fills screen
55. Commit: "feat: Godot web export embedded without iframe"

### Phase 5 – JS ↔ Godot Communication (Tasks 56-63)
56. In Godot, enable JavaScriptBridge in export preset
57. In GameManager.gd, add:
    ```gdscript
    func send_score_to_js(score):
        JavaScriptBridge.eval("window.parent.postMessage({type:'score',score:%d}, '*')" % score, true)
    func send_game_over_to_js(score):
        JavaScriptBridge.eval("window.parent.postMessage({type:'gameover',score:%d}, '*')", true)
    ```
58. In `GameCanvas.tsx`, add message listener and toast current score
59. Test: score updates appear as browser toasts
60. In `GameCanvas.tsx`, add function `sendToGodot(obj)` using `engine.call()` or postMessage reverse
61. In Godot, add JS callback to receive level JSON
62. Test round-trip: button in React → sends fake level JSON → Godot logs it
63. Commit: "feat: bidirectional Godot ↔ JavaScript bridge working"

### Phase 6 – AI Level Generation Endpoint (Tasks 64-70)
64. Create `src/app/api/level/route.ts` exactly as in architecture.md
65. Add simple rate limiting (max 5 requests per minute per IP)
66. Test with curl or Thunder Client → confirm returns valid JSON with chunks
67. Create `src/hooks/useLevelGenerator.ts` that calls /api/level and caches last seed
68. From React button "Generate Level" → call hook → send JSON to Godot
69. In Godot LevelGenerator.gd, parse JSON and spawn procedural pipes
70. Play game → press button → new gaps appear ahead

### Phase 7 – Score Saving & Leaderboard (Tasks 71-78)
71. Create `src/app/api/score/route.ts` (protected, insert into Supabase)
72. On game over → send score to /api/score
73. Create `src/app/(game)/leaderboard/page.tsx` with server-side fetch of top 50 scores
74. Add realtime subscription on leaderboard (optional but cool)
75. Add username display next to score
76. Add simple "Play Again" dialog on death that shows your rank
77. Add rewarded ad placeholder button "Watch ad to continue +5 seconds"
78. Commit: "feat: persistent high scores + leaderboard"

### Phase 8 – Polish & Monetization (Tasks 79-90)
79. Add AdBanner.tsx with real AdMob banner code (test mode)
80. Add rewarded ad button → on reward → tell Godot to give player 5 extra seconds
81. Add juice: screen shake, particles, sound effects (CC0 from Freesound)
82. Add PWA manifest + icons
83. Add "Install" prompt on mobile
84. Make sure game works offline after first load (service worker caches godot-build)
85. Write final README with live URL
86. Deploy to Vercel (automatic)
87. Export Android APK from Godot (one-click)
88. (Optional) Wrap with Capacitor for iOS TestFlight
89. Submit to Google Play (open testing)
90. Celebrate – you now have a live, monetized, AI-powered endless bouncer!

Total: 90 atomic tasks → perfect for feeding one-by-one to an engineering LLM or junior dev.

Start with task 1 and go straight down the list. Every single task is verifiable in <10 minutes. Good luck building Bounzle!