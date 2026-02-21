/**
 * Build Helper Script for MRN MULLA KIRANA
 * * Usage:
 * node scripts/build-apk.js customer   - Build Customer APK
 * node scripts/build-apk.js admin      - Build Admin APK
 */

import fs from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const mode = process.argv[2] || 'customer'

const configs = {
    customer: {
        appId: 'com.mrnmulla.store',
        appName: 'MRN Mulla Kirana',
        webDir: 'dist'
    },
    admin: {
        appId: 'com.mrnmulla.admin',
        appName: 'MRN Mulla Admin',
        webDir: 'dist',
        plugins: {
            LocalNotifications: {
                iconColor: "#023430",
                sound: "loud_alarm.wav"
            },
            PushNotifications: {
                presentationOptions: ["badge", "sound", "alert"]
            }
        }
    }
};

const config = configs[mode]
if (!config) {
    console.error(`❌ Unknown mode: ${mode}. Use 'customer' or 'admin'.`)
    process.exit(1)
}

console.log(`\n🚀 Building ${mode.toUpperCase()} APK...`)
console.log(`   App Name: ${config.appName}`)
console.log(`   App ID:   ${config.appId}\n`)

// 0. Copy Icons (if they exist)
const resourceDir = path.join(rootDir, 'resources', mode, 'res')
const androidResDir = path.join(rootDir, 'android/app/src/main/res')

if (fs.existsSync(resourceDir)) {
    console.log(`🎨 Copying icons from resources/${mode}/res...`)
    fs.cpSync(resourceDir, androidResDir, { recursive: true, force: true })
    console.log('✅ Icons updated')
} else {
    console.log(`ℹ️  No custom icons found at resources/${mode}/res (using default)`)
}

// 1. Write Capacitor config
const capConfigPath = path.join(rootDir, 'capacitor.config.json')
fs.writeFileSync(capConfigPath, JSON.stringify(config, null, 2))
console.log('✅ Capacitor config updated')

// 1.5 Update Android build.gradle (Vital for unique APKs)
const gradlePath = path.join(rootDir, 'android/app/build.gradle')
if (fs.existsSync(gradlePath)) {
    let gradleContent = fs.readFileSync(gradlePath, 'utf8')

    // Replace applicationId
    gradleContent = gradleContent.replace(
        /applicationId\s+"[^"]+"/,
        `applicationId "${config.appId}"`
    )

    // Replace namespace (optional but good)
    gradleContent = gradleContent.replace(
        /namespace\s+"[^"]+"/,
        `namespace "${config.appId}"`
    )

    fs.writeFileSync(gradlePath, gradleContent)
    console.log('✅ Android build.gradle updated (Application ID set)')
} else {
    console.error('⚠️ Warning: android/app/build.gradle not found. App ID might not update.')
}

// 1.6 Update strings.xml (App Name)
// Capacitor sync does this, but doing it manually ensures it sticks even if sync is flaky
const stringsPath = path.join(rootDir, 'android/app/src/main/res/values/strings.xml')
if (fs.existsSync(stringsPath)) {
    let stringsContent = fs.readFileSync(stringsPath, 'utf8')
    stringsContent = stringsContent.replace(
        /<string name="app_name">[^<]+<\/string>/,
        `<string name="app_name">${config.appName}</string>`
    )
    stringsContent = stringsContent.replace(
        /<string name="title_activity_main">[^<]+<\/string>/,
        `<string name="title_activity_main">${config.appName}</string>`
    )
    stringsContent = stringsContent.replace(
        /<string name="package_name">[^<]+<\/string>/,
        `<string name="package_name">${config.appId}</string>`
    )
    stringsContent = stringsContent.replace(
        /<string name="custom_url_scheme">[^<]+<\/string>/,
        `<string name="custom_url_scheme">${config.appId}</string>`
    )
    fs.writeFileSync(stringsPath, stringsContent)
    console.log('✅ Android strings.xml updated (App Name set)')
}

// 2. Build with Vite
console.log('📦 Building with Vite...')
execSync(`npx cross-env VITE_APP_MODE=${mode} vite build`, {
    cwd: rootDir,
    stdio: 'inherit'
})
console.log('✅ Vite build complete')

// 3. Sync with Capacitor
console.log('📱 Syncing with Capacitor...')
execSync('npx cap sync android', {
    cwd: rootDir,
    stdio: 'inherit'
})
console.log('✅ Capacitor sync complete')

console.log(`\n🎉 ${config.appName} build ready!`)
console.log('   Next: Open Android Studio with: npx cap open android')
console.log('   Then: Build → Build Bundle / APK → Build APK\n')