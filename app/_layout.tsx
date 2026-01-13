import "../global.css"

import "react-native-reanimated"

import notifee from "@notifee/react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import "../firebase"
import DismissibleToast from "./DismissibleToast"

import { NotificationService } from "../services/NotificationService"
import { SessionProvider } from "./session/SessionProvider"

import { useColorScheme } from "@/hooks/use-color-scheme"
import { Linking, Platform } from "react-native"
import Toast from "react-native-toast-message"

export const unstable_settings = {
  anchor: "(tabs)",
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  async function checkOverlayPermission() {
    if (Platform.OS === "android") {
      const settings = await notifee.getNotificationSettings()
      // 检查 Android 14+ 的全屏意图权限
      if (Platform.Version >= 34 && !settings.android.alarm) {
        // 引导去开启全屏权限
        await notifee.openAlarmPermissionSettings()
      }

      // 建议引导用户去设置页手动开启 “显示在其他应用上”
      // 因为目前没有 API 自动弹窗请求此权限，只能手动跳转
      Linking.openSettings()
    }
  }

  useEffect(() => {
    // 初始化通知服务并注册监听
    NotificationService.initialize()

    const unsubscribeForeground = NotificationService.setupForegroundHandler()
    const unsubscribeActions =
      NotificationService.setupNotificationActionHandler()

    return () => {
      unsubscribeForeground?.()
      unsubscribeActions?.()
    }
  }, [])

  const toastConfig = {
    success: (props: any) => (
      <DismissibleToast
        text1={props.text1}
        text2={props.text2}
        backgroundColor="#4CAF50"
        iconName="checkmark.circle.fill"
        toastId={props.props?.id}
        onClose={() => Toast.hide()}
      />
    ),
    error: (props: any) => (
      <DismissibleToast
        text1={props.text1}
        text2={props.text2}
        backgroundColor="#F44336"
        iconName="exclamationmark.circle"
        toastId={props.props?.id}
        onClose={() => Toast.hide()}
      />
    ),
  }

  return (
    <SessionProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
        <Stack.Screen name="call" options={{ headerShown: false }} />
        <Stack.Screen name="incoming" options={{ headerShown: false }} />
      </Stack>
      <Toast config={toastConfig} />
      <StatusBar style="auto" />
    </SessionProvider>
  )
}
