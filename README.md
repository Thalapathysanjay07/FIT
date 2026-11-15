# FIT — Personal Fitness Platform

Premium black + neon-green fitness companion built with React, Vite and Lucide icons.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Install as an app (PWA)

Deploy the production build over HTTPS. On Android Chrome, open the site and choose **Install app** or **Add to Home screen**. On iPhone Safari, use **Share → Add to Home Screen**. The service worker caches the app shell for basic offline opening; API/network-dependent features still require a connection.

## Android package (Capacitor)

Install dependencies, then generate the native Android project:

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Android Studio and the Android SDK are required to build/sign an APK or AAB. Set up an app signing key before publishing. iOS packaging requires macOS and Xcode; it is not generated on Windows.

## Current frontend features

- Responsive dashboard and mobile navigation
- Workout library with beginner, intermediate and advanced filters
- Workout completion tracking
- Nutrition log with add/remove meal interactions
- Calorie and protein target controls
- Water intake tracker
- Progress overview
- Workout discovery categories and search
- Self-paced habit challenges
- FIT Coach starter guidance
- Membership/pricing and revenue-model screens
- Browser-local persistence using localStorage
- Installable PWA manifest, app icon and service-worker app-shell cache
- Capacitor configuration for Android packaging

## Product decisions

- Goals: weight loss, muscle gain and fitness maintenance
- Levels: beginner, intermediate and advanced
- Language: English
- Visual system: premium black + neon green
- Business direction: free tier, proposed premium subscription, trainer marketplace, sponsorships and affiliate referrals

## Important implementation status

This repository is a **frontend MVP and installable app foundation**, not a fully launched commercial fitness service. Current logs, goals, challenge progress and preferences are stored only in the current browser using localStorage. They do not sync between devices or users.

The FIT Coach uses built-in rule-based responses; it is not connected to a live AI service. Workout and trend content is starter content, not live trend analytics or medically individualized programming. The proposed ₹199/month Pro price is a planning placeholder, not an active subscription.

Not yet integrated: secure authentication, backend API, cloud database, user profiles, server-side workout/diet personalization, payment gateway and webhooks, trainer onboarding/verification and payouts, affiliate tracking, ad network, push notifications, admin moderation, privacy/terms/consent flows, app-store signing and production monitoring.

Before collecting payments or showing ads, configure the relevant provider accounts, legal disclosures, privacy and refund policies, tax requirements, and security controls. Do not advertise guaranteed fitness outcomes or guaranteed income.
