module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@hooks": "./hooks",
            "@axios": "./config/axios",
            "@assets": "./assets",
          },
        },
      ],
    ],
  }
}
