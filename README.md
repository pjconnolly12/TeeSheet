# TeeSheet

TeeSheet is a lightweight golf round scheduler built with React, TypeScript, Supabase, and Netlify Functions.

## Features

- Sign up and log in
- Add and update golf rounds
- Treat the user who creates a round as that round's owner
- Store date, time, location, holes, number of players, and golfer list
- Maintain an owner-only distribution list for creation announcements
- Block groups from exceeding the round capacity
- Let golfers join a waitlist when a round is full
- Automatically promote the earliest waitlisted golfer when a spot opens
- Send automatic round emails on create and update
- Send reminder emails before upcoming rounds

## Stack

- Frontend: React + Vite + TypeScript
- Auth + Database: Supabase
- Email + automation: Netlify Functions + Resend
- Hosting: Netlify

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values.
3. Run the SQL in [supabase/schema.sql](/c:/Users/pjcon/dev/TeeSheet/supabase/schema.sql) inside Supabase.
If you already created the earlier version of the schema, run this updated file again so the `distribution_list_entries` and `round_waitlist_entries` tables and policies are added.
4. Start the app with `npm run netlify:dev`.

## Deploying

### 1. Secure secrets before you push

1. Rotate the current `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` if they were ever stored in a real `.env`.
2. Keep secrets only in your local `.env` and in Netlify environment variables.
3. Do not commit `.env`; this repo ignores it by default.

### 2. Prepare Supabase

1. Open the Supabase SQL editor for your project.
2. Run the full contents of [supabase/schema.sql](/c:/Users/pjcon/dev/TeeSheet/supabase/schema.sql).
3. Confirm the latest row visibility behavior is live:
   - round owners can see their rounds
   - invited players can see rounds where their email is listed in `round_players`
   - non-invited users cannot see those rounds

### 3. Push to GitHub

1. Initialize a Git repository if needed:
   ```bash
   git init -b main
   git add .
   git commit -m "Prepare TeeSheet for Netlify deploy"
   ```
2. Create a GitHub repository.
3. Add it as a remote and push:
   ```bash
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

### 4. Create the Netlify site

1. In Netlify, choose **Add new site** -> **Import an existing project**.
2. Connect your GitHub repo.
3. Netlify can use the existing settings from [netlify.toml](/c:/Users/pjcon/dev/TeeSheet/netlify.toml):
   - build command: `npm run build`
   - publish directory: `dist`
   - functions directory: `netlify/functions`

### 5. Add Netlify environment variables

Add these variables in Netlify Site configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Use these values:

- `VITE_SUPABASE_URL`: your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: your Supabase anon/public key
- `VITE_APP_URL`: your deployed site URL, for example `https://your-site-name.netlify.app`
- `SUPABASE_URL`: the same value as `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`: your rotated service-role key
- `RESEND_API_KEY`: your active Resend API key
- `EMAIL_FROM`: a verified sender, for example `TeeSheet <golf@yourdomain.com>`

### 6. Configure Supabase Auth

In Supabase Auth settings:

1. Set **Site URL** to your Netlify site URL.
2. Add these redirect URLs:
   - `https://<your-site-name>.netlify.app`
   - your custom domain later, for example `https://golf.yourdomain.com`

### 7. Configure a domain

1. Start with the default `*.netlify.app` domain for initial testing.
2. Add a custom domain in Netlify when the site is stable.
3. Update DNS at your registrar to point to Netlify.
4. After the custom domain is active, update:
   - `VITE_APP_URL` in Netlify
   - Supabase Auth Site URL
   - Supabase Auth Redirect URLs

### 8. Deploy and verify functions

1. Trigger a production deploy from the `main` branch.
2. Confirm these Netlify Functions are present:
   - `notify-round`
   - `send-round-reminders`
3. Confirm the scheduled reminder job is active. The current schedule is:
   - `0 13 * * *` (`13:00 UTC` daily)

### 9. Test the deployed app

Run through this checklist on the deployed site:

1. Sign up and sign in successfully.
2. Create a round and confirm the owner can see it.
3. Invite another player email and confirm that invited user can see it.
4. Confirm a non-invited account cannot see the round.
5. Confirm only the owner can edit or delete the round.
6. Fill a round, join the waitlist, and verify waitlist promotion when a spot opens.
7. Confirm creation and update emails send successfully.
8. Trigger or wait for `send-round-reminders` and confirm reminders mark `reminder_sent_at`.

## Reminder emails

`send-round-reminders` is configured as a Netlify Scheduled Function and runs daily at `13:00 UTC`.

## Round ownership and announcements

Each round is owned by the authenticated user who created it through the `rounds.created_by` field.
Owners can manage a reusable distribution list in the app, and those recipients are emailed whenever that owner creates a new round.

## Waitlist behavior

Users can only view rounds they created or rounds where their email is listed as a player.
When a round is full, logged-in users can add themselves to that round's waitlist.
If the round owner later removes a golfer or reduces the active lineup below capacity, TeeSheet automatically promotes the earliest active waitlist entry into the round.
