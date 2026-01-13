const { withProjectBuildGradle } = require("@expo/config-plugins")

function withNotifeeBuildGradleRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    let buildGradleContent = config.modResults.contents

    const notifeeMavenRepo = `        maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`
    const mavenCentralLine = "maven { url 'https://www.jitpack.io' }"

    if (buildGradleContent.includes(notifeeMavenRepo.trim())) {
      return config
    }

    if (buildGradleContent.includes(mavenCentralLine)) {
      buildGradleContent = buildGradleContent.replace(
        new RegExp(
          mavenCentralLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        ),
        `${mavenCentralLine}\n${notifeeMavenRepo}`
      )
    } else {
      console.warn(
        "[NotifeePlugin] Could not find mavenCentral() to inject after."
      )
    }

    config.modResults.contents = buildGradleContent

    return config
  })
}

module.exports = withNotifeeBuildGradleRepo
