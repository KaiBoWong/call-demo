import { IconSymbol } from "@/components/ui/icon-symbol"
import React, { useEffect, useRef } from "react"
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface ToastViewProps {
  text1?: string
  text2?: string
  backgroundColor?: string
  iconName?: string
  width?: number
  toastId?: number
  onClose?: () => void
}

const DismissibleToast: React.FC<ToastViewProps> = ({
  text1 = "",
  text2,
  backgroundColor = "#0d9488",
  iconName = "info.circle",
  width = Dimensions.get("screen").width * 0.92,
  toastId,
  onClose,
}) => {
  // 使用 useRef 存储动画实例,每次都创建新的
  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(1)).current
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null)
  const { top } = useSafeAreaInsets()
  const isClosingRef = useRef(false)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [toastId])

  const handleClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    progressAnimationRef.current?.stop()

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.()
      isClosingRef.current = false
    })
  }

  useEffect(() => {
    progress.setValue(1)
    progressAnimationRef.current?.stop()
    progressAnimationRef.current = Animated.timing(progress, {
      toValue: 0,
      duration: 4000,
      useNativeDriver: false,
    })
    progressAnimationRef.current.start(({ finished }) => {
      if (finished && !isClosingRef.current) {
        handleClose()
      }
    })
  }, [toastId])

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  })

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: top,
        left: (Dimensions.get("screen").width - width) / 2,
        width,
        padding: 20,
        borderRadius: 10,
        backgroundColor,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
        flexDirection: "row",
        alignItems: "center",
        transform: [{ translateY }],
        opacity,
        pointerEvents: "box-none",
      }}
    >
      <IconSymbol
        size={28}
        name={
          iconName === "checkmark.circle.fill"
            ? "checkmark.circle.fill"
            : "exclamationmark.circle"
        }
        color="#fff"
        style={{ marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>
          {text1}
        </Text>
        {text2 && (
          <Text style={{ color: "#fff", fontSize: 13, marginTop: 5 }}>
            {text2}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={handleClose}
        style={{ padding: 5 }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <IconSymbol name="xmark" size={20} color="#fff" />
      </TouchableOpacity>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
      </View>
    </Animated.View>
  )
}

const styles = {
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ffffff",
  },
} as const

export default DismissibleToast
