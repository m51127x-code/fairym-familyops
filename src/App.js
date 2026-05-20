import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./styles.css";
import { classifyMessage } from "./classifyMessage";

const STATUS_LABEL = {
  open: "未處理",
  tracking: "處理中",
  resolved: "已解決",
  ignored: "忽略",
};

const URGENCY_LABEL = {
  high: "高",
  medium: "中",
  normal: "一般",
  low: "低",
};

const ISSUE_PRESETS = [
  { label: "系統異常", issue_type: "系統異常", urgency: "medium" },
  { label: "操作疑問", issue_type: "操作疑問", urgency: "normal" },
  { label: "資料問題", issue_type: "資料問題", urgency: "medium" },
  { label: "需求變更", issue_type: "需求變更", urgency: "normal" },
  { label: "高優先", issue_type: "客戶問題", urgency: "high" },
  { label: "其他", issue_type: "其他", urgency: "normal" },
  { label: "測試", issue_type: "測試", urgency: "normal" },
  
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-TW");
}

function getMinutesAgo(value) {
  if (!value) return null;
  const created = new Date(value).getTime();
  const now = Date.now();
  return Math.floor((now - created) / 1000 / 60);
}

function getAgingLabel(value) {
  const minutes = getMinutesAgo(value);
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function getRiskLevel(group) {
  if (group.high > 0) return "high";
  if (group.open >= 3) return "medium";
  if (group.tracking > 0) return "watch";
  return "normal";
}

function getRiskLabel(level) {
  const labels = {
    high: "高風險",
    medium: "需注意",
    watch: "追蹤中",
    normal: "穩定",
  };

  return labels[level] || "穩定";
}

export default function App() {
  const [issues, setIssues] = useState([]);
  const [messages, setMessages] = useState([]);
  const [groupAliases, setGroupAliases] = useState([]);
  const [lineUsers, setLineUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [loading, setLoading] = useState(true);

  const groupMap = useMemo(() => {
    return Object.fromEntries(
      groupAliases.map((group) => [group.group_id, group])
    );
  }, [groupAliases]);
const userMap = useMemo(() => {
  return Object.fromEntries(
    lineUsers.map((user) => [
      `${user.group_id}_${user.user_id}`,
      user,
    ])
  );
}, [lineUsers]);
  function getGroupDisplayName(groupId) {
    const group = groupMap[groupId];

    return (
      group?.alias ||
      group?.group_name ||
      groupId ||
      "unknown"
    );
  }
function getUserDisplayName(groupId, userId) {
  const user = userMap[`${groupId}_${userId}`];

  return (
    user?.display_name ||
    userId ||
    "unknown"
  );
}
  async function loadIssues() {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load issues error:", error);
      return [];
    }

    return data || [];
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("line_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("load messages error:", error);
      return [];
    }

    return data || [];
  }

  async function loadGroupAliases() {
    const { data, error } = await supabase
      .from("group_aliases")
      .select("*");

    if (error) {
      console.error("load group aliases error:", error);
      return [];
    }

    return data || [];
  }
async function loadLineUsers() {
  const { data, error } = await supabase
    .from("line_users")
    .select("*");

  if (error) {
    console.error("load line users error:", error);
    return [];
  }

  return data || [];
}
  async function loadData() {
    setLoading(true);

    const [
  issueData,
  messageData,
  aliasData,
  userData,
] = await Promise.all([
  loadIssues(),
  loadMessages(),
  loadGroupAliases(),
  loadLineUsers(),
]);

    setIssues(issueData);
    setMessages(messageData);
    setGroupAliases(aliasData);
    setLineUsers(userData);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("issues")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("update status error:", error);
      alert("狀態更新失敗，請看 console / Vercel logs");
      return;
    }

    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === id ? { ...issue, status } : issue
      )
    );
  }

  async function createIssueFromMessage(message, preset) {
    const { data, error } = await supabase
      .from("issues")
      .insert([
        {
          group_id: message.group_id || null,
          source_message: message.message_text,
          issue_title: message.message_text,
          issue_type: preset.issue_type,
          urgency: preset.urgency,
          status: "open",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("create issue error:", error);
      alert("建立 issue 失敗，請看 console");
      return;
    }

    setIssues((prev) => [data, ...prev]);
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const today = new Date().toDateString();

    return {
      total: issues.length,
      high: issues.filter((i) => i.urgency === "high").length,
      open: issues.filter((i) => i.status === "open").length,
      tracking: issues.filter((i) => i.status === "tracking").length,
      resolved: issues.filter((i) => i.status === "resolved").length,
      todayMessages: messages.filter(
        (m) => m.created_at && new Date(m.created_at).toDateString() === today
      ).length,
    };
  }, [issues, messages]);

  const groupSummary = useMemo(() => {
    const map = {};

    issues.forEach((issue) => {
      const groupId = issue.group_id || "unknown";

      if (!map[groupId]) {
        map[groupId] = {
          group_id: groupId,
          total: 0,
          high: 0,
          open: 0,
          tracking: 0,
          resolved: 0,
          latest_at: issue.created_at,
          latest_message: issue.issue_title || issue.source_message || "",
        };
      }

      map[groupId].total += 1;

      if (issue.urgency === "high") map[groupId].high += 1;
      if (issue.status === "open") map[groupId].open += 1;
      if (issue.status === "tracking") map[groupId].tracking += 1;
      if (issue.status === "resolved") map[groupId].resolved += 1;

      if (
        issue.created_at &&
        new Date(issue.created_at) > new Date(map[groupId].latest_at)
      ) {
        map[groupId].latest_at = issue.created_at;
        map[groupId].latest_message =
          issue.issue_title || issue.source_message || "";
      }
    });

    return Object.values(map).sort((a, b) => {
      const riskRank = {
        high: 1,
        medium: 2,
        watch: 3,
        normal: 4,
      };

      const riskA = riskRank[getRiskLevel(a)] || 9;
      const riskB = riskRank[getRiskLevel(b)] || 9;

      if (riskA !== riskB) return riskA - riskB;

      return new Date(b.latest_at) - new Date(a.latest_at);
    });
  }, [issues]);

  const filteredIssues = useMemo(() => {
    let list = [...issues];

    if (filter !== "all") {
      list = list.filter((issue) => issue.status === filter);
    }

    if (selectedGroupId !== "all") {
      list = list.filter(
        (issue) => (issue.group_id || "unknown") === selectedGroupId
      );
    }

    const urgencyRank = {
      high: 1,
      medium: 2,
      normal: 3,
      low: 4,
    };

    const statusRank = {
      open: 1,
      tracking: 2,
      resolved: 3,
      ignored: 4,
    };

    return list.sort((a, b) => {
      const urgencyA = urgencyRank[a.urgency] || 9;
      const urgencyB = urgencyRank[b.urgency] || 9;

      if (urgencyA !== urgencyB) return urgencyA - urgencyB;

      const statusA = statusRank[a.status] || 9;
      const statusB = statusRank[b.status] || 9;

      if (statusA !== statusB) return statusA - statusB;

      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [issues, filter, selectedGroupId]);

  const filteredMessages = useMemo(() => {
    let list = [...messages];

    if (selectedGroupId !== "all") {
      list = list.filter(
        (message) => (message.group_id || "unknown") === selectedGroupId
      );
    }

    return list;
  }, [messages, selectedGroupId]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">LINE Issue Command Center</p>
          <h1>客戶問題中心</h1>
          <p className="subtitle">
            自動彙整 LINE 群組中的客戶問題、急件與待追蹤事項。
          </p>
        </div>

        <button className="refreshButton" onClick={loadData}>
          重新整理
        </button>
      </header>

      <section className="summaryGrid">
        <div className="summaryCard danger">
          <span>高優先</span>
          <strong>{summary.high}</strong>
        </div>

        <div className="summaryCard">
          <span>未處理</span>
          <strong>{summary.open}</strong>
        </div>

        <div className="summaryCard">
          <span>處理中</span>
          <strong>{summary.tracking}</strong>
        </div>

        <div className="summaryCard muted">
          <span>今日訊息</span>
          <strong>{summary.todayMessages}</strong>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <h2>群組風險總覽</h2>
            <p>依群組彙整問題數、未處理數與風險狀態。</p>
          </div>

          <button
            className={
              selectedGroupId === "all"
                ? "smallFilter active"
                : "smallFilter"
            }
            onClick={() => setSelectedGroupId("all")}
          >
            全部群組
          </button>
        </div>

        <div className="groupGrid">
          {groupSummary.map((group) => {
            const riskLevel = getRiskLevel(group);

            return (
              <button
                key={group.group_id}
                className={`groupCard ${riskLevel} ${
                  selectedGroupId === group.group_id ? "selected" : ""
                }`}
                onClick={() => setSelectedGroupId(group.group_id)}
              >
                <div className="groupTop">
                  <span className={`riskBadge ${riskLevel}`}>
                    {getRiskLabel(riskLevel)}
                  </span>
                  <span className="groupTime">
                    {getAgingLabel(group.latest_at)}
                  </span>
                </div>

                <h3>{getGroupDisplayName(group.group_id)}</h3>

                <p className="groupMessage">
                  {group.latest_message || "尚無問題摘要"}
                </p>

                <div className="groupStats">
                  <span>高優先 {group.high}</span>
                  <span>未處理 {group.open}</span>
                  <span>處理中 {group.tracking}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="toolbar">
        {["all", "open", "tracking", "resolved", "ignored"].map((item) => (
          <button
            key={item}
            className={filter === item ? "filter active" : "filter"}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "全部" : STATUS_LABEL[item]}
          </button>
        ))}
      </section>

      {loading ? (
        <p className="empty">載入中...</p>
      ) : filteredIssues.length === 0 ? (
        <p className="empty">目前沒有符合條件的問題。</p>
      ) : (
        <section className="issueList">
          {filteredIssues.map((issue) => (
            <article
              key={issue.id}
              className={`issueCard ${issue.urgency || "normal"} ${
                issue.status === "resolved" ? "resolved" : ""
              }`}
            >
              <div className="issueTop">
                <div>
                  <span className={`urgencyBadge ${issue.urgency}`}>
                    {URGENCY_LABEL[issue.urgency] || issue.urgency || "一般"}
                  </span>
                  <span className="typeBadge">
                    {issue.issue_type || "未分類"}
                  </span>
                </div>

                <span className={`statusBadge ${issue.status}`}>
                  {STATUS_LABEL[issue.status] || issue.status || "未處理"}
                </span>
              </div>

              <h2>{issue.issue_title || issue.source_message}</h2>

              <p className="sourceMessage">{issue.source_message}</p>

              <div className="meta">
                <span>群組：{getGroupDisplayName(issue.group_id)}</span>
                <span>{formatDate(issue.created_at)}</span>
              </div>

              <div className="actions">
                <button
                  onClick={() => updateStatus(issue.id, "tracking")}
                  disabled={issue.status === "tracking"}
                >
                  處理中
                </button>

                <button
                  onClick={() => updateStatus(issue.id, "resolved")}
                  disabled={issue.status === "resolved"}
                >
                  已解決
                </button>

                <button
                  onClick={() => updateStatus(issue.id, "ignored")}
                  disabled={issue.status === "ignored"}
                >
                  忽略
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="sectionBlock messageSection">
        <div className="sectionHeader">
          <div>
            <h2>最近 LINE 訊息</h2>
            <p>
              顯示所有已記錄的群組訊息。不是每則訊息都會建立 issue，但都應保留作為回覆上下文。
            </p>
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <p className="empty">目前沒有訊息紀錄。</p>
        ) : (
          <div className="messageList">
            {filteredMessages.map((message) => {
              const matchedIssue = issues.find(
                (issue) =>
                  issue.group_id === message.group_id &&
                  issue.source_message === message.message_text
              );

              return (
                <article
                  key={message.id}
                  className={`messageItem ${
                    matchedIssue ? "linkedIssue" : ""
                  }`}
                >
                  <div className="messageContent">
                    <div className="messageTop">
                      <span className="messageGroup">
                        {getGroupDisplayName(message.group_id)}
                      </span>
                      <span className="messageTime">
                        {formatDate(message.created_at)}
                      </span>
                    </div>

                    <p>{message.message_text}</p>

                    <div className="messageMeta">
                      <span>
  留言人：
  {getUserDisplayName(
    message.group_id,
    message.user_id
  )}
</span>
                      <span>type：{message.message_type || "-"}</span>
                    </div>
                  </div>

                  <div className="messageStatus">
                    {matchedIssue ? (
                      <span className="messageLinked">已建立 issue</span>
                    ) : (
                      <div className="quickIssuePanel">
                        <span className="quickIssueLabel">建立為</span>

                        <div className="quickIssueButtons">
                          {ISSUE_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              className={`quickIssueButton ${preset.urgency}`}
                              onClick={() =>
                                createIssueFromMessage(message, preset)
                              }
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
