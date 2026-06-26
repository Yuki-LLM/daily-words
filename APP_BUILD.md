# Daily Words App Packaging

This project is prepared for Capacitor so the same app can be installed as a real Android or iOS app.

## Android

1. Install Node dependencies:
   `pnpm install`
2. Add the Android native project:
   `pnpm cap:add:android`
3. Sync the current app files:
   `pnpm cap:sync`
4. Open Android Studio:
   `pnpm cap:open:android`
5. Build an APK from Android Studio.

This Windows machine currently does not have Android SDK / adb configured, so I cannot generate the APK here yet.

## iOS

1. Use a Mac with Xcode.
2. Install Node dependencies:
   `pnpm install`
3. Add the iOS native project:
   `pnpm cap:add:ios`
4. Sync the current app files:
   `pnpm cap:sync`
5. Open Xcode:
   `pnpm cap:open:ios`
6. Sign and export through Xcode, TestFlight, or the App Store.

iPhone apps cannot be directly produced from Windows without Apple's signing tools.
