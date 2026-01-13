import { AnimatedAccents } from "@/components/AnimatedAccents"
import AuthInput from "@/components/AuthInput"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { useTranslation } from "@hooks/useTranslation"
import { Stack, useRouter } from "expo-router"
import React, { useState } from "react"
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import Animated, { FadeInUp } from "react-native-reanimated"
import { useSession } from "./session/SessionProvider"

export default function SignInScreen() {
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useSession()
  const router = useRouter()

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      await signIn({
        username,
        password,
      })
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex flex-1 w-full bg-white">
            <AnimatedAccents
              accentOneStyle={authAccentStyles.accentOne}
              accentTwoStyle={authAccentStyles.accentTwo}
            />

            <View className="flex-1 px-6 py-10 justify-center">
              <Animated.View entering={FadeInUp.duration(900).springify()}>
                <Text
                  className="text-6xl font-extrabold pb-8"
                  style={{ color: "#022c22", lineHeight: 54 }}
                >
                  {t("login.login")}
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.delay(120).duration(700).springify()}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ letterSpacing: 1, color: "#065f46" }}
                >
                  {t("login.accessAcc")}
                </Text>

                <View className="mt-6">
                  <AuthInput
                    iconName="mail"
                    placeholder={t("login.username")}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    keyboardType="default"
                    textContentType="username"
                    returnKeyType="next"
                  />
                </View>

                <View className="mt-4">
                  <AuthInput
                    iconName="lock"
                    placeholder={t("login.password")}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                    textContentType="password"
                    returnKeyType="done"
                    rightAccessory={({ isFocused }) => (
                      <TouchableOpacity
                        onPress={() => setIsPasswordVisible((prev) => !prev)}
                      >
                        <IconSymbol
                          name={isPasswordVisible ? "eye" : "eye.slash"}
                          size={20}
                          color={isFocused ? "#22c55e" : "#94a3b8"}
                        />
                      </TouchableOpacity>
                    )}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.primaryButton,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View className="flex flex-row items-center">
                      <ActivityIndicator color="#ffff" className="mr-2" />
                      <Text className="font-bold text-lg text-white">
                        {t("common.pleaseWait")}
                      </Text>
                    </View>
                  ) : (
                    <Text className="font-bold text-lg text-white">
                      {t("login.login")}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAwareScrollView>
    </>
  )
}

const authAccentStyles = StyleSheet.create({
  accentOne: {
    top: -40,
    right: -70,
  },
  accentTwo: {
    bottom: -80,
    left: -80,
  },
})

const styles = StyleSheet.create({
  primaryButton: {
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
})
