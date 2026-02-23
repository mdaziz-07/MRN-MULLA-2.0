const fs = require('fs')
const path = require('path')

const mode = process.argv[2]
if (!['customer', 'admin'].includes(mode)) {
    console.error("Invalid mode: " + mode)
    process.exit(1)
}

const config = {
    customer: {
        appId: "com.mrnmulla.store",
        appName: "MRN Mulla Kirana",
    },
    admin: {
        appId: "com.mrnmulla.admin",
        appName: "MRN Admin",
    }
}

const target = config[mode]

// 1. capacitor.config.json
const capFile = path.resolve('capacitor.config.json')
let capJson = JSON.parse(fs.readFileSync(capFile, 'utf8'))
capJson.appId = target.appId
capJson.appName = target.appName
fs.writeFileSync(capFile, JSON.stringify(capJson, null, 2))

// 2. android/app/build.gradle
const gradleFile = path.resolve('android/app/build.gradle')
if (fs.existsSync(gradleFile)) {
    let gradleData = fs.readFileSync(gradleFile, 'utf8')
    gradleData = gradleData.replace(/applicationId "[^"]+"/, `applicationId "${target.appId}"`)
    fs.writeFileSync(gradleFile, gradleData)
}

// 3. android/app/src/main/res/values/strings.xml
const stringsFile = path.resolve('android/app/src/main/res/values/strings.xml')
if (fs.existsSync(stringsFile)) {
    let stringsData = fs.readFileSync(stringsFile, 'utf8')
    stringsData = stringsData.replace(/<string name="app_name">[^<]+<\/string>/, `<string name="app_name">${target.appName}</string>`)
    stringsData = stringsData.replace(/<string name="title_activity_main">[^<]+<\/string>/, `<string name="title_activity_main">${target.appName}</string>`)
    stringsData = stringsData.replace(/<string name="package_name">[^<]+<\/string>/, `<string name="package_name">${target.appId}</string>`)
    stringsData = stringsData.replace(/<string name="custom_url_scheme">[^<]+<\/string>/, `<string name="custom_url_scheme">${target.appId}</string>`)
    fs.writeFileSync(stringsFile, stringsData)
}

console.log(`\n✅ Switched Android App to ${mode.toUpperCase()} MODE`)
console.log(`   - App Name: ${target.appName}`)
console.log(`   - App ID  : ${target.appId}\n`)
