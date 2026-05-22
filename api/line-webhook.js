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

function classifyMessage(message, userRole = "全家", allMembers = []) {
  const text = (message || "").trim();
  const content = extractContent(text);

  let type = "todo";
  let member = userRole;
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

  for (const m of allMembers) {
    if (content.includes(m.name) || content.includes(m.role_name)) {
      member = m.name;
      break;
    }
  }

  return { type, content, date, member, mood };
}

async function pushNotification(messagePayload, targetGroupId = null) {
  const groupId = targetGroupId || process.env.FAIRYM_OPS_GROUP_ID;
  if (!groupId) return;

  const messages = typeof messagePayload === 'string'
    ? [{ type: "text", text: messagePayload }]
    : [messagePayload];

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: messages,
    }),
  });

  if (!response.ok) {
    console.error("LINE push error:", await response.text());
  }
}

async function replyMessage(replyToken, messagePayload) {
  if (!replyToken) return;

  const messages = typeof messagePayload === 'string'
    ? [{ type: "text", text: messagePayload }]
    : [messagePayload];

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages,
    }),
  });

  if (!response.ok) {
    console.error("LINE reply error:", await response.text());
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
      const replyToken = event.replyToken || null;

      if (event.type === "join") {
        const welcomeTemplate = {
          type: "template",
          altText: "👋 大家好！我是 FairyM 生活導航助理。請點擊按鈕開啟生活導航。",
          template: {
            type: "buttons",
            text: "👋 大家好！我是 FairyM 生活導航助理。\n\n請點擊下方按鈕開啟「生活導航」並綁定您的專屬角色，我們就可以開始自動記錄生活囉！",
            actions: [{ type: "uri", label: "打開生活導航", uri: "https://liff.line.me/2010165775-xmYZj7n4" }]
          }
        };
        await replyMessage(replyToken, welcomeTemplate);
        continue;
      }

      if (event.type === "memberJoined") {
        for (const member of event.joined.members) {
          const newUserId = member.userId;
          await syncGroupName(groupId);
          await syncUserProfile(groupId, newUserId);
        }
        const newbieTemplate = {
          type: "template",
          altText: "🎉 歡迎新夥伴加入！請點擊按鈕開啟生活導航。",
          template: {
            type: "buttons",
            text: "🎉 歡迎新夥伴加入！\n\n系統已偵測到您的進駐。請直接點開下方的按鈕，綁定您的專屬身分喔！",
            actions: [{ type: "uri", label: "打開生活導航", uri: "https://liff.line.me/2010165775-xmYZj7n4" }]
          }
        };
        await replyMessage(replyToken, newbieTemplate);
        continue;
      }

      if (event.type === "follow") {
        const privateTemplate = {
          type: "template",
          altText: "🌸 歡迎加入 FairyM！請點擊按鈕開啟生活導航。",
          template: {
            type: "buttons",
            text: "🌸 歡迎加入 FairyM！\n\n您可以把我邀請到您的「家庭 LINE 群組」裡。如果已在群組內，請點擊下方按鈕打開我們的專屬基地：",
            actions: [{ type: "uri", label: "打開生活導航", uri: "https://liff.line.me/2010165775-xmYZj7n4" }]
          }
        };
        await replyMessage(replyToken, privateTemplate);
        continue;
      }

      // --- 擋下非文字訊息 ---
      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const messageText = event.message.text;

      // 🌟 第一步：無聲雷達！只要群組有人講話，無論有沒有叫機器人，都先默默記錄他的 LINE ID
      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      // 🌟 第二步：確定有叫 @FairyM 才繼續往下執行，沒有就直接跳出
      if (!isFairyMMessage(messageText)) continue;

      const { data: allMembersData } = await supabase.from("members").select("name, role_name");
      const allMembers = allMembersData || [];

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

      // 🌟 攔截機制：如果發現發言者還沒綁定角色，拒絕新增任務並要求綁定
      if (userRole === "全家") {
        const unboundTemplate = {
          type: "template",
          altText: "⚠️ 系統尚未認識您！請先綁定角色。",
          template: {
            type: "buttons",
            text: "⚠️ 系統尚未認識您喔！\n\n為確保任務能正確指派，請先點擊下方按鈕綁定您的「專屬角色」後，再重新告訴我您要記錄什麼事項！",
            actions: [{ type: "uri", label: "去綁定身分", uri: "https://liff.line.me/2010165775-xmYZj7n4" }]
          }
        };
        await replyMessage(replyToken, unboundTemplate);
        continue; // 攔截！不往下執行分類與寫入資料庫
      }
      
      // 🌟 執行 AI 分類 (已修正重複宣告的問題)
      const classified = classifyMessage(messageText, userRole, allMembers);

      await supabase.from("line_messages").insert([{ group_id: groupId, user_id: userId, message_text: messageText, message_type: "text" }]);

      // 🌟 定義您的專屬後台通知群組 (FairyM Ops)
      const OPS_GROUP_ID = "C4f6db0e27ad7103cef2a8d00be1bcf5a";

      // 🌟 通知雙向分流處理
      if (classified.type === "routine") {
        await insertRoutine(classified);
        
        await replyMessage(replyToken, "✅ 已記錄");
        await pushNotification(`🔁 FairyM 記下週期事項\n\n「${classified.content}」\n\n👤 負責：${classified.member}\n📅 記錄日期：${classified.date}`, OPS_GROUP_ID);
        
      } else if (classified.type === "mood") {
        await insertEvent(classified);
        
        await replyMessage(replyToken, "✅ 已記錄");
        await pushNotification(`${classified.mood || "💬"} FairyM 收到心情分享\n\n${classified.member}說：「${classified.content}」\n\n📅 日期：${classified.date}`, OPS_GROUP_ID);
        
      } else {
        await insertEvent(classified);
        const typeLabel = { todo:"待辦", shop:"採買", health:"健康", remind:"提醒" };
        
        await replyMessage(replyToken, "✅ 已記錄");
        await pushNotification(`🏠 FairyM 新增共生事項\n\n「${classified.content}」\n\n👤 負責：${classified.member}\n📅 日期：${classified.date}\n🏷 分類：${typeLabel[classified.type] || "待辦"}`, OPS_GROUP_ID);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
