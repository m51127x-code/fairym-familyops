// 檔案路徑：api/notify.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { text, member, date, type, mood } = req.body;
    const mainGroupId = process.env.FAIRYM_OPS_GROUP_ID; 
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");

    const sendPromises = [];

    // ════════ 軌道一：發送到中控台群組 ════════
    if (mainGroupId) {
      let groupMessage = "";
      
      if (type === "mood") {
        groupMessage = `💭 [FairyM 心情廣播]\n\n${member} 說：「${text}」 ${mood || "✨"}\n📅 記錄日期：${date}`;
      } else if (type === "schedule") {
        // 🌟 行程的群組文案 (您指定的留白排版)
        groupMessage = `🏠 [FairyM 行程]\n${member}  ${text}\n\n📅 日期：${date}`;
      } else if (type === "remind") {
        groupMessage = `⏰ [FairyM 期限提醒]\n\n「${text}」\n📌 關聯：${member}\n⏳ 截止日：${date}\n\n(此副本已同步發送至關聯人私訊)`;
      } else {
        groupMessage = `🏠 [FairyM 任務動態同步]\n\n「${text}」\n📌 關聯：${member}\n📅 排定日期：${date}\n\n(此副本已同步發送至關聯人私訊)`;
      }

      sendPromises.push(
        fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            to: mainGroupId,
            messages: [{ type: "text", text: groupMessage }]
          })
        }).then(async (r) => { if (!r.ok) console.error("群組推播失敗:", await r.text()); })
      );
    }

    // ════════ 軌道二：精準一對一私訊給負責人 ════════
    if (type !== "mood" && member && member !== "全家") {
      const { data: memberData } = await supabase.from("members").select("line_user_id").eq("name", member).maybeSingle();

      if (memberData && memberData.line_user_id) {
        let privateMessage = "";

        if (type === "schedule") {
          // 🌟 行程的私訊文案 (不帶催促感)
          privateMessage = `🌸 溫馨提醒\n\n您有一項排定的生活安排：「${text}」\n\n📅 日期：${date}`;
        } else if (type === "remind") {
          // 🌟 提醒的私訊文案 (帶有時效性)
          privateMessage = `⏰ 期限提醒\n\n這是一項有時效性的待辦，請留意時間喔：「${text}」\n\n⏳ 截止日：${date}`;
        } else {
          // 一般待辦/採買/健康的私訊文案
          privateMessage = `🌸 溫馨提醒\n\n您有一項排定的生活事項：\n「${text}」\n📅 執行日期：${date}\n\n記得按時完成喔！`;
        }

        sendPromises.push(
          fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              to: memberData.line_user_id,
              messages: [{ type: "text", text: privateMessage }]
            })
          }).then(async (r) => { if (!r.ok) console.error("私訊發送失敗:", await r.text()); })
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
