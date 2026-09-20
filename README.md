# Sporttag

A production-oriented Expo application sharing one TypeScript codebase across iOS, Android, and the web. It uses Expo Router for native navigation and Supabase for authentication and backend services.

## Requirements

- Node.js 20.19 or later and npm
- An Expo account and the Expo CLI (`npx expo` is sufficient locally)
- A Supabase project
- An Apple Developer account for App Store distribution
- A Google Play Developer account for Play Store distribution

## Local setup

```bash
git clone <repository-url>
cd sporttag
npm install
cp .env.example .env
```

Set these values in `.env`, using your Supabase project's Connect settings:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Only publishable client credentials belong in `EXPO_PUBLIC_*` variables. Never add a Supabase service-role key to this app.

## Run

```bash
npm run start
npm run ios
npm run android
npm run web
```

Run checks with `npm run lint`, `npm run typecheck`, and `npm run web:export`.

## Architecture

- `app/` contains file-based routes. `(auth)` owns signed-out screens and `(app)` owns authenticated tabs.
- `providers/SessionProvider.tsx` restores and observes the Supabase session; the root layout protects the route groups.
- `lib/supabase.ts` configures Supabase Auth persistence with AsyncStorage on native and browser storage on web. It is ready for Postgres, Storage, and Realtime use through the exported client.
- `components/platform/PlatformSurface.tsx` centralizes platform presentation. On iOS systems that expose Apple's Liquid Glass API it uses Expo's native `GlassView`; elsewhere it uses a tokenized platform-appropriate surface.
- `components/ui/theme.ts` contains the compact semantic color token set, derived from the system theme.

The app uses Expo Router's native stack and tab primitives. iOS 26 navigation chrome receives the system Liquid Glass treatment automatically; Android retains its native Material-style navigation behavior; the web layout applies a readable desktop width constraint.

## Expo Go and development builds

Expo Go is fine for this starter and for testing Expo SDK APIs included by Expo Go. Use a development build when adding custom native modules, modifying native configuration, testing native app entitlements, or validating the same binary configuration you will submit. Create one with `eas build --profile development --platform ios` or `android`.

## Production builds

Install and authenticate EAS CLI (`npm install --global eas-cli`, then `eas login`), configure identifiers in `app.json`, and connect the project with `eas init`. Then build:

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

Use `eas submit --platform ios` or `eas submit --platform android` after configuring store credentials. `eas.json` also defines development and internal preview profiles.

For web, create static assets with `npm run web:export` and deploy the resulting `dist/` directory to a static host. Set a production web origin in Expo Router configuration if the app later needs absolute URLs or advanced web deployment behavior.
