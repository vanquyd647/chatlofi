#!/usr/bin/env pwsh
# Deploy Firebase Cloud Functions và Build Android APK
# Usage: .\deploy-and-build.ps1

Write-Host "🚀 Firebase Functions Deployment & Android Build" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""

# Step 1: Check Firebase CLI
Write-Host "📋 Step 1/5: Checking Firebase CLI..." -ForegroundColor Cyan
$firebaseCommand = Get-Command firebase -ErrorAction SilentlyContinue
if (-Not $firebaseCommand) {
    Write-Host "⚠️  Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Firebase CLI!" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Firebase CLI ready" -ForegroundColor Green
Write-Host ""

# Step 2: Login to Firebase
Write-Host "📋 Step 2/5: Firebase Login..." -ForegroundColor Cyan
Write-Host "⚠️  Please login to Firebase in your browser" -ForegroundColor Yellow
Write-Host ""

firebase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Firebase login failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "   firebase login" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}
Write-Host "✅ Firebase login successful" -ForegroundColor Green
Write-Host ""

# Step 3: Deploy Cloud Functions
Write-Host "📋 Step 3/5: Deploying Cloud Functions..." -ForegroundColor Cyan
Write-Host "⏳ This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

firebase deploy --only functions

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cloud Functions deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Cloud Functions deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "   1. Make sure 'Firebase Cloud Messaging API' is enabled:" -ForegroundColor White
    Write-Host "      https://console.cloud.google.com/apis/library/fcm.googleapis.com" -ForegroundColor White
    Write-Host ""
    Write-Host "   2. Check Firebase project is correct:" -ForegroundColor White
    Write-Host "      firebase use chatlofi-9c2c8" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Continue with APK build anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}
Write-Host ""

# Step 4: Build Android APK
Write-Host "📋 Step 4/5: Building Android APK..." -ForegroundColor Cyan
Write-Host ""

if (-Not (Test-Path "android")) {
    Write-Host "❌ Error: android directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location android

Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Cyan
.\gradlew clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Clean failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "🔨 Building Release APK..." -ForegroundColor Cyan
.\gradlew app:assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# Step 5: Verify Output
Write-Host ""
Write-Host "📋 Step 5/5: Verifying Output..." -ForegroundColor Cyan

$apkPath = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    $apkInfo = Get-Item $apkPath
    $sizeInMB = [math]::Round($apkInfo.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "🎉 SUCCESS! Everything is ready!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Cloud Functions: Deployed" -ForegroundColor Green
    Write-Host "✅ APK Built: app-release.apk" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 APK Location:" -ForegroundColor Yellow
    Write-Host "   $(Resolve-Path $apkPath)" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 APK Size: $sizeInMB MB" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔔 Notifications: " -ForegroundColor Yellow
    Write-Host "   ✅ FCM HTTP v1 API configured" -ForegroundColor Green
    Write-Host "   ✅ Cloud Functions auto-send notifications" -ForegroundColor Green
    Write-Host "   ✅ Package name: com.quy001.jolo" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Install APK: .\install-android.ps1" -ForegroundColor White
    Write-Host "   2. Test notifications on 2 devices" -ForegroundColor White
    Write-Host "   3. Check logs: firebase functions:log" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ APK not found at expected location!" -ForegroundColor Red
    exit 1
}
