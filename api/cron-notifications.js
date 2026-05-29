
// 檔案路徑：api/cron-notifications.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function getTypeLabel(type) {
  const labels = {
    schedule: "行程",
    remind: "提醒",
    todo: "待辦",
    shop: "採買",
    health: "健康",
    routine: "週期",
    mood: "心情",
    note: "紀錄",
  };
  return labels[type] || "事項";
}

function formatDateTW(dateStr) {
  if (!dateStr) return "未設定";
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

function buildReminderMessage(event) {
  const title = event?.text || event?.title || "未命名事項";
  const member = event?.member || "全家";
  const date = formatDateTW(event?.date);
  const typeLabel = getTypeLabel(event?.type);

  if (event?.type === "remind") {
    return `⏰ FairyM 期限提醒\n\n「${title}」\n\n📌 關聯：${member}\n📅 日期：${date}\n\n請留意這項有時效性的事項。`;
  }

  if (event?.type === "schedule") {
    return `🌸 FairyM 行程提醒\n\n「${title}」\n\n👤 關聯：${member}\n📅 日期：${date}`;
  }

  return `🔔 FairyM 事項提醒\n\n「${title}」\n\n👤 關聯：${member}\n📅 日期：${date}\n🏷 分類：${typeLabel}`;
}

async function pushLineText(to, text) {
  if (!to) throw new Error("缺少 LINE 推播對象");
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  }

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
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

async function getPrivateTargets(memberName) {
  let query = supabase
    .from("members")
    .select("name, line_user_id")
    .not("line_user_id", "is", null);

  if (memberName && memberName !== "全家") {
    query = query.eq("name", memberName);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

async function sendNotificationByMode(event, targetMode) {
  const message = buildReminderMessage(event);
  const results = {
    group: false,
    privateCount: 0,
    privateTargets: [],
  };

  if (targetMode === "group" || targetMode === "both") {
    const groupId = process.env.FAIRYM_OPS_GROUP_ID;
    if (!groupId) throw new Error("Missing FAIRYM_OPS_GROUP_ID");

    await pushLineText(groupId, message);
    results.group = true;
  }

  if (targetMode === "private" || targetMode === "both") {
    const targets = await getPrivateTargets(event.member || "全家");

    if (!targets.length) {
      throw new Error(
        event.member === "全家"
          ? "目前沒有任何已綁定 LINE 的成員"
          : `「${event.member}」尚未綁定 LINE 身分`
      );
    }

    for (const target of targets) {
      await pushLineText(target.line_user_id, message);
    }

    results.privateCount = targets.length;
    results.privateTargets = targets.map(t => t.name);
  }

  return results;
}

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  // 如果你還沒設定 CRON_SECRET，先允許執行，方便測試。
  // 正式上線後建議一定要設定。
  if (!cronSecret) return true;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${cronSecret}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const nowIso = new Date().toISOString();

  try {
    const { data: dueNotifications, error } = await supabase
      .from("scheduled_notifications")
      .select(`
        id,
        event_id,
        target_mode,
        scheduled_at,
        status,
        events (
          id,
          title,
          text,
          type,
          member,
          date,
          time,
          mood,
          is_done,
          completed
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    const results = [];

    for (const item of dueNotifications || []) {
      try {
        if (!item.events) {
          throw new Error("找不到對應 event，可能已被刪除");
        }

        const event = item.events;

        // 已完成的事項不再提醒，避免打擾
        if (event.is_done || event.completed) {
          await supabase
            .from("scheduled_notifications")
            .update({
              status: "cancelled",
              error_message: "event 已完成，自動取消通知",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          results.push({
            id: item.id,
            status: "cancelled",
            reason: "event 已完成",
          });

          continue;
        }

        const sendResult = await sendNotificationByMode(event, item.target_mode);

        await supabase
          .from("scheduled_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "sent",
          result: sendResult,
        });
      } catch (err) {
        await supabase
          .from("scheduled_notifications")
          .update({
            status: "failed",
            error_message: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "failed",
          error: err.message,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      checkedAt: nowIso,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("cron-notifications failed:", err);
    return res.status(500).json({ error: err.message });
  }
};
