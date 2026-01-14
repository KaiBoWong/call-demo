# Call Demo – Setup & Call Flow

## Setup
1. Install deps  
   `npm install`
2. Prebuild native (cleans ios/android)  
   `npx expo prebuild --clean`
3. Run on Android  
   `npm run android`

## Call Logic
1) **Caller flow**
   - Tap Call/Video in contacts.
   - Look up `users` to get callee `fcmToken`.
   - Create `call_sessions` (status `ringing`, store caller/receiver, channelName, callType).
   - Send an FCM data-only message with caller/receiver info, `callSessionId`, `channelName`, `callType`.
   - Navigate caller to `/call` and create Agora UID from `currentUserId`.
2) **Callee flow**
   - Foreground: `messaging().onMessage` → `NotificationService.navigateToIncoming` shows in-app notification and routes to `/incoming`.
   - Background/cold start: `setBackgroundMessageHandler` + Notifee show a full-screen notification and store payload; when app wakes, stored data is consumed to navigate.
   - Notification actions: Accept writes `status=accepted` then routes to `/call`; Decline writes `status=declined` then routes home.
3) **In call**
   - `/call` starts a timer once remote UID joins, periodically syncs `duration` to `call_sessions`, and on hangup writes `status=ended/declined`.

## How Full-Screen Incoming UI Is Triggered
- **Message shape**: FCM data-only, high priority (Android `priority=high`; APNs optional `content-available:1`).
- **Notifee display**: Background handler calls `notifee.displayNotification` with `fullScreenAction` and `ongoing`, then `openApp()` to wake the app.
- **Navigation restore**: Incoming payload is saved to AsyncStorage; `NotificationService.consumePendingNavigation` reads it on app resume/start and `router.replace("/incoming" | "/call")` so even killed apps reopen the incoming screen.
- **Identity propagation**: FCM carries `callerId/callerName` and `receiverId/receiverName`; incoming page forwards `currentUserId` into `/call` so the callee joins with their own UID.
