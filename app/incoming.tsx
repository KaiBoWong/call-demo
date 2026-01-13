import Ionicons from "@expo/vector-icons/Ionicons"
import { router, useLocalSearchParams } from "expo-router"
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { db } from "../firebase"

type Params = {
  callerId?: string
  callerName?: string
  callType?: string // ✅ 新增
  channelName?: string // ✅ 新增：接收频道名
  callSessionId?: string // ✅ 新增：通话会话ID
  receiverId?: string
  receiverName?: string
  currentUserId?: string
  currentUsername?: string
}

const ACCENT = "#0A84FF"
const DECLINE = "#FF3B30"
const ACCEPT = "#34C759"
const SUBTLE = "rgba(255,255,255,0.7)"

export default function IncomingScreen() {
  // ✅ 获取所有必要的参数
  const {
    callerId,
    callerName,
    callType,
    channelName,
    callSessionId,
    receiverId,
    receiverName,
    currentUserId,
    currentUsername,
  } = useLocalSearchParams<Params>()

  const displayName = callerName
    ? String(callerName)
    : callerId
    ? String(callerId)
    : "Unknown caller"
  const initial = displayName.charAt(0).toUpperCase()

  const updateStatus = async (status: "accepted" | "declined") => {
    if (!callSessionId) return
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

  const handleDecline = async () => {
    await updateStatus("declined")
    router.replace("/")
  }

  const handleAccept = async () => {
    await updateStatus("accepted")
    // ✅ 传递所有参数，包括 channelName
    router.replace({
      pathname: "/call",
      params: {
        receiverId: callerId ?? "contact",
        receiverName: displayName,
        currentUserId: currentUserId ?? receiverId ?? "",
        currentUsername: currentUsername ?? receiverName ?? "",
        callType: callType ?? "audio",
        channelName: channelName, // ✅ 传递频道名
        callSessionId: callSessionId, // ✅ 传递会话ID
      },
    })
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.blobOne} />
      <View style={styles.blobTwo} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.muted}>
            {callType === "video" ? "Video Call" : "Audio Call"}
          </Text>
          <Text style={styles.status}>Incoming call</Text>
        </View>

        <View style={styles.center}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtext}>Secured end-to-end</Text>
        </View>

        <View style={styles.actions}>
          <CallAction
            color={DECLINE}
            icon="close"
            label="Decline"
            onPress={handleDecline}
          />
          <CallAction
            color={ACCEPT}
            icon="call"
            label="Accept"
            onPress={handleAccept}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

type CallActionProps = {
  color: string
  icon: any
  label: string
  onPress: () => void
}

function CallAction({ color, icon, label, onPress }: CallActionProps) {
  return (
    <View style={styles.action}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.actionCircle, { backgroundColor: color }]}
        onPress={onPress}
      >
        <Ionicons name={icon} size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0C1626",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    justifyContent: "space-between",
  },
  blobOne: {
    position: "absolute",
    width: 260,
    height: 260,
    backgroundColor: "rgba(10,132,255,0.20)",
    borderRadius: 220,
    top: -80,
    right: -60,
  },
  blobTwo: {
    position: "absolute",
    width: 240,
    height: 240,
    backgroundColor: "rgba(52,199,89,0.18)",
    borderRadius: 220,
    bottom: -70,
    left: -50,
  },
  header: { gap: 4, marginTop: 8 },
  muted: { color: SUBTLE, fontSize: 14 },
  status: { color: "#fff", fontSize: 18, fontWeight: "600" },
  center: { alignItems: "center", gap: 12, marginTop: 40 },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarText: { fontSize: 52, fontWeight: "700", color: "#fff" },
  name: { fontSize: 30, fontWeight: "700", color: "#fff" },
  subtext: { fontSize: 15, color: SUBTLE },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  action: { alignItems: "center", gap: 10 },
  actionCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  actionLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
})
