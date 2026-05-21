import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTodayString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isFairyMMessage(text) {
  return /fairym|fairy m|@FairyM|FairyM|@fairym/i.test(text.trim());
}

function extractContent(text) {
  return text.replace(/^@?fairy\s?m\s*/gi, "").trim();
}

function classifyMessage(message) {
  const text = (message || "").trim();
  const content = extractContent(text);

  let type = "todo";
  let member = "全家";
  let date = getTodayString(0);
  let mood = null;

  if (/明天/.test(content)) date = getTodayString(1);
  else if (/後天/.test(content)) date = getTodayString(2);

  if (/買|採買|超市|補|衛生紙|洗碗精|菜|牛奶|米/.test(content)) {
    type = "shop";
  } else if (/回診|看醫生|牙醫|吃藥|健康|檢查|診所|醫院/.test(content)) {
    type = "health";
  } else if (/濾網|加鹽|機油|保養|清潔|換|澆花|倒垃圾/.test(content)) {
    type = "routine";
  } else if (/心情|今天覺得|好累|開心|難過|煩|不錯|累|焦慮|壓力|緊張|興奮|感動|委屈|生氣|煩躁|疲憊|滿足/.test(content)) {
    type = "mood";
    const moodMap = { "開心":"😊","快樂":"😄","累":"😴","好累":"😴","煩":"😤","難過":"😢","不錯":"🙂","放鬆":"😌" };
    for (const [word, emoji] of Object.entries(moodMap)) {
      if (content.includes(word)) { mood = emoji; break; }
    }
  } else {
    type = "todo";
  }

  if (/媽媽|媽/.test(content)) member = "媽媽";
  else if (/爸爸|爸/.test(content)) member = "爸爸";
  else if (/姐姐|姊姊/.test(content)) member = "姐姐";
  else if (/哥哥|弟弟|妹妹|小孩|孩子|兒子|女兒/.test(content)) member = "小孩";

  return { type, content, date, member, mood };
}

async function pushNotification(text) {
  const groupId = process.env.FAIRYM_OPS_GROUP_ID;
  if (!groupId) return;

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

  // 先查 Supabase，有資料就跳過 API 呼叫
  const { data: existing } = await supabase
    .from("group_aliases")
    .select("group_name")
    .eq("group_id", groupId)
    .maybeSingle();

  if (existing) return existing.group_name;

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

  // 先查 Supabase，有資料就跳過 API 呼叫
  const { data: existing } = await supabase
    .from("line_users")
    .select("display_name")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

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

async function insertRoutine(classified) {
  const { data: existing } = await supabase
    .from("routines")
    .select("*")
    .ilike("name", `%${classified.content}%`)
    .maybeSingle();

  let routine = existing;

  if (!routine) {
    const { data, error } = await supabase
      .from("routines")
      .insert([{
        name: classified.content,
        member: classified.member,
        interval_days: 30,
      }])
      .select()
      .single();
    if (error) throw error;
    routine = data;
  }

  const { error: logError } = await supabase
    .from("routine_logs")
    .insert([{
      routine_name: routine.name,
      member: classified.member,
      interval_days: routine.interval_days || 30,
      last_done_at: classified.date,
      note: "LINE 記錄",
    }]);

  if (logError) throw logError;

  // 同步寫入 events，讓前端日曆可以顯示
  await supabase.from("events").insert([{
    date: classified.date,
    type: "routine",
    text: classified.content,
    member: classified.member,
    mood: null,
    is_done: true,
  }]);

  return routine;
}

async function insertEvent(classified) {
  const { data, error } = await supabase
    .from("events")
    .insert([{
      date: classified.date,
      type: classified.type,
      text: classified.content,
      member: classified.member,
      mood: classified.mood || null,
      is_done: false,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const messageText = event.message.text;

      if (!isFairyMMessage(messageText)) continue;

      const groupId = event.source?.groupId || null;
      const userId = event.source?.userId || null;
      const classified = classifyMessage(messageText);

      console.log("classified:", classified);

      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      await supabase.from("line_messages").insert([{
        group_id: groupId,
        user_id: userId,
        message_text: messageText,
        message_type: "text",
      }]);

      if (classified.type === "routine") {
        await insertRoutine(classified);
        await pushNotification(
`🔁 FairyM 記下週期事項

「${classified.content}」

👤 負責：${classified.member}
📅 記錄日期：${classified.date}`
        );
      } else if (classified.type === "mood") {
        await insertEvent(classified);
        await pushNotification(
`${classified.mood || "💬"} FairyM 記下心情

「${classified.content}」

👤 ${classified.member}
📅 ${classified.date}`
        );
      } else {
        await insertEvent(classified);
        const typeLabel = { todo:"待辦", shop:"採買", health:"健康", remind:"提醒" };
        await pushNotification(
`🏠 FairyM 新增家庭事項

「${classified.content}」

👤 負責：${classified.member}
📅 日期：${classified.date}
🏷 分類：${typeLabel[classified.type] || "待辦"}`
        );
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
