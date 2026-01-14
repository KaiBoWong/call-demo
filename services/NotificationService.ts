import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AndroidVisibility,
  EventType,
} from "@notifee/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import messaging from "@react-native-firebase/messaging"
import { router } from "expo-router"
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { AppState } from "react-native"
import { db } from "../firebase"

const PENDING_NAV_KEY = "pending-incoming-call"

const updateCallSessionStatus = async (
  callSessionId?: string,
  status?: "accepted" | "declined"
) => {
  if (!callSessionId || !status) return
  try {
    await updateDoc(doc(db, "call_sessions", String(callSessionId)), {
      status,
      ...(status === "accepted"
        ? { acceptedAt: serverTimestamp(), declinedAt: null }
        : { declinedAt: serverTimestamp() }),
    })
  } catch (error) {
    console.error("Failed to update call session status:", error)
  }
}

export class NotificationService {
  static appStateSub: any

  static async initialize() {
    await notifee.requestPermission()
    await messaging().requestPermission()

    await notifee.createChannel({
      id: "incoming-call",
      name: "Incoming Calls",
      importance: AndroidImportance.HIGH,
      vibration: true,
      bypassDnd: true,
      visibility: AndroidVisibility.PUBLIC,
    })

    // ✅ 冷启动时立即消费一次
    await this.consumePendingNavigation()

    // ✅ 检查从后台通知启动
    await this.checkInitialNotification()

    // ✅ App 回到前台时消费待导航数据
    this.appStateSub = AppState.addEventListener("change", async (state) => {
      console.log("📱 App state changed to:", state)
      if (state === "active") {
        await this.consumePendingNavigation()
      }
    })
  }

  static cleanup() {
    if (this.appStateSub) {
      this.appStateSub.remove()
    }
  }

  // 前台监听
  static setupForegroundHandler() {
    return messaging().onMessage(async (remoteMessage) => {
      console.log("📱 Foreground message received:", remoteMessage)
      const data = remoteMessage.data

      if (data?.type === "incoming_call" || data?.callType) {
        // ✅ 前台直接跳转，不需要存储
        await this.navigateToIncoming(data)
      }
    })
  }

  // ✅ 统一的导航方法
  static async navigateToIncoming(data: Record<string, any>) {
    console.log("🎯 Navigating to /incoming screen with data:", data)

    try {
      // 显示通知（前台也显示，用户可以从通知栏操作）
      await notifee.displayNotification({
        id: String(data.callSessionId),
        title: `📞 ${data.callerName || "Unknown"} is calling...`,
        body: data.callType === "video" ? "📹 Video Call" : "📱 Voice Call",
        android: {
          channelId: "incoming-call",
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.CALL,
          ongoing: true,
          autoCancel: false,
          pressAction: { id: "default", launchActivity: "default" },
          fullScreenAction: {
            id: "incoming_call_full",
            launchActivity: "default",
            launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
          },
          actions: [
            {
              title: "✅ Accept",
              pressAction: { id: "accept", launchActivity: "default" },
            },
            { title: "❌ Decline", pressAction: { id: "decline" } },
          ],
        },
        data: { ...data, type: "incoming_call" },
      })

      // 导航到来电页面
      router.push({
        pathname: "/incoming",
        params: {
          callerId: String(data.callerId),
          callerName: String(data.callerName),
          receiverId: String(data.receiverId ?? ""),
          receiverName: String(data.receiverName ?? ""),
          currentUserId: String(data.receiverId ?? ""),
          currentUsername: String(data.receiverName ?? ""),
          callType: String(data.callType),
          channelName: String(data.channelName),
          callSessionId: String(data.callSessionId),
        },
      })
    } catch (error) {
      console.error("Error in navigateToIncoming:", error)
    }
  }

  // 处理前台通知按钮点击
  static setupNotificationActionHandler() {
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail
      const data = notification?.data

      console.log("🔔 Foreground event:", type, pressAction?.id)

      // ✅ 用户点击通知本身
      if (type === EventType.PRESS) {
        if (notification?.id) {
          await notifee.cancelNotification(notification.id)
        }
        // 跳转到来电页面
        router.push({
          pathname: "/incoming",
          params: {
            callerId: String(data?.callerId),
            callerName: String(data?.callerName),
            receiverId: String(data?.receiverId ?? ""),
            receiverName: String(data?.receiverName ?? ""),
            currentUserId: String(data?.receiverId ?? ""),
            currentUsername: String(data?.receiverName ?? ""),
            callType: String(data?.callType),
            channelName: String(data?.channelName),
            callSessionId: String(data?.callSessionId),
          },
        })
      }

      // ✅ 用户点击按钮
      if (type === EventType.ACTION_PRESS) {
        if (notification?.id) {
          await notifee.cancelNotification(notification.id)
        }

        if (pressAction?.id === "accept") {
          await updateCallSessionStatus(
            data?.callSessionId as string,
            "accepted"
          )
          router.replace({
            pathname: "/call",
            params: {
              receiverId: data?.callerId as string,
              receiverName: data?.callerName as string,
              currentUserId: String(data?.receiverId ?? ""),
              currentUsername: String(data?.receiverName ?? ""),
              callType: data?.callType as string,
              channelName: data?.channelName as string,
              callSessionId: data?.callSessionId as string,
            },
          })
        } else if (pressAction?.id === "decline") {
          await updateCallSessionStatus(
            data?.callSessionId as string,
            "declined"
          )
          // 可选：返回首页
          router.replace("/")
        }
      }
    })
  }

  // ✅ 检查应用启动时的通知（从完全关闭状态点击通知启动）
  static async checkInitialNotification() {
    console.log("🔍 Checking initial notification...")

    const initialNotification = await notifee.getInitialNotification()
    console.log("📋 Initial notification:", initialNotification)

    if (initialNotification?.notification?.data?.type === "incoming_call") {
      const data = initialNotification.notification.data
      console.log("✅ Found incoming call from initial notification")

      // ✅ 存储待导航数据，由 consumePendingNavigation 处理
      await AsyncStorage.setItem(
        PENDING_NAV_KEY,
        JSON.stringify({ ...data, action: "incoming" })
      )
    }
  }

  // ✅ 从存储读取待导航数据并跳转
  static async consumePendingNavigation() {
    try {
      const json = await AsyncStorage.getItem(PENDING_NAV_KEY)
      if (!json) {
        console.log("🔍 No pending navigation found")
        return
      }

      console.log("📦 Found pending navigation:", json)
      await AsyncStorage.removeItem(PENDING_NAV_KEY)

      const data = JSON.parse(json)
      const action = data?.action || "incoming"

      console.log("🎯 Executing pending action:", action)

      // ✅ 延迟确保路由系统已准备好
      setTimeout(() => {
        if (action === "call") {
          router.replace({
            pathname: "/call",
            params: {
              receiverId: String(data?.callerId ?? ""),
              receiverName: String(data?.callerName ?? ""),
              currentUserId: String(data?.receiverId ?? ""),
              currentUsername: String(data?.receiverName ?? ""),
              callType: String(data?.callType ?? "audio"),
              channelName: String(data?.channelName ?? ""),
              callSessionId: String(data?.callSessionId ?? ""),
            },
          })
        } else if (action === "declined") {
          // 拒绝后返回首页
          router.replace("/")
        } else {
          // 默认：跳转到来电页面
          router.replace({
            pathname: "/incoming",
            params: {
              callerId: String(data?.callerId ?? ""),
              callerName: String(data?.callerName ?? ""),
              callType: String(data?.callType ?? "audio"),
              channelName: String(data?.channelName ?? ""),
              callSessionId: String(data?.callSessionId ?? ""),
            },
          })
        }
      }, 500)
    } catch (error) {
      console.error("❌ Failed to consume pending navigation:", error)
    }
  }
}

// ✅ 后台消息处理器 - 只显示通知和存储数据
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("🔔 Background message received:", remoteMessage)
  const data = remoteMessage.data

  if (data?.callType) {
    console.log("💾 Storing pending navigation data")

    // ✅ 存储待导航数据
    await AsyncStorage.setItem(
      PENDING_NAV_KEY,
      JSON.stringify({ ...data, action: "incoming" })
    )

    // ✅ 显示全屏通知（会自动唤醒屏幕和启动应用）
    await notifee.displayNotification({
      id: String(data.callSessionId),
      title: `📞 ${data.callerName || "Unknown"} is calling...`,
      body: data.callType === "video" ? "📹 Video Call" : "📱 Voice Call",
      android: {
        channelId: "incoming-call",
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,
        ongoing: true,
        autoCancel: false,

        // ✅ 全屏意图 - 这会唤醒应用
        fullScreenAction: {
          id: "default",
          // 这里的 launchActivity 是关键，它会唤醒你的 App
          launchActivity: "default",
        },

        pressAction: { id: "default", launchActivity: "default" },

        actions: [
          {
            title: "✅ Accept",
            pressAction: { id: "accept", launchActivity: "default" },
          },
          { title: "❌ Decline", pressAction: { id: "decline" } },
        ],
      },
      data: { ...data, type: "incoming_call" },
    })

    console.log("✅ Background notification displayed with full screen intent")
  }
})

// ✅ 后台通知交互处理器
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail
  const data = notification?.data

  console.log("🔔 Background event:", type, pressAction?.id)

  // ✅ 用户点击通知本身
  if (type === EventType.PRESS) {
    console.log("📱 Notification pressed in background")
    if (notification?.id) {
      await notifee.cancelNotification(notification.id)
    }
    // 存储导航数据，应用启动后会自动跳转
    await AsyncStorage.setItem(
      PENDING_NAV_KEY,
      JSON.stringify({ ...data, action: "incoming" })
    )
  }

  // ✅ 用户点击按钮
  if (type === EventType.ACTION_PRESS) {
    if (notification?.id) {
      await notifee.cancelNotification(notification.id)
    }

    if (pressAction?.id === "accept") {
      console.log("✅ Accept clicked in background")
      await updateCallSessionStatus(data?.callSessionId as string, "accepted")
      // 存储数据，启动后跳转到通话页面
      await AsyncStorage.setItem(
        PENDING_NAV_KEY,
        JSON.stringify({ ...data, action: "call" })
      )
    } else if (pressAction?.id === "decline") {
      console.log("❌ Decline clicked in background")
      await updateCallSessionStatus(data?.callSessionId as string, "declined")
      // 存储数据，启动后返回首页
      await AsyncStorage.setItem(
        PENDING_NAV_KEY,
        JSON.stringify({ ...data, action: "declined" })
      )
    }
  }
})
