---
description: How to build Customer and Admin APKs
---
# Build APK Workflow

## Prerequisites
- Android Studio installed
- Java SDK installed (comes with Android Studio)

## Build Customer APK
// turbo
1. Build the customer web bundle:
```
node scripts/build-apk.js customer
```

2. Open Android Studio:
```
npx cap open android
```

3. In Android Studio:
   - Wait for Gradle sync to complete
   - Go to **Build → Build Bundle / APK → Build APK**
   - APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Rename to `MRN-Customer.apk`

---

## Build Admin APK
// turbo
4. Build the admin web bundle:
```
node scripts/build-apk.js admin
```

5. Open Android Studio:
```
npx cap open android
```

6. In Android Studio:
   - Wait for Gradle sync
   - **Build → Build Bundle / APK → Build APK**
   - APK at: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Rename to `MRN-Admin.apk`

---

## Notes
- Each build automatically swaps the Capacitor config (app name, app ID)
- Customer APK: `com.mrnmulla.store` → "MRN Mulla Kirana"
- Admin APK: `com.mrnmulla.admin` → "MRN Mulla Admin"
- Safe area / notch protection is built into both APKs
