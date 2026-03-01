export default {
  expo: {
    name: "Chat Lofi",
    slug: "chatlofi", // Đảm bảo slug này khớp với dự án trên Expo
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.yourdomain.chatlofi",
      adaptiveIcon: {
        foregroundImage: "./assets/ic_launcher-6677fbdfc5c28/android/playstore-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "CAMERA_ROLL",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET"
      ]
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#006AF5",
      androidMode: "default",
      androidCollapsedTitle: "#{unread_notifications} tin nhắn mới"
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#006AF5"
        }
      ]
    ],
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "ef962822-e60d-4ceb-a0ef-889f1db9c0bb"
      }
    },
    owner: "quy001"
  }
};
