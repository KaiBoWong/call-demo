import Ionicons from "@expo/vector-icons/Ionicons"
import { router, useLocalSearchParams } from "expo-router"
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  VideoSourceType,
} from "react-native-agora"
import { SafeAreaView } from "react-native-safe-area-context"
import { db } from "../firebase"

const APP_ID = "0f4271f194f8427287cebe05deef5f7e"
const TOKEN = "" // 测试环境可以为空，生产环境需要 token

type Params = {
  receiverId?: string
  receiverName?: string
  callType?: "audio" | "video"
  channelName?: string
  currentUserId?: string
  callSessionId?: string
}

const ACCENT = "#0A84FF"
const SUBTLE = "rgba(255,255,255,0.6)"

export default function CallScreen() {
  const {
    receiverId,
    receiverName,
    callType,
    channelName: routeChannelName,
    currentUserId,
    callSessionId,
  } = useLocalSearchParams<Params>()

  const displayName = receiverName
    ? String(receiverName)
    : receiverId
    ? String(receiverId)
    : "Contact"
  const isVideo = callType === "video"

  const initial = useMemo(
    () => displayName.charAt(0).toUpperCase(),
    [displayName]
  )

  // ✅ 生成一个稳定的 UID（重要！）
  const localUid = useMemo(() => {
    if (currentUserId) {
      // 使用用户ID的哈希值生成唯一的数字UID
      const hash = String(currentUserId)
        .split("")
        .reduce((acc, char) => {
          return (acc << 5) - acc + char.charCodeAt(0)
        }, 0)
      return Math.abs(hash) % 100000000 // 确保是正数且不会太大
    }
    return Math.floor(Math.random() * 100000000)
  }, [currentUserId])

  // Agora states
  const agoraEngineRef = useRef<IRtcEngine | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [remoteUid, setRemoteUid] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)
  const [dialString, setDialString] = useState("")
  const [callStartTime, setCallStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationSyncRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const channelName = useMemo(() => {
    if (routeChannelName) {
      return String(routeChannelName)
    }
    console.warn("⚠️ No channelName provided, generating fallback")
    return receiverId
      ? `call_${receiverId}_${Date.now()}`
      : `call_${Date.now()}`
  }, [routeChannelName, receiverId])

  const updateCallSession = useCallback(
    async (data: Record<string, any>) => {
      if (!callSessionId) return
      try {
        await updateDoc(doc(db, "call_sessions", String(callSessionId)), data)
      } catch (error) {
        console.error("Failed to update call session:", error)
      }
    },
    [callSessionId]
  )

  const startTimerIfNeeded = useCallback(() => {
    if (callStartTime) return
    const now = Date.now()
    setCallStartTime(now)
    setElapsedSeconds(0)
    updateCallSession({
      status: "accepted",
      acceptedAt: serverTimestamp(),
      declinedAt: null,
    })
  }, [callStartTime, updateCallSession])

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (durationSyncRef.current) {
      clearInterval(durationSyncRef.current)
      durationSyncRef.current = null
    }
  }, [])

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`
  }

  useEffect(() => {
    setupAgoraEngine()

    return () => {
      clearTimers()
      cleanup()
    }
  }, [clearTimers])

  useEffect(() => {
    if (remoteUid !== 0) {
      startTimerIfNeeded()
    }
  }, [remoteUid, startTimerIfNeeded])

  useEffect(() => {
    if (!callStartTime) return
    timerRef.current = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - callStartTime) / 1000)
      )
      setElapsedSeconds(seconds)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callStartTime])

  useEffect(() => {
    if (!callStartTime || !callSessionId) return

    durationSyncRef.current = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - callStartTime) / 1000)
      )
      updateCallSession({ duration: seconds })
    }, 5000)

    return () => {
      if (durationSyncRef.current) clearInterval(durationSyncRef.current)
    }
  }, [callStartTime, callSessionId, updateCallSession])

  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      const permissions = isVideo
        ? [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ]
        : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]

      const result = await PermissionsAndroid.requestMultiple(permissions)
      console.log("📱 Permissions result:", result)
    }
  }

  const setupAgoraEngine = async () => {
    try {
      console.log("🚀 Initializing Agora with:")
      console.log("  - Channel:", channelName)
      console.log("  - Local UID:", localUid)
      console.log("  - Call Type:", isVideo ? "Video" : "Audio")

      await requestPermissions()

      const engine = createAgoraRtcEngine()
      agoraEngineRef.current = engine

      // ✅ 初始化引擎
      engine.initialize({
        appId: APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      })

      // ✅ 设置视频配置（即使是音频通话也设置，以备切换）
      engine.setVideoEncoderConfiguration({
        dimensions: { width: 640, height: 480 },
        frameRate: 15,
        bitrate: 0,
      })

      // ✅ 启用视频或音频
      if (isVideo) {
        await engine.enableVideo()
        await engine.startPreview()
        console.log("📹 Video enabled and preview started")
      } else {
        await engine.enableAudio()
        console.log("🎤 Audio enabled")
      }

      // ✅ 设置音频配置
      engine.setAudioProfile(
        1, // 音乐音质
        3 // 游戏流畅
      )

      // ✅ 视频通话默认使用扬声器
      if (isVideo) {
        engine.setDefaultAudioRouteToSpeakerphone(true)
        engine.setEnableSpeakerphone(true)
      }

      // ✅ 注册事件处理器
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log("✅ Successfully joined channel:", channelName)
          console.log("  - Connection:", connection)
          console.log("  - Elapsed:", elapsed)
          setIsJoined(true)
        },
        onUserJoined: (connection, uid, elapsed) => {
          console.log("✅ Remote user joined:", uid)
          console.log("  - Connection:", connection)
          console.log("  - Elapsed:", elapsed)
          setRemoteUid(uid)
        },
        onUserOffline: (connection, uid, reason) => {
          console.log("👋 Remote user left:", uid)
          console.log("  - Reason:", reason)
          setRemoteUid(0)
        },
        onError: (err, msg) => {
          console.error("❌ Agora error:", err, msg)
        },
        onRemoteVideoStateChanged: (
          connection,
          uid,
          state,
          reason,
          elapsed
        ) => {
          console.log("📹 Remote video state changed:")
          console.log("  - UID:", uid)
          console.log("  - State:", state) // 0: stopped, 1: decoding, 2: frozen
          console.log("  - Reason:", reason)
        },
        onRemoteAudioStateChanged: (
          connection,
          uid,
          state,
          reason,
          elapsed
        ) => {
          console.log("🔊 Remote audio state changed:")
          console.log("  - UID:", uid)
          console.log("  - State:", state)
          console.log("  - Reason:", reason)
        },
      })

      // ✅ 加入频道
      await joinChannel()
    } catch (error) {
      console.error("❌ Failed to initialize Agora:", error)
    }
  }

  const joinChannel = async () => {
    try {
      console.log("🔗 Joining channel with UID:", localUid)

      // ✅ 使用稳定的 UID 加入频道
      await agoraEngineRef.current?.joinChannel(TOKEN, channelName, localUid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      })
    } catch (error) {
      console.error("❌ Failed to join channel:", error)
    }
  }

  const cleanup = async () => {
    try {
      console.log("🧹 Cleaning up Agora...")
      await agoraEngineRef.current?.leaveChannel()
      agoraEngineRef.current?.release()
    } catch (error) {
      console.error("Failed to cleanup:", error)
    }
  }

  const toggleMute = () => {
    agoraEngineRef.current?.muteLocalAudioStream(!isMuted)
    setIsMuted(!isMuted)
    console.log(isMuted ? "🎤 Unmuted" : "🔇 Muted")
  }

  const toggleSpeaker = () => {
    agoraEngineRef.current?.setEnableSpeakerphone(!isSpeakerOn)
    setIsSpeakerOn(!isSpeakerOn)
    console.log(isSpeakerOn ? "🔈 Speaker off" : "🔊 Speaker on")
  }

  const toggleCamera = () => {
    if (isVideo) {
      agoraEngineRef.current?.muteLocalVideoStream(!isVideoEnabled)
      setIsVideoEnabled(!isVideoEnabled)
      console.log(isVideoEnabled ? "📹 Video off" : "📹 Video on")
    }
  }

  const flipCamera = () => {
    agoraEngineRef.current?.switchCamera()
    setIsFrontCamera(!isFrontCamera)
    console.log(
      isFrontCamera
        ? "🤳 Switching to back camera"
        : "🤳 Switching to front camera"
    )
  }

  const toggleKeypad = () => {
    setShowKeypad((prev) => !prev)
  }

  const handleKeyPress = (key: string) => {
    if (key === "⌫") {
      setDialString((prev) => prev.slice(0, -1))
      return
    }
    setDialString((prev) => `${prev}${key}`)
  }

  const endCall = async () => {
    clearTimers()

    if (callSessionId) {
      const isNeverConnected = !callStartTime
      const status = isNeverConnected ? "declined" : "ended"
      const durationSeconds = callStartTime
        ? Math.max(0, Math.floor((Date.now() - callStartTime) / 1000))
        : 0

      await updateCallSession({
        status,
        duration: durationSeconds,
        ...(isNeverConnected
          ? { declinedAt: serverTimestamp() }
          : { endedAt: serverTimestamp() }),
      })
    }

    await cleanup()
    router.replace("/")
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.blobOne} />
      <View style={styles.blobTwo} />
      <View style={styles.container}>
        {/* 显示连接信息（调试用） */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Local UID: {localUid}</Text>
          {remoteUid !== 0 && (
            <Text style={styles.debugText}>Remote UID: {remoteUid}</Text>
          )}
        </View>

        <Text style={styles.callingLabel}>
          {remoteUid === 0
            ? isVideo
              ? "Video call..."
              : "Audio call..."
            : formatDuration(elapsedSeconds)}
        </Text>

        {!isVideo && (
          <>
            <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtext}>
            {remoteUid === 0 ? "Calling..." : formatDuration(elapsedSeconds)}
          </Text>
        </>
      )}

        {isVideo && (
          <View style={styles.videoGrid}>
            {remoteUid !== 0 ? (
              <RtcSurfaceView
                style={styles.remoteVideo}
                canvas={{
                  uid: remoteUid,
                  sourceType: VideoSourceType.VideoSourceRemote,
                }}
                zOrderMediaOverlay={false}
              />
            ) : (
              <View style={styles.remoteVideoPlaceholder}>
                <Ionicons
                  name="person-circle-outline"
                  size={64}
                  color="rgba(255,255,255,0.45)"
                />
                <Text style={styles.videoLabel}>
                  Waiting for {displayName}...
                </Text>
              </View>
            )}

            {isVideoEnabled && (
              <View style={styles.localVideoContainer}>
                <RtcSurfaceView
                  style={styles.localVideo}
                  canvas={{
                    uid: 0, // 本地视频始终用 0
                    sourceType: VideoSourceType.VideoSourceCamera,
                  }}
                  zOrderMediaOverlay={true}
                />
              </View>
            )}
          </View>
        )}

        <View style={styles.controlsRow}>
          <Control
            icon={isMuted ? "mic-off" : "mic"}
            label="Mute"
            active={isMuted}
            onPress={toggleMute}
          />
          <Control
            icon={isSpeakerOn ? "volume-high" : "volume-low"}
            label="Speaker"
            active={isSpeakerOn}
            onPress={toggleSpeaker}
          />
          {isVideo ? (
            <>
              <Control
                icon={isVideoEnabled ? "videocam" : "videocam-off"}
                label="Camera"
                active={!isVideoEnabled}
                onPress={toggleCamera}
              />
              <Control
                icon="camera-reverse"
                label="Flip"
                onPress={flipCamera}
              />
            </>
          ) : (
            <Control
              icon="keypad"
              label="Keypad"
              active={showKeypad}
              onPress={toggleKeypad}
            />
          )}
        </View>

        {!isVideo && showKeypad && (
          <View style={styles.keypad}>
            <View style={styles.dialDisplay}>
              <Text style={styles.dialText}>
                {dialString.length ? dialString : "•••"}
              </Text>
            </View>
            <View style={styles.keypadGrid}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "⌫"].map(
                (key) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.key}
                    onPress={() => handleKeyPress(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyText}>{key}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.endButton}
            activeOpacity={0.85}
            onPress={endCall}
          >
            <Ionicons name="call" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

type ControlProps = {
  icon: any
  label: string
  active?: boolean
  onPress?: () => void
}

function Control({ icon, label, active, onPress }: ControlProps) {
  return (
    <TouchableOpacity
      style={styles.control}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.controlCircle, active && styles.controlCircleActive]}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1727",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 28,
  },
  blobOne: {
    position: "absolute",
    width: 240,
    height: 240,
    backgroundColor: "rgba(10,132,255,0.20)",
    borderRadius: 200,
    top: -60,
    left: -40,
  },
  blobTwo: {
    position: "absolute",
    width: 260,
    height: 260,
    backgroundColor: "rgba(52,199,89,0.18)",
    borderRadius: 200,
    bottom: -80,
    right: -40,
  },
  debugInfo: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 8,
    zIndex: 100,
  },
  debugText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "monospace",
  },
  callingLabel: {
    color: SUBTLE,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarText: {
    fontSize: 42,
    fontWeight: "700",
    color: "#fff",
  },
  name: { fontSize: 28, fontWeight: "700", color: "#fff", marginTop: 14 },
  subtext: { fontSize: 16, color: SUBTLE, marginTop: 4 },
  videoGrid: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 18,
  },
  remoteVideo: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  localVideoContainer: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  videoLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  controlsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  control: { alignItems: "center", gap: 8 },
  controlCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  controlCircleActive: {
    backgroundColor: "rgba(255,59,48,0.25)",
    borderColor: "rgba(255,59,48,0.4)",
  },
  controlLabel: { color: SUBTLE, fontSize: 13, fontWeight: "500" },
  keypad: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  dialDisplay: {
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  dialText: {
    color: "#fff",
    fontSize: 20,
    letterSpacing: 1,
  },
  keypadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  key: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  keyText: { color: "#fff", fontSize: 22, fontWeight: "600" },
  footer: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  endButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
})
