# Firebase Realtime Database Rules for Video Call

## Required Setup

Video call signaling uses Firebase Realtime Database (RTD), not Firestore. You must:

1. **Enable Firebase Realtime Database** in Firebase Console
2. **Set the correct security rules**

## IMPORTANT: Rules for Testing

Since the app uses two Firebase SDKs that don't share authentication state, use these permissive rules for development/testing:

```json
{
  "rules": {
    "calls": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Go to Firebase Console → Realtime Database → Rules → Paste the above → Click "Publish"**

## Firebase Console Steps

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `chatlofi-9c2c8`
3. Go to **Realtime Database** in the left sidebar
4. If not created, click **Create Database**
   - Choose your region (asia-southeast1 recommended)
   - Start in **locked mode** (we'll set rules below)
5. Go to **Rules** tab
6. Replace everything with the rules above
7. Click **Publish**

## Security Rules

Go to **Realtime Database → Rules** and paste:

```json
{
  "rules": {
    "calls": {
      "$roomId": {
        // Allow authenticated users to read/write call data
        ".read": "auth != null",
        ".write": "auth != null",
        
        // Validate status field
        "status": {
          ".validate": "newData.isString() && newData.val().matches(/^(ringing|accepted|declined|cancelled|ended)$/)"
        },
        
        // Validate caller/recipient IDs
        "callerId": {
          ".validate": "newData.isString()"
        },
        "recipientId": {
          ".validate": "newData.isString()"
        },
        
        // Allow SDP offer/answer
        "offer": {
          ".validate": "newData.hasChildren(['type', 'sdp'])"
        },
        "answer": {
          ".validate": "newData.hasChildren(['type', 'sdp'])"
        },
        
        // Allow ICE candidates
        "candidates": {
          "$candidateId": {
            ".validate": "newData.hasChildren(['sender', 'candidate'])"
          }
        }
      }
    },
    
    // Default deny all other paths
    ".read": false,
    ".write": false
  }
}
```

## Alternative: Simple Rules (for development only)

If you just want to test quickly:

```json
{
  "rules": {
    "calls": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

⚠️ **Warning**: Simple rules are less secure. Use the full rules above for production.

## Verify Database URL

Make sure your `google-services.json` contains the database URL. If not, add it to Firebase config:

```javascript
// config/firebase.js
const firebaseConfig = {
  // ... existing config
  databaseURL: "https://chatlofi-9c2c8-default-rtdb.asia-southeast1.firebasedatabase.app"
};
```

To find your database URL:
1. Go to Firebase Console → Realtime Database
2. Copy the URL shown at the top (e.g., `https://chatlofi-9c2c8-default-rtdb.asia-southeast1.firebasedatabase.app`)

## Testing

After setting up rules:

1. Build and install the app
2. Login with two accounts on two devices/emulators
3. Start a video call from one device
4. Check the other device receives the call

## Debugging

Check logs for these messages:
- `📞 Getting Firebase Realtime Database instance...` - RTD initialized
- `✅ Call record created in Firebase RTD` - Call created successfully
- `📞 Call status changed:` - Status listener working
- `📞 Nhận được cuộc gọi đến` - Incoming call detected

If you see errors like:
- `PERMISSION_DENIED` - Check your rules
- `❌ ENTIRE CALL WAS DELETED from Firebase RTD!` - Rules may be rejecting writes
