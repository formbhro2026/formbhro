# APK Signing Guide for Formbhro

## 📱 Prerequisites

1. **Java Development Kit (JDK)** - Ensure JDK 8 or higher is installed
2. **Android Studio** - For key generation (optional, can use keytool directly)
3. **Capacitor** - Already installed in your project

## 🔑 Step 1: Generate Signing Key

### Option A: Using Android Studio (Recommended)

1. Open Android Studio
2. Go to **Build** → **Generate Signed Bundle/APK**
3. Select **APK** and click **Next**
4. Click **Create new...** to generate a new keystore
5. Fill in the required information:
   - **Key store path**: Choose a secure location (e.g., `formbhro-release.jks`)
   - **Password**: Create a strong password (remember this!)
   - **Key alias**: `formbhro` (or your preferred name)
   - **Key password**: Same as keystore password (recommended)
   - **Validity**: 10,000 days (default)
   - **Certificate info**: Fill in your details

### Option B: Using keytool (Command Line)

```bash
keytool -genkey -v -keystore formbhro-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias formbhro
```

You'll be prompted for:

- Keystore password
- Key password (use same as keystore password)
- Your name, organization, city, state, country code

## 📋 Step 2: Configure Capacitor for Signing

### Update capacitor.config.ts

Add or update the android configuration:

```typescript
const config: CapacitorConfig = {
  appId: "com.formbhro.app",
  appName: "Formbhro",
  webDir: "dist",
  server: {
    url: "https://formbhro.lovable.app",
    allowNavigation: [
      "*.supabase.co",
      "*.supabase.io",
      "*.lovable.app",
      "formbhro.lovable.app",
      "formbhro.vercel.app",
      "oauth.lovable.app",
      "accounts.google.com",
      "*.google.com",
      "ogjhvmucklbxcewpkiai.supabase.co",
    ],
  },
  plugins: {
    // ... existing plugins
  },
  android: {
    buildOptions: {
      signingType: "apksigner",
    },
  },
};
```

### Create signing configuration file

Create `android/app/build.gradle` (if it doesn't exist) or update it:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../formbhro-release.jks')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'formbhro'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**⚠️ SECURITY WARNING**: Never commit passwords to git! Use environment variables or a local.properties file.

### Using local.properties for security

Create `android/local.properties`:

```properties
FORMBHRO_KEYSTORE_PASSWORD=your_actual_password
FORMBHRO_KEY_PASSWORD=your_actual_password
```

Then update build.gradle:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../formbhro-release.jks')
            storePassword project.hasProperty('FORMBHRO_KEYSTORE_PASSWORD') ? project.property('FORMBHRO_KEYSTORE_PASSWORD') : System.getenv('FORMBHRO_KEYSTORE_PASSWORD')
            keyAlias 'formbhro'
            keyPassword project.hasProperty('FORMBHRO_KEY_PASSWORD') ? project.property('FORMBHRO_KEY_PASSWORD') : System.getenv('FORMBHRO_KEY_PASSWORD')
        }
    }
}
```

## 🏗️ Step 3: Build the APK

### Sync Capacitor

```bash
npm run cap:sync
```

### Build Release APK

```bash
npm run cap:build:release
```

Or manually:

```bash
cd android
./gradlew assembleRelease
```

## 📦 Step 4: Locate the APK

The signed APK will be located at:

```
android/app/build/outputs/apk/release/app-release.apk
```

## 🔒 Step 5: Verify Signature

Verify the APK signature:

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/app-release.apk
```

## 🧪 Step 6: Testing Before Distribution

### Install on Test Device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Test Checklist:

- [ ] App launches successfully
- [ ] User authentication works
- [ ] Admin authentication works
- [ ] Team authentication works
- [ ] Google Sign-In works
- [ ] WebRTC calling functions
- [ ] Screen sharing functions
- [ ] Database operations work
- [ ] Push notifications work
- [ ] All navigation works
- [ ] No crashes on normal usage

## 🚀 Step 7: Distribution

### Upload to Google Play Store

1. Use the signed APK for internal testing
2. For production, consider creating an AAB (Android App Bundle) instead

### Direct Distribution

Share the APK file directly for testing or distribution outside Play Store.

## 🔐 Important Security Notes

1. **Never commit your keystore file** to version control
2. **Never commit passwords** to version control
3. **Keep backup copies** of your keystore file
4. **Remember your passwords** - they cannot be recovered
5. **Use strong passwords** for keystore and key
6. **Store keystore securely** - it's your app's identity

## 🛠️ Troubleshooting

### "Keystore file not found"

- Ensure the keystore file path in build.gradle is correct
- Try using absolute path if relative path doesn't work

### "Invalid keystore format"

- Ensure you're using the correct keystore file
- Regenerate the keystore if corrupted

### "Permission denied"

- Ensure file permissions are correct on the keystore file
- Check that the keystore file isn't corrupted

### Build fails with signing errors

- Verify passwords are correct
- Check that the key alias matches what you created
- Ensure build.gradle configuration is correct

## 📝 Summary

1. Generate keystore file
2. Configure signing in build.gradle
3. Build release APK
4. Test thoroughly
5. Distribute

Your app is now properly signed and ready for distribution!
