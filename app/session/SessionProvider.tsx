import messaging from "@react-native-firebase/messaging"
import { useRouter } from "expo-router"
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import { PermissionsAndroid, Platform } from "react-native"
import { db } from "../../firebase"

interface AuthContextType {
  me: () => Promise<void>
  signIn: (payload: { username: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  session: string | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useSession() {
  const value = useContext(AuthContext)
  if (!value)
    throw new Error("useSession must be wrapped in <SessionProvider />")
  return value
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const getFCMToken = async (): Promise<string | null> => {
    try {
      console.log("1. Starting FCM token retrieval...")

      // Android 13+ 需要运行时权限
      if (Platform.OS === "android" && Platform.Version >= 33) {
        console.log("2. Requesting Android notification permission...")
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        )

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log("Android notification permission denied")
          return null
        }
      }

      // 请求推送通知权限
      console.log("3. Requesting messaging permission...")
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL

      if (!enabled) {
        console.log("Push notification permission not granted")
        return null
      }

      console.log("4. Permission granted, auth status:", authStatus)

      // iOS: 注册远程通知
      if (Platform.OS === "ios") {
        console.log("5. Registering iOS device for remote messages...")
        await messaging().registerDeviceForRemoteMessages()
        const isRegistered = messaging().isDeviceRegisteredForRemoteMessages
        console.log("6. iOS device registered:", isRegistered)
      }

      // 获取 FCM token
      console.log("7. Getting FCM token...")
      const token = await messaging().getToken()
      console.log("8. FCM Token obtained:", token.substring(0, 30) + "...")

      return token
    } catch (error) {
      console.error("Error getting FCM token:", error)
      return null
    }
  }

  const saveFCMToken = async (userId: string, token: string | null) => {
    if (!token) return
    try {
      const userRef = doc(db, "users", userId)
      await setDoc(userRef, { fcmToken: token }, { merge: true })
      console.log("FCM token saved to Firestore")
    } catch (error) {
      console.error("Error saving FCM token:", error)
    }
  }

  // 监听 token 刷新和前台消息
  useEffect(() => {
    // 监听 token 刷新
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(
      async (newToken) => {
        console.log("FCM Token refreshed:", newToken)

        // 如果用户已登录，更新 token
        if (session) {
          try {
            const user = JSON.parse(session)
            await saveFCMToken(user.id, newToken)

            // 更新本地 session
            const updatedUser = { ...user, fcmToken: newToken }
            setSession(JSON.stringify(updatedUser))
          } catch (error) {
            console.error("Error updating refreshed token:", error)
          }
        }
      }
    )

    // 监听前台消息
    const unsubscribeForeground = messaging().onMessage(
      async (remoteMessage) => {
        console.log("Foreground message received:", remoteMessage)
        // 这里可以显示本地通知或处理消息
      }
    )

    return () => {
      unsubscribeTokenRefresh()
      unsubscribeForeground()
    }
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        me: async () => {},
        signIn: async ({ username, password }) => {
          setIsLoading(true)
          try {
            console.log("Signing in user:", username)

            const q = query(
              collection(db, "users"),
              where("username", "==", username)
            )
            const snapshot = await getDocs(q)

            if (snapshot.empty) {
              console.warn("User not found")
              setSession(null)
              return
            }

            const docSnap = snapshot.docs[0]
            const data = docSnap.data() as { password?: string }

            // 获取并保存 FCM token
            const token = await getFCMToken()
            if (token) {
              await saveFCMToken(docSnap.id, token)
            }

            const userPayload = { id: docSnap.id, ...data, fcmToken: token }
            setSession(JSON.stringify(userPayload))

            console.log("Sign in successful")
            router.replace("/")
          } catch (err) {
            console.error("Sign in failed:", err)
            setSession(null)
          } finally {
            setIsLoading(false)
          }
        },
        signOut: async () => {
          setSession(null)
          router.replace("/sign-in")
        },
        session,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default SessionProvider
