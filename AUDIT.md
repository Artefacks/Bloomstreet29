# Bloomstreet 1929 – Website audit (what’s left to do)

## Summary

- **Stack:** Next.js 15, React 18, Supabase (auth + DB), Tailwind.
- **Done:** Auth (magic link), onboarding (create/join room), dashboard shell, protected layout, API for create-room and join-room.
- **Missing / TODO:** Login page UI, admin APIs (room, start/finish, remove member), dashboard content (portfolio, leaderboard, admin), orders page, and optional polish.

---

## 1. Critical – blocks basic flow

### 1.1 Login page (`/login`) – **MISSING**

- **Current:** Home links to `/login`, but there is **no page** at `/login` (only POST route at `/auth/login`).
- **Result:** Clicking “Se connecter” leads to 404.
- **To do:** Add `src/app/login/page.tsx` with a form (email input) that POSTs to `/auth/login`, and show `?status=sent` / `?error=...` (e.g. `otp_expired`, `auth_failed`).

---

## 2. Admin API – placeholders only (Étape 4)

These routes exist but return placeholder JSON; they need real Supabase + auth logic.

| Route | Method | TODO |
|-------|--------|------|
| `/api/admin/room` | GET | Return current league/room info (name, status, dates, invite_code, etc.) for the user’s current room. |
| `/api/admin/status/start` | POST | Start the competition (e.g. set league `status` to `"active"`), with admin check. |
| `/api/admin/status/finish` | POST | End the competition (e.g. set league `status` to `"finished"`), with admin check. |
| `/api/admin/members/remove` | POST | Remove a member from the league (body: `user_id` or similar), with admin check and RLS. |

---

## 3. Dashboard pages – placeholder content

All dashboard pages are stubs with “sera complétée à l’étape X” style text.

| Page | Path | To do |
|------|------|--------|
| Dashboard home | `/dashboard` | Show room summary, quick stats, link to portfolio/leaderboard/admin. |
| Portfolio | `/dashboard/portfolio` | List positions (from Supabase), P&amp;L, cash. “Étape 4”. |
| Leaderboard | `/dashboard/leaderboard` | Ranked list of players in current league (from `league_members` + balances). “Étape 4”. |
| Admin | `/dashboard/admin` | Room info, start/finish competition, invite code, member list + remove. “Étape 4”. |
| Orders | `/dashboard/orders` | List and (later) place orders. “Étape 5”. |

---

## 4. Navigation and UX

- **Dashboard nav:** No link to Admin; only Portfolio, Ordres, Classement. Add “Admin” (and optionally show only for admin role).
- **Logout:** No sign-out in the layout; add a button that calls Supabase `signOut()` and redirects to `/` or `/login`.
- **Onboarding errors:** Query params like `?error=code`, `?error=creation`, `?error=membership` are not shown in the UI; consider a small alert or message.

---

## 5. Optional / polish

- **Login:** Dedicated `/login` page with clear copy for magic link and error messages (see 1.1).
- **Metadata / SEO:** Root layout has title/description; add per-page metadata where useful.
- **Loading / errors:** No `loading.tsx` or `error.tsx` in app routes; add if you want better loading and error states.
- **Join-room:** Hardcoded `AUTO_ADMIN_EMAIL` in `join-room/route.ts`; consider config or env.

---

## 6. Running locally

1. **Dependencies:** From project root run:
   ```bash
   npm install
   ```
2. **Environment:** Ensure `.env.local` exists with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Dev server:**
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.  
   **Note:** Without a `/login` page, “Se connecter” will 404 until the login page is added (see 1.1).

---

## 7. Checklist (quick reference)

- [ ] Add `/login` page (form → POST `/auth/login`, show status/errors).
- [ ] Implement GET `/api/admin/room`.
- [ ] Implement POST `/api/admin/status/start` and `finish`.
- [ ] Implement POST `/api/admin/members/remove`.
- [ ] Fill dashboard home, portfolio, leaderboard, admin pages with real data and actions.
- [ ] Fill orders page (list; later: place orders).
- [ ] Add Admin link and logout in dashboard layout.
- [ ] (Optional) Show onboarding error messages from query params.
