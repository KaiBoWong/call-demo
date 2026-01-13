import React, { useState } from "react"
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native"

import { IconSymbol, IconSymbolName } from "@/components/ui/icon-symbol"

type RightAccessoryRenderer =
  | React.ReactNode
  | ((state: { isFocused: boolean }) => React.ReactNode)

interface AuthInputProps extends TextInputProps {
  iconName: IconSymbolName
  containerStyle?: StyleProp<ViewStyle>
  rightAccessory?: RightAccessoryRenderer
}

const AuthInput: React.FC<AuthInputProps> = ({
  iconName,
  containerStyle,
  rightAccessory,
  style,
  placeholderTextColor,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false)

  const handleFocus: TextInputProps["onFocus"] = (event) => {
    setIsFocused(true)
    onFocus?.(event)
  }

  const handleBlur: TextInputProps["onBlur"] = (event) => {
    setIsFocused(false)
    onBlur?.(event)
  }

  const accessoryContent =
    typeof rightAccessory === "function"
      ? rightAccessory({ isFocused })
      : rightAccessory

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <IconSymbol
        name={iconName}
        size={20}
        color={isFocused ? "#22c55e" : "#94a3b8"}
      />
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={
          placeholderTextColor ?? (isFocused ? "#16a34a" : "#94a3b8")
        }
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
      {accessoryContent ? (
        <View style={styles.rightAccessory}>{accessoryContent}</View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 0,
  },
  containerFocused: {
    borderColor: "#22c55e",
    backgroundColor: "#f0fdf4",
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: "#041022",
    fontWeight: "600",
  },
  rightAccessory: {
    marginLeft: 12,
  },
})

export default AuthInput
