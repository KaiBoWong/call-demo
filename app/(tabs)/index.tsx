import Ionicons from "@expo/vector-icons/Ionicons"
import messaging from "@react-native-firebase/messaging"
import * as Device from "expo-device"
import { router } from "expo-router"
import { getApp } from "firebase/app"
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Toast from "react-native-toast-message"
import { sendFCMNotification } from "../../services/fcmService"
import { useSession } from "../session/SessionProvider"

const ACCENT = "#0A84FF"

type ContactPerson = {
  id: string
  username: string
  phoneNumber: string
  createdBy: string
  createdAt?: any
}

export default function UserListScreen() {
  const [username, setUsername] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [contacts, setContacts] = useState<ContactPerson[]>([])
  const [pendingCall, setPendingCall] = useState<{
    id: string
    type: "audio" | "video"
  } | null>(null)
  const { session, signOut } = useSession()

  const currentUser = session ? JSON.parse(session) : null
  const CURRENT_USER_ID = currentUser?.id || "unknown"
  const CURRENT_USERNAME = currentUser?.username || "Unknown"

  const db = getFirestore(getApp())

  useEffect(() => {
    registerForPushToken()
  }, [])

  useEffect(() => {
    if (!CURRENT_USER_ID) return

    const q = query(
      collection(db, "contact_persons"),
      where("createdBy", "==", CURRENT_USER_ID)
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const list: ContactPerson[] = []
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ContactPerson, "id">),
        })
      })
      setContacts(list)
    })

    return unsub
  }, [CURRENT_USER_ID])

  const registerForPushToken = async () => {
    try {
      // 请求通知权限
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL

      if (!enabled) {
        console.log("Permission not granted")
        return
      }

      // 获取 FCM Token
      const fcmToken = await messaging().getToken()
      console.log("FCM Token:", fcmToken)

      // 保存到 Firestore
      await setDoc(
        doc(db, "users", CURRENT_USER_ID),
        {
          username: CURRENT_USERNAME,
          fcmToken: fcmToken,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      // 监听 token 刷新
      messaging().onTokenRefresh(async (newToken) => {
        console.log("Token refreshed:", newToken)
        await setDoc(
          doc(db, "users", CURRENT_USER_ID),
          { fcmToken: newToken, updatedAt: serverTimestamp() },
          { merge: true }
        )
      })
    } catch (error) {
      console.error("Error registering for push token:", error)
    }
  }

  const addContact = async () => {
    if (!username.trim()) {
      Alert.alert("Error", "Please enter a username")
      return
    }

    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter a phone number")
      return
    }

    const phoneRegex = /^[0-9+\-\s()]+$/
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert("Error", "Please enter a valid phone number")
      return
    }

    try {
      await addDoc(collection(db, "contact_persons"), {
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        createdBy: CURRENT_USER_ID,
        createdByUsername: CURRENT_USERNAME,
        createdAt: serverTimestamp(),
      })

      setUsername("")
      setPhoneNumber("")
      Alert.alert("Success", "Contact added successfully!")
    } catch (error) {
      console.error("Error adding contact:", error)
      Alert.alert("Error", "Failed to add contact. Please try again.")
    }
  }

  /**
   * 创建通话会话记录
   * 这个函数会在 Firestore 中创建一个完整的通话记录
   */
  const createCallSession = async ({
    callerId,
    callerName,
    receiverId,
    receiverName,
    receiverPhone,
    callType,
    channelName,
  }: {
    callerId: string
    callerName: string
    receiverId: string
    receiverName: string
    receiverPhone: string
    callType: "audio" | "video"
    channelName: string
  }) => {
    try {
      // 创建通话会话文档
      const callSessionRef = await addDoc(collection(db, "call_sessions"), {
        // 通话基本信息
        channelName,
        callType,
        status: "ringing", // ringing, accepted, declined, missed, ended

        // 主叫方信息
        callerId,
        callerName,

        // 被叫方信息
        receiverId,
        receiverName,
        receiverPhone,

        // 时间戳
        createdAt: serverTimestamp(), // 发起通话时间
        ringingAt: serverTimestamp(), // 开始响铃时间
        acceptedAt: null, // 接听时间（稍后更新）
        declinedAt: null, // 拒绝时间
        endedAt: null, // 结束时间

        // 通话时长（秒）
        duration: 0,

        // 额外信息
        deviceInfo: {
          platform: Device.osName,
          osVersion: Device.osVersion,
        },
      })

      console.log("Call session created:", callSessionRef.id)
      return callSessionRef.id
    } catch (error) {
      console.error("Error creating call session:", error)
      throw error
    }
  }

  const goToCall = async (
    contact: ContactPerson,
    callType: "audio" | "video"
  ) => {
    let isMounted = true
    setPendingCall({ id: contact.id, type: callType })

    try {
      // 1. 查找接收方用户
      const usersQuery = query(
        collection(db, "users"),
        where("phoneNumber", "==", contact.phoneNumber)
      )

      const usersSnapshot = await getDocs(usersQuery)

      if (usersSnapshot.empty) {
        // 延迟 50ms 确保 Activity 已挂载
        setTimeout(() => {
          if (isMounted) {
            Toast.show({
              type: "error",
              text1: `${contact.username} has not registered in the app yet.`,
              props: { id: Date.now() },
            })
          }
        }, 50)

        return
      }

      const receiverDoc = usersSnapshot.docs[0]
      const receiverData = receiverDoc.data()
      const receiverId = receiverDoc.id
      const fcmToken = receiverData.fcmToken

      if (!fcmToken) {
        setTimeout(() => {
          if (isMounted) {
            Toast.show({
              type: "error",
              text1: `${contact.username} is not available to receive calls.`,
              props: { id: Date.now() },
            })
          }
        }, 50)
        return
      }

      // 2. 生成唯一的频道名
      const channelName = `call_${CURRENT_USER_ID}_${receiverId}_${Date.now()}`

      // 3. 创建通话会话记录
      const callSessionId = await createCallSession({
        callerId: CURRENT_USER_ID,
        callerName: CURRENT_USERNAME,
        receiverId,
        receiverName: contact.username,
        receiverPhone: contact.phoneNumber,
        callType,
        channelName,
      })

      const targetToken = receiverData.fcmToken
      console.log("🚀 Sending FCM to User B...", targetToken)
      console.log("🚀 Target", targetToken)

      await sendFCMNotification(targetToken, CURRENT_USERNAME, {
        type: "incoming_call",
        callerId: CURRENT_USER_ID,
        callerName: CURRENT_USERNAME,
        receiverId,
        receiverName: contact.username,
        callType: callType,
        channelName: channelName,
        callSessionId: callSessionId, // 关键：传给对方，对方接听时才知道是哪个会话
      })

      // 5. 进入通话页面
      router.push({
        pathname: "/call",
        params: {
          receiverId,
          receiverName: contact.username,
          receiverPhone: contact.phoneNumber,
          currentUserId: CURRENT_USER_ID,
          currentUsername: CURRENT_USERNAME,
          callType,
          channelName,
          callSessionId,
        },
      })
    } catch (error) {
      console.error("Error initiating call:", error)
      setTimeout(() => {
        if (isMounted) {
          Toast.show({
            type: "error",
            text1: "Failed to start call. Please try again.",
            props: { id: Date.now() },
          })
        }
      }, 50)
    } finally {
      setPendingCall(null)
    }

    // 清理函数，避免组件卸载时调用 Alert
    return () => {
      isMounted = false
    }
  }

  // useEffect(() => {
  //   if (!CURRENT_USER_ID || CURRENT_USER_ID === "unknown") return

  //   console.log("👂 Started listening for incoming calls for:", CURRENT_USER_ID)

  //   // 查询 call_sessions 中 receiverId 等于当前用户的文档
  //   const q = query(
  //     collection(db, "call_sessions"),
  //     where("receiverId", "==", CURRENT_USER_ID),
  //     where("status", "==", "ringing")
  //   )

  //   const unsubscribe = onSnapshot(
  //     q,
  //     (snapshot) => {
  //       snapshot.docChanges().forEach((change) => {
  //         if (change.type === "added") {
  //           const data = change.doc.data()
  //           const callSessionId = change.doc.id

  //           console.log("📞 Incoming call from:", data.callerName)
  //           console.log("📋 Call session ID:", callSessionId)

  //           // 跳转到来电页面
  //           router.push({
  //             pathname: "/incoming",
  //             params: {
  //               callerId: data.callerId,
  //               callerName: data.callerName,
  //               callType: data.callType,
  //               channelName: data.channelName,
  //               callSessionId: callSessionId,
  //             },
  //           })
  //         }
  //       })
  //     },
  //     (error) => {
  //       console.error("❌ Error listening to call sessions:", error)
  //     }
  //   )

  //   return () => {
  //     console.log("👋 Stopped listening for incoming calls")
  //     unsubscribe()
  //   }
  // }, [CURRENT_USER_ID])

  const renderContact = ({ item }: { item: ContactPerson }) => (
    <TouchableOpacity
      style={styles.userCard}
      activeOpacity={0.9}
      onPress={() => goToCall(item, "audio")}
      disabled={!!pendingCall}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.username?.slice(0, 1)?.toUpperCase() ?? "?"}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.subtext}>{item.phoneNumber}</Text>
      </View>
      <View style={styles.callActions}>
        <TouchableOpacity
          style={[
            styles.callPill,
            styles.callPillAudio,
            pendingCall && styles.callPillDisabled,
          ]}
          activeOpacity={0.85}
          onPress={() => goToCall(item, "audio")}
          disabled={!!pendingCall}
        >
          {pendingCall?.id === item.id && pendingCall.type === "audio" ? (
            <ActivityIndicator color={ACCENT} />
          ) : (
            <>
              <Ionicons name="call" size={18} color={ACCENT} />
              <Text style={styles.callPillLabel}>Call</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.callPill,
            styles.callPillVideo,
            pendingCall && styles.callPillDisabled,
          ]}
          activeOpacity={0.85}
          onPress={() => goToCall(item, "video")}
          disabled={!!pendingCall}
        >
          {pendingCall?.id === item.id && pendingCall.type === "video" ? (
            <ActivityIndicator color="#34C759" />
          ) : (
            <>
              <Ionicons name="videocam" size={18} color="#34C759" />
              <Text style={styles.callPillLabel}>Video</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>My Contacts</Text>
            <Text style={styles.subtitle}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={signOut}
              style={styles.logoutBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={16} color="#ffffff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
            <View style={styles.badge}>
              <Ionicons name="call" size={18} color={ACCENT} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Add new contact</Text>
            <Text style={styles.cardHint}>
              Create your personal contact list
            </Text>
          </View>

          <View style={styles.inputRow}>
            <Ionicons
              name="person-outline"
              size={20}
              color={ACCENT}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter name"
              placeholderTextColor="#8E8E93"
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputRow}>
            <Ionicons
              name="call-outline"
              size={20}
              color={ACCENT}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor="#8E8E93"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={addContact}>
            <Ionicons
              name="add-circle-outline"
              size={20}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryText}>Add Contact</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-circle" size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No contacts yet</Text>
              <Text style={styles.emptyText}>
                Add your first contact to start calling.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F7",
  },
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 15, color: "#6B7280", marginTop: 4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#ed0e42ff",
  },
  logoutText: { color: "#ffff", fontSize: 14, fontWeight: "600" },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(10,132,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: { gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  cardHint: { fontSize: 13, color: "#8E8E93" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  listContent: { paddingBottom: 24 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(10,132,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: ACCENT, fontSize: 18, fontWeight: "700" },
  meta: { flex: 1, gap: 3 },
  name: { fontSize: 17, fontWeight: "600", color: "#111827" },
  subtext: { fontSize: 13, color: "#8E8E93" },
  callActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  callPill: {
    minWidth: 84,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  callPillAudio: { backgroundColor: "rgba(10,132,255,0.14)" },
  callPillVideo: { backgroundColor: "rgba(52,199,89,0.16)" },
  callPillLabel: { color: "#0F172A", fontSize: 13, fontWeight: "600" },
  callPillDisabled: { opacity: 0.6 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  emptyText: { fontSize: 14, color: "#8E8E93" },
})
