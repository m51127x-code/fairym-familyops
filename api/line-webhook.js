const { createClient } = require("@supabase/supabase-js");

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

// 加入第二個參數 userRole，預設為 "全家"
function classifyMessage(message, userRole = "全家") {
  const text = (message || "").trim();
  const content = extractContent(text);

  let type = "todo";
  let member = userRole; // 預設使用傳進來的發言者身分
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

  // 文字覆蓋：如果內容特別提到別人，才覆蓋掉原本的發言者
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

  // 同步寫入 events，讓前端日曆可以顯示 (修正 500 錯誤的部分)
  await supabase
    .from("events")
    .insert([{
      title: classified.content,
      text: classified.content,
      date: classified.date,
      type: classified.type,
      member: classified.member,
      mood: classified.mood || null,
      is_done: false,
    }]);

  return routine;
}

async function insertEvent(classified) {
  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        title: classified.content,
        text: classified.content,
        date: classified.date,
        type: classified.type,
        member: classified.member,
        mood: classified.mood || null,
        is_done: false,
      },
    ])
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

      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      // --- 新增功能：攔截使用者設定角色的指令 ---
      const roleMatch = messageText.match(/^@?Fairy\s?M\s*我是(媽媽|爸爸|姐姐|哥哥|弟弟|妹妹|小孩)/i);
      if (roleMatch && userId) {
        const newRole = roleMatch[1];
        
        // 寫入 Supabase 資料庫
        await supabase
          .from("line_users")
          .update({ role: newRole })
          .eq("user_id", userId);

        await pushNotification(`✅ 沒問題！我記住了，以後發送訊息預設就是「${newRole}」。`);
        continue; // 處理完設定就跳到下一則訊息
      }
      // ------------------------------------------

      // 撈取使用者的角色 (如果資料庫沒設定過，預設為 "全家")
      let userRole = "全家";
      if (userId) {
        const { data: userData } = await supabase
          .from("line_users")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
          
        if (userData && userData.role) {
          userRole = userData.role;
        }
      }

      // 將查到的角色傳入分類器
      const classified = classifyMessage(messageText, userRole);
      console.log("classified:", classified);

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
        // --- 修改心情的推播格式 ---
        await pushNotification(
`${classified.mood || "💬"} FairyM 收到心情分享

${classified.member}說：「${classified.content}」

📅 日期：${classified.date}`
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
