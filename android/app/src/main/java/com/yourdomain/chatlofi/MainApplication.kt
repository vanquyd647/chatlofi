package com.yourdomain.chatlofi

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.res.Configuration
import android.media.AudioAttributes
import android.os.Build
import androidx.annotation.NonNull
import androidx.core.app.NotificationManagerCompat

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {

      override fun getPackages(): List<ReactPackage> {
        // ✅ Chỉ dùng autolinking, KHÔNG tự add ReactNativeFirebaseAppPackage nữa
        return PackageList(this).packages
      }

      override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
  )

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (!BuildConfig.REACT_NATIVE_UNSTABLE_USE_RUNTIME_SCHEDULER_ALWAYS) {
      ReactFeatureFlags.unstable_useRuntimeSchedulerAlways = false
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    if (BuildConfig.DEBUG) {
      ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    
    // Create notification channels for Android O+
    createNotificationChannels()
  }
  
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(NotificationManager::class.java)
      
      // Audio attributes for notification sound
      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      
      // Messages channel - High priority like Facebook Messenger
      val messagesChannel = NotificationChannel(
        "messages",
        "Tin nhắn",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Thông báo tin nhắn mới"
        enableLights(true)
        lightColor = 0xFF006AF5.toInt()
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 300, 200, 300) // Rung mạnh hơn
        setShowBadge(true)
        setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        setBypassDnd(false)
      }
      
      // Friend requests channel
      val friendRequestsChannel = NotificationChannel(
        "friend_requests",
        "Lời mời kết bạn",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Thông báo lời mời kết bạn"
        enableLights(true)
        lightColor = 0xFF006AF5.toInt()
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 300, 200, 300)
        setShowBadge(true)
        setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }
      
      // Posts channel
      val postsChannel = NotificationChannel(
        "posts",
        "Bài viết mới",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Thông báo bài viết mới từ bạn bè"
        enableLights(true)
        lightColor = 0xFF006AF5.toInt()
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 200, 100, 200)
        setShowBadge(true)
        setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
      }
      
      // Default channel
      val defaultChannel = NotificationChannel(
        "default",
        "Thông báo chung",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Các thông báo khác"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 200, 100, 200)
        setShowBadge(true)
        setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
      }
      
      notificationManager?.createNotificationChannels(listOf(
        messagesChannel,
        friendRequestsChannel,
        postsChannel,
        defaultChannel
      ))
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
