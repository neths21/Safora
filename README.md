# Safora

Safora is a React Native safety companion app built with Expo. It helps users share ride details with trusted contacts, monitor ride progress, and trigger SOS flows during emergencies.

## Tech Stack

- React Native 0.83
- Expo SDK 55
- React Navigation
- Firebase (Auth, Firestore, Realtime Database)

## Core Features

- Create and start rides with pickup, destination, and vehicle details
- Manage trusted contacts
- Share ride start and emergency alerts
- SOS trigger flow with emergency event logging
- Audio recording support during emergencies
- Ride lifecycle screens (home, ride, emergency, completion)

## Project Structure

- `screens/` - UI screens and ride flow
- `navigation/` - app navigation stack
- `services/` - business logic (location, emergency, sharing, Firebase)
- `components/` - reusable UI components
- `hooks/` - custom hooks for tracking and voice triggers
- `utils/` - constants and helper values

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Expo CLI (optional, `npx expo` works without global install)
- Android Studio for Android emulator/device builds
- Xcode for iOS builds (macOS only)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the Expo development server:

```bash
npm run start
```

3. Run on Android:

```bash
npm run android
```

4. Run on iOS (macOS only):

```bash
npm run ios
```

5. Run on web:

```bash
npm run web
```

## Available Scripts

- `npm run start` - starts Expo dev server
- `npm run android` - builds and runs Android app
- `npm run ios` - builds and runs iOS app
- `npm run web` - starts web target

## Configuration Notes

- Expo app metadata is in `app.json`.
- Firebase bootstrap is in `firebaseConfig.js`.
- Native Android project files are under `android/`.

## Next Improvements

- Add environment-based Firebase configuration using `.env`
- Add authentication flow and replace hardcoded user ID
- Add automated tests for services and critical ride flows
- Add linting and formatting configuration
