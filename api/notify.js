// 檔案路徑：api/notify.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { text, member, date } = req.body;
    
    // 使用與 Webhook 相同的環境變數
    const groupId = process.env.FAIRYM_OPS_GROUP_ID;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!groupId || !token) {
      throw new Error("Missing LINE credentials in environment variables");
    }

    // 組裝推播訊息內容
    const message = `🔔 溫馨提醒\n\n「${text}」\n👤 負責：${member}\n📅 排定日期：${date}\n\n大家記得要完成喔！`;

    // 呼叫 LINE 推播 API
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: message }]
      })
    });

    if (!response.ok) throw new Error(await response.text());

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Notify Error:", err);
    res.status(500).json({ error: err.message });
  }
}
