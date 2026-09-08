# Build standalone Android APK for Smart Farmer Platform
param(
    [string]$OutputDir = "$PSScriptRoot\..\..\web\public\downloads"
)

$ErrorActionPreference = "Stop"

$sdkRoot = "C:\Users\DELL\AppData\Local\Android\Sdk"
$buildToolsDir = "$sdkRoot\build-tools\36.0.0"
$platformJar = "$sdkRoot\platforms\android-36.1\android.jar"
$javac = "C:\Java\jdk-24.0.2\bin\javac.exe"
$keystore = "C:\Users\DELL\.android\debug.keystore"

$aapt2 = "$buildToolsDir\aapt2.exe"
$d8 = "$buildToolsDir\d8.bat"
$zipalign = "$buildToolsDir\zipalign.exe"
$apksigner = "$buildToolsDir\apksigner.bat"

Write-Host "Verifying toolchain..." -ForegroundColor Cyan
foreach ($tool in @($javac, $platformJar, $aapt2, $d8, $zipalign, $apksigner, $keystore)) {
    if (-not (Test-Path $tool)) {
        throw "Required path not found: $tool"
    }
}

$workDir = "$PSScriptRoot\..\.apk_build"
if (Test-Path $workDir) {
    Remove-Item -Recurse -Force $workDir
}
New-Item -ItemType Directory -Path "$workDir\src\com\smartfarmer\platform" -Force | Out-Null
New-Item -ItemType Directory -Path "$workDir\res\values" -Force | Out-Null
New-Item -ItemType Directory -Path "$workDir\res\drawable" -Force | Out-Null
New-Item -ItemType Directory -Path "$workDir\res\layout" -Force | Out-Null
New-Item -ItemType Directory -Path "$workDir\compiled_res" -Force | Out-Null
New-Item -ItemType Directory -Path "$workDir\bin" -Force | Out-Null

function Set-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# 1. Android Manifest
$manifest = @'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.smartfarmer.platform"
    android:versionCode="1"
    android:versionName="1.1.1">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
'@
Set-Utf8NoBom -Path "$workDir\AndroidManifest.xml" -Content $manifest

# 2. Resources
$strings = @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Smart Farmer</string>
</resources>
'@
Set-Utf8NoBom -Path "$workDir\res\values\strings.xml" -Content $strings

# Vector drawable launcher icon
$icon = @'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#1F3A2D"
        android:pathData="M0,0h108v108h-108z"/>
    <path
        android:fillColor="#3F7D48"
        android:pathData="M54,18 C36,18 24,32 24,50 C24,68 40,82 54,90 C68,82 84,68 84,50 C84,32 72,18 54,18 Z"/>
    <path
        android:fillColor="#D7A44A"
        android:pathData="M54,34 C46,42 46,58 54,68 C62,58 62,42 54,34 Z"/>
</vector>
'@
Set-Utf8NoBom -Path "$workDir\res\drawable\ic_launcher.xml" -Content $icon

# 3. Java Activity
$javaCode = @'
package com.smartfarmer.platform;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView mWebView;
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILECHOOSER_RESULTCODE = 1001;
    private static final String DEFAULT_URL = "http://10.0.2.2:3000";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout layout = new FrameLayout(this);
        mWebView = new WebView(this);
        layout.addView(mWebView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(layout);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setGeolocationEnabled(true);

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    return true;
                }
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    mFilePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        mWebView.loadUrl(DEFAULT_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
'@
Set-Utf8NoBom -Path "$workDir\src\com\smartfarmer\platform\MainActivity.java" -Content $javaCode

Write-Host "Compiling resources with aapt2..." -ForegroundColor Cyan
& $aapt2 compile --dir "$workDir\res" -o "$workDir\compiled_res\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "Linking resources with aapt2..." -ForegroundColor Cyan
& $aapt2 link -I $platformJar --manifest "$workDir\AndroidManifest.xml" `
    --java "$workDir\src" `
    -o "$workDir\unaligned.apk" `
    "$workDir\compiled_res\res.zip" `
    --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "Compiling Java sources with javac..." -ForegroundColor Cyan
$javaFiles = Get-ChildItem -Path "$workDir\src" -Filter "*.java" -Recurse | Select-Object -ExpandProperty FullName
& $javac -source 17 -target 17 -cp "$platformJar" -d "$workDir\bin" $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac compilation failed" }

Write-Host "Dexing classes with d8..." -ForegroundColor Cyan
$classFiles = Get-ChildItem -Path "$workDir\bin" -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
cmd.exe /c "`"$d8`" --output `"$workDir`" --lib `"$platformJar`" $($classFiles -join ' ')"
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "Adding classes.dex to APK..." -ForegroundColor Cyan
$pythonScript = @"
import zipfile
with zipfile.ZipFile(r'$workDir\unaligned.apk', 'a') as z:
    z.write(r'$workDir\classes.dex', 'classes.dex')
"@
python -c $pythonScript
if ($LASTEXITCODE -ne 0) { throw "Adding classes.dex to APK failed" }

Write-Host "Zipaligning APK..." -ForegroundColor Cyan
& $zipalign -p -f 4 "$workDir\unaligned.apk" "$workDir\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "Signing APK with apksigner..." -ForegroundColor Cyan
cmd.exe /c "`"$apksigner`" sign --ks `"$keystore`" --ks-pass pass:android --key-pass pass:android --out `"$workDir\smart-farmer.apk`" `"$workDir\aligned.apk`""
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Host "Verifying signed APK..." -ForegroundColor Cyan
cmd.exe /c "`"$apksigner`" verify `"$workDir\smart-farmer.apk`""

# Deploy output
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}
Copy-Item "$workDir\smart-farmer.apk" "$OutputDir\smart-farmer.apk" -Force
$staticDir = "$PSScriptRoot\..\..\web\public\static\downloads"
if (-not (Test-Path $staticDir)) {
    New-Item -ItemType Directory -Path $staticDir -Force | Out-Null
}
Copy-Item "$workDir\smart-farmer.apk" "$staticDir\smart-farmer.apk" -Force

Write-Host "Smart Farmer APK successfully built and published to $OutputDir\smart-farmer.apk!" -ForegroundColor Green
Get-Item "$OutputDir\smart-farmer.apk" | Select-Object Name, Length, LastWriteTime
