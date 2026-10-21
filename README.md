# SAT Prep

An iOS and Android app (Expo / React Native) for SAT practice.

- **Sign in** with Google or Apple.
- **Generate a test**: Claude writes a fresh set of Reading & Writing and Math questions.
- **One question at a time**, with Back / Skip / Next and a question grid to jump back to skipped ones.
- **Stored test sets**: every generated set is saved to the student's account. Progress is saved as they go, and the
  same set comes back until they finish it and explicitly choose **Retake with a new test**.
- **Results**: score by section, a list of wrong or skipped questions to go back and retry (with explanations), and the
  topics they missed, each with a **one-page study guide** written for the mistakes they made.

## How it fits together

```
Expo app ──(Supabase Auth: Google / Apple)──▶ Supabase
   │                                            ├─ Postgres: tests, study_guides (row-level security)
   └──(functions.invoke)──▶ Edge Functions ─────┤
                              generate-test     └─ Claude API (key stays server-side)
                              study-guide
```

| Path | What it is |
|---|---|
| `src/app/` | Screens (Expo Router): sign-in, home, test, results, review, guide |
| `src/lib/` | Supabase client, auth helpers, API calls, types |
| `supabase/migrations/` | Database schema and security policies |
| `supabase/functions/generate-test` | Returns the stored test, or generates a new one on first use / retake |
| `supabase/functions/study-guide` | Builds and caches a one-page guide per missed topic |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Install the CLI and link it: `npx supabase login && npx supabase link --project-ref <ref>`.
3. Apply the schema: `npx supabase db push`.
4. Set function secrets and deploy:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional: QUESTIONS_PER_SECTION=10 (default), CLAUDE_MODEL=claude-opus-5-5 (default)
   npx supabase functions deploy generate-test
   npx supabase functions deploy study-guide
   ```
5. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.

### 2. Google sign-in

1. In Google Cloud Console, create an OAuth client (type **Web application**).
   Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase > Authentication > Providers > Google, paste the client ID and secret.
3. In Supabase > Authentication > URL Configuration, add `satprep://**` to the redirect URLs.

### 3. Apple sign-in

1. Apple Developer account: enable **Sign in with Apple** for the app ID (`com.example.satprep`, change in `app.json`).
2. In Supabase > Authentication > Providers > Apple, add the bundle ID as a client ID (iOS uses native sign-in).
3. For Android (browser flow), also create a Services ID and key in the Apple portal and add them to the same provider page.

### 4. Run

```bash
npm install
npx expo run:ios      # or run:android; needs a development build because of native sign-in
```

Or build in the cloud with EAS: `npx eas-cli@latest build --profile development`.

## Notes

- Questions and answer keys are delivered to the device so the app can score offline-friendly. That is fine for practice;
  move scoring into an edge function if scores ever need to be tamper-proof.
- Generating a test makes two parallel Claude calls (one per section) and usually takes under a minute.
  Claude refusals fall back to another model server-side (`fallbacks: "default"`).
