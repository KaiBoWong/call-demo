import React, { useEffect } from "react"
import { StyleProp, StyleSheet, ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

type AnimatedAccentsProps = {
  accentOneStyle?: StyleProp<ViewStyle>
  accentTwoStyle?: StyleProp<ViewStyle>
}

export function AnimatedAccents({
  accentOneStyle,
  accentTwoStyle,
}: AnimatedAccentsProps) {
  const accentOneProgress = useSharedValue(0)
  const accentTwoProgress = useSharedValue(0)

  useEffect(() => {
    accentOneProgress.value = withRepeat(
      withTiming(1, {
        duration: 6500,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    )
    accentTwoProgress.value = withRepeat(
      withTiming(1, {
        duration: 7800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    )
  }, [accentOneProgress, accentTwoProgress])

  const accentOneAnimatedStyle = useAnimatedStyle(() => {
    const translateX = Math.sin(accentOneProgress.value * Math.PI * 2) * 14
    const translateY = Math.cos(accentOneProgress.value * Math.PI * 2) * 12
    const scale = 1 + 0.05 * Math.sin(accentOneProgress.value * Math.PI * 2)
    return {
      transform: [{ translateX }, { translateY }, { scale }],
    }
  })

  const accentTwoAnimatedStyle = useAnimatedStyle(() => {
    const translateX = Math.cos(accentTwoProgress.value * Math.PI * 2) * 18
    const translateY = Math.sin(accentTwoProgress.value * Math.PI * 2) * 15
    const scale = 1 + 0.07 * Math.cos(accentTwoProgress.value * Math.PI * 2)
    return {
      transform: [{ translateX }, { translateY }, { scale }],
    }
  })

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.accentOne, accentOneStyle, accentOneAnimatedStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.accentTwo, accentTwoStyle, accentTwoAnimatedStyle]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  accentOne: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(34,197,94,0.2)",
    top: -80,
    right: -60,
  },
  accentTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(21,128,61,0.25)",
    bottom: -90,
    left: -70,
  },
})
