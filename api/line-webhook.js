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

function classifyMessage(message) {
  const text = (message || "").trim();

  let type = "event";
  let member = "全家";
  let date = getTodayString(0);

  if (/明天/.test(text)) date = getTodayString(1);
  if (/後天/.test(text)) date = getTodayString(2);

  if (/買|採買|超市|補|衛生紙|洗碗精|菜|牛奶|米/.test(text)) {
    type = "shopping";
  } else if (/回診|看醫生|牙醫|吃藥|健康|檢查|診所|醫院/.test(text)) {
    type = "health";
  } else if (/濾網|加鹽|機油|保養|清潔|換|澆花|倒垃圾/.test(text)) {
    type = "routine";
  } else if (/心情|今天覺得|好累|開心|難過|煩|不錯/.test(text)) {
    type = "note";
  }

  if (/媽媽|媽/.test(text)) member = "媽媽";
  else if (/爸爸|爸/.test(text)) member = "爸爸";
  else if (/姐姐|姊姊/.test(text)) member = "姐姐";
  else if (/哥哥|弟弟|妹妹|小孩|孩子|兒子|女兒/.test(text)) member = "小孩";

  return {
    type,
    title: text,
    date,
    member,
  };
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

async function insertRoutine(classified) {
  const { data: existingRoutine, error: findError } = await supabase
    .from("routines")
    .select("*")
    .eq("name", classified.title)
    .maybeSingle();

  if (findError) {
    console.error("find routine error:", findError);
  }

  let routine = existingRoutine;

  if (!routine) {
    const { data, error } = await supabase
      .from("routines")
      .insert([
        {
          name: classified.title,
          member: classified.member,
          interval_days: 30,
          category: "routine",
          active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    routine = data;
  }

  const { error: logError } = await supabase.from("routine_logs").insert([
    {
      routine_name: routine.name,
      member: routine.member || classified.member,
      interval_days: routine.interval_days || 30,
      last_done_at: classified.date,
      note: "LINE 記錄",
    },
  ]);

  if (logError) throw logError;

  return routine;
}

async function insertEvent(classified) {
  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        title: classified.title,
        type: classified.type,
        member: classified.member,
        date: classified.date,
        completed: false,
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

      const groupId = event.source?.groupId || null;
      const userId = event.source?.userId || null;
      const targetGroupId = process.env.FAIRYM_OPS_GROUP_ID;

      console.log("LINE source:", event.source);
      console.log("ENV group:", targetGroupId);
      console.log("Incoming group:", groupId);

      if (targetGroupId && groupId !== targetGroupId) {
        console.log("ignored: group not matched");
        continue;
      }

      const messageText = event.message.text;
      const classified = classifyMessage(messageText);

      console.log("classified:", classified);

      await syncGroupName(groupId);
      await syncUserProfile(groupId, userId);

      await supabase.from("line_messages").insert([
        {
          group_id: groupId,
          user_id: userId,
          message_text: messageText,
          message_type: "text",
        },
      ]);

      if (classified.type === "routine") {
        await insertRoutine(classified);

        await pushNotification(
          `✅ 已記錄週期事項\n\n${classified.title}\n負責：${classified.member}\n日期：${classified.date}`
        );
      } else {
        await insertEvent(classified);

        await pushNotification(
          `✅ 已新增家庭事項\n\n${classified.title}\n類型：${classified.type}\n負責：${classified.member}\n日期：${classified.date}`
        );
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("webhook failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
