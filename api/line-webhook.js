const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTodayString(offsetDays = 0) {
  const date = new Date();
  date.setHours(date.getHours() + 8);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isFairyMMessage(text) {
  return /fairym|fairy m|@FairyM|FairyM|@fairym/i.test(text.trim());
}

function extractContent(text) {
  return text.replace(/^@?fairy\s?m\s*/gi, "").trim();
}

// 🌟 升級：傳入 allMembers 動態名單進行比對，不再寫死角色
function classifyMessage(message, userRole = "全家", allMembers = []) {
  const text = (message || "").trim();
  const content = extractContent(text);

  let type = "todo";
  let member = userRole; // 預設使用已綁定的發言者身分
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

  // 🌟 動態文字覆蓋：如果內容特別提到 APP 裡建立好的某位家人，才覆蓋掉原本的發言者
  for (const m of allMembers) {
    if (content.includes(m.name) || content.includes(m.role_name)) {
      member = m.name;
      break;
    }
  }

  return { type, content, date, member, mood };
}

// 🌟 升級：支援傳入動態的 targetGroupId，確保回覆到正確的群組
async function pushNotification(text, targetGroupId = null) {
  const groupId = targetGroupId || process.env.FAIRYM_OPS_GROUP_ID;
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
  const { data: existing } = await supabase.from("group_aliases").select("group_name").eq("group_id", groupId).maybeSingle();
  if (existing) return existing.group_name;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    if (!response.ok) return null;
    const summary = await response.json();
    await supabase.from("group_aliases").upsert([{ group_id: groupId, group_name: summary.groupName || null }], { onConflict: "group_id" });
    return summary.groupName;
  } catch (error) { return null; }
}

async function syncUserProfile(groupId, userId) {
  if (!groupId || !userId) return null;
  const { data: existing } = await supabase.from("line_users").select("display_name").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  if (existing) return existing;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    if (!response.ok) return null;
    const profile = await response.json();
    await supabase.from("line_users").upsert([{ group_id: groupId, user_id: userId, display_name: profile.displayName || null, picture_url: profile.pictureUrl || null }], { onConflict: "group_id,user_id" });
    return profile;
  } catch (error) { return null; }
}

async function insertRoutine(classified) {
  const { data: existing } = await supabase.from("routines").select("*").ilike("name", `%${classified.content}%`).maybeSingle();
  let routine = existing;

  if (!routine) {
    const { data, error } = await supabase.from("routines").insert([{ name: classified.content, member: classified.member, interval_days: 30 }]).select().single();
    if (error) throw error;
    routine = data;
  }

  await supabase.from("routine_logs").insert([{ routine_name: routine.name, member: classified.member, interval_days: routine.interval_days || 30, last_done_at: classified.date, note: "LINE 記錄" }]);
  await supabase.from("events").insert([{ title: classified.content, text: classified.content, date: classified.date, type: classified.type, member: classified.member, mood: classified.mood || null, is_done: false }]);
  return routine;
}

async function insertEvent(classified) {
  const { data, error } = await supabase.from("events").insert([{ title: classified.content, text: classified.content, date: classified.date, type: classified.type, member: classified.member, mood: classified.mood || null, is_done: false }]).select().single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const events = req.body.events || [];

    for (const event of events) {
      const groupId = event.source?.groupId || null;
      const userId = event.source?.userId || null;

      // 🌟 第一階段：迎新廣播 (攔截新成員加入)
      if (event.type === "memberJoined") {
        const welcomeMsg = `🎉 歡迎加入共生公會 (Co-op Guild)！\n\n系統偵測到新成員進駐。請管理員先至 APP 設定您的專屬角色後，請您在此輸入：\n\n「@FairyM 綁定 [您的系統名稱]」\n\n以完成連線開通！`;
        await pushNotification(welcomeMsg, groupId);
        continue; // 處理完歡迎就跳過
      }

      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const messageText = event.message.text;
      if (!isFairyMMessage(messageText)) continue;

      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      // 🌟 第一階段：身份綁定指令攔截 (@FairyM 綁定 老爸)
      const bindMatch = messageText.match(/^@?Fairy\s?M\s*綁定\s*(.+)/i);
      if (bindMatch && userId) {
        const targetName = bindMatch[1].trim();
        
        // 去 members 表找有沒有這個名字
        const { data: memberData } = await supabase
          .from("members")
          .select("*")
          .eq("name", targetName)
          .maybeSingle();

        if (memberData) {
          // 找到了，把 userId 寫進去
          await supabase
            .from("members")
            .update({ line_user_id: userId })
            .eq("id", memberData.id);

          await pushNotification(`✅ 綁定成功！\n已將您的 LINE 帳號連線至『${targetName}』。\n未來您輸入的事項將自動標記為您負責。`, groupId);
        } else {
          await pushNotification(`⚠️ 找不到『${targetName}』這個角色。\n請確認管理員是否已在 APP 的「動態成員設定」中建立該名稱。`, groupId);
        }
        continue; 
      }

      // --- 一般事項處理邏輯 ---

      // 1. 去 Supabase 撈出系統目前所有的動態成員
      const { data: allMembersData } = await supabase.from("members").select("name, role_name");
      const allMembers = allMembersData || [];

      // 2. 判斷發言者的身分 (用 userId 去 members 表找對應的名字)
      let userRole = "全家";
      if (userId) {
        const { data: boundMember } = await supabase
          .from("members")
          .select("name")
          .eq("line_user_id", userId)
          .maybeSingle();
          
        if (boundMember && boundMember.name) {
          userRole = boundMember.name;
        }
      }

      // 3. 傳入動態成員與發言者進行 AI 分類
      const classified = classifyMessage(messageText, userRole, allMembers);

      await supabase.from("line_messages").insert([{ group_id: groupId, user_id: userId, message_text: messageText, message_type: "text" }]);

      if (classified.type === "routine") {
        await insertRoutine(classified);
        await pushNotification(`🔁 FairyM 記下週期事項\n\n「${classified.content}」\n\n👤 負責：${classified.member}\n📅 記錄日期：${classified.date}`, groupId);
      } else if (classified.type === "mood") {
        await insertEvent(classified);
        await pushNotification(`${classified.mood || "💬"} FairyM 收到心情分享\n\n${classified.member}說：「${classified.content}」\n\n📅 日期：${classified.date}`, groupId);
      } else {
        await insertEvent(classified);
        const typeLabel = { todo:"待辦", shop:"採買", health:"健康", remind:"提醒" };
        await pushNotification(`🏠 FairyM 新增共生事項\n\n「${classified.content}」\n\n👤 負責：${classified.member}\n📅 日期：${classified.date}\n🏷 分類：${typeLabel[classified.type] || "待辦"}`, groupId);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
