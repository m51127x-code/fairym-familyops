import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./styles.css";

const TYPE_LABEL = {
  event: "行程",
  shopping: "採買",
  health: "健康",
  note: "記錄",
  routine: "週期",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-TW");
}

function getTodayString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [routineLogs, setRoutineLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load events error:", error);
      return [];
    }

    return data || [];
  }

  async function loadRoutines() {
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load routines error:", error);
      return [];
    }

    return data || [];
  }

  async function loadRoutineLogs() {
    const { data, error } = await supabase
      .from("routine_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("load routine logs error:", error);
      return [];
    }

    return data || [];
  }

  async function loadData() {
    setLoading(true);

    const [eventData, routineData, logData] = await Promise.all([
      loadEvents(),
      loadRoutines(),
      loadRoutineLogs(),
    ]);

    setEvents(eventData);
    setRoutines(routineData);
    setRoutineLogs(logData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const today = getTodayString(0);
  const tomorrow = getTodayString(1);

  const todayEvents = useMemo(
    () => events.filter((item) => item.date === today),
    [events, today]
  );

  const tomorrowEvents = useMemo(
    () => events.filter((item) => item.date === tomorrow),
    [events, tomorrow]
  );

  const latestRoutineLogs = useMemo(() => routineLogs.slice(0, 8), [routineLogs]);

  const summary = useMemo(() => {
    return {
      today: todayEvents.length,
      tomorrow: tomorrowEvents.length,
      routines: routines.length,
      logs: routineLogs.length,
    };
  }, [todayEvents, tomorrowEvents, routines, routineLogs]);

  async function toggleCompleted(item) {
    const { error } = await supabase
      .from("events")
      .update({ completed: !item.completed })
      .eq("id", item.id);

    if (error) {
      console.error("update event error:", error);
      alert("更新失敗，請看 console");
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === item.id ? { ...event, completed: !item.completed } : event
      )
    );
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">FairyM Family Ops</p>
          <h1>家庭提醒中心</h1>
          <p className="subtitle">
            從 LINE 訊息自動分流成家庭事項、採買、健康提醒與週期紀錄。
          </p>
        </div>

        <button className="refreshButton" onClick={loadData}>
          重新整理
        </button>
      </header>

      <section className="summaryGrid">
        <div className="summaryCard danger">
          <span>今日事項</span>
          <strong>{summary.today}</strong>
        </div>

        <div className="summaryCard">
          <span>明日事項</span>
          <strong>{summary.tomorrow}</strong>
        </div>

        <div className="summaryCard">
          <span>週期主檔</span>
          <strong>{summary.routines}</strong>
        </div>

        <div className="summaryCard muted">
          <span>週期紀錄</span>
          <strong>{summary.logs}</strong>
        </div>
      </section>

      {loading ? (
        <p className="empty">載入中...</p>
      ) : (
        <>
          <section className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2>今天</h2>
                <p>{today}</p>
              </div>
            </div>

            {todayEvents.length === 0 ? (
              <p className="empty">今天沒有家庭事項。</p>
            ) : (
              <section className="issueList">
                {todayEvents.map((item) => (
                  <article
                    key={item.id}
                    className={`issueCard ${item.completed ? "resolved" : "normal"}`}
                  >
                    <div className="issueTop">
                      <div>
                        <span className="typeBadge">
                          {TYPE_LABEL[item.type] || item.type || "事項"}
                        </span>
                        <span className="urgencyBadge normal">
                          {item.member || "全家"}
                        </span>
                      </div>

                      <span className={`statusBadge ${item.completed ? "resolved" : "open"}`}>
                        {item.completed ? "已完成" : "未完成"}
                      </span>
                    </div>

                    <h2>{item.title}</h2>
                    <p className="sourceMessage">{formatDate(item.date)}</p>

                    <div className="actions">
                      <button onClick={() => toggleCompleted(item)}>
                        {item.completed ? "改回未完成" : "標記完成"}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </section>

          <section className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2>明天</h2>
                <p>{tomorrow}</p>
              </div>
            </div>

            {tomorrowEvents.length === 0 ? (
              <p className="empty">明天沒有家庭事項。</p>
            ) : (
              <div className="messageList">
                {tomorrowEvents.map((item) => (
                  <article key={item.id} className="messageItem">
                    <div className="messageContent">
                      <div className="messageTop">
                        <span className="messageGroup">
                          {TYPE_LABEL[item.type] || item.type || "事項"}
                        </span>
                        <span className="messageTime">{item.member || "全家"}</span>
                      </div>
                      <p>{item.title}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2>週期事項</h2>
                <p>來自 routines 主檔。</p>
              </div>
            </div>

            {routines.length === 0 ? (
              <p className="empty">目前沒有週期事項。</p>
            ) : (
              <div className="messageList">
                {routines.map((item) => (
                  <article key={item.id} className="messageItem">
                    <div className="messageContent">
                      <div className="messageTop">
                        <span className="messageGroup">{item.name}</span>
                        <span className="messageTime">
                          每 {item.interval_days || 30} 天
                        </span>
                      </div>
                      <p>負責：{item.member || "全家"}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2>最近週期紀錄</h2>
                <p>來自 routine_logs。</p>
              </div>
            </div>

            {latestRoutineLogs.length === 0 ? (
              <p className="empty">目前沒有週期紀錄。</p>
            ) : (
              <div className="messageList">
                {latestRoutineLogs.map((log) => (
                  <article key={log.id} className="messageItem">
                    <div className="messageContent">
                      <div className="messageTop">
                        <span className="messageGroup">
                          {log.routine_name || "週期事項"}
                        </span>
                        <span className="messageTime">
                          {formatDate(log.last_done_at || log.created_at)}
                        </span>
                      </div>
                      <p>{log.note || "已記錄"}</p>
                      <div className="messageMeta">
                        <span>負責：{log.member || "-"}</span>
                        <span>週期：{log.interval_days || "-"} 天</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
