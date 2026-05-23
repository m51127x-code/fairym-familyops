// 檔案路徑：api/notify.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { text, member, date } = req.body;
    
    const mainGroupId = process.env.FAIRYM_OPS_GROUP_ID; // 您與室友的中控群組 ID
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    }

    // 建立一個非同步任務陣列，讓兩條軌道的推播可以同時發射
    const sendPromises = [];

    // ════════ 軌道一：發送到中控台群組（您與室友的共享基地） ════════
    if (mainGroupId) {
      const groupMessage = `🏠 [FairyM 任務動態同步]\n\n「${text}」\n👤 負責人：${member}\n📅 排定日期：${date}\n\n(此副本已同步發送至負責人私訊)`;
      
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
    if (member && member !== "全家") {
      // 去 Supabase 撈取該成員綁定的 line_user_id
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
      } else {
        console.log(`📢 成員「${member}」尚未在 APP 內綁定 LINE 身分，略過私訊發送。`);
      }
    }

    // 同時執行所有推播發送
    await Promise.all(sendPromises);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Notify Route Error:", err);
    res.status(500).json({ error: err.message });
  }
};
