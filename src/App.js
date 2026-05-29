import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  Plus,
  X,
  Edit3,
  CheckCircle,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  ArrowRight,
  ClipboardList,
  FileDown,
  Trash2,
  Calendar,
  Users,
  ChevronUp,
  ChevronDown,
  Check,
  Home,
  List,
  FileText,
  Share2,
  Clock,
  Archive,
  Sparkles,
  Gauge,
  MonitorPlay,
  Download,
  MoveRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

/**
 * Odee Meeting OS
 * 定位：科技感會議工作台，用來取代傳統 PPT 會議簡報與會議紀錄流程。
 * 功能保留：
 * - 會議首頁
 * - 議程目錄
 * - 議題頁
 * - 總筆記
 * - 設定 Modal
 * - 圖片上傳
 * - 快捷標籤
 * - 分享連結
 * - PDF / 長圖 / ZIP 匯出
 */

// ══════════════════════════════════════════════════
// Brand System
// ══════════════════════════════════════════════════

const THEME = {
  cyan: "#47BCC6",
  amber: "#F8B74A",
  ink: "#000000",
  ice: "#F1FAFB",
  border: "#E0EEF0",
  text: "#0f172a",
  muted: "#64748b",
  soft: "#f8fbfc",
};

const FONT_FAMILY =
  '"Noto Sans TC", "Aptos", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif';

const INITIAL_CLEAN_CONFIG = {
  cover: { title: "", desc: "", titleFontSize: 72 },
  attendees: "",
  topics: [],
  sessionDate: "",
};



const EXPORT_OPTIONS = {
  pdf: {
    label: "PDF 正式紀錄",
    desc: "適合會後寄送、正式存檔與客戶交付。",
    Icon: FileDown,
  },
  png: {
    label: "長圖快速分享",
    desc: "適合 LINE 群組、內部同步或快速回顧。",
    Icon: ImageIcon,
  },
  zip: {
    label: "ZIP 圖檔素材包",
    desc: "適合拆圖備份、後續放入簡報或二次編輯。",
    Icon: Archive,
  },
};

const QUICK_TAGS = [
  {
    label: "決議",
    prefix: "【決議】",
    template: "【決議】",
    color:
      "bg-white text-[#47BCC6] border border-[#47BCC6]/30 hover:bg-[#47BCC6] hover:text-white",
  },
  {
    label: "待辦",
    prefix: "【待辦】負責人：　期限：　事項：",
    template: "【待辦】負責人：　期限：　事項：",
    color:
      "bg-white text-[#F8B74A] border border-[#F8B74A]/30 hover:bg-[#F8B74A] hover:text-white",
  },
  {
    label: "風險",
    prefix: "【風險】影響：　處理方式：",
    template: "【風險】影響：　處理方式：",
    color:
      "bg-white text-red-500 border border-red-200 hover:bg-red-500 hover:text-white",
  },
  {
    label: "追蹤",
    prefix: "【追蹤】下次確認：　追蹤事項：",
    template: "【追蹤】下次確認：　追蹤事項：",
    color:
      "bg-[#F1FAFB] text-[#47BCC6] border border-[#47BCC6]/25 hover:bg-[#47BCC6] hover:text-white",
  },
];

// ── 吉祥物：使用 public/images/odee-mascot-1.svg ──
// 你的檔案放在 public/images/odee-mascot-1.svg 時，React 路徑就是 /images/odee-mascot-1.svg
const Mascot = ({ size = "78%", lightBg = false, className = "" }) => (
  <img
    src="/images/odee-mascot-1.svg"
    alt="Odee Mascot"
    className={`object-contain hover:-translate-y-2 transition-transform duration-500 ease-out ${className}`}
    style={{
      position: "relative",
      zIndex: 3,
      width: size,
      height: size,
      filter: lightBg
        ? "drop-shadow(0 12px 24px rgba(71,188,198,0.15)) drop-shadow(0 4px 10px rgba(0,0,0,0.05))"
        : "drop-shadow(0 20px 32px rgba(0,0,0,0.25))",
    }}
    onError={(e) => {
      e.currentTarget.style.display = "none";
      console.warn("找不到吉祥物圖片：請確認 public/images/odee-mascot-1.svg 是否存在");
    }}
  />
);

const MiniMascotMark = () => (
  <div
    className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0"
    style={{
      background: `linear-gradient(145deg, ${THEME.cyan}, #3aaab4)`,
      boxShadow: "0 8px 18px rgba(71,188,198,0.28)",
    }}
  >
    <Mascot size="78%" lightBg={false} />
  </div>
);

const StatusDot = ({ status = "idle" }) => {
  const color =
    status === "resolved"
      ? THEME.cyan
      : status === "discussing"
      ? THEME.amber
      : "#cbd5e1";

  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}18` }}
    />
  );
};

const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isViewer = urlParams.get("mode") === "viewer";
  const meetingId = urlParams.get("id");

  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [lastSharedInfo, setLastSharedInfo] = useState({
    dataStr: null,
    id: null,
  });

  const [config, setConfig] = useState(() => {
    try {
      const s = sessionStorage.getItem("strategyMeetingData");
      if (s) return JSON.parse(s);
    } catch {}
    return INITIAL_CLEAN_CONFIG;
  });

  const [activePage, setActivePage] = useState("cover");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fullscreenImg, setFullscreenImg] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportSelection, setExportSelection] = useState({
    cover: true,
    agenda: true,
  });
  const [tempConfig, setTempConfig] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [expandedNotesTopicId, setExpandedNotesTopicId] = useState(null);
  const [draggingSetupTopicId, setDraggingSetupTopicId] = useState(null);
  const [draggingSetupImage, setDraggingSetupImage] = useState(null);
  const [expandedSetupTopicId, setExpandedSetupTopicId] = useState(null);
  const [isAdvancedSettingOpen, setIsAdvancedSettingOpen] = useState(false);

  const notesRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // ══════════════════════════════════════════════════
  // Effects
  // ══════════════════════════════════════════════════

  useEffect(() => {
    if (!isViewer) {
      try {
        sessionStorage.setItem("strategyMeetingData", JSON.stringify(config));
      } catch {}
    }
  }, [config, isViewer]);

  useEffect(() => {
    if (isViewer && meetingId) {
      fetch(`/api/get?id=${meetingId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && !data.error) {
            const p =
              typeof data.result === "string"
                ? JSON.parse(data.result)
                : data.result || data;
            setConfig(p);
          } else {
            alert("此會議紀錄不存在或已失效。");
          }
        })
        .catch(() => alert("無法取得雲端會議紀錄，請確認網路狀態。"));
    }
  }, [isViewer, meetingId]);

  useEffect(() => {
    if (!document.getElementById("google-fonts-odee")) {
      const link = document.createElement("link");
      link.id = "google-fonts-odee";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePage]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    [
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    ].forEach((src) => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        document.body.appendChild(s);
      }
    });
  }, []);

  // ══════════════════════════════════════════════════
  // Derived Data
  // ══════════════════════════════════════════════════

  const displayConfig = isConfigOpen && tempConfig ? tempConfig : config;

  const getAttendeeList = (a) => {
    if (!a || typeof a !== "string") return [];
    return a
      .split(/[,，、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  };

  const getAttendeePreview = (a) => {
    const list = getAttendeeList(a);
    if (!list.length) return "尚未填寫";
    return list.length > 1 ? `${list[0]} 等 ${list.length} 人` : list[0];
  };

  const getMeetingStats = (data = config) => {
    const topics = data.topics || [];
    const resolvedCount = topics.filter((t) => t.status === "resolved").length;
    const imageCount = topics.reduce((sum, t) => {
      const imgs = t.images?.length
        ? t.images
        : t.previewContent
        ? [t.previewContent]
        : [];
      return sum + imgs.length;
    }, 0);
    const noteCount = topics.filter((t) => (t.notes || "").trim()).length;
    const progress = topics.length
      ? Math.round((resolvedCount / topics.length) * 100)
      : 0;

    return {
      topics,
      total: topics.length,
      resolvedCount,
      imageCount,
      noteCount,
      progress,
    };
  };

  const getReadiness = (data = config) => {
    const stats = getMeetingStats(data);
    const attendees = getAttendeeList(data.attendees);

    const checks = [
      {
        id: "title",
        label: "會議標題",
        done: Boolean(data.cover?.title?.trim()),
      },
      {
        id: "date",
        label: "會議日期",
        done: Boolean(data.sessionDate),
      },
      {
        id: "attendees",
        label: "出席者",
        done: attendees.length > 0,
      },
      {
        id: "topics",
        label: "議題",
        done: stats.total > 0,
      },
      {
        id: "assets",
        label: "素材",
        done: stats.imageCount > 0,
        optional: true,
      },
    ];

    const requiredChecks = checks.filter((c) => !c.optional);
    const doneRequired = requiredChecks.filter((c) => c.done).length;
    const percent = Math.round((doneRequired / requiredChecks.length) * 100);
    const next = requiredChecks.find((c) => !c.done)?.label || "儲存並關閉";

    return {
      checks,
      requiredChecks,
      doneRequired,
      percent,
      next,
    };
  };

  const stats = getMeetingStats(config);
  const readiness = getReadiness(displayConfig);
  const currentTopic = (config.topics || []).find((t) => t.id === activePage);
  const currentTopicImages =
    currentTopic?.images?.length > 0
      ? currentTopic.images
      : currentTopic?.previewContent
      ? [currentTopic.previewContent]
      : [];

  const selectedTopicsList =
    config.topics?.filter((t) => exportSelection[t.id]) || [];

  const currentTopicIndex = currentTopic
    ? (config.topics || []).findIndex((t) => t.id === currentTopic.id)
    : -1;

  const previousTopic =
    currentTopicIndex > 0 ? config.topics[currentTopicIndex - 1] : null;

  const nextTopic =
    currentTopicIndex >= 0 && currentTopicIndex < config.topics.length - 1
      ? config.topics[currentTopicIndex + 1]
      : null;

  // ══════════════════════════════════════════════════
  // Core Actions
  // ══════════════════════════════════════════════════

  const openConfig = () => {
    setTempConfig(JSON.parse(JSON.stringify(config)));
    setIsConfigOpen(true);
  };

  const applyConfig = () => {
    setConfig(tempConfig);
    setIsConfigOpen(false);
  };


  const updateTopic = (id, field, value) =>
    setConfig((p) => ({
      ...p,
      topics: p.topics.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));

  const updateTempTopic = (id, field, value) =>
    setTempConfig((p) => ({
      ...p,
      topics: (p.topics || []).map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));
const addTempTopicSystem = (topicId) => {
  setTempConfig((p) => ({
    ...p,
    topics: (p.topics || []).map((t) =>
      t.id === topicId
        ? {
            ...t,
            systems: [...(t.systems || []), { name: "", url: "" }],
          }
        : t
    ),
  }));
};

const updateTempTopicSystem = (topicId, systemIndex, field, value) => {
  setTempConfig((p) => ({
    ...p,
    topics: (p.topics || []).map((t) => {
      if (t.id !== topicId) return t;

      const nextSystems = [...(t.systems || [])];
      nextSystems[systemIndex] = {
        ...nextSystems[systemIndex],
        [field]: value,
      };

      return {
        ...t,
        systems: nextSystems,
      };
    }),
  }));
};

const removeTempTopicSystem = (topicId, systemIndex) => {
  setTempConfig((p) => ({
    ...p,
    topics: (p.topics || []).map((t) => {
      if (t.id !== topicId) return t;

      return {
        ...t,
        systems: (t.systems || []).filter((_, i) => i !== systemIndex),
      };
    }),
  }));
};
  const addTopic = () => {
    const n = (tempConfig.topics || []).length + 1;
    setTempConfig((p) => ({
      ...p,
      topics: [
        ...(p.topics || []),
        {
          id: `Topic ${n}`,
          title: `新議題 ${n}`,
          desc: "",
          status: "discussing",
          notes: "",
          systems: [],
          images: [],
        },
      ],
    }));
  };

  const removeTempTopic = (id) => {
    setTempConfig((p) => ({
      ...p,
      topics: (p.topics || []).filter((t) => t.id !== id),
    }));
  };

  const moveTopic = (i, dir) => {
    if (
      (dir === -1 && i === 0) ||
      (dir === 1 && i === tempConfig.topics.length - 1)
    ) {
      return;
    }

    const arr = [...tempConfig.topics];
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];

    setTempConfig({
      ...tempConfig,
      topics: arr.map((t, idx) => ({
        ...t,
        id: t.id?.startsWith("Topic") ? `Topic ${idx + 1}` : t.id,
      })),
    });
  };
const moveTopicByDrag = (dragId, targetId) => {
  if (!dragId || !targetId || dragId === targetId) return;

  setTempConfig((p) => {
    const list = [...(p.topics || [])];
    const fromIndex = list.findIndex((t) => t.id === dragId);
    const toIndex = list.findIndex((t) => t.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return p;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    return {
      ...p,
      topics: list,
    };
  });
};
  const goToNextTopic = () => {
    if (nextTopic) {
      setActivePage(nextTopic.id);
    } else {
      setActivePage("allnotes");
    }
  };

  const markResolvedAndNext = () => {
    if (!currentTopic) return;
    updateTopic(currentTopic.id, "status", "resolved");
    setTimeout(() => {
      if (nextTopic) {
        setActivePage(nextTopic.id);
      } else {
        setActivePage("allnotes");
      }
    }, 180);
  };

  const appendQuickTag = (template) => {
    const t = config.topics.find((topic) => topic.id === activePage);
    if (!t) return;

    const cur = t.notes || "";
    const nextValue =
      cur + (cur.length && !cur.endsWith("\n") ? "\n" : "") + template + " ";

    updateTopic(t.id, "notes", nextValue);

    setTimeout(() => notesRef.current?.focus(), 10);
  };

  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          const MAX = 1920;

          if (w > h) {
            if (w > MAX) {
              h *= MAX / w;
              w = MAX;
            }
          } else if (h > MAX) {
            w *= MAX / h;
            h = MAX;
          }

          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
      };
    });

  const uploadImagesToTopic = async (topicId, files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    const compressed = await Promise.all(list.map(compressImage));
    const target = (config.topics || []).find((t) => t.id === topicId);
    const existing = target?.images || [];

    updateTopic(topicId, "images", [...existing, ...compressed]);
  };

  const uploadImagesToTempTopic = async (topicId, files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    const compressed = await Promise.all(list.map(compressImage));
    const target = (tempConfig.topics || []).find((t) => t.id === topicId);
    const existing = target?.images || [];

    updateTempTopic(topicId, "images", [...existing, ...compressed]);
  };

  const removeTempTopicImage = (topicId, imageIndex) => {
    setTempConfig((p) => ({
      ...p,
      topics: (p.topics || []).map((t) => {
        if (t.id !== topicId) return t;
        const imgs = t.images?.length > 0 ? t.images : t.previewContent ? [t.previewContent] : [];
        return { ...t, images: imgs.filter((_, i) => i !== imageIndex), previewContent: "" };
      }),
    }));
  };

  const moveTempTopicImageByDrag = (topicId, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;

    setTempConfig((p) => ({
      ...p,
      topics: (p.topics || []).map((t) => {
        if (t.id !== topicId) return t;
        const imgs = t.images?.length > 0 ? [...t.images] : t.previewContent ? [t.previewContent] : [];
        if (!imgs[fromIndex] || !imgs[toIndex]) return t;
        const [moved] = imgs.splice(fromIndex, 1);
        imgs.splice(toIndex, 0, moved);
        return { ...t, images: imgs, previewContent: "" };
      }),
    }));
  };

  const exportConfigJSON = () => {
    const a = document.createElement("a");
    a.setAttribute(
      "href",
      "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(config, null, 2))
    );
    a.setAttribute(
      "download",
      `${(config.cover?.title || "會議專案").replace(
        /[\/\?<>\\:\*\|":\s]/g,
        "_"
      )}_${config.sessionDate || "未定日期"}.json`
    );
    a.click();
  };

  const importConfigJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imp = JSON.parse(ev.target.result);
        if (imp.topics) {
          imp.topics = imp.topics.map((t) => ({
            ...t,
            images: t.images || (t.previewContent ? [t.previewContent] : []),
          }));
        }
        setTempConfig({ ...INITIAL_CLEAN_CONFIG, ...imp });
      } catch {
        alert("無法讀取專案，檔案可能已損毀。");
      }
    };
    reader.readAsText(file);
  };

  const generateShareLink = async () => {
    const cur = JSON.stringify(config);

    if (lastSharedInfo.dataStr === cur && lastSharedInfo.id) {
      const link = `${window.location.origin}/?mode=viewer&id=${lastSharedInfo.id}`;
      try {
        await navigator.clipboard.writeText(link);
        alert(`ℹ️ 內容未變更，已複製現有連結：\n\n${link}`);
      } catch {
        alert(`ℹ️ 請手動複製：\n\n${link}`);
      }
      return;
    }

    setIsGeneratingLink(true);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configData: config }),
      });

      if (!res.ok) throw new Error(`伺服器回應錯誤 (${res.status})`);

      const result = await res.json();

      if (result.id) {
        const link = `${window.location.origin}/?mode=viewer&id=${result.id}`;
        setLastSharedInfo({ dataStr: cur, id: result.id });

        try {
          await navigator.clipboard.writeText(link);
          alert(`✅ 已產生連結並複製！\n\n${link}`);
        } catch {
          alert(`✅ 請手動複製以下連結：\n\n${link}`);
        }
      } else {
        throw new Error("伺服器未回傳會議 ID。");
      }
    } catch (err) {
      alert(`❌ 產生連結失敗：\n${err.message}`);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const openExportModal = (fmt) => {
    const sel = { cover: true, agenda: true };
    config.topics?.forEach((t) => {
      sel[t.id] = true;
    });

    setExportSelection(sel);
    setExportFormat(fmt);
    setShowExportModal(true);
  };

  const toggleExportSelection = (key) =>
    setExportSelection((p) => ({ ...p, [key]: !p[key] }));

  function disableAnimations(el) {
    el.querySelectorAll("*").forEach((c) => {
      try {
        c.style.animation = "none";
        c.style.transition = "none";
        c.style.backdropFilter = "none";
      } catch {}
    });
  }
    // ══════════════════════════════════════════════════
  // Export Logic
  // ══════════════════════════════════════════════════

  const handleConfirmExport = async () => {
    setShowExportModal(false);

    const format = exportFormat;

    if (!window.html2canvas || (format === "pdf" && !window.jspdf)) {
      alert("匯出模組載入中，請稍候。");
      return;
    }

    setIsExporting(true);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    } catch {}

    const raw = config.cover?.title || "會議報告";
    const safe = raw.replace(/[\/\?<>\\:\*\|":\s]/g, "_");
    const base = `${safe}_${config.sessionDate || "未定日期"}`;

    await new Promise((r) => setTimeout(r, 900));

    const target = document.getElementById("full-report-export-target");

    if (!target) {
      alert("匯出畫布建置失敗。");
      setIsExporting(false);
      return;
    }

    try {
      if (format === "png") {
        const canvas = await window.html2canvas(target, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#FFFFFF",
          windowWidth: 1200,
          logging: false,
        });

        if (!canvas.width) throw new Error("畫面擷取為空");

        const a = document.createElement("a");
        a.download = `${base}_合併長圖.png`;
        a.href = canvas.toDataURL("image/png", 1.0);
        a.click();
      }

      if (format === "zip") {
        const zip = new window.JSZip();
        const folder = zip.folder(base);
        const secs = target.querySelectorAll("[data-export-section]");

        for (let i = 0; i < secs.length; i++) {
          const sec = secs[i];

          const canvas = await window.html2canvas(sec, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#FFFFFF",
            windowWidth: 1200,
            logging: false,
            ignoreElements: (el) => el.tagName === "IFRAME",
          });

          const b64 = canvas
            .toDataURL("image/png", 1.0)
            .replace(/^data:image\/(png|jpg);base64,/, "");

          const type = sec.getAttribute("data-export-section");
          const name =
            type === "cover"
              ? "00_封面.png"
              : type === "agenda"
              ? "01_議程總覽.png"
              : `${String(i + 2).padStart(2, "0")}_${
                  sec.getAttribute("data-topic-title") || type
                }.png`;

          folder.file(name, b64, { base64: true });
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${base}_圖檔集.zip`;
        a.click();
      }

      if (format === "pdf") {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");

        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const MM = pdfW / 1200;

        let agendaScale = 1.0;

        const agendaSec = target.querySelector(
          '[data-export-section="agenda"]'
        );

        if (agendaSec && exportSelection.agenda) {
          const wrap = document.createElement("div");

          wrap.style.cssText = `
            position: fixed;
            top: -99999px;
            left: -99999px;
            width: 1200px;
            background: #FFFFFF;
            pointer-events: none;
          `;

          const clone = agendaSec.cloneNode(true);
          disableAnimations(clone);
          wrap.appendChild(clone);
          document.body.appendChild(wrap);

          await new Promise((r) => setTimeout(r, 100));

          let mc;

          try {
            mc = await window.html2canvas(wrap, {
              scale: 3,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#FFFFFF",
              windowWidth: 1200,
              logging: false,
            });
          } finally {
            document.body.removeChild(wrap);
          }

          if (mc?.width > 0) {
            agendaScale = Math.min(
              pdfW / ((mc.width / 3) * MM),
              (pdfH - margin * 2) / ((mc.height / 3) * MM)
            );
          }
        }

        const blocks = target.querySelectorAll('[data-pdf-block="true"]');

        if (!blocks.length) throw new Error("無可用匯出區塊");

        let firstPage = true;
        let curY = margin;
        let lastSec = null;

        for (const block of blocks) {
          const isFullPage =
            block.getAttribute("data-pdf-full-page") === "true";

          const secEl = block.closest("[data-export-section]");
          const secKey = secEl?.getAttribute("data-export-section") || null;
          const isNewSec = secKey && secKey !== lastSec;

          if (isNewSec) lastSec = secKey;

          if (isFullPage) {
            if (!firstPage) pdf.addPage();

            pdf.setFillColor(241, 250, 251);
            pdf.rect(0, 0, pdfW, pdfH, "F");

            const wrap = document.createElement("div");

            wrap.style.cssText = `
              position: fixed;
              top: -99999px;
              left: -99999px;
              width: 1200px;
              background: #FFFFFF;
              pointer-events: none;
            `;

            const clone = block.cloneNode(true);
            disableAnimations(clone);
            wrap.appendChild(clone);
            document.body.appendChild(wrap);

            await new Promise((r) => setTimeout(r, 80));

            let cc;

            try {
              cc = await window.html2canvas(wrap, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#FFFFFF",
                windowWidth: 1200,
                logging: false,
              });
            } finally {
              document.body.removeChild(wrap);
            }

            if (cc?.width > 0) {
              pdf.addImage(
                cc.toDataURL("image/jpeg", 0.95),
                "JPEG",
                0,
                0,
                pdfW,
                pdfH
              );
            }

            firstPage = false;
            curY = pdfH;
            continue;
          }

          if (isNewSec) {
            if (!firstPage) pdf.addPage();

            pdf.setFillColor(241, 250, 251);
            pdf.rect(0, 0, pdfW, pdfH, "F");

            curY = margin;
            firstPage = false;
          }

          const wrap = document.createElement("div");

          wrap.style.cssText = `
            position: fixed;
            top: -99999px;
            left: -99999px;
            width: 1200px;
            background: #FFFFFF;
            pointer-events: none;
          `;

          const clone = block.cloneNode(true);
          disableAnimations(clone);
          wrap.appendChild(clone);
          document.body.appendChild(wrap);

          await new Promise((r) => setTimeout(r, 80));

          let canvas;

          try {
            canvas = await window.html2canvas(wrap, {
              scale: 3,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#FFFFFF",
              windowWidth: 1200,
              logging: false,
            });
          } finally {
            document.body.removeChild(wrap);
          }

          if (!canvas?.width) continue;

          const sw = (canvas.width / 3) * MM * agendaScale;
          const sh = (canvas.height / 3) * MM * agendaScale;

          if (curY + sh > pdfH - margin && curY > margin + 5) {
            pdf.addPage();
            pdf.setFillColor(241, 250, 251);
            pdf.rect(0, 0, pdfW, pdfH, "F");
            curY = margin;
          }

          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            (pdfW - sw) / 2,
            curY,
            sw,
            sh
          );

          curY += sh + 3;

          if (firstPage) firstPage = false;
        }

        pdf.save(`${base}.pdf`);
      }
    } catch (err) {
      alert("匯出錯誤：" + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // ══════════════════════════════════════════════════
  // Export Layout
  // 方向：回到初版匯出結構，只替換成 Odee 色票與吉祥物。
  // 重點：不拉伸圖片、不裁切文字、保持每個區塊自然分頁。
  // ══════════════════════════════════════════════════

  const exportHeaderJSX = (
    <div className="w-full px-20 pt-14 pb-6 bg-[#F1FAFB]">
      <div className="flex justify-between items-end border-b-[3px] border-[#E0EEF0] pb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-[3px] rounded-full"
              style={{ background: "linear-gradient(90deg, #47BCC6, #F8B74A)" }}
            />
            <span className="text-[13px] font-black text-[#47BCC6] tracking-[0.3em] uppercase">
              SESSION BOARD
            </span>
          </div>
          <span className="text-4xl font-black text-[#000000] tracking-tight leading-tight">
            {config.cover?.title || "未命名會議"}
          </span>
        </div>
        <div className="text-xl font-bold text-slate-700 bg-white px-6 py-3 rounded-2xl border border-[#E0EEF0] shadow-sm flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#F8B74A]" />
          {config.sessionDate || "TBD"}
        </div>
      </div>
    </div>
  );

  const renderFullReportExport = () => {
    const exportStats = getMeetingStats(config);

    return (
      <div
        id="full-report-export-target"
        className="text-slate-800 bg-[#F1FAFB] export-font-force"
        style={{ width: "1200px", fontFamily: FONT_FAMILY }}
      >
        {/* Cover：初版結構，換成 Odee 色票與吉祥物 */}
        {exportSelection.cover && (
          <div
            data-export-section="cover"
            data-pdf-block="true"
            data-pdf-full-page="true"
            className="w-full flex flex-row items-center justify-between px-20 relative overflow-hidden border-b-[10px] border-[#47BCC6]"
            style={{
              height: "1697px",
              background: "linear-gradient(135deg, #FFFFFF 0%, #F8FBFC 58%, #F1FAFB 100%)",
            }}
          >
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#47BCC6]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-12%] left-[-8%] w-[42%] h-[42%] bg-[#F8B74A]/5 rounded-full blur-[110px] pointer-events-none" />

            <div className="w-[55%] flex flex-col justify-center relative z-10">
              <div className="flex items-center gap-5 mb-7">
                <span className="font-black tracking-[0.34em] text-xl uppercase">
                  SESSION RECORD
                </span>
              </div>

              <h1
                className="font-black mb-10 tracking-tight leading-[1.22] whitespace-pre-wrap"
                style={{ fontSize: `${Math.max(44, Math.round((config.cover?.titleFontSize || 72) * 0.9))}px` }}
              >
                {config.cover?.title || "未命名會議"}
              </h1>

              {config.cover?.desc && (
                <p className="text-3xl mb-16 leading-[1.8] font-medium border-l-4 border-[#47BCC6] pl-8 text-left whitespace-pre-wrap">
                  {config.cover?.desc}
                </p>
              )}

              <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-5 py-10 border-t border-[#E0EEF0] w-full max-w-[860px]">
                <div className="flex flex-col">
                  <span className="text-lg font-bold uppercase tracking-[0.2em] mb-3">
                    Date
                  </span>
                  <span className="text-[22px] font-bold flex items-center gap-2 whitespace-nowrap">
                    <Calendar className="w-6 h-6 text-[#F8B74A]" />
                    {config.sessionDate || "TBD"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold uppercase tracking-[0.2em] mb-3">
                    Attendees
                  </span>
                  <span className="text-[22px] font-bold flex items-center gap-2 whitespace-nowrap">
                    <Users className="w-6 h-6 text-[#F8B74A]" />
                    {getAttendeePreview(config.attendees)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold uppercase tracking-[0.2em] mb-3">
                    Topics
                  </span>
                  <span className="text-[22px] font-black flex items-center gap-2 whitespace-nowrap">
                    <ClipboardList className="w-6 h-6 text-[#47BCC6]" />
                    {exportStats.total} ITEMS
                  </span>
                </div>
              </div>
            </div>

            <div className="w-[40%] flex flex-col justify-center items-center relative z-10 gap-8">
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: "380px",
                  height: "380px",
                  borderRadius: "48px",
                  background: "linear-gradient(145deg, #E7F8FA 0%, #FFFFFF 72%)",
                  border: "2px solid rgba(71,188,198,0.22)",
                  boxShadow:
                    "0 24px 60px rgba(71,188,198,0.16), 0 8px 22px rgba(15,23,42,0.06)",
                }}
              >
                <div
                  className="absolute inset-10 rounded-full pointer-events-none"
                  style={{ background: "rgba(71,188,198,0.12)" }}
                />
                <Mascot size="94%" lightBg={true} className="opacity-100" />
              </div>
              <div className="bg-white border border-[#E0EEF0] rounded-2xl px-6 py-4">
                <span className="text-[13px] font-black tracking-[0.24em] uppercase">
                  ODEE MEETING OS
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Agenda：回到初版大卡結構，一頁自然縮放 */}
        {exportSelection.agenda && config.topics?.length > 0 && (
          <div data-export-section="agenda" className="w-full bg-[#F1FAFB] pb-10">
            <div data-pdf-block="true" className="w-full bg-[#F1FAFB]">
              {exportHeaderJSX}
              <div className="px-20 pt-6 pb-10">
                <div className="bg-white rounded-[40px] shadow-sm border border-[#E0EEF0] overflow-hidden">
                  <div className="px-16 py-10 border-b border-[#E0EEF0] flex items-center justify-between">
                    <h2 className="text-5xl font-black text-[#000000] flex items-center gap-6">
                      <div className="w-4 h-12 bg-[#F8B74A] rounded-full" />
                      議程目錄
                    </h2>
                    <div className="text-right">
                      <div className="text-4xl font-black text-[#47BCC6] leading-none">
                        {exportStats.total}
                      </div>
                      <div className="text-sm text-slate-400 font-bold tracking-widest uppercase mt-2">
                        Topics
                      </div>
                    </div>
                  </div>

                  {config.topics.map((t, idx, arr) => (
                    <div
                      key={`agenda-${t.id}`}
                      className={`px-16 py-8 flex gap-10 items-start ${
                        idx !== arr.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <div className="text-5xl font-black text-[#47BCC6]/25 w-16 pt-1 font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <span className="text-xl font-bold text-[#F8B74A] tracking-widest uppercase">
                            {t.id}
                          </span>
                          <span
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold ${
                              t.status === "resolved"
                                ? "bg-[#47BCC6]/10 text-[#178C95]"
                                : "bg-[#F8B74A]/12 text-[#9A6400]"
                            }`}
                          >
                            {t.status === "resolved" ? "已決議" : "討論中"}
                          </span>
                        </div>
                        <h3 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
                          {t.title}
                        </h3>
                        <p className="text-2xl leading-relaxed whitespace-pre-wrap">
                          {t.desc || "無議題描述"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Topic Pages：單一內容卡，避免議題 / 筆記 / 圖片看起來被切成三段 */}
        {selectedTopicsList.map((t, topicIdx) => {
          const images =
            t.images?.length > 0
              ? t.images
              : t.previewContent
              ? [t.previewContent]
              : [];

          const descLines = (t.desc || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          const noteLines = (t.notes || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          const renderUnifiedTopicCard = (img = null, imgIdx = 0) => {
            const isFirstAsset = imgIdx === 0;
            const shownDescLines = isFirstAsset ? descLines : descLines.slice(0, 3);
            const shownNoteLines = isFirstAsset ? noteLines : [];

            return (
              <div data-pdf-block="true" className="w-full bg-[#F1FAFB] px-20 pb-12">
                {exportHeaderJSX}

                <div className="bg-white rounded-[40px] border border-[#E0EEF0] shadow-sm overflow-hidden">
                  {/* 上方：議題資訊與筆記都放在同一張卡內 */}
                  <div className="px-14 pt-10 pb-6">
                    <div className="flex items-center justify-between gap-6 mb-5">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-sm font-black text-slate-500 tracking-[0.25em] uppercase shrink-0">
                          {t.id || `Topic ${topicIdx + 1}`}
                        </span>
                        <span
                          className="text-sm font-bold shrink-0"
                          style={{
                            color: t.status === "resolved" ? "#47BCC6" : "#F8B74A",
                          }}
                        >
                          {t.status === "resolved" ? "✓ RESOLVED" : "● IN PROGRESS"}
                        </span>
                      </div>

                      {img && images.length > 1 && (
                        <span className="text-[13px] font-black text-slate-400 tracking-[0.16em] uppercase shrink-0">
                          Visual {imgIdx + 1} / {images.length}
                        </span>
                      )}
                    </div>

                    <h2 className="text-[46px] font-black text-[#000000] leading-[1.18] tracking-tight mb-5">
                      {t.title}
                    </h2>

                    {shownDescLines.length > 0 && (
                      <div className="border-l-[7px] border-[#F8B74A] pl-6 pr-3 mb-5">
                        {shownDescLines.map((line, i) => (
                          <p
                            key={`desc-${t.id}-${imgIdx}-${i}`}
                            className="text-[22px] text-slate-700 leading-[1.65] font-medium mb-1.5"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    )}

                    {shownNoteLines.length > 0 && (
                      <div className="mt-5 rounded-[20px] bg-[#F8FBFC] border border-[#E0EEF0] px-7 py-5">
                        <div className="flex items-center gap-3 mb-3">
                          <Edit3 className="w-4 h-4 text-[#47BCC6]" />
                          <span className="text-[12px] font-black tracking-[0.22em] uppercase text-[#47BCC6]">
                            Meeting Notes
                          </span>
                        </div>

                        {shownNoteLines.map((line, i) => (
                          <p
                            key={`note-${t.id}-${i}`}
                            className="text-[20px] text-slate-700 leading-[1.75] font-medium mb-1 whitespace-pre-wrap"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 下方：圖片接在同一張卡裡，不另開一個大區塊 */}
                  {img && (
                    <div className="px-14 pb-12 pt-2">
                      <div className="flex items-center justify-between mb-5 border-t border-[#E0EEF0] pt-5">
                        <div className="flex items-center gap-3">
                          <ImageIcon className="w-5 h-5 text-[#47BCC6]" />
                          <span className="text-[13px] font-black tracking-[0.24em] text-slate-500 uppercase">
                            Visual Assets
                          </span>
                        </div>
                        <span className="text-[13px] font-black text-slate-400">
                          {imgIdx + 1} / {images.length}
                        </span>
                      </div>

                      <div className="rounded-[22px] overflow-hidden border border-[#E0EEF0] bg-white flex items-center justify-center">
                        <img
                          src={img}
                          className="max-w-full h-auto block"
                          style={{
                            maxHeight: isFirstAsset ? "820px" : "940px",
                            objectFit: "contain",
                          }}
                          alt={`img-${imgIdx}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div
              data-export-section={`topic-${t.id}`}
              data-topic-title={t.title}
              key={`topic-${t.id}`}
              className="w-full bg-[#F1FAFB]"
            >
              {images.length > 0
                ? images.map((img, imgIdx) => (
                    <React.Fragment key={`topic-${t.id}-img-${imgIdx}`}>
                      {renderUnifiedTopicCard(img, imgIdx)}
                    </React.Fragment>
                  ))
                : renderUnifiedTopicCard(null, 0)}
            </div>
          );
        })}
      </div>
    );
  };
  // ══════════════════════════════════════════════════
  // Main Render
  // ══════════════════════════════════════════════════

  return (
    <>
      <style>{`


        .export-font-force,
        .export-font-force * {
          font-family: "Noto Sans TC", "Aptos", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif !important;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
          color: #000000 !important;
        }

        :root {
          --odee-cyan: #47BCC6;
          --odee-amber: #F8B74A;
          --odee-ice: #F1FAFB;
          --odee-border: #E0EEF0;
          --odee-ink: #000000;
        }

        @keyframes mascotFloat {
          0%, 100% {
            transform: translateY(0) rotate(-0.4deg);
          }
          50% {
            transform: translateY(-8px) rotate(0.4deg);
          }
        }

        @keyframes softPulse {
          0%, 100% {
            opacity: 0.38;
            transform: scale(1);
          }
          50% {
            opacity: 0.72;
            transform: scale(1.04);
          }
        }

        @keyframes statusPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(71,188,198,0.35);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(71,188,198,0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(71,188,198,0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .custom-scrollbar-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar-sidebar::-webkit-scrollbar-thumb {
          background: rgba(71,188,198,0.22);
          border-radius: 10px;
        }

        .custom-scrollbar-sidebar::-webkit-scrollbar-thumb:hover {
          background: rgba(71,188,198,0.45);
        }

        .custom-scrollbar-light::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar-light::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar-light::-webkit-scrollbar-thumb {
          background: rgba(15,23,42,0.10);
          border-radius: 10px;
        }

        .custom-scrollbar-light::-webkit-scrollbar-thumb:hover {
          background: rgba(71,188,198,0.45);
        }

        .odee-card {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(224,238,240,1);
          box-shadow: 0 8px 26px rgba(15,23,42,0.035);
          backdrop-filter: blur(14px);
        }

        .odee-card-hover {
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }

        .odee-card-hover:hover {
          transform: translateY(-3px);
          border-color: rgba(71,188,198,0.35);
          box-shadow: 0 14px 34px rgba(71,188,198,0.10);
        }

        .odee-grid-bg {
          background-image:
            linear-gradient(rgba(71,188,198,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(71,188,198,0.055) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .topic-card {
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(224,238,240,1);
          box-shadow: 0 6px 18px rgba(15,23,42,0.035);
          border-radius: 24px;
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }

        .topic-card:hover {
          border-color: rgba(71,188,198,0.40);
          box-shadow: 0 16px 34px rgba(71,188,198,0.12);
          transform: translateY(-3px);
        }
      `}</style>

      {/* 匯出用隱藏畫布 */}
      <div
        style={{
          position: "fixed",
          top: "-99999px",
          left: "-99999px",
          width: "1200px",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {renderFullReportExport()}
      </div>

      {/* 匯出 Loading */}
      {isExporting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(241,250,251,0.92)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "46px",
              height: "46px",
              border: "3px solid rgba(71,188,198,0.18)",
              borderTop: "3px solid #47BCC6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />

          <div className="text-center">
            <p className="text-[#47BCC6] font-black text-[14px] tracking-[0.22em] uppercase">
              Exporting Session Record
            </p>
            <p className="text-slate-400 text-[12px] mt-2 font-medium">
              正在產生檔案中，請稍候...
            </p>
          </div>
        </div>
      )}
       
  <div
  className="h-screen flex overflow-hidden text-slate-800"
  style={{
    fontFamily: FONT_FAMILY,
    background: "#FFFFFF",
  }}
>
        {/* ════════════════════════════════════════
            Sidebar
        ════════════════════════════════════════ */}
        <aside
          className={`flex flex-col z-40 relative transition-all duration-500 ease-in-out overflow-hidden shrink-0 ${
            isSidebarOpen ? "w-[260px]" : "w-[76px]"
          }`}
          style={{
            background: "rgba(255,255,255,0.78)",
            borderRight: "1px solid rgba(224,238,240,1)",
            backdropFilter: "blur(18px)",
            boxShadow: "8px 0 30px rgba(71,188,198,0.035)",
          }}
        >
          <div className="pt-7 pb-5 flex-1 overflow-y-auto custom-scrollbar-sidebar flex flex-col items-center">
            {/* Brand / Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center mb-6 transition-all duration-300 cursor-pointer group outline-none ${
                isSidebarOpen
                  ? "w-full px-5 justify-between"
                  : "w-full justify-center"
              }`}
              title={isSidebarOpen ? "收起側欄" : "展開側欄"}
            >
              <div className="flex items-center min-w-0">
                <MiniMascotMark />

                {isSidebarOpen && (
                  <div className="flex flex-col items-start ml-3 min-w-0">
                    <span className="font-black text-slate-900 text-[13px] tracking-wide leading-none">
                      Work Sapce (BETA)
                    </span>
                  </div>
                )}
              </div>

              {isSidebarOpen && (
                <PanelLeftClose className="w-4 h-4 text-slate-300 group-hover:text-[#47BCC6] transition-colors" />
              )}

              {!isSidebarOpen && (
                <PanelLeftOpen className="absolute bottom-2 right-2 w-3.5 h-3.5 text-slate-300" />
              )}
            </button>

            {/* Time Panel */}
{!isViewer && (
  <div
    className={`mb-5 transition-all duration-500 flex items-center justify-center w-full ${
      isSidebarOpen ? "px-4" : "px-2"
    }`}
  >
    {isSidebarOpen ? (
      <div className="w-full rounded-[22px] bg-white border border-[#E0EEF0] px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black tracking-[0.24em] uppercase text-slate-400">
              Current Time
            </p>
            <p className="font-mono text-[26px] font-black tracking-widest text-slate-900 mt-1">
              {currentTime.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(71,188,198,0.10)",
              color: THEME.cyan,
            }}
          >
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>
    ) : (
      <div className="w-[52px] h-[52px] rounded-2xl bg-white border border-[#E0EEF0] shadow-sm flex items-center justify-center">
        <span className="text-[#47BCC6] font-mono text-[11px] font-black tracking-widest">
          {currentTime.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    )}
  </div>
)}

            {/* Main Navigation */}
            <nav className="w-full flex flex-col flex-1">
              <div className="px-3 space-y-1">
                {[
                  { id: "cover", label: "會議首頁", Icon: Home },
                  { id: "agenda", label: "議程目錄", Icon: List },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActivePage(id)}
                    className={`w-full rounded-[16px] font-bold flex items-center transition-all duration-300 ${
                      isSidebarOpen
                        ? "px-4 py-2.5 text-[13px] justify-start gap-3"
                        : "p-3 justify-center"
                    }`}
                    style={
                      activePage === id
                        ? {
                            background: "rgba(71,188,198,0.12)",
                            color: THEME.cyan,
                            border: "1px solid rgba(71,188,198,0.22)",
                          }
                        : {
                            color: "#64748b",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    <Icon className="w-[17px] h-[17px] shrink-0" />
                    {isSidebarOpen && <span>{label}</span>}
                  </button>
                ))}

                {!isViewer && (
                  <button
                    onClick={() => setActivePage("allnotes")}
                    className={`w-full rounded-[16px] font-bold flex items-center transition-all duration-300 ${
                      isSidebarOpen
                        ? "px-4 py-2.5 text-[13px] justify-start gap-3"
                        : "p-3 justify-center"
                    }`}
                    style={
                      activePage === "allnotes"
                        ? {
                            background: "rgba(71,188,198,0.12)",
                            color: THEME.cyan,
                            border: "1px solid rgba(71,188,198,0.22)",
                          }
                        : {
                            color: "#64748b",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    <FileText className="w-[17px] h-[17px] shrink-0" />
                    {isSidebarOpen && <span>總筆記</span>}
                  </button>
                )}
              </div>

              {/* Topic List */}
              <div
                className={`py-5 flex-1 flex flex-col ${
                  isSidebarOpen ? "px-3" : "items-center px-0"
                }`}
              >
                {isSidebarOpen && (
                  <div className="px-3 mb-3">
  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.28em]">
    議題清單
  </p>
</div>
                )}

                <div
                  className={`w-full flex flex-col space-y-1 ${
                    !isSidebarOpen && "items-center"
                  }`}
                >
                  {config.topics?.map((t, idx) => (
                    <div
                      key={t.id}
                      onClick={() => setActivePage(t.id)}
                      className={`group cursor-pointer rounded-[16px] font-semibold flex items-center transition-all duration-300 ${
                        isSidebarOpen
                          ? "w-full px-3 py-2.5 gap-2.5 text-[13px] justify-start"
                          : "w-10 h-10 justify-center relative my-0.5"
                      }`}
                      style={
                        activePage === t.id
                          ? {
                              background: "rgba(71,188,198,0.12)",
                              color: THEME.cyan,
                              border: "1px solid rgba(71,188,198,0.20)",
                            }
                          : {
                              color: "#64748b",
                              border: "1px solid transparent",
                            }
                      }
                    >
                      {isSidebarOpen ? (
                        <>
                          <StatusDot status={t.status} />

                          <span className="truncate flex-1 text-left select-none">
                            {t.title || `議題 ${idx + 1}`}
                          </span>

                          {!isViewer && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTopic(
                                  t.id,
                                  "status",
                                  t.status === "resolved"
                                    ? "discussing"
                                    : "resolved"
                                );
                              }}
                              className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors shrink-0"
                              title="切換決議狀態"
                            >
                              <CheckCircle
                                className={`w-3.5 h-3.5 ${
                                  t.status === "resolved"
                                    ? "text-[#47BCC6]"
                                    : "opacity-0 group-hover:opacity-35"
                                } transition-all`}
                              />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-mono text-slate-500">
                            {String(idx + 1).padStart(2, "0")}
                          </span>

                          {t.status === "resolved" && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#47BCC6]" />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              {!isViewer && (
                <div
                  className="pt-4 pb-5 flex flex-col gap-2 px-3 w-full"
                  style={{ borderTop: "1px solid rgba(224,238,240,1)" }}
                >
                  <button
                    onClick={openConfig}
                    className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-[12px] border border-[#E0EEF0] bg-white hover:text-[#47BCC6] hover:border-[#47BCC6]/30 text-slate-500`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {isSidebarOpen && <span>設定</span>}
                  </button>
                  <button
                    onClick={generateShareLink}
                    disabled={isGeneratingLink}
                    className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 font-bold text-[12px] text-white bg-[#47BCC6] hover:bg-[#3baab4] shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {isSidebarOpen && <span>{isGeneratingLink ? "處理中..." : "分享"}</span>}
                  </button>
                  <button
                    onClick={() => openExportModal("pdf")}
                    disabled={isExporting}
                    className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 font-bold text-[12px] text-slate-500 hover:text-[#47BCC6] hover:bg-white border border-[#E0EEF0] bg-white/70"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {isSidebarOpen && <span>匯出</span>}
                  </button>
                  {isSidebarOpen && (
  <p className="pt-2 text-center text-[9px] font-black tracking-[0.22em] uppercase text-slate-300 leading-relaxed">
    －CRAFTED BY S.Y.L－<br />
  </p>
)}
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* ════════════════════════════════════════
            Main Content
        ════════════════════════════════════════ */}
        <main
          ref={scrollContainerRef}
          className={`flex-1 relative overflow-y-auto custom-scrollbar-light transition-all duration-500 bg-white ${
            isNotesOpen ? "rounded-l-[40px] shadow-2xl" : ""
          }`}
        >
          

          {/* ════════════════════════════════════════
              Cover Page
          ════════════════════════════════════════ */}
          {activePage === "cover" && (
            <div className="min-h-screen flex flex-col justify-center px-8 md:px-16 pt-28 pb-16 relative overflow-hidden">
              <div className="absolute top-[-14%] right-[-7%] w-[52%] h-[52%] bg-[#47BCC6]/8 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute bottom-[-12%] left-[-8%] w-[42%] h-[42%] bg-[#F8B74A]/7 rounded-full blur-[110px] pointer-events-none" />

              <div className="z-10 w-full max-w-[1240px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-16">
                {/* Left Hero */}
<div className="w-full lg:w-[54%] flex flex-col justify-center">
  

  <h1
  className="font-black mb-6 tracking-tight leading-[1.08] text-[#000000] break-words whitespace-pre-wrap transition-all duration-300"
  style={{
    fontSize: `clamp(40px, ${
      displayConfig.cover?.titleFontSize || 72
    }px, 92px)`,
  }}
>
  {displayConfig.cover?.title || "未命名會議"}
</h1>

  {displayConfig.cover?.desc && (
  <p className="text-[16px] md:text-[17px] text-slate-600 mb-8 max-w-[620px] leading-[1.9] font-medium border-l-4 border-[#F8B74A] pl-5">
    {displayConfig.cover?.desc}
  </p>
)}

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 max-w-[720px]">
    <div className="group rounded-[22px] px-5 py-4 bg-white border border-[#E0EEF0] shadow-[0_8px_28px_rgba(15,23,42,0.04)] hover:border-[#47BCC6]/35 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.24em]">
          Date
        </span>
        <Calendar className="w-4 h-4 text-[#F8B74A]" />
      </div>

      <span className="text-[15px] font-black text-slate-800">
        {displayConfig.sessionDate || "TBD"}
      </span>
    </div>

    <div className="group rounded-[22px] px-5 py-4 bg-white border border-[#E0EEF0] shadow-[0_8px_28px_rgba(15,23,42,0.04)] hover:border-[#47BCC6]/35 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.24em]">
          Attendees
        </span>
        <Users className="w-4 h-4 text-[#F8B74A]" />
      </div>

      <span
        className="text-[15px] font-black text-slate-800 truncate block"
        title={displayConfig.attendees}
      >
        {getAttendeePreview(displayConfig.attendees)}
      </span>
    </div>

    <div className="group rounded-[22px] px-5 py-4 bg-white border border-[#E0EEF0] shadow-[0_8px_28px_rgba(15,23,42,0.04)] hover:border-[#47BCC6]/35 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.24em]">
          Topics
        </span>
        <ClipboardList className="w-4 h-4 text-[#47BCC6]" />
      </div>

      <span className="text-[15px] font-black text-[#47BCC6]">
        {displayConfig.topics?.length || 0} ITEMS
      </span>
    </div>
  </div>

  <div className="flex flex-wrap items-center gap-3">
    <button
      onClick={() => {
        if (displayConfig.topics?.length > 0) {
          setActivePage("agenda");
        } else if (!isViewer) {
          openConfig();
        }
      }}
      className="px-7 py-3.5 bg-[#0B2E63] text-white rounded-[16px] font-black text-[14px] flex items-center gap-3 transition-all hover:bg-[#164A96] shadow-[0_10px_26px_rgba(11,46,99,0.18)] group w-fit"
    >
      {displayConfig.topics?.length > 0
        ? "開始進行會議"
        : isViewer
        ? "目前無會議議題"
        : "設定會議內容"}

      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </button>

    
  </div>
</div>

               

          
{/* Right Assistant Panel */}
<div className="hidden lg:flex w-[42%] justify-center items-center relative">
  <div className="relative w-[460px] h-[460px] flex items-center justify-center">
    {/* Back Glow */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, rgba(71,188,198,0.18), rgba(30,102,208,0.10), transparent 68%)",
        filter: "blur(28px)",
      }}
    />


    {/* Main Mascot Card */}
    <div
      className="relative w-[360px] h-[360px] rounded-[44px] overflow-hidden border border-[#DCEBED] shadow-[0_20px_60px_rgba(11,46,99,0.08)]"
      style={{
        background:
          "linear-gradient(145deg, #FFFFFF 0%, #F8FBFC 42%, #EEF8FA 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(71,188,198,0.10), rgba(30,102,208,0.05), transparent 72%)",
        }}
      />

      <div className="absolute top-7 left-7 right-7 h-px bg-[#47BCC6]/22" />
      <div className="absolute bottom-7 left-7 right-7 h-px bg-[#F8B74A]/22" />

      <div className="absolute top-[76px] left-[58px] w-2.5 h-2.5 rounded-full bg-[#47BCC6]/35" />
      <div className="absolute top-[96px] left-[82px] w-1.5 h-1.5 rounded-full bg-[#1E66D0]/25" />
      <div className="absolute top-[88px] right-[70px] w-2 h-2 rounded-full bg-[#47BCC6]/30" />
      <div className="absolute top-[110px] right-[92px] w-1.5 h-1.5 rounded-full bg-[#F8B74A]/30" />

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[230px] h-[230px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95), rgba(241,250,251,0.92), rgba(255,255,255,0) 74%)",
          boxShadow:
            "0 24px 70px rgba(71,188,198,0.12), inset 0 0 30px rgba(255,255,255,0.65)",
        }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          animation: "mascotFloat 5s ease-in-out infinite",
        }}
      >
        <Mascot size="72%" lightBg={true} />
      </div>

      <div className="absolute left-1/2 bottom-8 -translate-x-1/2">
        <div className="px-4 py-2 rounded-2xl bg-white/92 border border-[#E0EEF0] shadow-sm">
          <span className="text-[12px] font-black tracking-[0.18em] text-[#0B2E63] uppercase">
            Odee Assistant
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
              </div>
            </div>
          )}
                    {/* ════════════════════════════════════════
    Agenda Page
════════════════════════════════════════ */}
{activePage === "agenda" && (
  <div className="min-h-screen px-8 md:px-16 pt-28 pb-24 mx-auto w-full max-w-[1040px] xl:max-w-[1240px]">
    <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
      <div>
        <h2 className="text-[40px] md:text-[52px] font-black text-slate-900 leading-tight tracking-tighter">
          議程目錄
        </h2>
      </div>
    </div>

    <div className="space-y-4">
      {config.topics?.length > 0 ? (
        config.topics.map((t, idx) => {
          const imageCount = t.images?.length
            ? t.images.length
            : t.previewContent
            ? 1
            : 0;

          const hasNotes = Boolean((t.notes || "").trim());

          return (
            <div
              key={t.id}
              onClick={() => setActivePage(t.id)}
              className="topic-card group cursor-pointer relative overflow-hidden flex flex-col md:flex-row gap-6 md:gap-8 md:items-start p-7 md:p-9 bg-white"
            >
              <div
                className="absolute left-0 top-5 bottom-5 w-[5px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    t.status === "resolved" ? THEME.cyan : THEME.amber,
                }}
              />

              <div className="text-[44px] md:text-[52px] leading-none font-black text-slate-100 group-hover:text-[#47BCC6]/12 transition-colors w-16 md:w-20 shrink-0 font-mono tracking-tighter pt-1">
                {String(idx + 1).padStart(2, "0")}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-[10.5px] font-black text-[#F8B74A] tracking-widest uppercase">
                    {t.id}
                  </span>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      t.status === "resolved"
                        ? "bg-[#47BCC6]/10 text-[#47BCC6]"
                        : "bg-[#F8B74A]/12 text-[#F8B74A]"
                    }`}
                  >
                    {t.status === "resolved" ? "已決議" : "討論中"}
                  </span>

                  {imageCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {imageCount} 張展示圖
                    </span>
                  )}

                  {hasNotes && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      已有筆記
                    </span>
                  )}
                </div>

                <h3 className="text-[22px] md:text-[29px] font-black text-slate-900 mb-3 group-hover:text-[#47BCC6] transition-colors leading-[1.3] tracking-tight">
                  {t.title || `未命名議題 ${idx + 1}`}
                </h3>

                <p className="text-[14px] text-slate-500 font-medium whitespace-pre-wrap leading-[1.8] max-w-3xl">
                  {t.desc || "尚未填寫議題描述。"}
                </p>
              </div>

             
            </div>
          );
        })
      ) : (
        <div className="py-20 text-center bg-white rounded-[28px] border border-dashed border-[#E0EEF0]">
          <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">尚未建立任何議題</p>

          {!isViewer && (
            <button
              onClick={openConfig}
              className="mt-5 px-5 py-2.5 rounded-xl bg-[#47BCC6] text-white text-[13px] font-bold hover:bg-[#3baab4] transition-all"
            >
              建立議題
            </button>
          )}
        </div>
      )}
    </div>
  </div>
)}

          {/* ════════════════════════════════════════
              All Notes Page
          ════════════════════════════════════════ */}
          {activePage === "allnotes" && !isViewer && (
            <div className="min-h-screen px-8 md:px-16 pt-28 pb-24 mx-auto w-full max-w-[1040px] xl:max-w-[1240px]">
              <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
                <div>
                  <h2 className="text-[40px] md:text-[52px] font-black text-slate-900 leading-tight tracking-tighter">
                    總筆記
                  </h2>

                  <p className="mt-4 text-[15px] text-slate-500 font-medium leading-[1.8] max-w-[660px]">
                    依議題彙整會議紀錄、決議、待辦、風險與追蹤事項。
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="odee-card rounded-[20px] px-5 py-4 text-center">
                    <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                      Topics
                    </p>
                    <p className="text-[26px] font-black text-slate-900 mt-1">
                      {stats.total}
                    </p>
                  </div>

                  <div className="odee-card rounded-[20px] px-5 py-4 text-center">
                    <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                      Resolved
                    </p>
                    <p className="text-[26px] font-black text-[#47BCC6] mt-1">
                      {stats.resolvedCount}
                    </p>
                  </div>

                  <div className="odee-card rounded-[20px] px-5 py-4 text-center">
                    <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                      Notes
                    </p>
                    <p className="text-[26px] font-black text-[#F8B74A] mt-1">
                      {stats.noteCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {config.topics?.length > 0 ? (
                  config.topics.map((t, idx) => (
                    <div
                      key={t.id}
                      className="bg-white/95 rounded-[24px] border border-[#E0EEF0] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="px-7 py-4 border-b border-[#E0EEF0]/70 flex flex-wrap items-center justify-between gap-3 bg-[#F1FAFB]/55">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-black text-[#F8B74A] tracking-widest uppercase shrink-0">
                            {String(idx + 1).padStart(2, "0")} / {t.id}
                          </span>

                          <StatusDot status={t.status} />

                          <h3 className="text-[16px] font-black text-slate-800 truncate">
                            {t.title || `未命名議題 ${idx + 1}`}
                          </h3>
                        </div>

                        <button
                          onClick={() => setActivePage(t.id)}
                          className="text-[12px] font-bold text-slate-400 hover:text-[#47BCC6] transition-colors flex items-center gap-1"
                        >
                          回到議題
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="px-7 py-6">
                        {t.notes ? (
                          <div className="text-[15px] leading-[1.9] text-slate-700 font-medium whitespace-pre-wrap">
                            {t.notes}
                          </div>
                        ) : (
                          <div className="text-slate-300 text-[13px] font-medium">
                            尚無筆記
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-300 font-medium bg-white rounded-[24px] border border-dashed border-[#E0EEF0]">
                    尚未建立任何議題
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              Topic Workspace
          ════════════════════════════════════════ */}
          {currentTopic &&
            !["agenda", "cover", "summary", "allnotes"].includes(activePage) && (
              <div className="px-8 md:px-16 pt-28 pb-48 mx-auto w-full max-w-[1040px] xl:max-w-[1240px]">
                {/* Topic Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-white border border-[#E0EEF0] text-[10px] font-black text-slate-400 tracking-widest uppercase shadow-sm">
                      {currentTopic.id}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                        currentTopic.status === "resolved"
                          ? "bg-[#47BCC6]/10 text-[#47BCC6]"
                          : "bg-[#F8B74A]/12 text-[#F8B74A]"
                      }`}
                    >
                      {currentTopic.status === "resolved"
                        ? "Resolved"
                        : "In Progress"}
                    </span>

                    <span className="text-[12px] font-bold text-slate-400">
                      {currentTopicIndex + 1} / {stats.total}
                    </span>
                  </div>

                </div>

                {/* Topic Title */}
                <div className="mb-8">
                  <h2 className="text-[36px] md:text-[50px] lg:text-[56px] font-black text-slate-900 leading-[1.18] tracking-tight">
                    <span className="relative inline px-1">
                      <span className="absolute bottom-2 left-0 right-0 h-[10px] bg-[#F8B74A]/20 rounded-sm -z-0" />
                      <span className="relative z-10">
                        {currentTopic.title || "未命名議題"}
                      </span>
                    </span>
                  </h2>
                </div>

                {/* Topic Description */}
                <div className="mb-8 bg-white/95 rounded-[26px] border border-[#E0EEF0] p-6 md:p-8 shadow-sm">
                  {currentTopic.desc ? (
                    <p className="text-[15px] md:text-[16px] text-slate-600 leading-[1.9] font-medium whitespace-pre-wrap">
                      {currentTopic.desc}
                    </p>
                  ) : (
                    <p className="text-[14px] text-slate-300 font-medium">
                      尚未填寫議題描述。
                    </p>
                  )}
                </div>

                {/* Visual Assets / Presentation Stage */}
<div className="bg-white rounded-[32px] md:rounded-[40px] p-1.5 md:p-2 overflow-hidden border border-[#E0EEF0] shadow-sm mb-8">
  <div className="px-6 md:px-8 py-5 flex flex-wrap items-center justify-between border-b border-[#E0EEF0]/70 gap-4">
    <div className="flex items-center gap-2">
      <ImageIcon className="w-4 h-4 text-slate-400" />
      <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">
        Visual Assets & Collaboration
      </span>
    </div>

    {currentTopic.systems?.filter((s) => s?.name || s?.url).length > 0 && (
      <div className="flex flex-wrap gap-2">
        {currentTopic.systems
          .filter((s) => s?.name || s?.url)
          .map((s, i) => (
            <a
              key={i}
              href={s.url || "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!s.url) e.preventDefault();
              }}
              className="px-3 py-1.5 bg-[#F8FBFC] border border-[#E0EEF0] rounded-lg text-[12px] font-bold text-slate-600 hover:border-[#47BCC6] hover:text-[#47BCC6] transition-all flex items-center gap-1 shadow-sm"
            >
              {s.name || "相關連結"}
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
      </div>
    )}

    {!isViewer && (
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-lg bg-transparent text-slate-300 hover:text-[#47BCC6] hover:bg-[#F8FBFC] transition-all text-[12px] font-bold" title="臨時補圖">
          <Upload className="w-3.5 h-3.5" />
          補圖
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              await uploadImagesToTopic(currentTopic.id, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    )}
  </div>

  <div className="min-h-[300px] bg-[#F8FBFC] rounded-[28px] md:rounded-[36px] flex flex-col items-center justify-center p-6 md:p-10 gap-8 relative">
    {currentTopicImages.length > 0 ? (
      currentTopicImages.map((img, i) => (
        <div
          key={i}
          className="w-full flex flex-col items-center group relative bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 border border-[#E0EEF0] shadow-sm"
        >
          <img
            src={img}
            className="max-w-full max-h-[600px] md:max-h-[800px] object-contain rounded-xl md:rounded-2xl cursor-zoom-in hover:scale-[1.01] transition-transform"
            onClick={() => setFullscreenImg(img)}
            alt={`Topic img ${i + 1}`}
          />
        </div>
      ))
    ) : (
      <div className="py-16 text-center">
        <ImageIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-[14px] text-slate-400 font-bold">
          尚未上傳展示畫面
        </p>
      </div>
    )}
  </div>
</div>

                {/* Resolution Notes：optional / light mode */}
{(() => {
  const hasNotes = Boolean((currentTopic.notes || "").trim());
  const isNoteOpen = hasNotes || expandedNotesTopicId === currentTopic.id;

  if (isViewer && !hasNotes) return null;

  return (
    <div className="mb-8">
      {!isNoteOpen ? (
        <button
          onClick={() => setExpandedNotesTopicId(currentTopic.id)}
          className="w-full rounded-[24px] border border-dashed border-[#E0EEF0] bg-white px-6 py-5 text-left hover:border-[#47BCC6]/35 hover:bg-[#F8FBFC] transition-all group"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F1FAFB] border border-[#E0EEF0] flex items-center justify-center text-[#47BCC6]">
                <Edit3 className="w-4 h-4" />
              </div>

              <div>
                <h3 className="text-[15px] font-black text-slate-800">
                  新增此議題的會議筆記
                </h3>
                <p className="mt-1 text-[12px] text-slate-400 font-medium">
                  只有需要記錄決議、待辦或追蹤事項時再展開。
                </p>
              </div>
            </div>

            <span className="text-[12px] font-bold text-slate-300 group-hover:text-[#47BCC6] transition-colors">
              展開
            </span>
          </div>
        </button>
      ) : (
        <div className="rounded-[26px] border border-[#E0EEF0] bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E0EEF0] bg-[#F8FBFC] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white border border-[#E0EEF0] flex items-center justify-center text-[#47BCC6]">
                <Edit3 className="w-4 h-4" />
              </div>

              <div>
                <h3 className="text-[15px] font-black text-slate-900">
                  會議筆記
                </h3>
                <p className="mt-1 text-[12px] text-slate-400 font-medium">
                  記錄此議題的決議、待辦、風險與追蹤事項。
                </p>
              </div>
            </div>

            {!isViewer && (
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => appendQuickTag(tag.template)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tag.color}`}
                  >
                    + {tag.label}
                  </button>
                ))}

                {!hasNotes && (
                  <button
                    onClick={() => setExpandedNotesTopicId(null)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    收合
                  </button>
                )}
              </div>
            )}
          </div>

          {isViewer ? (
            <div className="px-6 py-5 text-[15px] text-slate-700 leading-[1.9] font-medium whitespace-pre-wrap bg-white">
              {currentTopic.notes}
            </div>
          ) : (
            <textarea
              ref={notesRef}
              value={currentTopic.notes || ""}
              onChange={(e) =>
                updateTopic(currentTopic.id, "notes", e.target.value)
              }
              placeholder="輸入此議題的決議、待辦、風險或追蹤事項..."
              className="w-full min-h-[180px] bg-white text-slate-700 outline-none px-6 py-5 text-[15px] leading-[1.9] font-medium resize-y transition-all placeholder:text-slate-300"
            />
          )}
        </div>
      )}
    </div>
  );
})()}

                {/* Bottom Navigation */}
                {!isViewer && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <button
                      onClick={() => setActivePage("agenda")}
                      className="px-5 py-3 rounded-2xl bg-white border border-[#E0EEF0] text-slate-500 hover:text-[#47BCC6] hover:border-[#47BCC6]/35 transition-all font-bold text-[13px]"
                    >
                      ← 返回議程
                    </button>

                    <button
                      onClick={markResolvedAndNext}
                      className="px-6 py-3 rounded-2xl bg-black text-white hover:bg-slate-800 transition-all font-black text-[13px] flex items-center gap-2"
                    >
                      完成並前進
                      <MoveRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* Fullscreen Image Preview */}
          {fullscreenImg && (
            <div
              className="fixed inset-0 z-[9998] bg-black/80 flex items-center justify-center p-8 cursor-zoom-out backdrop-blur-sm"
              onClick={() => setFullscreenImg(null)}
            >
              <img
                src={fullscreenImg}
                className="max-w-full max-h-full rounded-2xl shadow-2xl"
                alt=""
              />

              <button className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20">
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
        </main>

        {/* Quick Notes Side Panel */}
        {isNotesOpen && !isViewer && (
          <div className="w-[360px] shrink-0 flex flex-col border-l border-[#E0EEF0] bg-white/92 backdrop-blur-xl">
            <div className="px-6 py-4 border-b border-[#E0EEF0] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Quick Notes
                </span>
                <p className="text-[12px] text-slate-300 font-medium mt-1">
                  自由記錄，不會進入正式議題筆記
                </p>
              </div>

              <button
                onClick={() => setIsNotesOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              className="flex-1 p-6 text-[14px] text-slate-700 leading-[1.9] resize-none outline-none bg-white placeholder:text-slate-300 font-medium"
              placeholder="自由記錄任何想法..."
            />
          </div>
        )}
        
{/* ════════════════════════════════════════
    Setting Modal（單頁捲動式，不分步驟）
════════════════════════════════════════ */}
{isConfigOpen && tempConfig && (
  <div className="fixed inset-0 z-[9000] flex items-center justify-center p-5 bg-slate-950/35 backdrop-blur-sm">
    <div
      className="w-full max-w-[780px] h-[88vh] bg-white rounded-[28px] shadow-2xl border border-[#E0EEF0] overflow-hidden flex flex-col"
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Header */}
      <div className="px-7 py-5 border-b border-[#E0EEF0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <MiniMascotMark />
          <h3 className="text-[18px] font-black text-slate-900">會議設定</h3>
        </div>
        <button
          onClick={() => setIsConfigOpen(false)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-light px-7 py-6 space-y-7">

        {/* ── 基本資料 ── */}
        <section>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.22em] mb-4">基本資料</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-500 tracking-widest uppercase mb-2">會議標題</label>
              <input
                value={tempConfig.cover?.title || ""}
                onChange={(e) => setTempConfig((p) => ({ ...p, cover: { ...p.cover, title: e.target.value } }))}
                placeholder="例如：八千代醫美 APP 下單流程 Demo"
                className="w-full px-4 py-3.5 rounded-2xl border border-[#E0EEF0] bg-white outline-none focus:border-[#47BCC6]/60 focus:ring-2 focus:ring-[#47BCC6]/10 text-[15px] font-bold text-slate-800 placeholder:text-slate-300"
              />

            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-500 tracking-widest uppercase mb-2">會議日期</label>
                <input
                  type="date"
                  value={tempConfig.sessionDate || ""}
                  onChange={(e) => setTempConfig((p) => ({ ...p, sessionDate: e.target.value }))}
                  className="w-full px-4 py-3.5 rounded-2xl border border-[#E0EEF0] bg-white outline-none focus:border-[#47BCC6]/60 focus:ring-2 focus:ring-[#47BCC6]/10 text-[14px] font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 tracking-widest uppercase mb-2">出席者</label>
                <input
                  value={tempConfig.attendees || ""}
                  onChange={(e) => setTempConfig((p) => ({ ...p, attendees: e.target.value }))}
                  placeholder="王小姐、陳經理（以逗號分隔）"
                  className="w-full px-4 py-3.5 rounded-2xl border border-[#E0EEF0] bg-white outline-none focus:border-[#47BCC6]/60 focus:ring-2 focus:ring-[#47BCC6]/10 text-[14px] font-medium text-slate-700 placeholder:text-slate-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 tracking-widest uppercase mb-2">會議描述（選填）</label>
              <textarea
                value={tempConfig.cover?.desc || ""}
                onChange={(e) => setTempConfig((p) => ({ ...p, cover: { ...p.cover, desc: e.target.value } }))}
                placeholder="補充本次會議目的、背景..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-[#E0EEF0] bg-white outline-none focus:border-[#47BCC6]/60 focus:ring-2 focus:ring-[#47BCC6]/10 text-[14px] leading-[1.8] font-medium text-slate-700 placeholder:text-slate-300 resize-y min-h-[92px]"
              />
            </div>

            <div className="rounded-2xl border border-[#E0EEF0] bg-[#F8FBFC] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdvancedSettingOpen(!isAdvancedSettingOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white transition-all"
              >
                <div>
                  <p className="text-[12px] font-black text-slate-600">進階設定</p>
                  <p className="mt-1 text-[11px] text-slate-400 font-medium">調整首頁標題字級。</p>
                </div>
                {isAdvancedSettingOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {isAdvancedSettingOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#E0EEF0]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-black text-slate-500">首頁標題大小</span>
                    <span className="text-[12px] font-black text-[#47BCC6]">{tempConfig.cover?.titleFontSize || 72}px</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-bold">小</span>
                    <input
                      type="range"
                      min="40"
                      max="120"
                      step="2"
                      value={tempConfig.cover?.titleFontSize || 72}
                      onChange={(e) =>
                        setTempConfig((p) => ({
                          ...p,
                          cover: { ...p.cover, titleFontSize: Number(e.target.value) || 72 },
                        }))
                      }
                      className="flex-1 accent-[#47BCC6] cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-400 font-bold">大</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="h-px bg-[#E0EEF0]" />

        {/* ── 議題安排 ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">議題安排</p>
            <button
              onClick={addTopic}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-[12px] font-black hover:bg-slate-800 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              新增
            </button>
          </div>

          {(tempConfig.topics || []).length > 0 ? (
            <div className="space-y-2">
              {tempConfig.topics.map((t, idx) => {
                const expanded = expandedSetupTopicId === t.id;
                return (
                  <div
  key={t.id}
  draggable={!expanded}
  onDragStart={() => setDraggingSetupTopicId(t.id)}
  onDragOver={(e) => e.preventDefault()}
  onDrop={() => { moveTopicByDrag(draggingSetupTopicId, t.id); setDraggingSetupTopicId(null); }}
  onDragEnd={() => setDraggingSetupTopicId(null)}
  className={`bg-white border rounded-[18px] transition-all hover:border-[#47BCC6]/45 ${draggingSetupTopicId === t.id ? "opacity-50 border-[#47BCC6]" : expanded ? "border-[#47BCC6]/45 shadow-[0_10px_28px_rgba(71,188,198,0.08)]" : "border-[#E0EEF0]"}`}
>
                    <div
  onClick={() => setExpandedSetupTopicId(expanded ? null : t.id)}
  className="px-4 py-3.5 flex items-center gap-3 cursor-pointer"
>
                      <div className="text-slate-300 cursor-grab select-none text-[13px] font-black shrink-0">⋮⋮</div>
                      <span className="text-[11px] font-black text-slate-300 font-mono shrink-0 w-6">{String(idx + 1).padStart(2, "0")}</span>
                      <input
                        value={t.title || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTempTopic(t.id, "title", e.target.value)}
                        placeholder={`議題 ${idx + 1}`}
                        className="flex-1 bg-transparent outline-none text-[14px] font-black text-slate-900 placeholder:text-slate-300 cursor-text"
                      />
                      <ChevronDown
                        className={`w-4 h-4 text-slate-300 transition-transform ${expanded ? "rotate-180 text-[#47BCC6]" : ""}`}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTempTopic(t.id); }}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
          
                      {expanded && (() => {
                        const imgs = t.images?.length > 0 ? t.images : t.previewContent ? [t.previewContent] : [];

                        return (
                          <div className="px-4 pb-4 pl-[52px] space-y-4">
                            <textarea
                              value={t.desc || ""}
                              onChange={(e) => updateTempTopic(t.id, "desc", e.target.value)}
                              placeholder="議題描述"
                              rows={3}
                              className="w-full px-4 py-3 rounded-xl border border-[#E0EEF0] bg-[#F8FBFC] outline-none focus:bg-white focus:border-[#47BCC6]/60 text-[13px] leading-[1.8] font-medium text-slate-700 placeholder:text-slate-300 resize-y min-h-[92px]"
                            />

                            <div className="rounded-2xl border border-[#E0EEF0] bg-[#F8FBFC] p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                  <p className="text-[12px] font-black text-slate-700">展示圖</p>
                                  <p className="mt-1 text-[11px] text-slate-400 font-medium">上傳、刪除或拖曳縮圖調整播放順序。</p>
                                </div>

                                <label className="px-3 py-2 rounded-xl bg-white border border-dashed border-[#E0EEF0] text-[12px] font-bold text-[#47BCC6] hover:border-[#47BCC6]/40 transition-all flex items-center gap-1.5 cursor-pointer">
                                  <Upload className="w-3.5 h-3.5" />
                                  上傳圖片
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={async (e) => {
                                      await uploadImagesToTempTopic(t.id, e.target.files);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              </div>

                              {imgs.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                  {imgs.map((img, i) => (
                                    <div
                                      key={`${t.id}-img-${i}`}
                                      draggable
                                      onDragStart={() => setDraggingSetupImage({ topicId: t.id, index: i })}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={() => {
                                        if (draggingSetupImage?.topicId === t.id) {
                                          moveTempTopicImageByDrag(t.id, draggingSetupImage.index, i);
                                        }
                                        setDraggingSetupImage(null);
                                      }}
                                      onDragEnd={() => setDraggingSetupImage(null)}
                                      className={`group relative aspect-video rounded-xl border overflow-hidden bg-white cursor-grab transition-all ${
                                        draggingSetupImage?.topicId === t.id && draggingSetupImage?.index === i
                                          ? "opacity-45 border-[#47BCC6]"
                                          : "border-[#E0EEF0] hover:border-[#47BCC6]/45"
                                      }`}
                                      title="拖曳調整順序"
                                    >
                                      <img src={img} alt="" className="w-full h-full object-contain p-1" />
                                      <div className="absolute left-2 top-2 px-1.5 py-0.5 rounded-md bg-white/90 text-[10px] font-black text-slate-400 shadow-sm">
                                        {i + 1}
                                      </div>
                                      <button
                                        onClick={() => removeTempTopicImage(t.id, i)}
                                        className="absolute right-2 top-2 w-6 h-6 rounded-full bg-slate-950/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
                                        title="刪除此張"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[#E0EEF0] bg-white py-5 text-center text-[12px] text-slate-300 font-bold">
                                  尚未上傳展示圖
                                </div>
                              )}
                            </div>

                            <div className="rounded-2xl border border-[#E0EEF0] bg-[#F8FBFC] p-4 space-y-3">
  <div className="flex items-center justify-between gap-3">
    <p className="text-[13px] font-black tracking-wide text-slate-600 flex items-center gap-1.5">
      <ExternalLink className="w-3.5 h-3.5" />
      相關連結
    </p>

    <button
      onClick={() => addTempTopicSystem(t.id)}
      className="text-[11px] text-[#47BCC6] font-bold hover:underline"
    >
      + 新增
    </button>
  </div>

  {(t.systems || []).length === 0 && (
    <div className="text-[12px] text-slate-400 py-2">
      尚未新增連結
    </div>
  )}

  {(t.systems || []).map((sys, sidx) => (
    <div key={sidx} className="flex gap-2 items-center">
      <input
        value={sys.name || ""}
        onChange={(e) => updateTempTopicSystem(t.id, sidx, "name", e.target.value)}
        placeholder="名稱，例如：APP 後台"
        className="w-1/3 p-2 bg-white border border-[#E0EEF0] rounded-md text-[12px] outline-none focus:border-[#47BCC6]"
      />

      <input
        value={sys.url || ""}
        onChange={(e) => updateTempTopicSystem(t.id, sidx, "url", e.target.value)}
        placeholder="https://..."
        className="flex-1 p-2 bg-white border border-[#E0EEF0] rounded-md text-[12px] outline-none focus:border-[#47BCC6]"
      />

      <button
        onClick={() => removeTempTopicSystem(t.id, sidx)}
        className="p-1.5 text-slate-300 hover:text-red-500 rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ))}
</div>
                             

                            </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 rounded-[20px] border border-dashed border-[#E0EEF0] bg-white text-center">
              <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold text-[13px]">尚未建立議題</p>
            </div>
          )}
        </section>

        <div className="h-px bg-[#E0EEF0]" />

        {/* ── 專案備份 ── */}
        <section>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.22em] mb-4">專案備份</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportConfigJSON} className="px-4 py-2.5 rounded-xl bg-white border border-[#E0EEF0] text-slate-500 hover:text-[#47BCC6] hover:border-[#47BCC6]/35 transition-all font-bold text-[12px] flex items-center gap-2">
              <Download className="w-4 h-4" />匯出 JSON
            </button>
            <label className="px-4 py-2.5 rounded-xl bg-white border border-[#E0EEF0] text-slate-500 hover:text-[#47BCC6] hover:border-[#47BCC6]/35 transition-all font-bold text-[12px] flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />匯入 JSON
              <input type="file" accept="application/json" className="hidden" onChange={importConfigJSON} />
            </label>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="px-7 py-4 border-t border-[#E0EEF0] bg-white flex items-center">

  <div className="flex items-center gap-8">

    <button
      onClick={() => setIsConfigOpen(false)}
      className="px-1 py-2 text-[13px] font-bold text-slate-400 hover:text-slate-700 transition-colors"
    >
      放棄變更
    </button>

    <button
      onClick={() => {
        if (window.confirm("確定清除全部設定？")) {
          setTempConfig(INITIAL_CLEAN_CONFIG);
        }
      }}
      className="px-1 py-2 text-[13px] font-bold text-slate-400 hover:text-red-500 transition-colors"
    >
      清除全部設定
    </button>
  </div>

  <button
    onClick={applyConfig}
    className="ml-auto px-6 py-2.5 rounded-xl bg-black text-white hover:bg-slate-800 transition-all font-black text-[13px] flex items-center gap-2"
  >
    儲存設定
    <Check className="w-4 h-4" />
  </button>
</div>
    </div>
  </div>
)}

        {/* ════════════════════════════════════════
            Export Modal
        ════════════════════════════════════════ */}
        {showExportModal && (
          <div className="fixed inset-0 z-[9100] flex items-center justify-center p-6 bg-slate-950/45 backdrop-blur-sm">
            <div
              className="w-full max-w-[760px] max-h-[86vh] bg-white rounded-[34px] shadow-2xl border border-[#E0EEF0] overflow-hidden flex flex-col"
              style={{ fontFamily: FONT_FAMILY }}
            >
              <div className="px-8 py-6 border-b border-[#E0EEF0] flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#47BCC6] mb-2">
                    Export Session
                  </p>
                  <h3 className="text-[22px] font-black text-slate-900">
                    匯出會議紀錄
                  </h3>
                </div>

                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2.5 rounded-xl hover:bg-[#F1FAFB] text-slate-400 hover:text-[#47BCC6] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar-light px-8 py-7 space-y-6">
                <div>
                  <h4 className="text-[15px] font-black text-slate-900 mb-3">
                    選擇匯出用途
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(EXPORT_OPTIONS).map(([fmt, item]) => {
                      const Icon = item.Icon;
                      const active = exportFormat === fmt;

                      return (
                        <button
                          key={fmt}
                          onClick={() => setExportFormat(fmt)}
                          className="text-left rounded-[22px] p-5 transition-all"
                          style={
                            active
                              ? {
                                  background: "rgba(71,188,198,0.10)",
                                  border: "1px solid rgba(71,188,198,0.35)",
                                  boxShadow:
                                    "0 12px 24px rgba(71,188,198,0.10)",
                                }
                              : {
                                  background: "#F8FBFC",
                                  border: "1px solid #E0EEF0",
                                }
                          }
                        >
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
                            style={{
                              background: active
                                ? "rgba(71,188,198,0.14)"
                                : "white",
                              color: active ? THEME.cyan : "#94a3b8",
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          <p
                            className={`text-[13px] font-black ${
                              active ? "text-[#47BCC6]" : "text-slate-700"
                            }`}
                          >
                            {item.label}
                          </p>

                          <p className="mt-2 text-[11px] leading-[1.6] text-slate-400 font-medium">
                            {item.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[15px] font-black text-slate-900">
                      選擇匯出內容
                    </h4>

                    <button
                      onClick={() => {
                        const allSelected = Object.values(
                          exportSelection
                        ).every(Boolean);

                        const next = {
                          cover: !allSelected,
                          agenda: !allSelected,
                        };

                        config.topics?.forEach((t) => {
                          next[t.id] = !allSelected;
                        });

                        setExportSelection(next);
                      }}
                      className="text-[12px] font-bold text-[#47BCC6] hover:text-[#3baab4]"
                    >
                      全選 / 取消全選
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-4 rounded-[18px] border border-[#E0EEF0] bg-[#F8FBFC] px-5 py-4 cursor-pointer hover:border-[#47BCC6]/35 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-white border border-[#E0EEF0] flex items-center justify-center text-[#47BCC6]">
                          <Home className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-slate-800">
                            封面
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium mt-1">
                            會議標題、日期、出席者與進度資訊
                          </p>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={Boolean(exportSelection.cover)}
                        onChange={() => toggleExportSelection("cover")}
                        className="w-4 h-4 accent-[#47BCC6]"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-[18px] border border-[#E0EEF0] bg-[#F8FBFC] px-5 py-4 cursor-pointer hover:border-[#47BCC6]/35 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-white border border-[#E0EEF0] flex items-center justify-center text-[#F8B74A]">
                          <List className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-slate-800">
                            議程總覽
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium mt-1">
                            所有議題順序與討論狀態
                          </p>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={Boolean(exportSelection.agenda)}
                        onChange={() => toggleExportSelection("agenda")}
                        className="w-4 h-4 accent-[#47BCC6]"
                      />
                    </label>

                    {config.topics?.map((t, idx) => (
                      <label
                        key={t.id}
                        className="flex items-center justify-between gap-4 rounded-[18px] border border-[#E0EEF0] bg-white px-5 py-4 cursor-pointer hover:border-[#47BCC6]/35 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-[#F1FAFB] border border-[#E0EEF0] flex items-center justify-center text-slate-400 font-black text-[11px]">
                            {String(idx + 1).padStart(2, "0")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-black text-slate-800 truncate">
                              {t.title || `未命名議題 ${idx + 1}`}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">
                              {t.status === "resolved" ? "已決議" : "討論中"}・
                              {(t.images?.length || 0)} 張素材
                            </p>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={Boolean(exportSelection[t.id])}
                          onChange={() => toggleExportSelection(t.id)}
                          className="w-4 h-4 accent-[#47BCC6]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-[#E0EEF0] bg-[#F8FBFC] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <p className="text-[12px] text-slate-400 font-medium">
                  匯出會依目前會議內容產生，不會影響原始資料。
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-white border border-[#E0EEF0] text-slate-500 hover:text-slate-800 transition-all font-bold text-[13px]"
                  >
                    取消
                  </button>

                  <button
                    onClick={handleConfirmExport}
                    className="px-6 py-2.5 rounded-xl bg-black text-white hover:bg-slate-800 transition-all font-black text-[13px] flex items-center gap-2"
                  >
                    確認匯出
                    <FileDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
