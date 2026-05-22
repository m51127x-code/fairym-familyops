const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTodayString(offsetDays = 0) {
  const date = new Date();
  date.setHours(date.getHours() + 8); // 台灣時間 UTC+8
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isFairyMMessage(text) {
  return /fairym|fairy m|@FairyM|FairyM|@fairym|幫我記|記一下/i.test(text.trim());
}

function extractContent(text) {
  return text.replace(/^@?fairy\s?m|幫我記|記一下\s*/gi, "").trim();
}

// 🌟 第二層：Gemini AI 降落傘引擎 (已強化防呆與時間擷取)
async function callGeminiAI(text, userRole, allMembers) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ 尚未設定 GEMINI_API_KEY，略過 AI 解析");
    return null; 
  }

  const membersList = allMembers.map(m => m.name).join(", ");
  const today = getTodayString(0);
  
  const prompt = `
  你是一個家庭管家語意解析器。今天是 ${today}。
  請將以下使用者的訊息轉換為 JSON 格式。
  
  原始訊息：「${text}」
  預設發言者：「${userRole}」
  可選家庭成員：${membersList}
  
  規則：
  1. content: 拔除所有「相對日期」字眼（如：這週六、下週二、明天），但必須保留具體時間（如：10:30、下午三點），剩下的作為純粹動作描述（例如：「這週六10:30去美甲」必須變成「10:30去美甲」）。
  2. date: 將訊息中的時間詞彙轉換為 YYYY-MM-DD 的絕對日期格式。如果沒有提到日期，預設為 ${today}。如果提到這週幾，請根據今天是 ${today} 正確推算。
  3. member: 負責此任務的成員。如果沒提到名字，預設為「${userRole}」。
  4. type: 嚴格從以下選擇：todo (待辦), shop (採買), health (健康), routine (週期), mood (心情)。
  5. mood: 如果 type 是 mood，請給一個最適合的 Emoji（如：😊, 😢, 😰, 🤯），否則為 null。
  
  回傳格式範例（必須是合法 JSON）：
  {"content": "10:30去美甲", "date": "2026-05-23", "member": "米雪", "type": "todo", "mood": null}
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      })
    });
    
    const data = await response.json();
    
    // 🛡️ 防呆機制：如果回傳的資料裡面沒有 candidates，直接記錄錯誤並退回本地處理
    if (!data.candidates || data.candidates.length === 0) {
      console.error("Gemini API 回傳異常，可能是 Key 錯誤或權限問題:", JSON.stringify(data));
      return null;
    }
    
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
  } catch (e) {
    console.error("Gemini 解析過程發生重大異常:", e);
    return null;
  }
}

// 🌟 第一層：本地正則分類與清理引擎
function classifyMessage(message, userRole = "全家", allMembers = []) {
  const text = (message || "").trim();
  let content = extractContent(text);
  
  let type = "todo";
  let member = userRole;
  let date = getTodayString(0);
  let mood = null;
  let needAI = false;

  // 1. 基礎日期推算與「字眼徹底移除」
  const dateMapping = {
    "大後天": 3,
    "後天": 2,
    "明天": 1,
    "今天": 0,
    "昨天": -1,
    "前天": -2
  };
  
  for (const [key, offset] of Object.entries(dateMapping)) {
    if (content.includes(key)) {
      date = getTodayString(offset);
      content = content.replace(key, "").trim(); // 拔除「昨天」、「明天」等字眼
      break; 
    }
  }

  // 2. 判斷是否需要召喚 AI (若包含複雜時間特徵)
  if (/週|星期|禮拜|號|日|月|\/|:|點|早上|下午|晚上/.test(content)) {
    needAI = true;
  }

  // 3. 基礎分類
  if (/買|採買|超市|補|衛生紙|洗碗精|菜|牛奶|米/.test(content)) type = "shop";
  else if (/回診|看醫生|牙醫|吃藥|健康|檢查|診所|醫院/.test(content)) type = "health";
  else if (/濾網|加鹽|機油|保養|清潔|換|澆花|倒垃圾/.test(content)) type = "routine";
  else if (/心情|今天覺得|好累|開心|難過|煩|不錯|累|焦慮|壓力|緊張|興奮|感動|委屈|生氣|煩躁|疲憊|滿足/.test(content)) {
    type = "mood";
    const moodMap = { "開心":"😊","快樂":"😄","累":"😴","好累":"😴","煩":"😤","難過":"😢","不錯":"🙂","放鬆":"😌", "焦慮":"😰", "壓力":"🤯" };
    for (const [word, emoji] of Object.entries(moodMap)) {
      if (content.includes(word)) { mood = emoji; break; }
    }
  }

  // 4. 指派人員清理 (把提到的人名也從任務文字中拔除)
  for (const m of allMembers) {
    if (content.includes(m.name) || content.includes(m.role_name)) {
      member = m.name;
      content = content.replace(m.name, "").replace(m.role_name, "").trim();
      break;
    }
  }

  return { type, content, date, member, mood, needAI };
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
    body: JSON.stringify({ to: groupId, messages: messages }),
  });

  if (!response.ok) console.error("LINE push error:", await response.text());
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
    body: JSON.stringify({ replyToken: replyToken, messages: messages }),
  });

  if (!response.ok) console.error("LINE reply error:", await response.text());
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
  if (existing) return;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    if (!response.ok) return null;
    const profile = await response.json();
    await supabase.from("line_users").upsert([{ group_id: groupId, user_id: userId, display_name: profile.displayName || null, picture_url: profile.pictureUrl || null }], { onConflict: "group_id,user_id" });
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
          await syncGroupName(groupId);
          await syncUserProfile(groupId, member.userId);
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

      if (event.type !== "message" || event.message?.type !== "text") continue;

      const messageText = event.message.text;

      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      if (!isFairyMMessage(messageText)) continue;

      const { data: allMembersData } = await supabase.from("members").select("name, role_name");
      const allMembers = allMembersData || [];

      let userRole = "全家";
      if (userId) {
        const { data: boundMember } = await supabase.from("members").select("name").eq("line_user_id", userId).maybeSingle();
        if (boundMember && boundMember.name) userRole = boundMember.name;
      }

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
        continue; 
      }
      
      // 🌟 核心分流：先用本地引擎解析
      let classified = classifyMessage(messageText, userRole, allMembers);

      // 🌟 AI 降落傘啟動：如果本地引擎發現複雜日期，請 Gemini 接手
      if (classified.needAI) {
        const aiResult = await callGeminiAI(extractContent(messageText), userRole, allMembers);
        if (aiResult) {
          classified = {
            ...classified,
            content: aiResult.content || classified.content,
            date: aiResult.date || classified.date,
            member: aiResult.member || classified.member,
            type: aiResult.type || classified.type,
            mood: aiResult.mood || classified.mood
          };
        }
      }

      await supabase.from("line_messages").insert([{ group_id: groupId, user_id: userId, message_text: messageText, message_type: "text" }]);

      const OPS_GROUP_ID = process.env.FAIRYM_OPS_GROUP_ID || "C4f6db0e27ad7103cef2a8d00be1bcf5a";

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
        await pushNotification(`🏠 FairyM 新增事項\n\n「${classified.content}」\n\n👤 負責：${classified.member}\n📅 日期：${classified.date}\n🏷 分類：${typeLabel[classified.type] || "待辦"}`, OPS_GROUP_ID);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
