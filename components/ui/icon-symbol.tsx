// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons"
import { SymbolWeight } from "expo-symbols"
import React from "react"
import { OpaqueColorValue, StyleProp, TextStyle } from "react-native"

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  mail: "email",
  "lock.fill": "lock",
  lock: "lock-outline",
  "lock.open": "lock-open",
  "house.fill": "other-houses",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  checklist: "checklist",
  gear: "settings",
  clock: "alarm",
  pin: "location-pin",
  person: "person",
  phone: "phone",
  "iphone.gen3": "phone-android",
  "chevron.up.circle": "arrow-circle-up",
  "chevron.down.circle": "arrow-circle-down",
  "exclamationmark.circle": "error",
  "list.bullet.clipboard": "free-cancellation",
  eye: "visibility",
  "eye.slash": "visibility-off",
  "bell.fill": "notifications",
  bell: "notifications-none",
  "checkmark.circle.fill": "check-circle",
  xmark: "close",
  "chevron.left": "chevron-left",
  smartphone: "app-settings-alt",
  "arrow.backward": "arrow-back",
  "arrow.forward": "arrow-forward",
  "gear.badge.checkmark": "check-circle",
  "xmark.circle": "cancel",
  "chevron.up": "keyboard-arrow-up",
  "chevron.down": "keyboard-arrow-down",
  "chevron.right.2": "chevron-right",
  "location.circle.fill": "location-on",
  calendar: "calendar-today",
  "calendar.badge.clock": "calendar-month",
  "trophy.fill": "emoji-events",
  "figure.seated.seatbelt": "airline-seat-recline-normal",
  "car.fill": "directions-car",
  camera: "photo-camera",
  transmission: "settings",
  headset: "headset-mic",
  "checkmark.shield": "shield",
  translate: "translate",
  "key.horizontal": "key",
  trash: "delete",
  "info.circle": "info-outline",
  number: "tag",
  "rectangle.portrait.and.arrow.right": "exit-to-app",
  "wallet.bifold.fill": "payments",
  "gift.circle": "card-giftcard",
  "plus.circle": "add-circle",
  paintpalette: "palette",
  "dollarsign.circle": "attach-money",
  "clock.badge.checkmark": "more-time",
  checkmark: "check",
  "checkmark.circle": "task-alt",
  "square.and.pencil": "mode-edit",
  "key.radiowaves.forward": "settings-remote",
  "plus.app": "add-circle-outline",
  "plus.circle.fill": "add-circle",
  "tag.fill": "discount",
  "list.bullet": "list",
  circle: "circle",
  "exclamationmark.triangle": "warning-amber",
  forward: "skip-next",
  magnifyingglass: "search",
  "play.circle": "play-circle-outline",
  "arrow.trianglehead.clockwise": "refresh",
  "paperplane.fill": "near-me",
  "line.3.horizontal.decrease.circle": "tune",
  "arrow.trianglehead.2.clockwise.rotate.90.camera": "cameraswitch",
  alarm: "access-alarm",
  "arrow.right.to.line.circle": "login",
  "arrowshape.turn.up.backward.fill": "reply",
  "creditcard.fill": "credit-card",
  "photo.stack": "photo-library",
} as Partial<
  Record<
    import("expo-symbols").SymbolViewProps["name"],
    React.ComponentProps<typeof MaterialIcons>["name"]
  >
>

export type IconSymbolName = keyof typeof MAPPING

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName
  size?: number
  color: string | OpaqueColorValue
  style?: StyleProp<TextStyle>
  weight?: SymbolWeight
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  )
}
