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

A GitHub Actions workflow runs the Vite production build on pushes and pull requests to `main`.

## Features in this frontend foundation

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

## Product decisions

- Goals: weight loss, muscle gain and fitness maintenance
- Levels: beginner, intermediate and advanced
- Language: English
- Visual system: premium black + neon green
- Business direction: free tier, proposed premium subscription, trainer marketplace, sponsorships and affiliate referrals

## Important implementation status

This repository now contains a richer **frontend MVP**, not a fully launched commercial fitness service. Current logs, goals, challenge progress and preferences are stored only in the current browser using localStorage. They do not sync between devices or users.

The FIT Coach uses built-in rule-based responses; it is not connected to a live AI service. Workout and trend content is starter content, not live trend analytics or medically individualized programming. The proposed ₹199/month Pro price is a planning placeholder, not an active subscription.

Not yet integrated: secure authentication, backend API, cloud database, user profiles, server-side workout/diet personalization, payment gateway and webhooks, trainer onboarding/verification and payouts, affiliate tracking, ad network, push notifications, admin moderation, privacy/terms/consent flows, and production monitoring.

Before collecting payments or showing ads, configure the relevant provider accounts, legal disclosures, privacy and refund policies, tax requirements, and security controls. Do not advertise guaranteed fitness outcomes or guaranteed income.
