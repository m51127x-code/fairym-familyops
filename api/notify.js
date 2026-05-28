// 檔案路徑：api/notify.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function normalizePayload(body = {}) {
  const event = body.event || body;

  return {
    text: event.text || event.title || "",
    title: event.title || event.text || "",
    member: event.member || "全家",
    date: event.date || "",
    type: event.type || "todo",
    mood: event.mood || null,
    mode: body.mode || "both", // group | private | both
  };
}

function buildGroupMessage({ text, member, date, type, mood }) {
  if (type === "mood") {
    return `💭 [FairyM 心情廣播]\n\n${member} 說：「${text}」 ${mood || "✨"}\n📅 記錄日期：${date}`;
  }

  if (type === "schedule") {
    return `🏠 [FairyM 行程]\n${member}  ${text}\n\n📅 日期：${date}`;
  }

  if (type === "remind") {
    return `⏰ [FairyM 期限提醒]\n\n「${text}」\n📌 關聯：${member}\n⏳ 截止日：${date}`;
  }

  return `🏠 [FairyM 任務動態同步]\n\n「${text}」\n📌 關聯：${member}\n📅 排定日期：${date}`;
}

function buildPrivateMessage({ text, member, date, type }) {
  if (member === "全家") {
    return `🔔 全家提醒\n\n「${text}」\n\n📅 日期：${date}\n\n這筆事項已同步提醒所有已綁定的家庭成員。`;
  }

  if (type === "schedule") {
    return `🌸 溫馨提醒\n\n您有一項排定的生活安排：\n「${text}」\n\n📅 日期：${date}`;
  }

  if (type === "remind") {
    return `⏰ 期限提醒\n\n這是一項有時效性的待辦，請留意時間喔：\n「${text}」\n\n⏳ 截止日：${date}`;
  }

  return `🌸 溫馨提醒\n\n您有一項排定的生活事項：\n「${text}」\n\n📅 執行日期：${date}\n\n記得按時完成喔！`;
}

async function pushLineText(to, text, token) {
  if (!to) throw new Error("缺少 LINE 推播對象");

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE push failed: ${errorText}`);
  }
}

async function getPrivateTargets(member) {
  let query = supabase
    .from("members")
    .select("name, line_user_id")
    .not("line_user_id", "is", null);

  if (member && member !== "全家") {
    query = query.eq("name", member);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const mainGroupId = process.env.FAIRYM_OPS_GROUP_ID;

    if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");

    const payload = normalizePayload(req.body);
    const { text, member, date, type, mood, mode } = payload;

    if (!text) {
      return res.status(400).json({ error: "缺少通知內容 text" });
    }

    const sendResults = {
      group: false,
      privateCount: 0,
      privateTargets: [],
    };

    const shouldSendGroup = mode === "group" || mode === "both";
    const shouldSendPrivate = mode === "private" || mode === "both";

    // ════════ 軌道一：群組通知 ════════
    if (shouldSendGroup) {
      if (!mainGroupId) {
        return res.status(400).json({ error: "Missing FAIRYM_OPS_GROUP_ID" });
      }

      const groupMessage = buildGroupMessage({ text, member, date, type, mood });
      await pushLineText(mainGroupId, groupMessage, token);
      sendResults.group = true;
    }

    // ════════ 軌道二：私訊通知 ════════
    // 心情目前不私訊，避免變成情緒廣播壓力
    if (shouldSendPrivate && type !== "mood") {
      const targets = await getPrivateTargets(member);

      if (!targets.length) {
        return res.status(400).json({
          error:
            member === "全家"
              ? "目前沒有任何已綁定 LINE 的家庭成員"
              : `「${member}」尚未綁定 LINE 身分`,
        });
      }

      const privateMessage = buildPrivateMessage({ text, member, date, type });

      for (const target of targets) {
        await pushLineText(target.line_user_id, privateMessage, token);
      }

      sendResults.privateCount = targets.length;
      sendResults.privateTargets = targets.map(t => t.name);
    }

    return res.status(200).json({
      success: true,
      mode,
      result: sendResults,
    });
  } catch (err) {
    console.error("Notify Route Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
