import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, 
  RotateCw, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Droplets,
  Wind,
  Leaf,
  Car,
  Sparkles,
  Bell,
  X,
  Activity,
  ShoppingCart,
  HeartPulse,
  Smile,
  AlertCircle,
  ChevronDown,
  History,
  PenLine,
  MoreVertical
} from 'lucide-react';

// --- 工具函數與常數 ---
const TODAY = new Date();
const fmtDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shiftDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
};
const daysSince = (dateStr) => Math.ceil(Math.abs(new Date(fmtDate(TODAY)) - new Date(dateStr)) / (1000 * 60 * 60 * 24));
const daysUntil = (lastDate, interval) => interval - daysSince(lastDate);

// 🎨 旅人手帖 (Traveler's Notebook) 色彩計畫
const PALETTE = {
  paper: '#F5F3E9',      // 紙張底色
  card: '#FCFBF8',       // 卡片底色
  ink: '#3D3835',        // 主要文字 (深褐黑)
  inkMuted: '#878378',   // 次要文字 (鉛筆灰)
  border: '#E8E4D9',     // 柔和分隔線
  // 莫蘭迪印章色
  todo: '#4A6D8C',       // 鋼筆藍
  shop: '#5A7A5A',       // 苔蘚綠
  remind: '#C2834E',     // 皮革橘
  health: '#B55B5C',     // 印泥紅
  mood: '#7A6B8A',       // 薰衣草灰
};

const TYPE_CONFIG = {
  todo: { label: '待辦', color: PALETTE.todo, bg: 'bg-[#4A6D8C]/10', text: 'text-[#4A6D8C]', icon: Activity },
  shop: { label: '採買', color: PALETTE.shop, bg: 'bg-[#5A7A5A]/10', text: 'text-[#5A7A5A]', icon: ShoppingCart },
  remind: { label: '提醒', color: PALETTE.remind, bg: 'bg-[#C2834E]/10', text: 'text-[#C2834E]', icon: AlertCircle },
  health: { label: '健康', color: PALETTE.health, bg: 'bg-[#B55B5C]/10', text: 'text-[#B55B5C]', icon: HeartPulse },
  mood: { label: '心情', color: PALETTE.mood, bg: 'bg-[#7A6B8A]/10', text: 'text-[#7A6B8A]', icon: Smile },
};

// --- 假資料 ---
const MOCK_EVENTS = [
  { id: 'e1', date: shiftDays(TODAY, -1), type: 'mood', text: '今天有點累，但孩子考試不錯', member: '媽媽', mood: '😌' },
  { id: 'e2', date: fmtDate(TODAY), type: 'todo', text: '繳交寬頻網路費與管理費', member: '爸爸' },
  { id: 'e3', date: fmtDate(TODAY), type: 'shop', text: '採買日用品（雞蛋、鮮奶、衛生紙）', member: '媽媽' },
  { id: 'e4', date: fmtDate(TODAY), type: 'mood', text: '早晨的陽光真好！', member: '爸爸', mood: '☀️' },
  { id: 'e5', date: shiftDays(TODAY, 2), type: 'health', text: '年度健康檢查', member: '爸爸' },
  { id: 'e6', date: shiftDays(TODAY, 3), type: 'remind', text: '信用卡帳單自動扣款日', member: '全家' },
];

const MOCK_ROUTINES = [
  { id: 'r1', name: '軟水機加鹽', icon: 'droplet', color: PALETTE.todo, interval: 30, member: '爸爸', logs: [{ id: 'l1', date: shiftDays(TODAY, -25), note: '加了半包' }, { id: 'l2', date: shiftDays(TODAY, -58), note: '補滿' }] },
  { id: 'r2', name: '更換全熱濾網', icon: 'wind', color: PALETTE.mood, interval: 60, member: '爸爸', logs: [{ id: 'l3', date: shiftDays(TODAY, -65), note: '清洗鰭片' }] },
  { id: 'r3', name: '植栽澆水施肥', icon: 'leaf', color: PALETTE.shop, interval: 3, member: '媽媽', logs: [{ id: 'l5', date: shiftDays(TODAY, -1), note: '加觀葉液肥' }, { id: 'l6', date: shiftDays(TODAY, -4), note: '' }] },
  { id: 'r4', name: '機油更換', icon: 'car', color: PALETTE.remind, interval: 90, member: '爸爸', logs: [{ id: 'l7', date: shiftDays(TODAY, -85), note: '5W-30 全合成' }] },
];
const HOLIDAYS = {
  '2026-01-01':'元旦','2026-02-17':'除夕','2026-02-18':'春節',
  '2026-02-19':'春節','2026-02-20':'春節','2026-04-04':'兒童節',
  '2026-04-05':'清明節','2026-05-01':'勞動節','2026-06-19':'端午節',
  '2026-09-25':'中秋節','2026-10-10':'國慶日','2026-12-25':'聖誕節',
  '2025-01-01':'元旦','2025-01-28':'除夕','2025-01-29':'春節',
  '2025-01-30':'春節','2025-01-31':'春節','2025-04-04':'兒童節',
  '2025-04-05':'清明節','2025-05-01':'勞動節','2025-05-31':'端午節',
  '2025-10-06':'中秋節','2025-10-10':'國慶日',
};
const MOOD_MAP = { '開心':'😊', '快樂':'😄', '累':'😴', '煩':'😤', '難過':'😢', '期待':'🥰', '放鬆':'😌', '不錯':'🙂' };

// --- 主元件 ---
export default function FamilyHub() {
  const [activeTab, setActiveTab] = useState('board');
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [routines, setRoutines] = useState(MOCK_ROUTINES);
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  
  // Modals & Drawers
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [logModalRoutine, setLogModalRoutine] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAiSubmit = (text) => {
    let type = 'todo', member = '全家', date = fmtDate(TODAY), mood = null;
    const lower = text.toLowerCase();
    for (const [word, emoji] of Object.entries(MOOD_MAP)) {
      if (lower.includes(word)) { type = 'mood'; mood = emoji; break; }
    }
    if (type !== 'mood') {
      if (/買|採買|超市/.test(lower)) type = 'shop';
      else if (/醫|看診|回診|健康/.test(lower)) type = 'health';
      else if (/提醒|記得|截止|到期/.test(lower)) type = 'remind';
    }
    if (/媽媽|老婆/.test(lower)) member = '媽媽';
    else if (/爸爸|老公/.test(lower)) member = '爸爸';
    else if (/小明|孩子/.test(lower)) member = '小明';
    
    if (/明天/.test(lower)) date = shiftDays(TODAY, 1);
    else if (/後天/.test(lower)) date = shiftDays(TODAY, 2);

    const newEvent = { id: `ai_${Date.now()}`, date, type, text, member, mood };
    
    setTimeout(() => {
      setEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setSelectedDate(newEvent.date);
      if (new Date(newEvent.date).getMonth() !== currentMonth.getMonth()) {
        setCurrentMonth(new Date(new Date(newEvent.date).getFullYear(), new Date(newEvent.date).getMonth(), 1));
      }
      setActiveTab('board');
      setIsAiModalOpen(false);
      showToast('AI 解析完成，已寫入手帖');
    }, 600);
  };

  const handleAddLog = (routineId, noteText) => {
    setRoutines(prev => prev.map(r => {
      if (r.id === routineId) {
        return { ...r, logs: [{ id: `log_${Date.now()}`, date: fmtDate(TODAY), note: noteText }, ...r.logs] };
      }
      return r;
    }));
    setLogModalRoutine(null);
    showToast('事務歷史已更新');
  };

  // --- UI 元件：看板視圖 (Calendar & Events) ---
  const BoardView = () => {
    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const calendarDays = useMemo(() => {
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const firstDay = getFirstDayOfMonth(y, m);
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push({ type: 'empty', id: `empty-${i}` });
      for (let i = 1; i <= getDaysInMonth(y, m); i++) {
        const dateStr = fmtDate(new Date(y, m, i));
days.push({
  type: 'day',
  date: dateStr,
  dayNum: i,
  events: events.filter(e => e.date === dateStr),
  isSun: new Date(y, m, i).getDay() === 0,
  holiday: HOLIDAYS[dateStr] || null,
});
      return days;
    }, [currentMonth, events]);

    const dayEvents = events.filter(e => e.date === selectedDate && (filter === 'all' || e.type === filter));
    const isTodaySelected = selectedDate === fmtDate(TODAY);

    // 智能數據統計 (還原 HTML 功能)
    const monthEvents = events.filter(e => e.date.startsWith(fmtDate(currentMonth).substring(0, 7)));
    const stats = { todo: 0, shop: 0, remind: 0, health: 0, mood: 0 };
    monthEvents.forEach(e => { if(stats[e.type]!==undefined) stats[e.type]++; });

    return (
      <div className="flex flex-col pb-32 pt-2 px-4 space-y-5">
        
        {/* 智能統計儀表板 (Stats Dashboard) */}
        <div className="bg-[#FCFBF8] border border-[#E8E4D9] rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h2 className="text-xl font-bold text-[#3D3835] font-serif tracking-wide leading-none">
                {currentMonth.getMonth() + 1}月 <span className="text-sm font-sans font-medium text-[#878378] ml-1">{currentMonth.getFullYear()}</span>
              </h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 border border-[#E8E4D9] rounded-lg text-[#878378] hover:bg-[#F5F3E9]"><ChevronLeft size={16} /></button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 border border-[#E8E4D9] rounded-lg text-[#878378] hover:bg-[#F5F3E9]"><ChevronRight size={16} /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-2 pt-2 border-t border-[#E8E4D9] border-dashed">
            {Object.keys(TYPE_CONFIG).map(type => (
              <div key={type} className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-[#F5F3E9] cursor-pointer transition-colors" onClick={() => setFilter(type)}>
                <span className="text-[17px] font-bold font-serif" style={{ color: stats[type] > 0 ? TYPE_CONFIG[type].color : '#D4D0C5' }}>{stats[type]}</span>
                <span className="text-[10px] font-medium text-[#878378] mt-0.5">{TYPE_CONFIG[type].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 手帳感日曆 (Calendar Grid) */}
        <div className="bg-[#FCFBF8] border border-[#E8E4D9] rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-7 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className={`text-center text-[10px] font-bold tracking-widest ${i===0 ? 'text-[#B55B5C]' : 'text-[#878378]'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-3 gap-x-1">
            {calendarDays.map((day, i) => {
              if (day.type === 'empty') return <div key={day.id} />;
              const isSelected = selectedDate === day.date;
              const isToday = day.date === fmtDate(TODAY);
              const hasEvents = day.events.length > 0;
              const isHoliday = !!day.holiday;

              return (
                <div key={day.date} onClick={() => setSelectedDate(day.date)} className="relative flex flex-col items-center justify-center cursor-pointer group h-10">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full text-[14px] font-medium font-serif transition-all
  ${isSelected ? 'bg-[#3D3835] text-[#F5F3E9] shadow-md' : ''}
  ${!isSelected && isToday ? 'border border-[#3D3835] text-[#3D3835]' : ''}
  ${!isSelected && !isToday ? (day.isSun || isHoliday ? 'text-[#B55B5C]' : 'text-[#3D3835]') : ''}
  ${!isSelected && !isToday && 'group-hover:bg-[#E8E4D9]/50'}
`}>
  {day.dayNum}
</div>
{isHoliday && (
  <div className="text-[8px] text-[#B55B5C] font-medium leading-none mt-0.5 max-w-[32px] text-center truncate">
    {day.holiday}
  </div>
)}
                  {hasEvents && (
  <div className="absolute -bottom-1 flex gap-0.5 items-center">
    {(() => {
      const moodEv = day.events.find(e => e.type === 'mood');
      const others = day.events.filter(e => e.type !== 'mood').slice(0, moodEv ? 2 : 3);
      return (
        <>
          {moodEv && (
            <span className="text-[9px] leading-none">{moodEv.mood || '💬'}</span>
          )}
          {others.map((e, idx) => (
            <span key={idx} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: isSelected ? '#E8E4D9' : TYPE_CONFIG[e.type].color }}></span>
          ))}
        </>
      );
    })()}
  </div>
)}
                </div>
              );
            })}
          </div>
        </div>

        {/* 標籤過濾區 (Tags) */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1">
          <button onClick={() => setFilter('all')} className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-[12px] font-medium transition-all ${filter === 'all' ? 'bg-[#3D3835] text-[#F5F3E9]' : 'bg-[#FCFBF8] text-[#878378] border border-[#E8E4D9]'}`}>所有紀錄</button>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <button key={key} onClick={() => setFilter(key)} className={`snap-start whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${filter === key ? 'bg-[#3D3835] text-[#F5F3E9]' : 'bg-[#FCFBF8] text-[#878378] border border-[#E8E4D9]'}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></span>
              {config.label}
            </button>
          ))}
        </div>

        {/* 每日手札列表 (Daily Logs) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-[15px] font-bold text-[#3D3835] tracking-wide flex items-center gap-2">
              <span className="font-serif">{new Date(selectedDate).getDate()}</span> 日
              {isTodaySelected && <span className="text-[10px] bg-[#E8E4D9] text-[#3D3835] px-2 py-0.5 rounded-sm uppercase tracking-widest font-normal">Today</span>}
            </h3>
          </div>

          {dayEvents.length === 0 ? (
            <div className="bg-[#FCFBF8] border border-[#E8E4D9] border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
              <Leaf size={24} strokeWidth={1} className="text-[#D4D0C5] mb-2" />
              <p className="text-[#878378] text-[13px] tracking-widest">這天沒有手札紀錄</p>
            </div>
          ) : (
            <div className="relative">
              {/* 左側時間軸引線 */}
              <div className="absolute left-[20px] top-4 bottom-4 w-[1px] bg-[#E8E4D9]"></div>
              
              <div className="space-y-4 relative">
                {dayEvents.map((e, index) => {
                  const TypeIcon = TYPE_CONFIG[e.type].icon;
                  return (
                    <div key={e.id} className="relative pl-12 pr-2 group">
                      {/* 時間軸節點 (圖示) */}
                      <div className="absolute left-[8px] top-1 w-6 h-6 rounded-full bg-[#FCFBF8] border border-[#E8E4D9] flex items-center justify-center shadow-sm z-10" style={{ color: TYPE_CONFIG[e.type].color }}>
                        {e.type === 'mood' ? <span className="text-[10px]">{e.mood}</span> : <TypeIcon size={12} strokeWidth={2} />}
                      </div>
                      
                      {/* 卡片內容 */}
                      <div className="bg-[#FCFBF8] p-3.5 rounded-2xl border border-[#E8E4D9] shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[11px] font-medium tracking-widest uppercase" style={{ color: TYPE_CONFIG[e.type].color }}>{TYPE_CONFIG[e.type].label}</span>
                          <button onClick={() => showToast('已發送提醒至 LINE')} className="text-[#D4D0C5] hover:text-[#3D3835] transition-colors"><Bell size={14} /></button>
                        </div>
                        <div className="text-[14px] font-medium text-[#3D3835] leading-relaxed">
                          {e.text}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[#878378] bg-[#F5F3E9] px-2 py-0.5 rounded border border-[#E8E4D9] font-serif italic">{e.member}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- UI 元件：週期事務 (Routine Maintenance) ---
  const RoutinesView = () => {
    const getIcon = (name) => {
      switch(name) {
        case 'droplet': return <Droplets size={18} strokeWidth={1.5} />;
        case 'wind': return <Wind size={18} strokeWidth={1.5} />;
        case 'leaf': return <Leaf size={18} strokeWidth={1.5} />;
        case 'car': return <Car size={18} strokeWidth={1.5} />;
        default: return <Activity size={18} strokeWidth={1.5} />;
      }
    };

    return (
      <div className="px-4 pb-32 pt-2">
        <h2 className="text-[20px] font-bold text-[#3D3835] tracking-wide font-serif mb-5 px-1">週期事務追蹤</h2>
        
        <div className="grid grid-cols-1 gap-4">
          {routines.map(r => {
            const lastLog = r.logs[0];
            const remaining = lastLog ? daysUntil(lastLog.date, r.interval) : 0;
            const isDue = remaining < 0;
            const isWarn = remaining >= 0 && remaining <= 5;
            const isExpanded = expandedRoutineId === r.id;
            
            // 進度計算與顏色配置 (還原 HTML 進度條邏輯)
            const pct = Math.min(100, Math.max(0, isDue ? 100 : Math.round(((r.interval - remaining) / r.interval) * 100)));
            let statusColor = r.color;
            let statusText = `剩餘 ${remaining} 天`;

            if (isDue) { statusColor = PALETTE.health; statusText = `已逾期 ${Math.abs(remaining)} 天`; }
            else if (isWarn) { statusColor = PALETTE.remind; statusText = `即將到期`; }

            return (
              <div key={r.id} className="bg-[#FCFBF8] rounded-2xl shadow-sm border border-[#E8E4D9] flex flex-col overflow-hidden">
                
                {/* 卡片標頭 (Header) */}
                <div className="p-4 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#E8E4D9] bg-[#F5F3E9]" style={{ color: r.color }}>
                        {getIcon(r.icon)}
                      </div>
                      <div>
                        <h3 className="text-[16px] font-bold text-[#3D3835] tracking-tight leading-tight">{r.name}</h3>
                        <p className="text-[11px] font-medium text-[#878378] mt-1 tracking-wider uppercase font-serif">
                          {r.member} <span className="mx-1 font-sans opacity-50">|</span> 每 {r.interval} 天
                        </p>
                      </div>
                    </div>
                    {/* 狀態標籤 */}
                    <div className="px-2.5 py-1 rounded border text-[10px] font-bold tracking-widest bg-white" style={{ borderColor: statusColor, color: statusColor }}>
                      {statusText}
                    </div>
                  </div>

                  {/* 鋼筆細線進度條 (Refined Progress Bar) */}
                  <div className="mb-4 relative">
                    {/* 軌道 */}
                    <div className="h-[4px] w-full bg-[#E8E4D9] rounded-full overflow-hidden">
                      {/* 填滿 */}
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: statusColor }}></div>
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] font-medium text-[#878378] tracking-widest uppercase">
                      <span>上次: {lastLog.date.substring(5).replace('-','/')}</span>
                      <span>下次預計: {shiftDays(lastLog.date, r.interval).substring(5).replace('-','/')}</span>
                    </div>
                  </div>

                  {/* 操作區 */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setLogModalRoutine(r)} 
                      className="flex-1 py-2.5 bg-white border border-[#E8E4D9] hover:bg-[#F5F3E9] text-[#3D3835] rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Check size={16} strokeWidth={2} /> 紀錄本次完成
                    </button>
                    <button 
                      onClick={() => setExpandedRoutineId(isExpanded ? null : r.id)}
                      className={`w-[46px] flex items-center justify-center rounded-xl border border-[#E8E4D9] text-[#878378] hover:bg-[#F5F3E9] transition-colors ${isExpanded ? 'bg-[#F5F3E9]' : 'bg-white'}`}
                    >
                      <ChevronDown size={18} strokeWidth={1.5} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* 歷史紀錄抽屜 (History Drawer - 還原 HTML 設計) */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-[#F5F3E9] border-t border-[#E8E4D9] border-dashed ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-4 px-5">
                    <h4 className="text-[11px] font-bold text-[#878378] tracking-widest flex items-center gap-2 mb-3">
                      <History size={14} strokeWidth={1.5} /> 執行歷史軌跡
                    </h4>
                    
                    <div className="space-y-3">
                      {r.logs.map((log, idx) => (
                        <div key={log.id} className="flex items-center gap-3 py-2 border-b border-[#E8E4D9] last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-[#3D3835]' : 'bg-[#D4D0C5]'}`}></div>
                          <div className="text-[13px] font-serif font-medium text-[#3D3835] min-w-[70px]">
                            {log.date.substring(5).replace('-', '月')}日
                          </div>
                          <div className="text-[13px] text-[#878378] flex-1 truncate">
                            {log.note || '—'}
                          </div>
                          <div className="text-[11px] font-medium text-[#D4D0C5] whitespace-nowrap">
                            {daysSince(log.date)}天前
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- UI 元件：紀錄彈窗面板 ---
  const RoutineLogModal = () => {
    const [note, setNote] = useState('');
    if (!logModalRoutine) return null;
    const routine = logModalRoutine;
    
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#3D3835]/40 backdrop-blur-sm transition-opacity p-0 sm:p-4">
        <div className="bg-[#FCFBF8] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col pb-safe animate-in slide-in-from-bottom-8 duration-300 border border-[#E8E4D9]">
          <div className="p-6 relative">
            <button onClick={() => setLogModalRoutine(null)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#878378] hover:bg-[#F5F3E9] transition-colors">
              <X size={20} strokeWidth={1.5}/>
            </button>

            <div className="mb-5 border-b border-[#E8E4D9] border-dashed pb-4">
              <h3 className="text-[20px] font-bold text-[#3D3835] font-serif tracking-wide">新增紀錄</h3>
              <p className="text-[12px] font-medium text-[#878378] mt-1 tracking-wider">{routine.name}</p>
            </div>

            <div className="mb-6">
              <label className="block text-[13px] font-bold text-[#3D3835] mb-2 flex items-center gap-2">
                <PenLine size={16} className="text-[#878378]" strokeWidth={1.5} /> 筆記備註 <span className="text-[#D4D0C5] font-normal">(選填)</span>
              </label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：更換了原廠耗材、加了半桶..."
                className="w-full bg-[#F5F3E9] border border-[#E8E4D9] rounded-2xl p-4 text-[14px] text-[#3D3835] focus:outline-none focus:border-[#3D3835] transition-all resize-none h-28 placeholder:text-[#D4D0C5]"
              ></textarea>
            </div>

            <button 
              onClick={() => handleAddLog(routine.id, note)}
              className="w-full py-4 bg-[#3D3835] hover:bg-black text-[#F5F3E9] rounded-2xl text-[15px] font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 tracking-widest"
            >
              <Check size={18} strokeWidth={2} /> 儲存
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- UI 元件：AI 智慧輸入 (Smart Modal) ---
  const AiModal = () => {
    const [input, setInput] = useState('');
    if (!isAiModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#3D3835]/40 backdrop-blur-sm transition-opacity p-2 sm:p-4">
        <div className="bg-[#FCFBF8] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col mb-4 border border-[#E8E4D9] animate-in slide-in-from-bottom-8 duration-300">
          <div className="p-6 relative">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#878378] hover:bg-[#F5F3E9]">
              <X size={20} strokeWidth={1.5}/>
            </button>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#3D3835] flex items-center justify-center shadow-md">
                 <Sparkles size={14} className="text-[#F5F3E9]" strokeWidth={2} />
              </div>
              <span className="text-[18px] font-bold text-[#3D3835] font-serif tracking-wide">AI 手札助理</span>
            </div>
            <p className="text-[12px] text-[#878378] mb-5 tracking-widest leading-relaxed">
              輸入文字，系統會自動擷取時間與分類。<br/>
            </p>

            <div className="relative">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="「明天要去超市買鮮奶，爸爸負責」"
                className="w-full bg-[#F5F3E9] border border-[#E8E4D9] rounded-[20px] p-5 pb-16 text-[15px] text-[#3D3835] placeholder:text-[#D4D0C5] focus:outline-none focus:border-[#3D3835] transition-all resize-none h-36"
              ></textarea>
              
              <button 
                onClick={() => { if(input.trim()) handleAiSubmit(input); }}
                disabled={!input.trim()}
                className="absolute right-3 bottom-3 bg-[#3D3835] disabled:bg-[#E8E4D9] disabled:text-[#878378] text-[#F5F3E9] py-2 px-5 rounded-full shadow-md flex items-center gap-2 text-[13px] font-bold transition-all hover:scale-105 active:scale-95 disabled:scale-100 tracking-widest"
              >
                寫入
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 根佈局 ---
  return (
    <div className="min-h-screen bg-[#EAE8E0] font-sans flex justify-center selection:bg-[#E8E4D9]">
      <div className="w-full max-w-[480px] h-dvh bg-[#F5F3E9] relative flex flex-col overflow-hidden sm:border-x border-[#D4D0C5] sm:rounded-[32px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-2xl">
        
        {/* Header */}
        <header className="flex-none pt-12 pb-3 px-6 flex justify-between items-center z-20 bg-[#F5F3E9]/90 backdrop-blur-xl border-b border-[#E8E4D9] sticky top-0">
          <div>
            <h1 className="text-[22px] font-bold tracking-wider text-[#3D3835] font-serif">Family Hub</h1>
            <p className="text-[9px] text-[#878378] tracking-[0.3em] uppercase mt-1">Traveler's Logbook</p>
          </div>
          {/* 連線狀態印章 */}
          <div className="flex items-center gap-1.5 bg-[#FCFBF8] px-2.5 py-1.5 rounded-md border border-[#E8E4D9] shadow-sm transform rotate-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5A7A5A] animate-pulse"></div>
            <span className="text-[9px] font-bold text-[#5A7A5A] uppercase tracking-widest">LINE Sync</span>
          </div>
        </header>

        {/* 主內容區 */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth">
          {activeTab === 'board' ? <BoardView /> : <RoutinesView />}
        </main>

        {/* 懸浮按鈕 FAB */}
        <button 
          onClick={() => setIsAiModalOpen(true)}
          className="absolute bottom-[108px] right-6 w-14 h-14 rounded-full flex items-center justify-center z-40 transition-transform active:scale-90 hover:scale-105 shadow-lg bg-[#3D3835] text-[#F5F3E9]"
        >
          <Sparkles size={22} strokeWidth={1.5} />
        </button>

        <AiModal />
        <RoutineLogModal />

        {/* 通知 Toast */}
        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#3D3835]/95 backdrop-blur-md text-[#F5F3E9] text-[12px] font-medium tracking-widest px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-[#878378]/30">
            <Check size={16} className="text-[#E8E4D9]" strokeWidth={2} />
            {toast}
          </div>
        )}

        {/* Bottom Tab Bar (皮革/紙張質感) */}
        <nav className="absolute bottom-0 left-0 w-full h-[90px] bg-[#FCFBF8]/90 backdrop-blur-xl border-t border-[#E8E4D9] z-30 flex justify-around items-start pt-3 pb-safe px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <button 
            onClick={() => setActiveTab('board')} 
            className={`flex flex-col items-center gap-1.5 w-20 transition-all ${activeTab === 'board' ? 'text-[#3D3835] -translate-y-1' : 'text-[#D4D0C5] hover:text-[#878378]'}`}
          >
            <CalendarDays size={22} strokeWidth={activeTab === 'board' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">手札看板</span>
            {activeTab === 'board' && <div className="w-1 h-1 rounded-full bg-[#3D3835]"></div>}
          </button>
          
          <button 
            onClick={() => setActiveTab('routines')} 
            className={`flex flex-col items-center gap-1.5 w-20 transition-all ${activeTab === 'routines' ? 'text-[#3D3835] -translate-y-1' : 'text-[#D4D0C5] hover:text-[#878378]'}`}
          >
            <RotateCw size={22} strokeWidth={activeTab === 'routines' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">週期維護</span>
            {activeTab === 'routines' && <div className="w-1 h-1 rounded-full bg-[#3D3835]"></div>}
          </button>
        </nav>

      </div>
    </div>
  );
}
