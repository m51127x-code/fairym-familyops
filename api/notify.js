// 檔案路徑：api/notify.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    // 🌟 接收前端傳來的新參數：type 與 mood
    const { text, member, date, type, mood } = req.body;
    
    const mainGroupId = process.env.FAIRYM_OPS_GROUP_ID; 
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    }

    const sendPromises = [];

    // ════════ 軌道一：發送到中控台群組 ════════
    if (mainGroupId) {
      let groupMessage = "";
      
      // 🌟 根據 type 決定群組通知內容
      if (type === "mood") {
        groupMessage = `💭 [FairyM 心情廣播]\n\n${member} 說：「${text}」 ${mood || "✨"}\n📅 記錄日期：${date}`;
      } else {
        groupMessage = `🏠 [FairyM 任務動態同步]\n\n「${text}」\n👤 負責人：${member}\n📅 排定日期：${date}\n\n(此副本已同步發送至負責人私訊)`;
      }

      sendPromises.push(
        fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            to: mainGroupId,
            messages: [{ type: "text", text: groupMessage }]
          })
        }).then(async (r) => {
          if (!r.ok) console.error("中控群組推播失敗:", await r.text());
        })
      );
    }

    // ════════ 軌道二：精準一對一私訊給負責人 ════════
    // 🌟 判斷：心情分享不需要發「提醒做事」的私訊給自己
    if (type !== "mood" && member && member !== "全家") {
      const { data: memberData } = await supabase
        .from("members")
        .select("line_user_id")
        .eq("name", member)
        .maybeSingle();

      if (memberData && memberData.line_user_id) {
        const privateMessage = `🌸 溫馨提醒\n\n您有一項排定的生活事項：\n「${text}」\n📅 執行日期：${date}\n\n記得按時完成喔！`;
        
        sendPromises.push(
          fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              to: memberData.line_user_id,
              messages: [{ type: "text", text: privateMessage }]
            })
          }).then(async (r) => {
            if (!r.ok) console.error(`私訊發送給 ${member} 失敗:`, await r.text());
          })
        );
      }
    }

    await Promise.all(sendPromises);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Notify Route Error:", err);
    res.status(500).json({ error: err.message });
  }
};
