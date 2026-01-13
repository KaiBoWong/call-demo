import { useCallback } from 'react'
import i18n from '../i18n/i18n'

export const useTranslation = () => {
  const t = useCallback((key: string, options?: object) => {
    return i18n.t(key, options)
  }, [])

  const setLanguage = useCallback((lang: 'en' | 'ms' | 'zh') => {
    i18n.locale = lang
  }, [])

  return { t, setLanguage }
}
