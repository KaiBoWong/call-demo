const jsrsasign = require("jsrsasign")

// 这是你的 Service Account JSON 信息
const serviceAccount = {
  client_email:
    "firebase-adminsdk-fbsvc@call-demo-b3572.iam.gserviceaccount.com",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQChBmeUmDWhKbeU\ngLqfjIPmNhXL8n7+LIcOvP8H6XT6UguYNT8IcZfiRlC2OaKRGWTUj02LuvHlZpT2\nnY/XVhpe7lX9U2Z2KwCFGbi+MMlx8D7WzXDthNnoshNBz6LneRD3SeuFPvm71mHz\nclhkpmcAjnEfgCNhQrYTDbqR1bOZ3IH8b/sPXflAKZYQb5oEUg7qAK+f1ipuGMeP\ngTwRUULo2suqlVuLwl3Og01zXu+/EQVZX1E/aO2fHVqOICY/4wjdVXQ4L8ybt6uA\nElcsRswfWesSQXOf4D2XsBdU9G0txEBB8L1gCrINfMpxsd6TU2SSzwVjL7o1zT2S\njNUd+pXJAgMBAAECggEAEZeZiWp3sXvVSqwlt3iqkGQoTXfY1/wVZU7QrhSbax27\nlo16rXl7loUIHGB/mkqj8XUWi8WI1/81Fxxvsp79kpGHY33RG+fmzqPYwy6hU4lj\n1CPtyoVRKVMLN41vxso7SEkTKiOPNS5e1TIQ5i4n4q+tPDvLobygF8TQNU6bqJt6\nQT/ZxdOJaVjnXr75dP8azhFgs2/EN5g2+YqMg0SAxlH01Gd+hNUWUIqLQwfh+WI4\nseflkwk/Io+lhcUNomdJd/+FWdqhcGRBPuR7xKFmueeOPJRaKW4HTlejH0NGEjqW\n4TI/GfRXlFLokJ2qiuxd3p8cZHtykvOne6Z7Hwo3gQKBgQDZJfLhkz6R9wNMkwBc\nU0s6R92BcL224s/T6AaYjueh494wcbR0zRFmSPuPuwwACYKhKo7k2dakfl5WFVTc\nVA2Md8uqo5FR0R191KgYoxvx7hpnNy9b0w6RwUUFa0Lx8PVralkl7c06HRaupxFC\nvbaYTBvE48SPVWp3yV5GQrNT3QKBgQC91ddgyk5XF953jcwx0nj3Dvd2F5/B8Ksc\nx78R/xY/qsndo/yKxf/Ms40KLXw7dnqUqTcgx2/iTkTgz17CpZRq+WHWZyPwh3eC\ngk6wn5RHVsepdt3LOO7SAoFUBqPY3BrgbyZPyaSr+S1Mk8WuHpcMhuEyEU0q7wlx\nbkvHAfzw3QKBgHGZTbe+nRQlYj90A9NI6+kAYZvuzADaJRlZn+G9mOXzXHCBe4ND\nKKAW/CuUEdIPJ5yCtCB66bRCO73TCQL+odvja9PIICTqPgBu+MVyxxLIml123Dqw\nbkXIEwCjvXDuuqVIDH0wK5YEU7JoyjndH6IK5tgYw+KsL7ecy8n76O6tAoGAK0xv\nB6CdJbhIAbTR8jszZAaB4umYgr/GB5Z3uj8YcAUgbfFNVMm8gpAhh0TApT9sziOa\nc1uJ5XA8vZoO3w6tP4kKC8ESrXX4iEf4csizJWJhwAFgrU2bC0OPA/9Pt9LcPnyb\nnG89pAv9jQ3XdNN9WFobWzQfCb/jw3+IwSdu7fECgYEAq1ujQbexpbDLy8kEDdDg\nxW83quxQw2llv/LGnB9AOCJ9Cepq0Far1Uz5SnEJIDK48ioUL3t2dS6aN8aNOxWy\nAx431+Jw43GRD0BiN9odvFD0U4Q8X3sOeIH9aNUqK8NuevYX+MPRSLmGDJpzqBz7\n+7bv9PF+IW9cksZYZ3Fep2Y=\n-----END PRIVATE KEY-----\n",
}

async function getAccessToken() {
  const header = { alg: "RS256", typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)

  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const sHeader = JSON.stringify(header)
  const sPayload = JSON.stringify(payload)

  // 使用私钥签名生成 JWT
  const jwt = jsrsasign.KJUR.jws.JWS.sign(
    "RS256",
    sHeader,
    sPayload,
    serviceAccount.private_key
  )

  // 用 JWT 去换取 Access Token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const data = await response.json()
  return data.access_token
}

export const sendFCMNotification = async (
  targetToken: string,
  callerName: string,
  extraData: any // 增加这个参数
) => {
  try {
    const accessToken = await getAccessToken()
    const projectId = "call-demo-b3572"

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: targetToken,
            // 保险起见通知字段也带上，Android 即使前台也会触发 onMessage
            notification: {
              title: `${callerName} is calling...`,
              body: `${extraData?.callType || "audio"} call`,
            },
            data: Object.fromEntries(
              Object.entries(extraData || {}).map(([k, v]) => [k, String(v)])
            ), // FCM data 只能是字符串
            android: {
              priority: "high",
              notification: {
                channelId: "incoming-call",
              },
            },
            apns: {
              headers: { "apns-priority": "10" },
              payload: {
                aps: {
                  "content-available": 1,
                },
              },
            },
          },
        }),
      }
    )
    const json = await response.json()
    if (!response.ok) {
      console.error("FCM send failed", response.status, json)
    }
    console.log("✅ FCM send response", json)
    return json
  } catch (error) {
    console.error("FCM Error:", error)
  }
}
