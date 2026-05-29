// 檔案路徑：api/morning-report.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function getTaipeiNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

function getTaipeiDateString(offsetDays = 0) {
  const date = getTaipeiNow();
  date.setDate(date.getDate() + offsetDays);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getTaipeiHHMM() {
  const date = getTaipeiNow();
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeSendTime(value) {
  if (!value) return "08:00";
  return String(value).slice(0, 5);
}

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

function buildTaskLine(event, index) {
  const title = event.text || event.title || "未命名事項";
  const typeLabel = getTypeLabel(event.type);
  return `${index}. ${title}${typeLabel ? `（${typeLabel}）` : ""}`;
}

function buildPrivateReport(memberName, tasks) {
  const displayName = memberName || "成員";

  if (!tasks.length) {
    return `Morning Brief\n\n${displayName}，早安。\n\n今天目前沒有待處理事項。\n\n願今天一切順利。`;
  }

  const lines = tasks.map((task, idx) => buildTaskLine(task, idx + 1)).join("\n");

  return `Morning Brief\n\n${displayName}，早安。\n\n今天有 ${tasks.length} 件事需要留意：\n\n${lines}\n\n祝今天順利。`;
}

function buildGroupReport(groupedTasks) {
  const members = Object.keys(groupedTasks);

  if (!members.length) {
    return `Morning Brief\n\n今天目前沒有待處理事項。\n\n願今天一切順利。`;
  }

  const sections = members.map(memberName => {
    const tasks = groupedTasks[memberName] || [];
    const lines = tasks.map((task, idx) => buildTaskLine(task, idx + 1)).join("\n");
    return `${memberName}\n\n${lines}`;
  });

  const total = members.reduce((sum, name) => sum + groupedTasks[name].length, 0);

  return `Morning Brief\n\n今天共有 ${total} 件事項需要留意。\n\n${sections.join("\n\n")}`;
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

async function getPrivateTargets(memberName = null) {
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

function groupTasksByMember(tasks) {
  const grouped = {};

  for (const task of tasks || []) {
    const member = task.member || "未指派";
    if (!grouped[member]) grouped[member] = [];
    grouped[member].push(task);
  }

  return grouped;
}

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return true;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${cronSecret}`;
}

async function alreadyDelivered(reportType, sendDate, targetMode) {
  const { data, error } = await supabase
    .from("report_delivery_logs")
    .select("id")
    .eq("report_type", reportType)
    .eq("send_date", sendDate)
    .eq("target_mode", targetMode)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function writeDeliveryLog({ reportType, sendDate, targetMode, status, errorMessage = null }) {
  const { error } = await supabase
    .from("report_delivery_logs")
    .insert([{
      report_type: reportType,
      send_date: sendDate,
      target_mode: targetMode,
      status,
      error_message: errorMessage,
    }]);

  if (error) throw error;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = getTaipeiDateString(0);
  const nowHHMM = getTaipeiHHMM();

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("report_settings")
      .select("*")
      .eq("report_type", "morning")
      .limit(1)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "尚未建立 report_settings",
      });
    }

    if (!settings.enabled) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "晨間報表未啟用",
      });
    }

    const sendTime = normalizeSendTime(settings.send_time);

    // 允許 5 分鐘內觸發，避免 cron 剛好慢一點就錯過。
    const [sendH, sendM] = sendTime.split(":").map(Number);
    const [nowH, nowM] = nowHHMM.split(":").map(Number);
    const sendMinutes = sendH * 60 + sendM;
    const nowMinutes = nowH * 60 + nowM;
    const diff = nowMinutes - sendMinutes;

    if (diff < 0 || diff > 5) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: `尚未到設定時間，目前 ${nowHHMM}，設定 ${sendTime}`,
      });
    }

    const targetMode = settings.target_mode || "private";

    const delivered = await alreadyDelivered("morning", today, targetMode);
    if (delivered) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "今日晨間報表已發送過",
      });
    }

    let query = supabase
      .from("events")
      .select("*")
      .or("is_done.eq.false,completed.eq.false")
      .order("date", { ascending: true });

    const conditions = [];

    if (settings.include_today_events) {
      conditions.push(`date.eq.${today}`);
    }

    if (settings.include_overdue_events) {
      conditions.push(`date.lt.${today}`);
    }

    if (!conditions.length) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "報表內容設定為空",
      });
    }

    const { data: tasks, error: tasksError } = await query.or(conditions.join(","));

    if (tasksError) throw tasksError;

    const activeTasks = (tasks || []).filter(t => !t.is_done && !t.completed && t.type !== "mood");
    const grouped = groupTasksByMember(activeTasks);

    const results = {
      group: false,
      privateCount: 0,
      privateTargets: [],
      taskCount: activeTasks.length,
    };

    if (targetMode === "group" || targetMode === "both") {
      const groupId = process.env.FAIRYM_OPS_GROUP_ID;
      if (!groupId) throw new Error("Missing FAIRYM_OPS_GROUP_ID");

      await pushLineText(groupId, buildGroupReport(grouped));
      results.group = true;
    }

    if (targetMode === "private" || targetMode === "both") {
      const allTargets = await getPrivateTargets();

      for (const target of allTargets) {
        const memberTasks = activeTasks.filter(t => {
          if (t.member === target.name) return true;
          if (t.member === "全家") return true;
          return false;
        });

        await pushLineText(target.line_user_id, buildPrivateReport(target.name, memberTasks));
        results.privateCount += 1;
        results.privateTargets.push(target.name);
      }
    }

    await writeDeliveryLog({
      reportType: "morning",
      sendDate: today,
      targetMode,
      status: "sent",
    });

    return res.status(200).json({
      ok: true,
      sent: true,
      today,
      nowHHMM,
      sendTime,
      targetMode,
      results,
    });
  } catch (err) {
    console.error("morning-report failed:", err);

    try {
      await writeDeliveryLog({
        reportType: "morning",
        sendDate: today,
        targetMode: "unknown",
        status: "failed",
        errorMessage: err.message,
      });
    } catch (_) {}

    return res.status(500).json({ error: err.message });
  }
};
