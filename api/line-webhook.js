import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function shouldRecordMessage(message) {
  const text = message.toLowerCase();

  const recordKeywords = [
    "請問", "問題", "錯誤", "不能", "無法", "失敗", "異常",
    "登入", "帳號", "權限", "出單", "訂單", "庫存", "報表",
    "付款", "結帳", "系統", "app", "後台", "協助", "確認",
    "急", "緊急", "#記錄", "#issue",
  ];

  return recordKeywords.some((keyword) => text.includes(keyword));
}

function detectIssue(message) {
  const text = message.toLowerCase();

  const issueKeywords = [
    "壞掉", "錯誤", "不能用", "無法", "失敗", "有問題", "異常",
    "卡住", "沒反應", "打不開", "開不起來", "進不去", "登不進去",
    "登入不了", "不能登入", "無法登入", "連不上", "出不來",
    "跑不出來", "查不到", "不見", "沒有資料", "不能出單",
    "無法出單", "出單失敗", "結帳失敗", "付款失敗",
  ];

  return issueKeywords.some((k) => text.includes(k));
}

function detectUrgency(message) {
  const text = message.toLowerCase();

  const highKeywords = [
    "急", "現在", "馬上", "緊急", "今天", "客戶在等", "來不及",
  ];

  return highKeywords.some((k) => text.includes(k)) ? "high" : "normal";
}

function detectType(message) {
  const text = message.toLowerCase();

  if (text.includes("登入") || text.includes("帳號") || text.includes("權限")) {
    return "帳號問題";
  }

  if (text.includes("出單") || text.includes("庫存") || text.includes("報表")) {
    return "ERP問題";
  }

  if (text.includes("壞掉") || text.includes("錯誤") || text.includes("異常")) {
    return "系統異常";
  }

  return "客戶問題";
}
function getSuggestedAction(issueType) {
  switch (issueType) {
    case "帳號問題":
      return "→ 立即確認帳號權限與登入服務";

    case "ERP問題":
      return "→ 確認 ERP API、庫存與出單狀態";

    case "系統異常":
      return "→ 確認系統服務與錯誤 log";

    default:
      return "→ 請人工確認與追蹤";
  }
}
async function pushToFairyMOps(text) {
  const groupId = process.env.FAIRYM_OPS_GROUP_ID;

  if (!groupId) {
    console.error("Missing FAIRYM_OPS_GROUP_ID");
    return;
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    console.error("LINE push error:", await response.text());
  }
}

async function syncGroupName(groupId) {
  if (!groupId) return null;

  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error("LINE group summary error:", await response.text());
      return null;
    }

    const summary = await response.json();
    const groupName = summary.groupName || null;

    await supabase.from("group_aliases").upsert(
      [{ group_id: groupId, group_name: groupName }],
      { onConflict: "group_id" }
    );

    return groupName;
  } catch (error) {
    console.error("sync group name failed:", error);
    return null;
  }
}

async function syncUserProfile(groupId, userId) {
  if (!groupId || !userId) return null;

  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error("LINE user profile error:", await response.text());
      return null;
    }

    const profile = await response.json();

    await supabase.from("line_users").upsert(
      [
        {
          group_id: groupId,
          user_id: userId,
          display_name: profile.displayName || null,
          picture_url: profile.pictureUrl || null,
        },
      ],
      { onConflict: "group_id,user_id" }
    );

    return profile;
  } catch (error) {
    console.error("sync user profile failed:", error);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const messageText = event.message.text;
      const shouldRecord = shouldRecordMessage(messageText);
      const shouldCreateIssue = detectIssue(messageText);

      if (!shouldRecord && !shouldCreateIssue) {
        continue;
      }

      const groupId = event.source?.groupId || null;
      const userId = event.source?.userId || null;

      const groupName = await syncGroupName(groupId);
      const userProfile = await syncUserProfile(groupId, userId);
      const userName = userProfile?.displayName || userId || "未知使用者";

      await supabase.from("line_messages").insert([
        {
          group_id: groupId,
          user_id: userId,
          message_text: messageText,
          message_type: "text",
        },
      ]);

      if (shouldCreateIssue) {
        const issueType = detectType(messageText);
        const urgency = detectUrgency(messageText);

        await supabase.from("issues").insert([
          {
            group_id: groupId,
            source_message: messageText,
            issue_title: messageText,
            issue_type: issueType,
            urgency,
            status: "open",
          },
        ]);

        if (urgency === "high") {
  const suggestion = getSuggestedAction(issueType);

  await pushToFairyMOps(
`🚨 [HIGH] ${issueType}

群組：${groupName || groupId || "未知群組"}
留言人：${userName}

${messageText}

建議：
${suggestion}`
  );
}
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
