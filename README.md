# Wheelbase

An app for car enthusiasts to catalog their collector vehicles — OEM specs, customizations, photos/videos, and a social layer for sharing builds.

Built with **Expo (React Native + React Native Web)** so one codebase targets **web, iOS, and Android**. Backend is **Firebase** (Auth, Firestore, Storage).

> Web ships first; iOS and Android follow.

---

## Prerequisites

- Node.js 20+ (tested on 24)
- npm 10+
- A Firebase project (see [Firebase setup](#firebase-setup) below)

## Quickstart

```bash
npm install
cp .env.example .env        # then fill in your Firebase config
npm run web                 # open in browser
# later:
npm run ios                 # requires Xcode / iOS simulator
npm run android             # requires Android SDK / emulator
```

## Project structure

```
app/                  Expo Router screens (file-based routing)
  (tabs)/             Garage, Feed, Profile tabs
  _layout.tsx         Root stack layout
assets/               Images, fonts, splash/icon
components/           Reusable UI primitives (ThemedText, ThemedView, HapticTab, ...)
constants/            Theme palette + fonts
hooks/                React hooks (use-auth, use-color-scheme, use-theme-color)
lib/                  Cross-cutting clients (firebase.ts)
services/             Data-access layer (vehicles.ts, vpic.ts)
types/                TypeScript domain types (Vehicle, Modification, MediaItem)
```

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. In **Project settings → Your apps**, register a **Web app** and copy the config values into `.env`.
3. Enable these products in the Firebase Console:
   - **Authentication** → Sign-in methods (start with Email/Password; add Google/Apple later)
   - **Firestore Database** → Create in production mode
   - **Storage** → Create bucket
4. Restart the dev server after changing `.env`.

Env vars must start with `EXPO_PUBLIC_` for Expo to include them in the client bundle.

## OEM spec source

OEM specs are fetched from the free [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) (`services/vpic.ts`). Richer paid sources (CarAPI, Edmunds, etc.) can be layered in later behind the same service interface.

## Scripts

- `npm run web` — dev server in the browser
- `npm run ios` — iOS simulator (requires Xcode)
- `npm run android` — Android emulator
- `npm run lint` — ESLint
- `npm run reset-project` — wipes the starter `app/` and moves it to `app-example/`

## Status

Early scaffold. Working:

- Expo Router with Garage / Feed / Profile tabs
- Firebase client (Auth, Firestore, Storage) wired up via env vars
- Auth-state hook (`useAuth`)
- Vehicle / Modification / MediaItem types
- vPIC VIN decoder stub

Not yet built: add-vehicle flow, photo/video upload, sharing, feed.
