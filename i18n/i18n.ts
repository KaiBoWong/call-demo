import { I18n } from "i18n-js"
import en from "./locales/en"
import id from "./locales/id"
import zh from "./locales/zh"

const i18n = new I18n({
  en,
  zh,
  id,
})

// 设置默认语言
i18n.defaultLocale = "en"
i18n.locale = "en"

// 当翻译缺失时，使用默认语言
i18n.enableFallback = true

export default i18n
