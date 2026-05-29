import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, RotateCw, Plus, ChevronLeft, ChevronRight, Check,
  Wind, Leaf, Bell, X, Activity, ShoppingCart, HeartPulse,
  Smile, AlertCircle, ChevronDown, History, PenLine, Users, Trash2, Edit2, Sparkles, Clock
} from 'lucide-react';

// ==========================================
// 系統設定 & 模擬環境 (解決編譯錯誤)
// ==========================================
const TODAY = new Date();
const fmtDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDateChinese = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
};
const shiftDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
};

const supabase = createClient(
  'https://pmhudmhdxfctmyfmmxhh.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaHVkbWhkeGZjdG15Zm1teGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ5MDQsImV4cCI6MjA5NDY0MDkwNH0.ymAzLChmVVvtkKCw2AIQLfhfodo8vJTONihzufw9CY0'
);


const cleanDateOnly = (value) => {
  if (!value) return fmtDate(TODAY);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fmtDate(value);
};

const normalizeEvent = (event) => {
  const content = event?.text || event?.title || '';
  const done = Boolean(event?.is_done ?? event?.completed ?? false);
  return {
    ...event,
    title: event?.title || content,
    text: content,
    date: cleanDateOnly(event?.date),
    is_done: done,
    completed: done,
  };
};

const buildEventPayload = ({ type, text, member, date, time, mood, currentUserLineId, members, base = {} }) => {
  const trimmedText = (text || '').trim();
  const finalType = type || 'todo';
  const finalDate = cleanDateOnly(date || TODAY);
  let displayText = trimmedText || TYPE_CONFIG[finalType]?.label || '記事';
  let finalMember = member || '全家';
  let finalMood = null;

  if (finalType === 'mood') {
    const me = members?.find(m => m.line_user_id === currentUserLineId);
    displayText = trimmedText || '紀錄當下心情...';
    finalMember = me ? me.name : (member || '家人');
    finalMood = mood || '😊';
  } else if (time) {
    if (finalType === 'schedule') displayText = `${time} ${trimmedText}`.trim();
    if (finalType === 'remind') displayText = `${trimmedText || '提醒'} (${time} 截止)`;
  }

  const done = Boolean(base.is_done ?? base.completed ?? false);

  return {
    title: displayText,
    text: displayText,
    type: finalType,
    member: finalMember,
    date: finalType === 'mood' ? fmtDate(TODAY) : finalDate,
    time: finalType === 'schedule' || finalType === 'remind' ? (time || null) : null,
    mood: finalType === 'mood' ? finalMood : null,
    is_done: done,
    completed: done,
  };
};


const buildScheduledAtISO = (date, time) => {
  if (!date || !time) return null;
  // 使用台灣時區組合，避免瀏覽器所在地或 UTC 造成日期偏移
  return new Date(`${cleanDateOnly(date)}T${time}:00+08:00`).toISOString();
};

const getNotificationModeLabel = (mode) => {
  const map = { private: '私訊', group: '群組', both: '全部' };
  return map[mode] || '私訊';
};

// ==========================================
// 質感調色盤 (Premium Aesthetic)
// ==========================================
const PALETTE = {
  paper: '#F9F8F6', card: '#FFFFFF', ink: '#233142', inkMuted: '#8E8E93', border: '#EAEAEA', accent: '#D68C7A',
  todo: '#5B7586', shop: '#C49553', remind: '#D68C7A', health: '#8DA399', mood: '#7A6B8D',
};

const TYPE_CONFIG = {
  schedule: { label: '行程', color: '#C49553', bg: 'bg-[#FCF8F2] text-[#C49553]', icon: CalendarDays },
  remind: { label: '提醒', color: PALETTE.remind, bg: 'bg-[#F9F3EE] text-[#D68C7A]', icon: AlertCircle },
  todo: { label: '待辦', color: PALETTE.todo, bg: 'bg-[#F0F4F8] text-[#5B7586]', icon: Activity },
  shop: { label: '採買', color: '#566B56', bg: 'bg-[#F4F8F4] text-[#566B56]', icon: ShoppingCart },
  health: { label: '健康', color: PALETTE.health, bg: 'bg-[#F6F4F8] text-[#8DA399]', icon: HeartPulse },
  routine: { label: '週期', color: PALETTE.inkMuted, bg: 'bg-[#F5F5F5] text-[#8E8E93]', icon: RotateCw },
  mood: { label: '心情', color: PALETTE.mood, bg: 'bg-[#F4F1F8] text-[#7A6B8D]', icon: Smile },
  note: { label: '紀錄', color: '#9CA3AF', bg: 'bg-[#F5F5F5] text-[#8E8E93]', icon: PenLine }, 
};

const PRIORITY = { remind: 1, schedule: 2, todo: 3, shop: 4, health: 5, routine: 6, mood: 7, note: 8 };
const HOLIDAYS = { '2026-05-01':'勞動節', '2026-06-19':'端午節', '2026-09-25':'中秋節', '2026-10-10':'國慶日' };
const moodOptions = ['😊', '😄', '🥰', '😌', '🙂', '😴', '😢', '😤'];
const hideScrollbar = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']";

// ==========================================
// 全局樣式注入 (高級字體 & 動畫)
// ==========================================
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Noto+Serif+TC:wght@400;500;600;700;900&family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap');

  :root { --bg-color: #F9F8F6; }

  .font-serif-jp { font-family: 'Noto Serif TC', 'Songti TC', 'MingLiU', serif; letter-spacing: 0.03em; }
  .font-num { font-family: 'Outfit', sans-serif; letter-spacing: 0; }
  .font-editorial { font-family: 'Playfair Display', serif; }
  
  html, body { 
    font-family: 'Noto Sans TC', sans-serif; 
    touch-action: auto; overscroll-behavior-y: none; letter-spacing: 0.01em; 
    margin: 0; padding: 0; background-color: var(--bg-color); min-height: 100dvh; 
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  input, textarea, select { font-size: 16px !important; font-family: inherit; } 
  .hide-scroll::-webkit-scrollbar { display: none; }
  .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  
  @keyframes springSlideUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
  .spring-modal { animation: springSlideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

  /* 統一 date/time input 外觀，所有瀏覽器 */
  .date-input, .time-input {
    display: block;
    width: 100%;
    height: 48px;
    padding: 0 16px;
    background: #F9F8F6;
    border: 1.5px solid #EAEAEA;
    border-radius: 14px;
    font-size: 15px;
    font-family: inherit;
    font-weight: 600;
    color: #233142;
    cursor: pointer;
    outline: none;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color 0.15s;
  }
  .date-input:focus, .time-input:focus {
    border-color: #233142;
    background: #fff;
  }
  .time-input { width: 130px; text-align: center; padding: 0 8px; }
  /* Chrome/Safari: 隱藏 calendar icon，保留點擊功能 */
  .date-input::-webkit-calendar-picker-indicator { opacity: 0; width: 100%; position: absolute; left: 0; cursor: pointer; }
  .time-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
  .date-input { position: relative; }
`;

if (typeof document !== 'undefined' && !document.getElementById('familyhub-style')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'familyhub-style';
  styleEl.innerHTML = GLOBAL_CSS;
  document.head.appendChild(styleEl);
}

// 質感共用輸入框
const inputStyle = "w-full bg-[#F9F8F6] border border-[#EAEAEA] focus:bg-white focus:border-[#233142] rounded-[16px] px-4 py-3.5 text-[15px] font-medium text-[#233142] placeholder:text-[#D1CFC7] transition-all outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

// 純按鈕日期/時間選擇器：日期用快速選擇，時間用快捷選項＋精準輸入，不超出手機框
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const TimeWheelPicker = ({ time, setTime }) => {
  const [draftTime, setDraftTime] = useState(time || '');

  useEffect(() => {
    setDraftTime(time || '');
  }, [time]);

  const quickTimes = [
    { label: '09:00', value: '09:00' },
    { label: '12:00', value: '12:00' },
    { label: '15:00', value: '15:00' },
    { label: '19:00', value: '19:00' },
  ];

  const isValidHHMM = (value) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return false;
    const [h, m] = value.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  const normalizeDraft = (value) => {
    const raw = String(value || '').replace(/[^0-9:]/g, '').slice(0, 5);
    if (/^\d{4}$/.test(raw)) return `${raw.slice(0, 2)}:${raw.slice(2)}`;
    return raw;
  };

  const commitTime = (value) => {
    const normalized = normalizeDraft(value);
    if (isValidHHMM(normalized)) {
      setDraftTime(normalized);
      setTime(normalized);
    } else if (!normalized) {
      setDraftTime('');
      setTime('');
    } else {
      setDraftTime(time || '');
    }
  };

  const handleTimeInput = (value) => {
    const normalized = normalizeDraft(value);
    setDraftTime(normalized);
    if (isValidHHMM(normalized)) setTime(normalized);
  };

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[18px] bg-white border border-[#EAEAEA] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <div className="px-3 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold text-[#A0A0A0] tracking-[0.18em] uppercase font-num">Quick Select</span>
          <button
            type="button"
            onClick={() => { setDraftTime(''); setTime(''); }}
            className="text-[11px] font-bold text-[#A0A0A0] tracking-widest active:text-[#D68C7A] transition-colors"
          >
            不設定
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {quickTimes.map(q => (
            <button
              type="button"
              key={q.value}
              onClick={() => { setDraftTime(q.value); setTime(q.value); }}
              className={`h-[38px] min-w-0 rounded-[11px] text-[12px] font-num font-bold border transition-all active:scale-95 ${
                time === q.value
                  ? 'bg-[#233142] text-white border-[#233142]'
                  : 'bg-[#F9F8F6] text-[#8E8E93] border-[#EAEAEA]'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#EAEAEA] bg-[#F9F8F6]/70 px-3 py-3">
        <label className="flex items-center gap-3 w-full">
          <span className="shrink-0 text-[11px] font-bold text-[#8E8E93] tracking-widest">24H 時間</span>
          <div className="relative flex-1 min-w-0">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="13:17"
              value={draftTime}
              onChange={e => handleTimeInput(e.target.value)}
              onBlur={e => commitTime(e.target.value)}
              className="w-full h-[42px] bg-white border border-[#EAEAEA] rounded-[13px] pl-9 pr-3 text-[15px] font-num font-bold tracking-[0.02em] text-[#233142] outline-none focus:border-[#233142] transition-all placeholder:text-[#D1CFC7]"
            />
          </div>
        </label>
      </div>
    </div>
  );
};

const DateTimePicker = ({ date, setDate, time, setTime, showTime = false }) => {
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const safeDate = cleanDateOnly(date || TODAY);

  const quickDates = [
    { label: '今天', d: shiftDays(TODAY, 0) },
    { label: '明天', d: shiftDays(TODAY, 1) },
    { label: '後天', d: shiftDays(TODAY, 2) },
  ];
  const isQuick = quickDates.some(q => q.d === safeDate);

  const moveDate = (days) => {
    setDate(shiftDays(safeDate, days));
    setShowCustomDate(false);
  };

  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden">
      <div className="bg-white border border-[#EAEAEA] rounded-[18px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center justify-between mb-3 min-w-0">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            className="shrink-0 w-9 h-9 rounded-full bg-[#F9F8F6] border border-[#EAEAEA] flex items-center justify-center active:scale-90 transition-all"
          >
            <ChevronLeft size={15} strokeWidth={2.5} className="text-[#8E8E93]" />
          </button>

          <div className="text-center min-w-0 px-2">
            <p className="text-[10px] font-bold text-[#A0A0A0] tracking-[0.22em] uppercase mb-0.5 font-num">Selected Date</p>
            <p className="text-[clamp(13px,3.8vw,15px)] font-bold text-[#233142] tracking-wide truncate">{fmtDateChinese(safeDate)}</p>
          </div>

          <button
            type="button"
            onClick={() => moveDate(1)}
            className="shrink-0 w-9 h-9 rounded-full bg-[#F9F8F6] border border-[#EAEAEA] flex items-center justify-center active:scale-90 transition-all"
          >
            <ChevronRight size={15} strokeWidth={2.5} className="text-[#8E8E93]" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {quickDates.map(q => (
            <button
              type="button"
              key={q.label}
              onClick={() => { setDate(q.d); setShowCustomDate(false); }}
              className={`h-[38px] min-w-0 rounded-[11px] text-[clamp(10px,3.2vw,12px)] font-bold border transition-all active:scale-95 ${
                safeDate === q.d ? 'bg-[#233142] text-white border-[#233142]' : 'bg-[#F9F8F6] text-[#8E8E93] border-[#EAEAEA]'
              }`}
            >
              {q.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowCustomDate(v => !v)}
            className={`h-[38px] min-w-0 rounded-[11px] text-[clamp(10px,3.2vw,12px)] font-bold border transition-all active:scale-95 ${
              showCustomDate || !isQuick ? 'bg-[#D68C7A] text-white border-[#D68C7A]' : 'bg-[#F9F8F6] text-[#8E8E93] border-[#EAEAEA]'
            }`}
          >
            指定
          </button>
        </div>

        {showCustomDate && (
          <div className="mt-3 pt-3 border-t border-dashed border-[#EAEAEA] animate-in fade-in slide-in-from-top-1 duration-150">
            <input
              type="date"
              value={safeDate}
              onChange={e => setDate(e.target.value)}
              className="w-full h-[44px] bg-[#F9F8F6] border border-[#EAEAEA] rounded-[12px] px-3 text-[14px] font-bold text-[#233142] outline-none focus:border-[#233142]"
            />
          </div>
        )}
      </div>

      {showTime && (
        <div className="w-full max-w-full overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTimePicker(v => !v)}
            className={`w-full h-[46px] rounded-[14px] border text-[13px] font-bold flex items-center gap-2 px-4 transition-all ${
              showTimePicker || time ? 'bg-white border-[#233142] text-[#233142]' : 'bg-[#F9F8F6] border-[#EAEAEA] text-[#8E8E93]'
            }`}
          >
            <Clock size={15} className="shrink-0 text-[#A0A0A0]" />
            <span className="truncate flex items-center gap-1.5 min-w-0">
              {showTimePicker ? (
                <span>時間設定</span>
              ) : time ? (
                <>
                  <span>提醒時間</span>
                  <span className="font-num tracking-[0.02em]">{time}</span>
                </>
              ) : (
                <span>設定時間（選填）</span>
              )}
            </span>
            {time && (
              <span
                className="ml-auto shrink-0 text-[#A0A0A0] w-7 h-7 flex items-center justify-center rounded-full bg-[#F9F8F6]"
                onClick={e => { e.stopPropagation(); setTime(''); }}
              >
                <X size={13}/>
              </span>
            )}
          </button>

          {showTimePicker && (
            <div className="mt-2 animate-in fade-in zoom-in-95 duration-150">
              <TimeWheelPicker time={time} setTime={setTime} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
const DragHeader = ({ children, className = '' }) => (
  <div className={`w-full shrink-0 bg-white rounded-t-[32px] ${className}`}>
      <div className="w-full pt-4 pb-3 flex justify-center items-center">
          <div className="w-12 h-1.5 bg-[#D0D0D0] rounded-full shrink-0 opacity-80"></div>
      </div>
      {children}
  </div>
);
const ScheduleReminderControl = ({ enabled, setEnabled, mode, setMode, disabled = false }) => {
  const modeOptions = [
    { key: 'private', label: '私訊' },
    { key: 'group', label: '群組' },
    { key: 'both', label: '全部' },
  ];

  return (
    <div className={`rounded-[18px] border border-[#EAEAEA] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.025)] transition-all ${disabled ? 'opacity-45' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-serif-jp font-bold text-[#233142] tracking-widest leading-none">預約 LINE 提醒</p>
          <p className="text-[10px] text-[#A0A0A0] mt-1 tracking-[0.08em] truncate">
            {disabled ? '設定時間後可啟用' : '到設定時間自動推播'}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEnabled(!enabled)}
          className={`shrink-0 w-[46px] h-[26px] rounded-full p-[3px] transition-all active:scale-95 ${enabled && !disabled ? 'bg-[#233142]' : 'bg-[#EAEAEA]'}`}
        >
          <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled && !disabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {enabled && !disabled && (
        <div className="mt-3 pt-3 border-t border-dashed border-[#EAEAEA] animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] font-bold text-[#8E8E93] tracking-widest mb-2 uppercase">通知方式</p>
          <div className="grid grid-cols-3 gap-1.5">
            {modeOptions.map(opt => (
              <button
                type="button"
                key={opt.key}
                onClick={() => setMode(opt.key)}
                className={`h-[36px] rounded-[12px] border text-[12px] font-bold tracking-widest transition-all active:scale-[0.97] ${
                  mode === opt.key
                    ? 'bg-[#233142] border-[#233142] text-white shadow-[0_2px_10px_rgba(35,49,66,0.12)]'
                    : 'bg-[#F9F8F6] border-[#EAEAEA] text-[#8E8E93]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};



export default function FamilyHub() {
  const [activeTab, setActiveTab] = useState('board');
  const [events, setEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [members, setMembers] = useState([]);
  const [lineUsers, setLineUsers] = useState([]); 
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [holidays, setHolidays] = useState(HOLIDAYS);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHideListOpen, setIsHideListOpen] = useState(false); 
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentUserLineId, setCurrentUserLineId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); 
  const [notifyEvent, setNotifyEvent] = useState(null);
  const [isSendingNotify, setIsSendingNotify] = useState(false);
  const [reportSettings, setReportSettings] = useState(null);
  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);
  const [isSavingReportSettings, setIsSavingReportSettings] = useState(false);

  const unboundLineUsers = useMemo(() => {
    const unbound = lineUsers.filter(lu => !lu.is_ignored && !members.some(m => m.line_user_id === lu.user_id));
    const uniqueUnbound = [];
    const seenIds = new Set();
    for (const user of unbound) {
      if (!seenIds.has(user.user_id)) { seenIds.add(user.user_id); uniqueUnbound.push(user); }
    }
    return uniqueUnbound;
  }, [lineUsers, members]);

  const ignoredLineUsers = useMemo(() => {
    const ignored = lineUsers.filter(lu => lu.is_ignored && !members.some(m => m.line_user_id === lu.user_id));
    const uniqueIgnored = [];
    const seenIds = new Set();
    for (const user of ignored) {
      if (!seenIds.has(user.user_id)) { seenIds.add(user.user_id); uniqueIgnored.push(user); }
    }
    return uniqueIgnored;
  }, [lineUsers, members]);

  const triggerVibration = (pattern = 10) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate(pattern);
  };

  const fetchSupabaseData = async () => {
    setIsRefreshing(true);
    try {
      const { data: eventsData } = await supabase.from('events').select('*').gte('date', '2026-05-22').order('date', { ascending: true });
      if (eventsData) setEvents(eventsData.map(normalizeEvent));

      const { data: routinesData } = await supabase.from('routines').select('*').gte('created_at', '2026-05-22T00:00:00Z');
      const { data: logsData } = await supabase.from('routine_logs').select('*');

      if (routinesData) {
        setRoutines(
          routinesData.map(r => {
            const myLogs = logsData ? logsData.filter(log => log.routine_name === r.name) : [];
            return {
              ...r, icon: r.icon || 'activity', color: r.color || '#5B7586',
              logs: myLogs.map(l => ({ id: l.id, date: l.last_done_at, note: l.note })).sort((a, b) => new Date(b.date) - new Date(a.date)),
            };
          })
        );
      }

      const { data: membersData } = await supabase.from('members').select('*');
      if (membersData) setMembers(membersData);
      const { data: lineUsersData } = await supabase.from('line_users').select('*');
      if (lineUsersData) setLineUsers(lineUsersData);

      const { data: reportSettingsData } = await supabase
        .from('report_settings')
        .select('*')
        .eq('report_type', 'morning')
        .limit(1)
        .maybeSingle();
      if (reportSettingsData) setReportSettings(reportSettingsData);
    } catch (err) { console.error('Fetch error:', err); } finally { setIsRefreshing(false); }
  };

  useEffect(() => {
    async function initLiff() {
      try {
        await liff.init({ liffId: '2010165775-xmYZj7n4' });
        if (liff.isLoggedIn()) { const profile = await liff.getProfile(); setCurrentUserLineId(profile.userId); }
      } catch (err) { console.error('LIFF 初始化失敗:', err); }
    }
    fetchSupabaseData(); initLiff();
  }, []);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const year = currentMonth.getFullYear();
        const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`);
        if (res.ok) {
          const data = await res.json();
          const newHolidays = {};
          data.forEach(d => {
            if (d.isHoliday && d.description) {
              const dateStr = `${d.date.substring(0,4)}-${d.date.substring(4,6)}-${d.date.substring(6,8)}`;
              newHolidays[dateStr] = d.description;
            }
          });
          setHolidays(prev => ({ ...prev, ...newHolidays }));
        }
      } catch (err) { }
    };
    fetchHolidays();
  }, [currentMonth.getFullYear()]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); triggerVibration(10); };

  const handleIgnoreUser = async (userId, shouldIgnore) => {
    try {
      await supabase.from('line_users').update({ is_ignored: shouldIgnore }).eq('user_id', userId);
      setLineUsers(prev => prev.map(lu => lu.user_id === userId ? { ...lu, is_ignored: shouldIgnore } : lu));
      showToast(shouldIgnore ? '🙈 已移至隱藏名單' : '👀 已恢復至待安排名單');
    } catch (err) { alert('操作失敗，請重新整理頁面重試。'); }
  };

  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const { data, error } = await supabase.from('members').insert([{ name, role_name: role }]).select();
    if (!error && data) { setMembers(prev => [...prev, data[0]]); showToast('✅ 角色已建立'); return true; }
    return false;
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm('確定要移除此角色嗎？')) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (!error) { setMembers(prev => prev.filter(m => m.id !== id)); showToast('🗑️ 角色已移除'); }
    }
  };

  const handleUpdateEvent = async (updatedEvent) => {
    const payload = buildEventPayload({
      type: updatedEvent.type,
      text: updatedEvent.text,
      member: updatedEvent.member,
      date: updatedEvent.date,
      time: updatedEvent.time,
      mood: updatedEvent.mood,
      currentUserLineId,
      members,
      base: updatedEvent,
    });

    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', updatedEvent.id)
      .select();

    if (!error) {
      const nextEvent = normalizeEvent(data?.[0] || { ...updatedEvent, ...payload });
      setEvents(prev => prev.map(e => e.id === updatedEvent.id ? nextEvent : e).sort((a,b) => {
        if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
        return (PRIORITY[a.type] || 99) - (PRIORITY[b.type] || 99);
      }));
      setEditingEvent(null);
      showToast('✅ 手札已更新');
    } else {
      console.error('update error:', error);
      showToast(`❌ 更新失敗：${error?.message || '請稍後再試'}`);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (!error) { setEvents(prev => prev.filter(e => e.id !== eventId)); setEditingEvent(null); showToast('🗑️ 記事已刪除'); }
  };

  const handleSendNotify = async (mode) => {
    if (!notifyEvent || isSendingNotify) return;
    setIsSendingNotify(true);
    triggerVibration(10);

    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: notifyEvent, mode }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'LINE 通知發送失敗');

      const privateCount = result?.result?.privateCount || 0;
      const groupSent = Boolean(result?.result?.group);
      const label = mode === 'group'
        ? '已發送到群組'
        : mode === 'private'
          ? `已私訊 ${privateCount || ''} 位成員`
          : groupSent
            ? `已發送群組與私訊${privateCount ? `（${privateCount} 位）` : ''}`
            : '已發送提醒';

      showToast(`🔔 ${label}`);
      setNotifyEvent(null);
    } catch (err) {
      console.error('notify error:', err);
      showToast(`❌ ${err?.message || '通知失敗，請稍後再試'}`);
    } finally {
      setIsSendingNotify(false);
    }
  };


  const saveScheduledNotification = async ({ eventId, date, time, enabled, targetMode }) => {
    if (!eventId) return;

    const { data: existing, error: findError } = await supabase
      .from('scheduled_notifications')
      .select('id')
      .eq('event_id', eventId)
      .eq('notification_type', 'event_reminder')
      .eq('status', 'pending')
      .limit(1);

    if (findError) throw findError;

    const existingId = existing?.[0]?.id;
    const scheduledAt = buildScheduledAtISO(date, time);

    if (!enabled || !scheduledAt) {
      if (existingId) {
        const { error } = await supabase
          .from('scheduled_notifications')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', existingId);
        if (error) throw error;
      }
      return;
    }

    const payload = {
      event_id: eventId,
      notification_type: 'event_reminder',
      target_mode: targetMode || 'private',
      scheduled_at: scheduledAt,
      status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      const { error } = await supabase
        .from('scheduled_notifications')
        .update(payload)
        .eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('scheduled_notifications')
        .insert([payload]);
      if (error) throw error;
    }
  };

  const loadScheduledNotificationForEvent = async (eventId) => {
    if (!eventId) return null;
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('event_id', eventId)
      .eq('notification_type', 'event_reminder')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('load scheduled notification error:', error);
      return null;
    }
    return data || null;
  };

  const handleSaveReportSettings = async (nextSettings) => {
    setIsSavingReportSettings(true);
    try {
      const payload = {
        report_type: 'morning',
        enabled: Boolean(nextSettings.enabled),
        send_time: nextSettings.send_time || '08:00',
        target_mode: nextSettings.target_mode || 'private',
        timezone: 'Asia/Taipei',
        include_today_events: true,
        include_overdue_events: true,
        updated_at: new Date().toISOString(),
      };

      if (reportSettings?.id) {
        const { data, error } = await supabase
          .from('report_settings')
          .update(payload)
          .eq('id', reportSettings.id)
          .select()
          .single();
        if (error) throw error;
        setReportSettings(data);
      } else {
        const { data, error } = await supabase
          .from('report_settings')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setReportSettings(data);
      }

      showToast(payload.enabled ? `✅ 晨間報表已設定 ${payload.send_time}` : '✅ 晨間報表已關閉');
      setIsReportSettingsOpen(false);
    } catch (err) {
      console.error('report settings error:', err);
      showToast(`❌ 設定失敗：${err?.message || '請稍後再試'}`);
    } finally {
      setIsSavingReportSettings(false);
    }
  };

  const handleToggleDone = async (e, ev) => {
    e.stopPropagation();
    triggerVibration(15);
    const newStatus = !Boolean(ev.is_done ?? ev.completed);

    setEvents(prev => prev.map(item => item.id === ev.id ? { ...item, is_done: newStatus, completed: newStatus } : item));

    const { error } = await supabase
      .from('events')
      .update({ is_done: newStatus, completed: newStatus })
      .eq('id', ev.id);

    if (!error) {
      if (newStatus) showToast('✅ 任務已完成');

      if (newStatus && ev.is_routine && ev.routine_id) {
        const routine = routines.find(r => r.id === ev.routine_id);
        if (routine) {
          const nextDate = shiftDays(ev.date, routine.interval_days || 30);
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('routine_id', routine.id)
            .eq('date', nextDate);

          if (!existing || existing.length === 0) {
            await supabase.from('events').insert([{
              title: ev.text || ev.title || routine.name,
              text: ev.text || ev.title || routine.name,
              type: ev.type || 'routine',
              member: ev.member || routine.member || '全家',
              date: nextDate,
              time: null,
              mood: null,
              is_routine: true,
              routine_id: routine.id,
              is_done: false,
              completed: false,
            }]);
            fetchSupabaseData();
          }
        }
      }
    } else {
      setEvents(prev => prev.map(item => item.id === ev.id ? { ...item, is_done: !newStatus, completed: !newStatus } : item));
      console.error('toggle error:', error);
      showToast(`❌ 狀態更新失敗：${error?.message || '請重試'}`);
    }
  };

  const NotifyActionPanel = ({ event }) => {
    if (!event) return null;

    const member = event.member || '全家';
    const isAllMembers = member === '全家';
    const helperText = isAllMembers ? '私訊所有已綁定成員' : `私訊 ${member}`;
    const isMood = event.type === 'mood';

    const actionButtonClass = "h-[38px] min-w-0 rounded-[12px] border border-[#EAEAEA] bg-white text-[#233142] text-[12px] font-bold tracking-widest active:scale-[0.97] transition-all disabled:opacity-50 shadow-[0_1px_4px_rgba(0,0,0,0.02)]";

    return (
      <div
        className="mt-3 pt-3 border-t border-dashed border-[#EAEAEA] animate-in fade-in slide-in-from-top-1 duration-200"
        onClick={ev => ev.stopPropagation()}
      >
        <div className="flex items-end justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-serif-jp font-bold text-[#233142] tracking-widest leading-none">發送提醒</p>
            <p className="text-[10px] text-[#A0A0A0] tracking-[0.08em] mt-1 truncate">群組通知 / {helperText}</p>
          </div>
          <button
            type="button"
            disabled={isSendingNotify}
            onClick={() => setNotifyEvent(null)}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#B8B2AA] active:bg-[#F9F8F6] active:scale-95 transition-all disabled:opacity-50"
            aria-label="收合提醒選單"
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>

        <div className={`grid gap-1.5 ${isMood ? 'grid-cols-1' : 'grid-cols-3'}`}>
          <button
            type="button"
            disabled={isSendingNotify}
            onClick={() => handleSendNotify('group')}
            className={actionButtonClass}
          >
            群組
          </button>

          {!isMood && (
            <>
              <button
                type="button"
                disabled={isSendingNotify}
                onClick={() => handleSendNotify('private')}
                className={actionButtonClass}
              >
                私訊
              </button>
              <button
                type="button"
                disabled={isSendingNotify}
                onClick={() => handleSendNotify('both')}
                className="h-[38px] min-w-0 rounded-[12px] border border-[#233142] bg-[#233142] text-white text-[12px] font-bold tracking-widest active:scale-[0.97] transition-all disabled:opacity-50 shadow-[0_2px_10px_rgba(35,49,66,0.12)]"
              >
                全部
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ==============================================================
  // 1. 任務看板 (BoardView)
  // ==============================================================
  const BoardView = () => {
    const calendarDays = useMemo(() => {
      const days = [];
      const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
      const firstDay = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
      
      for (let i = 0; i < firstDay; i++) days.push({ type: "empty", id: `empty-${i}` });
      
      for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(y, m, i);
        const dateStr = fmtDate(dateObj);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        days.push({ 
          type: "day", date: dateStr, dayNum: i, 
          events: events.filter(e => e.date === dateStr), 
          isWeekend, holiday: holidays[dateStr] || null 
        });
      }
      return days;
    }, [currentMonth, events, holidays]);

    const dayEvents = useMemo(() => {
      return events.filter(e => e.date === selectedDate && (filter === 'all' || e.type === filter))
        .sort((a, b) => {
          if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
          return (PRIORITY[a.type] || 99) - (PRIORITY[b.type] || 99);
        });
    }, [events, selectedDate, filter]);

    const isTodaySelected = selectedDate === fmtDate(TODAY);
    const [animKey, setAnimKey] = useState(Date.now());
    const handleDayClick = (date) => { triggerVibration(5); setSelectedDate(date); setAnimKey(Date.now()); };

    return (
      <div className="flex flex-col pb-32 pt-2 relative">
        <div className="px-5 space-y-3">
          <div className="bg-white rounded-[24px] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_4px_20px_rgba(0,0,0,0.02)] border border-[#EAEAEA] relative overflow-hidden">
            <div className="flex justify-between items-center mb-5 relative z-10">
              <h2 className="text-[26px] font-serif-jp font-bold text-[#233142] leading-none tracking-wider flex items-baseline gap-2">
                {currentMonth.getMonth() + 1}月 <span className="text-[14px] font-num font-medium text-[#8E8E93]">{currentMonth.getFullYear()}</span>
              </h2>
              <div className="flex gap-2">
                <button onClick={() => {triggerVibration(5); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}} className="w-8 h-8 rounded-full bg-[#F9F8F6] text-[#233142] hover:bg-[#EAEAEA] active:scale-95 transition-all flex items-center justify-center"><ChevronLeft size={16} strokeWidth={2.5}/></button>
                <button onClick={() => {triggerVibration(5); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}} className="w-8 h-8 rounded-full bg-[#F9F8F6] text-[#233142] hover:bg-[#EAEAEA] active:scale-95 transition-all flex items-center justify-center"><ChevronRight size={16} strokeWidth={2.5}/></button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-3 border-t border-[#EAEAEA] border-dashed pt-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={`text-center text-[11px] font-num font-bold tracking-[0.2em] uppercase ${(i===0 || i===6) ? 'text-[#D68C7A]' : 'text-[#8E8E93]'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {calendarDays.map((day) => {
                if (day.type === 'empty') return <div key={day.id} />;
                const isSelected = selectedDate === day.date;
                const isToday = day.date === fmtDate(TODAY);
                const hasEvents = day.events.length > 0;
                const isRed = day.isWeekend || day.holiday;
                
                return (
                  <div key={day.date} onClick={() => handleDayClick(day.date)} className="relative flex flex-col items-center justify-center cursor-pointer group h-[44px] tap-highlight-transparent">
                    <div className={`absolute inset-0 rounded-[12px] transition-all duration-300 ease-out ${isSelected ? (isRed ? 'bg-[#D68C7A] scale-100 opacity-100 shadow-[0_4px_12px_rgba(214,140,122,0.25)]' : 'bg-[#233142] scale-100 opacity-100 shadow-[0_4px_12px_rgba(35,49,66,0.15)]') : 'scale-[0.85] opacity-0 group-hover:bg-[#F9F8F6] group-hover:scale-100 group-hover:opacity-100 group-active:bg-[#EAEAEA]'}`}></div>
                    <div className={`relative z-10 w-8 h-8 flex items-center justify-center text-[15px] font-num transition-colors duration-200 ${isSelected ? 'text-white font-bold' : (isRed ? 'text-[#D68C7A] font-bold' : 'text-[#233142] font-medium')} ${!isSelected && isToday ? `border-[1.5px] ${isRed ? 'border-[#D68C7A]' : 'border-[#233142]'} rounded-[12px]` : ''}`}>
                      {day.dayNum}
                    </div>
                    {day.holiday && !isSelected && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D68C7A]/40"></div>
                    )}
                    {hasEvents && (
                      <div className="relative z-10 absolute bottom-[2px] flex gap-[3px] items-center mt-1">
                        {day.events.slice(0, 3).map((e, idx) => <span key={idx} className={`w-[4px] h-[4px] rounded-full transition-colors`} style={{ backgroundColor: isSelected ? '#FFFFFF' : TYPE_CONFIG[e.type].color }}></span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#F9F8F6] to-[#F9F8F6]/95 backdrop-blur-md pt-5 pb-3 px-5 mt-1 border-b border-[#EAEAEA]/80">
          <div className={`flex gap-3 overflow-x-auto snap-x ${hideScrollbar}`}>
            <button onClick={() => {triggerVibration(5); setFilter('all')}} className={`snap-start whitespace-nowrap px-4 py-2 text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center rounded-[12px] shadow-sm ${filter === 'all' ? 'bg-[#233142] text-white' : 'bg-white text-[#8E8E93] border border-[#EAEAEA] hover:bg-[#F9F8F6]'}`}>
              所有紀錄
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <button key={key} onClick={() => {triggerVibration(5); setFilter(key)}} className={`snap-start whitespace-nowrap flex items-center gap-2 px-4 py-2 text-[12px] font-bold transition-all active:scale-95 rounded-[12px] shadow-sm ${filter === key ? 'bg-[#233142] text-white' : 'bg-white text-[#8E8E93] border border-[#EAEAEA] hover:bg-[#F9F8F6]'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filter === key ? '#FFFFFF' : config.color }}></span>
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-4 relative pb-20 min-h-[350px]">
          <div className="flex items-center justify-between py-1 mb-5 z-10">
            <h3 className="text-[17px] font-serif-jp font-bold text-[#233142] flex items-baseline gap-2 tracking-wide">
              <span className={`text-[36px] font-editorial italic leading-none pr-1 ${holidays[selectedDate] || new Date(selectedDate).getDay() === 0 || new Date(selectedDate).getDay() === 6 ? 'text-[#D68C7A]' : ''}`}>{new Date(selectedDate).getDate()}</span>
              <span className="text-[14px] leading-none text-[#8E8E93] font-medium">日</span>
              {isTodaySelected && <span className="text-[10px] text-[#D68C7A] font-num bg-[#D68C7A]/10 px-2.5 py-1 rounded-md uppercase tracking-[0.2em] font-bold ml-1 transform -translate-y-1">Today</span>}
              {holidays[selectedDate] && <span className="text-[10px] text-white bg-[#D68C7A] px-2.5 py-1 rounded-md tracking-widest font-bold ml-1 shadow-[0_2px_6px_rgba(214,140,122,0.25)] transform -translate-y-1">{holidays[selectedDate]}</span>}
            </h3>
          </div>

          <div key={animKey} className="animate-in fade-in slide-in-from-bottom-4 duration-400 ease-out pb-4">
            {dayEvents.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-md rounded-[24px] p-12 text-center flex flex-col items-center justify-center border border-[#EAEAEA]/80 mt-2 shadow-sm">
                <Leaf size={32} strokeWidth={1.5} className="text-[#D1CFC7] mb-4" />
                <p className="text-[#8E8E93] text-[13px] tracking-widest font-bold m-0 uppercase font-serif-jp">這天是一張白紙</p>
              </div>
            ) : (
              <div className="relative">
                {/* 時序引導線 */}
                <div className="absolute left-[20px] top-6 bottom-4 z-0"
                  style={{ width: '1px', borderLeft: '1px dashed #E3DFD5' }} />
                
                <div className="space-y-3 relative mt-2">
                  {dayEvents.map((e) => {
                    const TypeIcon = TYPE_CONFIG[e.type]?.icon || Activity;
                    return (
                      <div key={e.id} className={`relative pl-[46px] pr-1 group cursor-pointer tap-highlight-transparent active:scale-[0.99] transition-all ${e.is_done ? 'opacity-55 grayscale-[0.2]' : ''}`} onClick={() => setEditingEvent(e)}>

                        {/* Timeline Node — 可點擊打勾 */}
                        <button
                          onClick={(ev) => handleToggleDone(ev, e)}
                          className={`absolute left-[8px] top-[14px] w-[26px] h-[26px] rounded-[8px] border flex items-center justify-center z-10 transition-all active:scale-90
                            ${e.is_done ? 'bg-[#233142] border-[#233142]' : 'bg-white border-[#DDDBD5]'}`}
                          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          {e.is_done
                            ? <Check size={13} strokeWidth={3} className="text-white" />
                            : e.type === 'mood'
                              ? <span style={{ fontSize: 12, lineHeight: 1 }}>{e.mood}</span>
                              : <TypeIcon size={12} strokeWidth={2.5} style={{ color: TYPE_CONFIG[e.type]?.color }} />
                          }
                        </button>

                        <div className="bg-white px-4 py-3 rounded-[18px] border border-[#EAEAEA] shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold tracking-[0.18em] uppercase"
                              style={{ color: e.is_done ? '#A0A0A0' : TYPE_CONFIG[e.type]?.color }}>
                              {TYPE_CONFIG[e.type]?.label}
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); triggerVibration(8); setNotifyEvent(e); }}
                              className="w-8 h-8 -mr-1 -my-1 rounded-full bg-transparent flex items-center justify-center text-[#B8B2AA] hover:text-[#D68C7A] active:bg-[#F9F8F6] active:scale-95 transition-all shrink-0"
                              aria-label="發送 LINE 提醒"
                            >
                              <Bell size={16} strokeWidth={2.5} />
                            </button>
                          </div>

                          <p className={`text-[15px] font-bold leading-snug break-words ${e.is_done ? 'text-[#A0A0A0] line-through' : 'text-[#233142]'}`}
                            style={{ fontFamily: 'Noto Sans TC, PingFang TC, sans-serif', letterSpacing: '0.01em' }}>
                            {e.type === 'mood' ? e.text : e.text}
                          </p>

                          <div className="flex items-center gap-1.5">
                            <div className="w-[5px] h-[5px] rounded-[2px]"
                              style={{ background: e.is_done ? '#D1CFC7' : '#D68C7A' }} />
                            <span className="text-[11px] text-[#8E8E93]"
                              style={{ letterSpacing: '0.04em' }}>{e.member}</span>
                          </div>
                          {notifyEvent?.id === e.id && <NotifyActionPanel event={e} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==============================================================
  // 2. 本週手帳 (WeeklyPlannerView) — 全週攤開版
  // ==============================================================
  const WeeklyPlannerView = () => {
    const DAY_LABELS_TW = ['日', '一', '二', '三', '四', '五', '六'];

    const weekDays = useMemo(() => {
      const days = [];
      const curr = new Date(selectedDate);
      const dayIndex = curr.getDay() === 0 ? 6 : curr.getDay() - 1;
      const first = curr.getDate() - dayIndex;
      for (let i = 0; i < 7; i++) {
        const d = new Date(curr.getFullYear(), curr.getMonth(), first + i);
        const dateStr = fmtDate(d);
        days.push({
          dateStr,
          dayLabel: DAY_LABELS_TW[d.getDay()],
          dateNum: d.getDate(),
          monthNum: d.getMonth() + 1,
          isToday: dateStr === fmtDate(TODAY),
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          holiday: holidays[dateStr] || null,
          events: events.filter(e => e.date === dateStr).sort((a,b) => {
            if(a.is_done !== b.is_done) return a.is_done ? 1 : -1;
            return (PRIORITY[a.type] || 99) - (PRIORITY[b.type] || 99);
          })
        });
      }
      return days;
    }, [selectedDate, events, holidays]);

    const weekLabel = (() => {
      if (!weekDays.length) return '';
      const s = new Date(weekDays[0].dateStr);
      const e = new Date(weekDays[6].dateStr);
      if (s.getMonth() === e.getMonth()) return `${s.getMonth()+1}月 ${s.getDate()}日 — ${e.getDate()}日`;
      return `${s.getMonth()+1}月${s.getDate()}日 — ${e.getMonth()+1}月${e.getDate()}日`;
    })();

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        {/* 週標題 */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#EAEAEA]">
          <div>
            <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-[0.25em] font-num mb-0.5">Weekly Planner</p>
            <h2 className="text-[18px] font-serif-jp font-bold text-[#233142] tracking-wide">{weekLabel}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedDate(shiftDays(selectedDate, -7))}
              className="w-8 h-8 rounded-full bg-white border border-[#EAEAEA] flex items-center justify-center shadow-sm active:scale-90 transition-all">
              <ChevronLeft size={16} strokeWidth={2.5} className="text-[#8E8E93]" />
            </button>
            <button onClick={() => setSelectedDate(fmtDate(TODAY))}
              className="px-3 h-8 rounded-full bg-white border border-[#EAEAEA] text-[11px] font-bold text-[#8E8E93] shadow-sm active:scale-90 transition-all tracking-wider">
              今週
            </button>
            <button onClick={() => setSelectedDate(shiftDays(selectedDate, 7))}
              className="w-8 h-8 rounded-full bg-white border border-[#EAEAEA] flex items-center justify-center shadow-sm active:scale-90 transition-all">
              <ChevronRight size={16} strokeWidth={2.5} className="text-[#8E8E93]" />
            </button>
          </div>
        </div>

        {/* 全週攤開 */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden px-5 pb-28 pt-4 ${hideScrollbar}`}>
          <div className="space-y-6">
            {weekDays.map((day) => {
              const isRed = day.isWeekend || !!day.holiday;
              return (
                <div key={day.dateStr}>
                  {/* 每日標題列 */}
                  <div className="flex items-baseline gap-2 mb-3 pb-2 border-b border-dashed border-[#E3DFD5]">
                    <span className={`text-[36px] font-editorial italic leading-none ${isRed || day.isToday ? 'text-[#D68C7A]' : 'text-[#233142]'}`}>
                      {day.dateNum}
                    </span>
                    <span className="text-[13px] font-serif-jp font-bold text-[#8E8E93]">週{day.dayLabel}</span>
                    {day.isToday && (
                      <span className="text-[9px] bg-[#D68C7A] text-white px-2 py-0.5 rounded-md tracking-[0.2em] uppercase font-num font-bold shadow-sm -translate-y-0.5">Today</span>
                    )}
                    {day.holiday && (
                      <span className="text-[9px] text-white bg-[#D68C7A] px-2 py-0.5 rounded-md tracking-widest font-bold shadow-sm -translate-y-0.5">{day.holiday}</span>
                    )}
                    <span className="ml-auto text-[11px] font-num text-[#C4C4C4]">{day.monthNum}/{day.dateNum}</span>
                  </div>

                  {/* 事件 */}
                  {day.events.length === 0 ? (
                    <div className="flex items-center gap-2 py-2 pl-1">
                      <Leaf size={14} strokeWidth={1.5} className="text-[#D1CFC7]" />
                      <p className="text-[#C4C4C4] text-[12px] font-medium tracking-widest italic font-serif-jp">這天是一張白紙...</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[19px] top-2 bottom-2 z-0"
                        style={{ width: '1px', borderLeft: '1.5px dashed #E3DFD5' }} />
                      <div className="space-y-3 relative">
                        {day.events.map((e) => {
                          const TypeIcon = TYPE_CONFIG[e.type]?.icon || Activity;
                          return (
                            <div key={e.id}
                              className={`relative pl-[46px] pr-1 group cursor-pointer tap-highlight-transparent active:scale-[0.99] transition-all ${e.is_done ? 'opacity-55 grayscale-[0.2]' : ''}`}
                              onClick={() => setEditingEvent(e)}>
                              <button
                                onClick={(ev) => handleToggleDone(ev, e)}
                                className={`absolute left-[7px] top-[12px] w-[26px] h-[26px] rounded-[8px] border flex items-center justify-center z-10 transition-all active:scale-90
                                  ${e.is_done ? 'bg-[#233142] border-[#233142]' : 'bg-white border-[#DDDBD5]'}`}
                                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                {e.is_done
                                  ? <Check size={12} strokeWidth={3} className="text-white" />
                                  : e.type === 'mood'
                                    ? <span style={{ fontSize: 11, lineHeight: 1 }}>{e.mood}</span>
                                    : <TypeIcon size={11} strokeWidth={2.5} style={{ color: TYPE_CONFIG[e.type]?.color }} />
                                }
                              </button>
                              <div className="bg-white px-4 py-3 rounded-[18px] border border-[#EAEAEA] shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase"
                                    style={{ color: e.is_done ? '#A0A0A0' : TYPE_CONFIG[e.type]?.color }}>
                                    {TYPE_CONFIG[e.type]?.label}
                                  </span>
                                  <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); triggerVibration(8); setNotifyEvent(e); }}
                              className="w-8 h-8 -mr-1 -my-1 rounded-full bg-transparent flex items-center justify-center text-[#B8B2AA] hover:text-[#D68C7A] active:bg-[#F9F8F6] active:scale-95 transition-all shrink-0"
                              aria-label="發送 LINE 提醒"
                            >
                              <Bell size={16} strokeWidth={2.5} />
                            </button>
                                </div>
                                <p className={`text-[15px] font-bold leading-snug break-words ${e.is_done ? 'text-[#A0A0A0] line-through' : 'text-[#233142]'}`}
                                  style={{ fontFamily: 'Noto Sans TC, PingFang TC, sans-serif', letterSpacing: '0.01em' }}>
                                  {e.text}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-[5px] h-[5px] rounded-[2px]"
                                    style={{ background: e.is_done ? '#D1CFC7' : '#D68C7A' }} />
                                  <span className="text-[11px] text-[#8E8E93]" style={{ letterSpacing: '0.04em' }}>{e.member}</span>
                                </div>
                                {notifyEvent?.id === e.id && <NotifyActionPanel event={e} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ==============================================================
  // 3. 週期事務 (RoutinesView)
  // ==============================================================
  const calculateRoutineStatus = (routine) => {
    const lastLog = routine.logs && routine.logs.length > 0 ? routine.logs[0].date : routine.created_at;
    const lastDate = new Date(lastLog);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + routine.interval_days);
    
    const today = new Date(TODAY);
    const nextDateOnly = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = nextDateOnly.getTime() - todayOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const totalTime = nextDate.getTime() - lastDate.getTime();
    const passedTime = today.getTime() - lastDate.getTime();
    let progress = Math.max(0, Math.min(100, (passedTime / totalTime) * 100));

    return { daysLeft: diffDays, progress, lastDate: fmtDate(lastDate), nextDate: fmtDate(nextDate) };
  };

  const RoutineCard = ({ r, setRoutines, showToast, handleDeleteRoutine }) => {
    const status = calculateRoutineStatus(r);
    const isUrgent = status.daysLeft <= 3;
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    
    const [isAddingLog, setIsAddingLog] = useState(false);
    const [logDate, setLogDate] = useState(fmtDate(TODAY));
    const [logNote, setLogNote] = useState('');
    
    const [editingLogId, setEditingLogId] = useState(null);
    const [editDate, setEditDate] = useState('');
    const [editNote, setEditNote] = useState('');

    const handleLogRoutine = async (noteToSave, dateToSave) => {
      triggerVibration(10);
      const finalNote = noteToSave.trim() || '';
      const finalDate = cleanDateOnly(dateToSave);
      const { data, error } = await supabase.from('routine_logs').insert([{
          routine_name: r.name, member: r.member || null, interval_days: r.interval_days || null, last_done_at: finalDate, note: finalNote
      }]).select();

      if (!error && data) {
          setRoutines(prev => prev.map(rt => {
              if (rt.id === r.id) {
                  const newLogs = [{ id: data[0].id, date: finalDate, note: finalNote }, ...rt.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
                  return { ...rt, logs: newLogs };
              }
              return rt;
          }));
          setIsAddingLog(false); setLogNote(''); setLogDate(fmtDate(TODAY));
          showToast(`✅ 紀錄已儲存`);
      } else { showToast('❌ 紀錄失敗'); console.error('log error:', error); }
    };

    const handleUpdateLog = async () => {
      triggerVibration(10);
      const finalNote = editNote.trim() || '';
      const finalDate = cleanDateOnly(editDate);
      const { error } = await supabase.from('routine_logs').update({ last_done_at: finalDate, note: finalNote }).eq('id', editingLogId);
      if (!error) {
        setRoutines(prev => prev.map(rt => {
            if (rt.id === r.id) {
                const newLogs = rt.logs.map(l => l.id === editingLogId ? { ...l, date: finalDate, note: finalNote } : l).sort((a, b) => new Date(b.date) - new Date(a.date));
                return { ...rt, logs: newLogs };
            }
            return rt;
        }));
        setEditingLogId(null); showToast('✅ 紀錄已更新');
      }
    };

    const handleDeleteLog = async (logId) => {
      if (window.confirm('確定要刪除這筆紀錄嗎？')) {
        const { error } = await supabase.from('routine_logs').delete().eq('id', logId);
        if (!error) {
          setRoutines(prev => prev.map(rt => {
              if (rt.id === r.id) return { ...rt, logs: rt.logs.filter(l => l.id !== logId) };
              return rt;
          }));
          showToast('🗑️ 紀錄已刪除');
        }
      }
    };

    return (
      <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[#EAEAEA] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col transition-all">
        <div className="flex justify-between items-start mb-6">
          <div>
              <h3 className="text-[18px] font-bold text-[#233142] tracking-wide leading-tight mb-2.5">{r.name}</h3>
              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest bg-[#F9F8F6] border border-[#EAEAEA] px-2 py-1 rounded-md inline-block shadow-sm">間隔 {r.interval_days} 天</p>
          </div>
          <div className="flex flex-col items-end gap-2">
              <div className={`px-2.5 py-1.5 rounded-[8px] text-[10px] font-bold tracking-widest uppercase border shadow-[0_2px_4px_rgba(0,0,0,0.02)] ${status.daysLeft <= 0 ? 'bg-[#D68C7A]/10 text-[#D68C7A] border-[#D68C7A]/20' : isUrgent ? 'bg-[#C49553]/10 text-[#C49553] border-[#C49553]/20' : 'bg-white text-[#233142] border-[#EAEAEA]'}`}>
              {status.daysLeft < 0 ? `逾期 ${Math.abs(status.daysLeft)} 天` : status.daysLeft === 0 ? '今天到期' : `剩餘 ${status.daysLeft} 天`}
              </div>
              <button onClick={() => handleDeleteRoutine(r.id)} className="text-[#D1CFC7] hover:text-[#D68C7A] transition-colors p-1"><Trash2 size={14} strokeWidth={2.5}/></button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-[10px] font-bold text-[#A0A0A0] mb-2.5 uppercase tracking-widest font-num">
            <span>上次 {fmtDateChinese(status.lastDate)}</span>
            <span>下次 {fmtDateChinese(status.nextDate)}</span>
          </div>
          <div className="w-full bg-[#F9F8F6] h-[8px] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] border border-[#EAEAEA]">
              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${status.daysLeft <= 0 ? 'bg-[#D68C7A]' : isUrgent ? 'bg-[#C49553]' : 'bg-[#233142]'}`} style={{ width: `${status.progress}%` }}></div>
          </div>
        </div>

        <div className="mt-auto">
            <button onClick={() => handleLogRoutine('', fmtDate(TODAY))} className="w-full py-3.5 bg-[#233142] text-white text-[13px] font-bold tracking-[0.2em] rounded-[16px] flex justify-center items-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_16px_rgba(35,49,66,0.2)]">
                <Check size={16} strokeWidth={3}/> 完成今日
            </button>
        </div>

        <div className="mt-5 border-t border-[#EAEAEA] border-dashed pt-4">
            <button onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="flex items-center gap-2 w-full text-left focus:outline-none group">
                <div className={`p-1.5 rounded-lg transition-colors ${isHistoryExpanded ? 'bg-[#EAEAEA] text-[#233142]' : 'bg-[#F9F8F6] text-[#A0A0A0] group-hover:bg-[#EAEAEA] group-hover:text-[#8E8E93]'}`}>
                  <History size={14} strokeWidth={2.5}/>
                </div>
                <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest flex-1">歷史紀錄 ({r.logs.length})</span>
                <ChevronDown size={14} className={`text-[#A0A0A0] transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`}/>
            </button>

            {isHistoryExpanded && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {r.logs.length === 0 ? (
                  <div className="text-[11px] text-[#A0A0A0] italic font-medium font-serif-jp pl-2">尚無紀錄</div>
                ) : (
                  r.logs.map(log => (
                    <div key={log.id} className="bg-[#F9F8F6] border border-[#EAEAEA] p-3.5 rounded-[16px] shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
                      {editingLogId === log.id ? (
                        <div className="flex flex-col gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-[#8E8E93] mb-1 uppercase tracking-widest">日期</label>
                            <DateTimePicker date={editDate} setDate={setEditDate} time="" setTime={() => {}} showTime={false} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#8E8E93] mb-1 uppercase tracking-widest">備註</label>
                            <input value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="備註..."
                              className="w-full bg-white border border-[#EAEAEA] text-[13px] p-2.5 rounded-xl text-[#233142] outline-none focus:border-[#233142]"
                              style={{ boxSizing: 'border-box' }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingLogId(null)} className="flex-1 text-[11px] font-bold text-[#8E8E93] px-3 py-2 bg-[#EAEAEA]/50 rounded-xl hover:bg-[#EAEAEA] transition-colors tracking-widest">取消</button>
                            <button onClick={handleUpdateLog} className="flex-[2] text-[11px] font-bold text-white px-3 py-2 bg-[#233142] rounded-xl shadow-sm tracking-widest active:scale-[0.98]">儲存</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col gap-1.5 flex-1 pl-1">
                            <span className="text-[11px] font-num font-bold text-[#D68C7A] tracking-widest">{fmtDateChinese(log.date)}</span>
                            <span className="text-[14px] font-medium text-[#233142] break-words leading-snug">{log.note || <span className="text-[#D1CFC7] italic font-serif-jp text-[13px]">無備註</span>}</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => { setEditingLogId(log.id); setEditDate(log.date); setEditNote(log.note||''); }} className="w-8 h-8 flex items-center justify-center text-[#A0A0A0] hover:text-[#233142] bg-white border border-[#EAEAEA] shadow-sm rounded-[10px] transition-colors active:scale-95"><Edit2 size={12} strokeWidth={2.5}/></button>
                            <button onClick={() => handleDeleteLog(log.id)} className="w-8 h-8 flex items-center justify-center text-[#A0A0A0] hover:text-[#D68C7A] bg-white border border-[#EAEAEA] shadow-sm rounded-[10px] transition-colors active:scale-95"><Trash2 size={12} strokeWidth={2.5}/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {!isAddingLog ? (
                  <button onClick={() => setIsAddingLog(true)} className="w-full py-3 mt-3 border border-dashed border-[#A0A0A0] text-[#8E8E93] rounded-[16px] text-[12px] font-bold tracking-widest hover:bg-[#F9F8F6] transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"><Plus size={14}/> 補登歷史紀錄</button>
                ) : (
                  <div className="bg-white border border-[#EAEAEA] p-4 rounded-[16px] flex flex-col gap-3 mt-3 shadow-md animate-in zoom-in-95 duration-200">
                    <div>
                      <label className="block text-[10px] font-bold text-[#8E8E93] mb-1.5 uppercase tracking-widest">日期</label>
                      <DateTimePicker date={logDate} setDate={setLogDate} time="" setTime={() => {}} showTime={false} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#8E8E93] mb-1.5 uppercase tracking-widest">備註（選填）</label>
                      <input value={logNote} onChange={e => setLogNote(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') handleLogRoutine(logNote, logDate); }}
                        placeholder="輸入備註..."
                        className="w-full bg-[#F9F8F6] border border-[#EAEAEA] text-[14px] p-3 rounded-[12px] text-[#233142] outline-none focus:border-[#233142]"
                        style={{ boxSizing: 'border-box' }} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setIsAddingLog(false); setLogNote(''); setLogDate(fmtDate(TODAY)); }}
                        className="flex-1 text-[12px] font-bold text-[#8E8E93] py-2.5 bg-[#F9F8F6] rounded-[12px] hover:bg-[#EAEAEA] transition-colors tracking-widest">取消</button>
                      <button onClick={() => handleLogRoutine(logNote, logDate)}
                        className="flex-[2] text-[12px] font-bold text-white py-2.5 bg-[#233142] rounded-[12px] shadow-sm tracking-widest active:scale-[0.98]">加入紀錄</button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    );
  };

  const RoutinesView = () => {
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newInterval, setNewInterval] = useState(30);
    const [newLastDate, setNewLastDate] = useState(fmtDate(TODAY)); 

    const handleAddRoutine = async () => {
      if (!newName.trim() || Number(newInterval) < 1) return;
      const routinePayload = {
        name: newName.trim(),
        interval_days: Number(newInterval),
        member: null,
        category: 'routine',
        active: true,
      };

      const { data, error } = await supabase.from('routines').insert([routinePayload]).select();

      if (!error && data?.length) {
        const createdRoutine = { ...data[0], logs: [] };

        if (newLastDate) {
          const finalDate = cleanDateOnly(newLastDate);
          const { data: logData, error: logError } = await supabase.from('routine_logs').insert([{
            routine_name: createdRoutine.name,
            member: createdRoutine.member || null,
            interval_days: createdRoutine.interval_days,
            last_done_at: finalDate,
            note: '初始設定',
          }]).select();

          if (!logError && logData?.length) {
            createdRoutine.logs = [{ id: logData[0].id, date: finalDate, note: '初始設定' }];
          } else if (logError) {
            console.error('initial routine log error:', logError);
          }
        }

        setRoutines(prev => [...prev, createdRoutine]);
        setIsAdding(false);
        setNewName('');
        setNewInterval(30);
        setNewLastDate(fmtDate(TODAY));
        showToast('✅ 週期卡片已建立');
      } else {
        console.error('routine insert error:', error);
        showToast(`❌ 建立失敗：${error?.message || '請稍後再試'}`);
      }
    };

    const handleDeleteRoutine = async (id) => {
      if (window.confirm('確定要刪除這個週期卡片嗎？')) {
        const { error } = await supabase.from('routines').delete().eq('id', id);
        if (!error) { setRoutines(prev => prev.filter(r => r.id !== id)); showToast('🗑️ 卡片已刪除'); }
      }
    };

    return (
      <div className="px-5 pb-32 pt-6 animate-in fade-in duration-400 relative min-h-full">
        <div className="flex items-end justify-between mb-8 pb-4 border-b border-[#EAEAEA]">
          <div>
            <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-[0.25em] font-num mb-0.5">Routine Tracker</p>
            <h2 className="text-[34px] font-editorial italic font-bold text-[#233142] leading-none">Routine<br/><span className="text-[28px] font-serif-jp normal-case tracking-widest">Tracker</span></h2>
          </div>
        </div>

        <div className="space-y-6">
          {routines.length === 0 && !isAdding ? (
            <div className="bg-white/60 backdrop-blur-md rounded-[24px] p-12 text-center flex flex-col items-center justify-center border border-[#EAEAEA]/80 mt-4 shadow-sm">
              <RotateCw size={32} strokeWidth={1.5} className="text-[#D1CFC7] mb-4" />
              <p className="text-[#8E8E93] text-[13px] tracking-widest font-bold m-0 uppercase font-serif-jp">目前沒有週期事務</p>
            </div>
          ) : (
            routines.map(r => (
               <RoutineCard key={r.id} r={r} setRoutines={setRoutines} showToast={showToast} handleDeleteRoutine={handleDeleteRoutine} />
            ))
          )}
        </div>

        {!isAdding ? (
          <button onClick={() => setIsAdding(true)} className="w-full mt-8 py-4 bg-white border border-dashed border-[#A0A0A0] text-[#8E8E93] rounded-[24px] flex items-center justify-center gap-2 font-bold text-[14px] hover:bg-[#F9F8F6] transition-colors tracking-widest active:scale-[0.98] shadow-sm"><Plus size={18} strokeWidth={2.5} /> 建立新卡片</button>
        ) : (
          <div className="mt-8 bg-white p-6 rounded-[24px] border border-[#EAEAEA] space-y-5 animate-in fade-in zoom-in-95 duration-300 shadow-[0_12px_40px_rgba(35,49,66,0.06)]">
            <div>
              <label className="block text-[11px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">任務名稱</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：定期保養車子" className={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">上次完成日</label>
              <DateTimePicker date={newLastDate} setDate={setNewLastDate} time="" setTime={() => {}} showTime={false} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">間隔天數</label>
              <div className="flex items-center gap-3">
                <input type="number" value={newInterval} onChange={e => setNewInterval(Number(e.target.value))} min="1"
                  className="w-28 bg-[#F9F8F6] border border-[#EAEAEA] focus:bg-white focus:border-[#233142] rounded-[16px] px-4 py-3.5 text-[15px] font-medium text-[#233142] outline-none"
                  style={{ boxSizing: 'border-box' }} />
                <span className="text-[14px] font-bold text-[#8E8E93]">天</span>
              </div>
            </div>
            <div className="flex gap-3 pt-3">
              <button onClick={() => { setIsAdding(false); setNewName(''); setNewInterval(30); setNewLastDate(fmtDate(TODAY)); }} className="flex-[1] py-3.5 bg-[#F9F8F6] text-[#8E8E93] rounded-[16px] flex items-center justify-center text-[13px] font-bold active:scale-[0.98] transition-all tracking-widest hover:bg-[#EAEAEA]">取消</button>
              <button onClick={handleAddRoutine} disabled={!newName.trim() || newInterval < 1} className="flex-[2] py-3.5 bg-[#233142] disabled:bg-[#D1CFC7] disabled:text-[#F9F8F6] text-white rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[0.98] transition-transform tracking-widest shadow-[0_4px_12px_rgba(35,49,66,0.2)]"><Check size={16} strokeWidth={3} /> 確認建立</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==============================================================
  // 彈出視窗組件 (Modals)
  // ==============================================================
  const EventEditModal = () => {
    const [text, setText] = useState('');
    const [type, setType] = useState('todo');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [member, setMember] = useState('全家');
    const [mood, setMood] = useState('😊');
    const [scheduleNotifyEnabled, setScheduleNotifyEnabled] = useState(false);
    const [scheduleNotifyMode, setScheduleNotifyMode] = useState('private');

    useEffect(() => {
      if (editingEvent) {
        let initText = editingEvent.text || editingEvent.title || '';
        let initTime = '';
        if (editingEvent.type === 'schedule') {
          const match = initText.match(/^(\d{2}:\d{2})\s+(.*)/);
          if (match) { initTime = match[1]; initText = match[2]; }
        } else if (editingEvent.type === 'remind') {
          const match = initText.match(/(.*?)\s+\((\d{2}:\d{2})\s+截止\)$/);
          if (match) { initText = match[1]; initTime = match[2]; }
        }
        setText(initText); setType(editingEvent.type || 'todo'); setDate(editingEvent.date);
        setTime(initTime); setMember(editingEvent.member || '全家'); setMood(editingEvent.mood || '😊');

        loadScheduledNotificationForEvent(editingEvent.id).then(schedule => {
          if (schedule) {
            setScheduleNotifyEnabled(true);
            setScheduleNotifyMode(schedule.target_mode || 'private');
          } else {
            setScheduleNotifyEnabled(false);
            setScheduleNotifyMode('private');
          }
        });
      }
    }, [editingEvent]);

    if (!editingEvent) return null;

    const handleSave = async () => {
      if (!text.trim() && type !== 'mood') return;
      const updateRow = {
        ...editingEvent,
        type,
        text: text.trim(),
        date,
        time,
        member,
        mood: type === 'mood' ? mood : null,
      };

      await handleUpdateEvent(updateRow);

      try {
        await saveScheduledNotification({
          eventId: editingEvent.id,
          date,
          time,
          enabled: scheduleNotifyEnabled && (type === 'schedule' || type === 'remind') && Boolean(time),
          targetMode: scheduleNotifyMode,
        });
        if (scheduleNotifyEnabled && time && (type === 'schedule' || type === 'remind')) {
          showToast(`✅ 已設定 ${getNotificationModeLabel(scheduleNotifyMode)}預約提醒`);
        }
      } catch (err) {
        console.error('schedule notification error:', err);
        showToast(`⚠️ 記事已更新，但預約提醒設定失敗：${err?.message || '請稍後再試'}`);
      }
    };

    const isOtherDate = date !== shiftDays(TODAY,0) && date !== shiftDays(TODAY,1) && date !== shiftDays(TODAY,2);

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A2532]/40 backdrop-blur-sm" onClick={() => setEditingEvent(null)}>
        <div
          className="bg-[#F9F8F6] w-full max-w-[480px] rounded-t-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col spring-modal overflow-hidden"
          style={{ maxHeight: 'calc(92dvh - env(safe-area-inset-bottom, 0px))' }}
          onClick={e => e.stopPropagation()}
        >
          <DragHeader className="px-5 pb-2 border-b border-[#EAEAEA] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#233142] flex items-center justify-center shadow-md"><PenLine size={18} className="text-white" strokeWidth={2} /></div>
                <span className="text-[20px] font-serif-jp font-bold text-[#233142] tracking-widest">編輯記事</span>
              </div>
              <button onClick={() => setEditingEvent(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] bg-[#EAEAEA]/80 active:scale-90 transition-all"><X size={18} strokeWidth={2.5}/></button>
            </div>
          </DragHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scroll px-5 pt-5" style={{ paddingBottom: '8px' }}>
            <div className="space-y-5">
              {/* 分類 */}
              <div>
                <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">變更分類</label>
                <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                  {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'routine').map(([k, v]) => {
                    const Icon = v.icon; const isSelected = type === k;
                    return (
                      <button key={k} onClick={() => { setType(k); if(k!=='schedule'&&k!=='remind') setTime(''); }}
                        className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-[12px] font-bold transition-all border ${isSelected ? 'bg-[#233142] text-white border-[#233142] shadow-md' : 'bg-white text-[#8E8E93] border-[#EAEAEA] shadow-sm'}`}>
                        <Icon size={14} strokeWidth={isSelected ? 2.5 : 2} /> {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 內容 */}
              <div>
                <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">事項內容</label>
                <input value={text} onChange={(e) => setText(e.target.value)} className={inputStyle} />
              </div>

              {type === 'mood' ? (
                <div>
                  <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">當下心情</label>
                  <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                    {moodOptions.map(m => (
                      <button key={m} onClick={() => setMood(m)}
                        className={`snap-start shrink-0 w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[22px] transition-all border ${mood === m ? 'bg-white border-[#D68C7A] scale-105 shadow-[0_4px_12px_rgba(214,140,122,0.15)]' : 'bg-[#EAEAEA]/40 border-transparent grayscale opacity-50'}`}>{m}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">日期{(type==='schedule'||type==='remind') ? ' & 時間' : ''}</label>
                    <DateTimePicker date={date} setDate={setDate} time={time} setTime={setTime} showTime={type==='schedule'||type==='remind'} />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">關聯成員</label>
                    <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                      {['全家', ...members.map(m => m.name)].map(m => (
                        <button key={m} onClick={() => setMember(m)}
                          className={`snap-start shrink-0 whitespace-nowrap px-4 py-2.5 text-[13px] font-bold rounded-[12px] transition-all border ${member === m ? 'bg-[#233142] text-white border-[#233142] shadow-md' : 'bg-white text-[#8E8E93] border-[#EAEAEA] shadow-sm'}`}>{m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-5 pt-3 bg-[#F9F8F6] border-t border-[#EAEAEA]" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteEvent(editingEvent.id)} className="w-[52px] h-[52px] bg-white text-[#C85A5A] rounded-[14px] font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm border border-[#EAEAEA]"><Trash2 size={18} strokeWidth={2} /></button>
              <button onClick={handleSave} disabled={!text.trim() && type !== 'mood'} className="flex-1 h-[52px] bg-[#233142] disabled:bg-[#D1CFC7] text-white rounded-[14px] text-[15px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center tracking-widest shadow-[0_4px_16px_rgba(35,49,66,0.2)]">儲存變更</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AiModal = () => {
    const [text, setText] = useState('');
    const [type, setType] = useState('schedule');
    const [date, setDate] = useState(fmtDate(TODAY));
    const [time, setTime] = useState('');
    const [member, setMember] = useState('全家');
    const [mood, setMood] = useState('😊');
    const [scheduleNotifyEnabled, setScheduleNotifyEnabled] = useState(false);
    const [scheduleNotifyMode, setScheduleNotifyMode] = useState('private');

    if (!isAiModalOpen) return null;

    const handleManualSubmit = async () => {
      if (!text.trim() && type !== 'mood') return;

      const insertRow = buildEventPayload({
        type,
        text,
        member,
        date,
        time,
        mood,
        currentUserLineId,
        members,
        base: { is_done: false, completed: false },
      });

      const { data, error } = await supabase.from('events').insert([insertRow]).select();

      if (!error && data?.length) {
        const createdEvent = normalizeEvent(data[0]);
        setEvents(prev => [...prev, createdEvent].sort((a, b) => {
          if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
          return (PRIORITY[a.type] || 99) - (PRIORITY[b.type] || 99);
        }));
        if (scheduleNotifyEnabled && (type === 'schedule' || type === 'remind') && time) {
          try {
            await saveScheduledNotification({
              eventId: createdEvent.id,
              date: createdEvent.date,
              time,
              enabled: true,
              targetMode: scheduleNotifyMode,
            });
            showToast(`✅ 已存入手札，並設定${getNotificationModeLabel(scheduleNotifyMode)}預約提醒`);
          } catch (scheduleError) {
            console.error('schedule notification error:', scheduleError);
            showToast('✅ 已存入手札，但預約提醒設定失敗');
          }
        } else {
          showToast('✅ 已存入手札');
        }

        setSelectedDate(createdEvent.date);
        setIsAiModalOpen(false);
        setText('');
        setTime('');
        setType('schedule');
        setMember('全家');
        setMood('😊');
        setScheduleNotifyEnabled(false);
        setScheduleNotifyMode('private');
      } else {
        console.error('insert error:', error);
        showToast(`❌ 儲存失敗：${error?.message || '請檢查資料表欄位'}`);
      }
    };

    const isOtherDate = date !== shiftDays(TODAY,0) && date !== shiftDays(TODAY,1) && date !== shiftDays(TODAY,2);

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A2532]/40 backdrop-blur-sm" onClick={() => setIsAiModalOpen(false)}>
        <div
          className="bg-[#F9F8F6] w-full max-w-[480px] rounded-t-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col spring-modal overflow-hidden"
          style={{ maxHeight: 'calc(92dvh - env(safe-area-inset-bottom, 0px))' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <DragHeader className="px-5 pb-2 border-b border-[#EAEAEA] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#233142] flex items-center justify-center shadow-md"><PenLine size={18} className="text-white" strokeWidth={2} /></div>
                <span className="text-[20px] font-serif-jp font-bold text-[#233142] tracking-widest">建立記事</span>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] bg-[#EAEAEA]/80 active:scale-90 transition-all"><X size={18} strokeWidth={2.5}/></button>
            </div>
          </DragHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scroll px-5 pt-5" style={{ paddingBottom: '8px' }}>
            <div className="space-y-5">

              {/* 分類 */}
              <div>
                <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">選擇分類</label>
                <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                  {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'routine').map(([k, v]) => {
                    const Icon = v.icon; const isSelected = type === k;
                    return (
                      <button key={k} onClick={() => { setType(k); setTime(''); }}
                        className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-[12px] font-bold transition-all border ${isSelected ? 'bg-[#233142] text-white border-[#233142] shadow-md' : 'bg-white text-[#8E8E93] border-[#EAEAEA] shadow-sm'}`}>
                        <Icon size={14} strokeWidth={isSelected ? 2.5 : 2} /> {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 內容 */}
              <div>
                <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">{type === 'mood' ? '想說些什麼？(選填)' : '事項內容'}</label>
                <input value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={type === 'mood' ? '今天過得如何...' : '例：去超市買牛奶'}
                  className={inputStyle} />
              </div>

              {type === 'mood' ? (
                <div>
                  <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">當下心情</label>
                  <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                    {moodOptions.map(m => (
                      <button key={m} onClick={() => setMood(m)}
                        className={`snap-start shrink-0 w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[22px] transition-all border ${mood === m ? 'bg-white border-[#D68C7A] scale-105 shadow-[0_4px_12px_rgba(214,140,122,0.15)]' : 'bg-[#EAEAEA]/40 border-transparent grayscale opacity-50'}`}>{m}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 日期 + 時間 */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">日期{(type==='schedule'||type==='remind') ? ' & 時間' : ''}</label>
                    <DateTimePicker date={date} setDate={setDate} time={time} setTime={setTime} showTime={type==='schedule'||type==='remind'} />
                  </div>

                  {/* 關聯成員 */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">關聯成員</label>
                    <div className={`flex gap-2 overflow-x-auto pb-1 snap-x ${hideScrollbar}`}>
                      {['全家', ...members.map(m => m.name)].map(m => (
                        <button key={m} onClick={() => setMember(m)}
                          className={`snap-start shrink-0 whitespace-nowrap px-4 py-2.5 text-[13px] font-bold rounded-[12px] transition-all border ${member === m ? 'bg-[#233142] text-white border-[#233142] shadow-md' : 'bg-white text-[#8E8E93] border-[#EAEAEA] shadow-sm'}`}>{m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer button - always visible */}
          <div className="shrink-0 px-5 pt-3 bg-[#F9F8F6] border-t border-[#EAEAEA]" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <button onClick={handleManualSubmit} disabled={!text.trim() && type !== 'mood'}
              className="w-full h-[52px] bg-[#233142] disabled:bg-[#D1CFC7] disabled:text-[#F9F8F6] text-white rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-transform tracking-widest shadow-[0_4px_16px_rgba(35,49,66,0.2)]">
              <Check size={18} strokeWidth={3} /> 儲存記事
            </button>
          </div>
        </div>
      </div>
    );
  };

  const MemberModal = () => {
    const [nameInput, setNameInput] = useState('');
    const [roleInput, setRoleInput] = useState('');
    const [isAddingRole, setIsAddingRole] = useState(false); 

    if (!isMemberModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A2532]/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMemberModalOpen(false)}>
        <div className="bg-[#F9F8F6] w-full max-w-[480px] max-h-[85vh] rounded-t-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col spring-modal" onClick={e => e.stopPropagation()}>
          <DragHeader className="px-6 pb-2 border-b border-[#EAEAEA] shrink-0">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#566B56] flex items-center justify-center shadow-md"><Users size={20} className="text-white" strokeWidth={2.5} /></div>
                  <span className="text-[22px] font-serif-jp font-bold text-[#233142] tracking-widest">群體角色設定</span>
                </div>
                <button onClick={() => setIsMemberModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] bg-[#EAEAEA]/80 hover:bg-[#D0D0D0]/80 active:scale-90 transition-all"><X size={18} strokeWidth={2.5}/></button>
             </div>
             <p className="text-[12px] font-bold text-[#8E8E93] tracking-widest leading-relaxed mt-2 mb-2 pl-1">建立專屬稱謂，以便自動分派任務。</p>
          </DragHeader>
          
          <div className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] overflow-y-auto flex-1 hide-scroll">
            
            <div className="flex-1">
              {unboundLineUsers.length > 0 && (
                <div className="mb-6 p-4 bg-white border border-[#D68C7A]/30 rounded-[20px] shadow-[0_4px_12px_rgba(214,140,122,0.06)]">
                  <p className="text-[11px] font-bold text-[#D68C7A] mb-3 flex items-center gap-1.5 uppercase tracking-widest">
                    <Wind size={14} strokeWidth={2.5} /> 待安排專屬角色的成員：
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {unboundLineUsers.map(u => (
                      <span key={u.user_id} className="text-[12px] bg-[#F9F8F6] pl-2.5 pr-1.5 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm flex items-center gap-2 font-bold text-[#233142]">
                        {u.picture_url ? (
                          <img src={u.picture_url} className="w-6 h-6 rounded-md border border-[#EAEAEA]" alt="avatar" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-[#D1CFC7] flex items-center justify-center text-[10px] text-white">?</div>
                        )}
                        <span className="truncate max-w-[70px]">{u.display_name}</span>
                        <button onClick={() => handleIgnoreUser(u.user_id, true)} className="text-[#8E8E93] hover:text-[#D68C7A] p-1 rounded-md transition-colors active:bg-[#EAEAEA]"><X size={14} strokeWidth={2.5} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {members.length === 0 ? (
                  <div className="text-center py-8 text-[#D1CFC7] text-[13px] font-bold tracking-widest uppercase border border-dashed border-[#EAEAEA] rounded-[24px]">尚無建立任何角色</div>
                ) : (
                  members.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-4 bg-white rounded-[20px] border border-[#EAEAEA] shadow-[0_2px_8px_rgba(44,42,40,0.02)] transition-colors">
                      <div>
                        <span className="block text-[16px] font-bold text-[#233142] tracking-wide mb-2">{m.name}</span>
                        <span className="text-[10px] font-bold tracking-widest text-[#566B56] bg-[#F4F8F4] px-2 py-1 rounded-md border border-[#EAEAEA] shadow-sm inline-block uppercase">{m.role_name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            if (!currentUserLineId) { alert("授權準備中，請稍後重試。"); return; }
                            if (m.line_user_id === currentUserLineId) {
                              if (window.confirm(`確定要解除您與「${m.name}」的綁定關係嗎？`)) {
                                await supabase.from("members").update({ line_user_id: null }).eq("id", m.id);
                                setMembers(prev => prev.map(mem => mem.id === m.id ? { ...mem, line_user_id: null } : mem));
                                showToast(`🔓 已解除綁定`);
                              }
                              return;
                            }
                            if (m.line_user_id && m.line_user_id !== currentUserLineId) { alert("此角色已被其他家人綁定！"); return; }
                            const myRole = members.find(mem => mem.line_user_id === currentUserLineId);
                            if (myRole && myRole.id !== m.id) { alert(`您已綁定為「${myRole.name}」，無法再綁定其他身分喔！`); return; }
                            await supabase.from("members").update({ line_user_id: currentUserLineId }).eq("id", m.id);
                            setMembers(prev => prev.map(mem => mem.id === m.id ? { ...mem, line_user_id: currentUserLineId } : mem));
                            showToast(`✅ 綁定成功！您現在是：${m.name}`);
                          }}
                          disabled={m.line_user_id && m.line_user_id !== currentUserLineId}
                          className={`text-[12px] px-4 py-2.5 rounded-[12px] font-bold tracking-widest transition-all ${m.line_user_id === currentUserLineId ? 'bg-[#566B56] text-white active:scale-95 shadow-sm' : m.line_user_id ? 'bg-[#EAEAEA] text-[#8E8E93] cursor-not-allowed opacity-70' : 'bg-[#233142] text-white active:scale-95 shadow-sm' }`}
                        >
                          {m.line_user_id === currentUserLineId ? '✅ 我的身分' : m.line_user_id ? '已被綁定' : '綁定我'}
                        </button>
                        <button onClick={() => handleDeleteMember(m.id)} className="text-[12px] bg-white text-[#C85A5A] px-3.5 py-2.5 rounded-[12px] active:scale-95 border border-[#EAEAEA] shadow-sm transition-all flex items-center justify-center hover:bg-[#FDF5F5]"><Trash2 size={16} strokeWidth={2.5} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!isAddingRole ? (
                <button onClick={() => setIsAddingRole(true)} className="w-full py-4 bg-white border border-dashed border-[#A0A0A0] text-[#8E8E93] rounded-[24px] flex items-center justify-center gap-2 font-bold text-[13px] hover:bg-[#F9F8F6] transition-colors mt-6 mb-8 tracking-widest active:scale-[0.98] shadow-sm"><Plus size={18} strokeWidth={2.5} /> 建立新角色</button>
              ) : (
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] space-y-5 mt-6 mb-8 animate-in fade-in zoom-in-95 duration-300 shadow-[0_8px_24px_rgba(44,42,40,0.06)]">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">名字/暱稱</label>
                      <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例：林老杯" className={inputStyle} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">擔任身分</label>
                      <input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} placeholder="例：採買總監" className={inputStyle} />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setIsAddingRole(false); setNameInput(''); setRoleInput(''); }} className="flex-[1] py-3.5 bg-[#F9F8F6] text-[#8E8E93] rounded-[16px] flex items-center justify-center text-[13px] font-bold active:scale-[0.98] transition-transform tracking-widest shadow-sm hover:bg-[#EAEAEA]">取消</button>
                    <button onClick={async () => { const ok = await handleAddMember(nameInput, roleInput); if(ok) { setNameInput(''); setRoleInput(''); setIsAddingRole(false); } }} disabled={!nameInput.trim() || !roleInput.trim()} className="flex-[2] py-3.5 bg-[#233142] disabled:bg-[#D1CFC7] disabled:text-[#F9F8F6] text-white rounded-[16px] flex items-center justify-center gap-2 text-[13px] font-bold active:scale-[0.98] transition-transform tracking-widest shadow-md"><Check size={16} strokeWidth={3} /> 確認建立</button>
                  </div>
                </div>
              )}

              {ignoredLineUsers.length > 0 && (
                <div className="mb-4 pt-6 border-t border-[#EAEAEA] border-dashed">
                  <button onClick={() => setIsHideListOpen(!isHideListOpen)} className="w-full flex items-center justify-between text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest py-2 hover:text-[#233142] focus:outline-none">
                    <span>🙈 已隱藏的成員 ({ignoredLineUsers.length})</span>
                    <ChevronDown size={14} className={`transform transition-transform duration-300 ${isHideListOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isHideListOpen && (
                    <div className="flex flex-wrap gap-2.5 mt-3 p-4 bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm">
                      {ignoredLineUsers.map(u => (
                        <span key={u.user_id} className="text-[12px] bg-[#F9F8F6] pl-3 pr-2 py-1.5 rounded-xl border border-[#EAEAEA] flex items-center gap-2 text-[#8E8E93] font-bold">
                          {u.display_name}
                          <button onClick={() => handleIgnoreUser(u.user_id, false)} className="text-[#566B56] hover:text-[#233142] bg-[#EAEAEA] hover:bg-[#D0D0D0] p-1.5 rounded-lg transition-colors"><RotateCw size={12} strokeWidth={2.5} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };


  const ReportSettingsModal = () => {
    const [enabled, setEnabled] = useState(Boolean(reportSettings?.enabled));
    const [sendTime, setSendTime] = useState(reportSettings?.send_time ? String(reportSettings.send_time).slice(0, 5) : '08:00');
    const [targetMode, setTargetMode] = useState(reportSettings?.target_mode || 'private');

    useEffect(() => {
      if (isReportSettingsOpen) {
        setEnabled(Boolean(reportSettings?.enabled));
        setSendTime(reportSettings?.send_time ? String(reportSettings.send_time).slice(0, 5) : '08:00');
        setTargetMode(reportSettings?.target_mode || 'private');
      }
    }, [isReportSettingsOpen, reportSettings]);

    if (!isReportSettingsOpen) return null;

    const modeOptions = [
      { key: 'private', label: '私訊', desc: '每位成員收到自己的清單' },
      { key: 'group', label: '群組', desc: '發送一份群組總覽' },
      { key: 'both', label: '全部', desc: '群組總覽 + 個人私訊' },
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A2532]/40 backdrop-blur-sm" onClick={() => setIsReportSettingsOpen(false)}>
        <div
          className="bg-[#F9F8F6] w-full max-w-[480px] rounded-t-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col spring-modal overflow-hidden"
          style={{ maxHeight: 'calc(88dvh - env(safe-area-inset-bottom, 0px))' }}
          onClick={e => e.stopPropagation()}
        >
          <DragHeader className="px-5 pb-2 border-b border-[#EAEAEA] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#566B56] flex items-center justify-center shadow-md shrink-0">
                  <Clock size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[20px] font-serif-jp font-bold text-[#233142] tracking-widest truncate">晨間報表</p>
                  <p className="text-[10px] font-num font-bold text-[#8E8E93] tracking-[0.22em] uppercase mt-0.5">Morning Brief</p>
                </div>
              </div>
              <button onClick={() => setIsReportSettingsOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] bg-[#EAEAEA]/80 active:scale-90 transition-all shrink-0">
                <X size={18} strokeWidth={2.5}/>
              </button>
            </div>
          </DragHeader>

          <div className="px-5 py-5 space-y-5 overflow-y-auto hide-scroll">
            <div className="bg-white border border-[#EAEAEA] rounded-[22px] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#233142] tracking-wide">啟用晨間報表</p>
                  <p className="text-[11px] text-[#8E8E93] mt-1 leading-relaxed">到設定時間時，整理今日與逾期未完成事項。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`shrink-0 w-[48px] h-[28px] rounded-full p-[3px] transition-all active:scale-95 ${enabled ? 'bg-[#233142]' : 'bg-[#EAEAEA]'}`}
                >
                  <span className={`block w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">推播時間</label>
              <TimeWheelPicker time={sendTime} setTime={setSendTime} />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8E8E93] mb-2 uppercase tracking-widest">推播方式</label>
              <div className="space-y-2">
                {modeOptions.map(opt => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setTargetMode(opt.key)}
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                      targetMode === opt.key
                        ? 'bg-[#233142] border-[#233142] text-white shadow-[0_4px_16px_rgba(35,49,66,0.16)]'
                        : 'bg-white border-[#EAEAEA] text-[#233142] shadow-sm'
                    }`}
                  >
                    <span className="block text-[13px] font-bold tracking-widest">{opt.label}</span>
                    <span className={`block text-[11px] mt-1 ${targetMode === opt.key ? 'text-white/70' : 'text-[#8E8E93]'}`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 px-5 pt-3 bg-[#F9F8F6] border-t border-[#EAEAEA]" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <button
              type="button"
              disabled={isSavingReportSettings || !sendTime}
              onClick={() => handleSaveReportSettings({ enabled, send_time: sendTime, target_mode: targetMode })}
              className="w-full h-[52px] bg-[#233142] disabled:bg-[#D1CFC7] disabled:text-[#F9F8F6] text-white rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-transform tracking-widest shadow-[0_4px_16px_rgba(35,49,66,0.2)]"
            >
              <Check size={18} strokeWidth={3} /> {isSavingReportSettings ? '儲存中...' : '儲存設定'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==============================================================
  // 主畫面 Layout
  // ==============================================================
  return (
    <div className={`fixed inset-0 bg-[#DFDCD4] flex justify-center overflow-hidden select-none selection:bg-[#D68C7A] selection:text-white ${hideScrollbar}`} style={{ fontFamily: 'PingFang TC, PingFang SC, sans-serif', fontStyle: 'normal' }}>
      <div className="w-full max-w-[480px] h-full bg-[#F9F8F6] relative flex flex-col overflow-hidden sm:border-x border-[#D1CFC7] sm:rounded-[40px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-[0_20px_60px_rgba(44,42,40,0.1)]">
        
        <header className="flex-none pt-12 pb-4 px-6 flex justify-between items-center z-30 bg-[#F9F8F6]/95 backdrop-blur-xl border-b border-[#EAEAEA] sticky top-0">
          <div>
            <h1 className="text-[28px] font-editorial italic font-bold tracking-tight text-[#233142]">Family Hub</h1>
            <p className="text-[9px] text-[#8E8E93] tracking-[0.4em] font-num font-bold uppercase mt-1">Life Navigator</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchSupabaseData} disabled={isRefreshing} className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] border-[1.5px] border-[#566B56] bg-white active:scale-95 transition-all disabled:opacity-70 shadow-sm hover:bg-[#F4F8F4]">
              <RotateCw size={12} strokeWidth={3} className={`text-[#566B56] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-num font-bold text-[#566B56] uppercase tracking-[0.2em]">{isRefreshing ? 'SYNC' : 'SYNC'}</span>
            </button>
            <button onClick={() => setIsMemberModalOpen(true)} className="relative w-[38px] h-[38px] bg-white border-[1.5px] border-[#EAEAEA] rounded-[12px] flex items-center justify-center text-[#233142] shadow-sm hover:bg-[#F9F8F6] active:scale-95 transition-all">
              <Users size={18} strokeWidth={2.5} />
              {unboundLineUsers.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-[12px] w-[12px]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D68C7A] opacity-60"></span>
                  <span className="relative inline-flex rounded-[4px] h-[12px] w-[12px] bg-[#D68C7A] border-[2px] border-[#F9F8F6]"></span>
                </span>
              )}
            </button>
          </div>
        </header>

        {unboundLineUsers.length > 0 && (
          <div className="flex-none bg-[#D68C7A]/10 border-b border-[#D68C7A]/20 px-6 py-3.5 flex items-start animate-in slide-in-from-top duration-300 z-20">
            <p className="text-[12px] font-bold text-[#D68C7A] m-0 tracking-wide text-left leading-relaxed">
              📢 偵測到 {unboundLineUsers.length} 位夥伴已加入，請點選右上角按鈕進行綁定。
            </p>
          </div>
        )}

        <main className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth ${hideScrollbar}`}>
          {activeTab === 'board' ? <BoardView /> : activeTab === 'weekly' ? <WeeklyPlannerView /> : <RoutinesView />}
        </main>

        {activeTab !== 'routines' && (
          <button
            onClick={() => { triggerVibration(10); setIsAiModalOpen(true); }}
            aria-label="新增手札"
            className="absolute right-5 z-20 flex flex-col items-center gap-1 active:scale-90 transition-transform animate-in zoom-in-95 duration-200"
            style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#233142] flex items-center justify-center shadow-[0_4px_16px_rgba(35,49,66,0.24)]">
              <PenLine size={20} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-[9px] font-bold text-[#8E8E93] tracking-[0.12em] font-num">手札</span>
          </button>
        )}

        <AiModal />
        <MemberModal />
        <EventEditModal />
        {toast && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#233142]/95 backdrop-blur-xl text-white text-[13px] font-bold tracking-widest px-6 py-3.5 rounded-[16px] shadow-[0_10px_30px_rgba(35,49,66,0.2)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <Check size={18} className="text-[#EAEAEA]" strokeWidth={3} />
            {toast}
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="flex-none w-full bg-[#F9F8F6]/90 backdrop-blur-2xl border-t border-[#EAEAEA]/80 z-20 flex justify-around items-start pt-3 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]"
             style={{ height: 'calc(75px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button onClick={() => { triggerVibration(5); setActiveTab('board'); }} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-400 ease-out ${activeTab === 'board' ? 'text-[#233142] -translate-y-1' : 'text-[#A0A0A0] hover:text-[#8E8E93]'}`}>
            <CalendarDays size={24} strokeWidth={activeTab === 'board' ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase font-num">任務看板</span>
            {activeTab === 'board' && <div className="w-[18px] h-[3px] rounded-full bg-[#233142] mt-0.5 shadow-sm"></div>}
          </button>

          <button onClick={() => { triggerVibration(5); setActiveTab('weekly'); }} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-400 ease-out ${activeTab === 'weekly' ? 'text-[#233142] -translate-y-1' : 'text-[#A0A0A0] hover:text-[#8E8E93]'}`}>
            <PenLine size={24} strokeWidth={activeTab === 'weekly' ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase font-num">本週手帳</span>
            {activeTab === 'weekly' && <div className="w-[18px] h-[3px] rounded-full bg-[#233142] mt-0.5 shadow-sm"></div>}
          </button>

          <button onClick={() => { triggerVibration(5); setActiveTab('routines'); }} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-400 ease-out ${activeTab === 'routines' ? 'text-[#233142] -translate-y-1' : 'text-[#A0A0A0] hover:text-[#8E8E93]'}`}>
            <RotateCw size={24} strokeWidth={activeTab === 'routines' ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase font-num">進階追蹤</span>
            {activeTab === 'routines' && <div className="w-[18px] h-[3px] rounded-full bg-[#233142] mt-0.5 shadow-sm"></div>}
          </button>
        </nav>

      </div>
    </div>
  );
}
