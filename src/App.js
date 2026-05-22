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
  Users,     // 👈 新增：使用者圖示
  UserPlus   // 👈 新增：新增使用者圖示
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://pmhudmhdxfctmyfmmxhh.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaHVkbWhkeGZjdG15Zm1teGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ5MDQsImV4cCI6MjA5NDY0MDkwNH0.ymAzLChmVVvtkKCw2AIQLfhfodo8vJTONihzufw9CY0'
);

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

// 🎨 旅人手帖 (Traveler's Notebook) 典藏色彩
const PALETTE = {
  paper: '#F2EFE9',      // 稍深的自然紙漿色
  card: '#FBF9F6',       // 書寫區紙色
  ink: '#2C2A28',        // 濃郁墨黑
  inkMuted: '#7D7973',   // 褪色墨水/鉛筆灰
  border: '#E3DFD5',     // 柔和摺痕/分隔線
  accent: '#A84C3D',     // 經典手帳紅(印章/星期日)
  // 莫蘭迪墨水色
  todo: '#425C73',       // 鋼筆藍
  shop: '#566B56',       // 苔蘚綠
  remind: '#B87A45',     // 鞍馬橘
  health: '#A84C3D',     // 印泥紅
  mood: '#6D607D',       // 薰衣草灰
};

const TYPE_CONFIG = {
  todo: { label: '待辦', color: PALETTE.todo, icon: Activity },
  shop: { label: '採買', color: PALETTE.shop, icon: ShoppingCart },
  remind: { label: '提醒', color: PALETTE.remind, icon: AlertCircle },
  health: { label: '健康', color: PALETTE.health, icon: HeartPulse },
  mood: { label: '心情', color: PALETTE.mood, icon: Smile },
  routine: { label: '週期', color: PALETTE.inkMuted, icon: RotateCw },
};

// --- 假資料 ---
const MOCK_EVENTS = [];

const MOCK_ROUTINES = [];

const HOLIDAYS = {
  '2026-05-01':'勞動節', '2026-06-19':'端午節', '2026-09-25':'中秋節', '2026-10-10':'國慶日'
};
const MOOD_MAP = { '開心':'😊', '快樂':'😄', '累':'😴', '煩':'😤', '難過':'😢', '期待':'🥰', '放鬆':'😌', '不錯':'🙂' };

// 共用隱藏捲軸 class
const hideScrollbar = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']";

// --- 主元件 ---
export default function FamilyHub() {
  const [activeTab, setActiveTab] = useState('board');
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [routines, setRoutines] = useState(MOCK_ROUTINES);
  const [members, setMembers] = useState([]); // 👈 新增：用來裝載動態成員的容器
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false); // 👈 新增：成員管理面板開關
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [logModalRoutine, setLogModalRoutine] = useState(null);
  
  // 4. 👇 網頁載入時去 Supabase 撈取資料
  useEffect(() => {
    async function fetchSupabaseData() {
      // 撈取手札事件 (events)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .gte('date', '2026-05-22')
        .order('date', { ascending: true });
      
      if (eventsData) setEvents(eventsData);

      // 撈取週期任務 (routines) 與它的歷史紀錄 (routine_logs)
      const { data: routinesData } = await supabase
        .from('routines')
        .select('*')
        .gte('created_at', '2026-05-22T00:00:00Z');
        
      if (routinesData) {
        const formattedRoutines = routinesData.map(r => ({
          ...r,
          icon: r.icon || 'activity',
          color: r.color || '#425C73',
          logs: r.logs ? r.logs.sort((a, b) => new Date(b.date) - new Date(a.date)) : []
        }));
        setRoutines(formattedRoutines);
      }

      // 👈 新增：撈取動態家庭成員 (安全降落機制：如果資料庫還沒建這張表也不會當機)
      const { data: membersData, error: membersError } = await supabase.from('members').select('*');
      if (!membersError && membersData) {
        setMembers(membersData);
      }
    }

    fetchSupabaseData();
  }, []); 
  
  // ==========================================

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 👈 新增：處理新增成員寫入資料庫
  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const newMember = { name, role_name: role };
    
    // 樂觀更新：先讓畫面顯示
    const tempId = Date.now();
    setMembers(prev => [...prev, { ...newMember, id: tempId }]);
    
    // 寫入 Supabase
    const { error } = await supabase.from('members').insert([newMember]);
    if (error) {
      showToast('⚠️ 儲存失敗，請確認資料庫是否已建立 members 表單');
      setMembers(prev => prev.filter(m => m.id !== tempId));
    } else {
      showToast('✅ 成員角色已成功建立');
    }
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
      showToast('AI 解析完成，已寫入手札');
    }, 600);
  };

  const handleAddLog = (routineId, noteText) => {
    setRoutines(prev => prev.map(r => {
      if (r.id === routineId) return { ...r, logs: [{ id: `log_${Date.now()}`, date: fmtDate(TODAY), note: noteText }, ...r.logs] };
      return r;
    }));
    setLogModalRoutine(null);
    showToast('事務歷史已更新');
  };

  // --- UI 元件：手札看板 (Calendar & Events) ---
  const BoardView = () => {
    const calendarDays = useMemo(() => {
      const days = [];
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < firstDay; i++) days.push({ type: "empty", id: `empty-${i}` });
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = fmtDate(new Date(y, m, i));
        days.push({
          type: "day", date: dateStr, dayNum: i,
          events: events.filter((e) => e.date === dateStr),
          isSun: new Date(y, m, i).getDay() === 0,
          holiday: HOLIDAYS[dateStr] || null,
        });
      }
      return days;
    }, [currentMonth, events]);

    const dayEvents = events.filter(e => e.date === selectedDate && (filter === 'all' || e.type === filter));
    const isTodaySelected = selectedDate === fmtDate(TODAY);
    const monthEvents = events.filter(e => e.date.startsWith(fmtDate(currentMonth).substring(0, 7)));
    const stats = { todo: 0, shop: 0, remind: 0, health: 0, mood: 0, routine: 0 };
    monthEvents.forEach(e => { if(stats[e.type]!==undefined) stats[e.type]++; });

    // 點擊滑動並觸發小動畫 (透過 key 改變觸發)
    const [animKey, setAnimKey] = useState(Date.now());
    const handleDayClick = (date) => {
      setSelectedDate(date);
      setAnimKey(Date.now()); // 強制觸發動畫
      const listRef = document.getElementById('daily-logs-header');
      if(listRef) listRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
      <div className="flex flex-col pb-32 pt-2 relative">
        <div className="px-5 space-y-4">
          
          {/* 月份儀表板 (Dashboard) */}
          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-[20px] p-4 shadow-[0_2px_8px_rgba(44,42,40,0.02)] relative overflow-hidden">
            {/* 紙張質感裝飾 */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#E3DFD5]/30 to-transparent rounded-bl-full"></div>
            
            <div className="flex justify-between items-end mb-3 relative z-10">
              <h2 className="text-[22px] font-bold text-[#2C2A28] font-serif tracking-wide leading-none">
                {currentMonth.getMonth() + 1}月 <span className="text-[14px] font-sans font-medium text-[#7D7973] ml-1">{currentMonth.getFullYear()}</span>
              </h2>
              <div className="flex gap-1.5">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-xl text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all"><ChevronLeft size={16} strokeWidth={2}/></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-xl text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all"><ChevronRight size={16} strokeWidth={2}/></button>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-[#E3DFD5] border-dashed relative z-10">
              {Object.keys(TYPE_CONFIG).map(type => (
                <div key={type} className="flex flex-col items-center justify-center py-2 rounded-xl hover:bg-[#F2EFE9] cursor-pointer transition-colors active:bg-[#E3DFD5]" onClick={() => setFilter(type)}>
                  <span className="text-[18px] font-bold font-serif leading-none" style={{ color: stats[type] > 0 ? TYPE_CONFIG[type].color : '#D1CFC7' }}>{stats[type]}</span>
                  <span className="text-[10px] font-medium text-[#7D7973] mt-1.5">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 月曆 (Calendar Grid) */}
          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-[20px] p-4 shadow-[0_2px_8px_rgba(44,42,40,0.02)]">
            <div className="grid grid-cols-7 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={`text-center text-[10px] font-bold tracking-widest ${i===0 ? 'text-[#A84C3D]' : 'text-[#7D7973]'}`}>{d}</div>
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
                  <div key={day.date} onClick={() => handleDayClick(day.date)} className="relative flex flex-col items-center justify-center cursor-pointer group h-[42px] tap-highlight-transparent">
                    {/* 鋼筆圈選效果 (Highlight) */}
                    <div className={`absolute inset-0 rounded-xl transition-all duration-200 ${isSelected ? 'bg-[#2C2A28] scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:bg-[#E3DFD5]/40 group-hover:scale-100 group-hover:opacity-100 group-active:bg-[#E3DFD5]'}`}></div>
                    
                    <div className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full text-[15px] font-medium font-serif transition-colors duration-200
                      ${isSelected ? 'text-[#FBF9F6]' : ''}
                      ${!isSelected && isToday ? 'border-[1.5px] border-[#2C2A28] text-[#2C2A28] font-bold' : ''}
                      ${!isSelected && !isToday ? (day.isSun || isHoliday ? 'text-[#A84C3D]' : 'text-[#2C2A28]') : ''}
                    `}>
                      {day.dayNum}
                    </div>
                    {isHoliday && (
                      <div className={`relative z-10 text-[8px] font-medium leading-none mt-[1px] max-w-[32px] text-center truncate ${isSelected ? 'text-[#FBF9F6]/80' : 'text-[#A84C3D]'}`}>
                        {day.holiday}
                      </div>
                    )}
                    {hasEvents && !isHoliday && (
                      <div className="relative z-10 absolute bottom-0 flex gap-0.5 items-center mt-[2px]">
                        {(() => {
                          const moodEv = day.events.find(e => e.type === 'mood');
                          const others = day.events.filter(e => e.type !== 'mood').slice(0, moodEv ? 2 : 3);
                          return (
                            <>
                              {moodEv && <span className="text-[8px] leading-none opacity-90">{moodEv.mood || '💬'}</span>}
                              {others.map((e, idx) => (
                                <span key={idx} className="w-[3.5px] h-[3.5px] rounded-full transition-colors" style={{ backgroundColor: isSelected ? '#FBF9F6' : TYPE_CONFIG[e.type].color }}></span>
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
        </div>

        {/* 標籤過濾區 (和紙膠帶風格 Washi Tape Tabs) */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#F2EFE9] to-[#F2EFE9]/95 backdrop-blur-md pt-5 pb-3 px-5 mt-1 border-b border-[#E3DFD5]/50">
          <div className={`flex gap-3 overflow-x-auto snap-x ${hideScrollbar}`}>
            <button 
              onClick={() => setFilter('all')} 
              className={`snap-start whitespace-nowrap px-4 py-1.5 text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center
                ${filter === 'all' 
                  ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-md rounded-sm' 
                  : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm rounded-sm hover:-translate-y-0.5'
                }`}
            >
              所有紀錄
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <button 
                key={key} 
                onClick={() => setFilter(key)} 
                className={`snap-start whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95
                  ${filter === key 
                    ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-md rounded-sm' 
                    : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm rounded-sm hover:-translate-y-0.5'
                  }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filter === key ? '#FBF9F6' : config.color }}></span>
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* 每日手札列表 (Daily Logs) - 點陣子彈筆記風格 */}
        <div 
          className="px-5 mt-2 relative min-h-[350px]" 
          style={{ backgroundImage: 'radial-gradient(#E3DFD5 1.5px, transparent 1.5px)', backgroundSize: '16px 16px', backgroundPosition: '-8px -8px' }}
        >
          
          <div id="daily-logs-header" className="flex items-center justify-between py-3 mb-2 bg-[#F2EFE9]/90 backdrop-blur-md -mx-5 px-5 sticky top-[60px] z-10 border-b border-[#E3DFD5]/40">
            <h3 className="text-[17px] font-bold text-[#2C2A28] tracking-wide flex items-center gap-2">
              <span className="font-serif text-[20px]">{new Date(selectedDate).getDate()}</span> 日
              {isTodaySelected && (
                // 復古印章風格的 Today Badge
                <span className="text-[10px] text-[#A84C3D] border-[1.5px] border-[#A84C3D]/60 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-bold ml-1 opacity-90">
                  Today
                </span>
              )}
            </h3>
          </div>

          <div key={animKey} className="animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out pb-6">
            {dayEvents.length === 0 ? (
              <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-3xl p-10 text-center flex flex-col items-center shadow-[0_2px_8px_rgba(44,42,40,0.02)] mt-4">
                <Leaf size={28} strokeWidth={1.5} className="text-[#D1CFC7] mb-3" />
                <p className="text-[#7D7973] text-[14px] tracking-widest font-medium">這天沒有手札紀錄</p>
              </div>
            ) : (
              <div className="relative">
                {/* 鉛筆感牽引線 */}
                <div className="absolute left-[20px] top-6 bottom-4 w-[1.5px] bg-[#E3DFD5] border-l border-dashed border-[#D1CFC7]"></div>
                
                <div className="space-y-4 relative mt-2">
                  {dayEvents.map((e) => {
                    const TypeIcon = TYPE_CONFIG[e.type].icon;
                    return (
                      <div key={e.id} className="relative pl-12 pr-1 group">
                        {/* 節點圖示 */}
                        <div className="absolute left-[8px] top-3 w-[26px] h-[26px] rounded-full bg-[#FBF9F6] border-2 border-[#E3DFD5] flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110" style={{ color: TYPE_CONFIG[e.type].color }}>
                          {e.type === 'mood' ? <span className="text-[12px] leading-none">{e.mood}</span> : <TypeIcon size={12} strokeWidth={2.5} />}
                        </div>
                        
                        {/* 紀錄卡片 */}
                        <div className="bg-[#FBF9F6]/95 backdrop-blur-sm p-4 rounded-[16px] border border-[#E3DFD5] shadow-[0_2px_8px_rgba(44,42,40,0.02)] flex flex-col gap-2 transition-shadow hover:shadow-md">
                          <div className="flex justify-between items-start mb-0.5">
                            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: TYPE_CONFIG[e.type].color }}>{TYPE_CONFIG[e.type].label}</span>
                            <button onClick={() => showToast('已發送提醒至 LINE')} className="text-[#D1CFC7] hover:text-[#2C2A28] bg-[#F2EFE9] hover:bg-[#E3DFD5] p-1.5 rounded-full transition-colors active:scale-90"><Bell size={13} strokeWidth={2.5} /></button>
                          </div>
                          <div className="text-[15px] font-medium text-[#2C2A28] leading-relaxed">
                            {e.text}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-[#E3DFD5]/60 border-dashed">
                            <span className="text-[11px] text-[#7D7973] font-serif italic flex items-center gap-1.5 bg-[#F2EFE9] px-2 py-0.5 rounded-sm">
                               <div className="w-1 h-1 rounded-full bg-[#A84C3D]"></div>
                               {e.member}
                            </span>
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
      </div>
    );
  };

  // --- UI 元件：週期事務 (Routine Maintenance) ---
  const RoutinesView = () => {
    const getIcon = (name) => {
      switch(name) {
        case 'droplet': return <Droplets size={20} strokeWidth={1.5} />;
        case 'wind': return <Wind size={20} strokeWidth={1.5} />;
        case 'leaf': return <Leaf size={20} strokeWidth={1.5} />;
        case 'car': return <Car size={20} strokeWidth={1.5} />;
        default: return <Activity size={20} strokeWidth={1.5} />;
      }
    };

    return (
      <div className="px-5 pb-32 pt-2 animate-in fade-in duration-300">
        <h2 className="text-[22px] font-bold text-[#2C2A28] tracking-wide font-serif mb-6 px-1">週期事務追蹤</h2>
        
        <div className="grid grid-cols-1 gap-5">
          {routines.length === 0 && (
            <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-3xl p-10 text-center flex flex-col items-center shadow-[0_2px_8px_rgba(44,42,40,0.02)] mt-2">
              <Activity size={28} strokeWidth={1.5} className="text-[#D1CFC7] mb-3" />
              <p className="text-[#7D7973] text-[14px] tracking-widest font-medium">目前沒有週期事務</p>
            </div>
          )}
          {routines.map(r => {
            const lastLog = r.logs[0];
            const remaining = lastLog ? daysUntil(lastLog.date, r.interval) : 0;
            const isDue = remaining < 0;
            const isWarn = remaining >= 0 && remaining <= 5;
            const isExpanded = expandedRoutineId === r.id;
            
            const pct = Math.min(100, Math.max(0, isDue ? 100 : Math.round(((r.interval - remaining) / r.interval) * 100)));
            let statusColor = r.color;
            let statusText = `剩餘 ${remaining} 天`;

            if (isDue) { statusColor = PALETTE.health; statusText = `已逾期 ${Math.abs(remaining)} 天`; }
            else if (isWarn) { statusColor = PALETTE.remind; statusText = `即將到期`; }

            return (
              <div key={r.id} className="bg-[#FBF9F6] rounded-[20px] shadow-[0_2px_12px_rgba(44,42,40,0.03)] border border-[#E3DFD5] flex flex-col overflow-hidden transition-all duration-300 hover:border-[#D1CFC7]">
                
                {/* 點擊熱區 Header */}
                <div 
                  className="p-5 pb-3 cursor-pointer tap-highlight-transparent active:bg-[#F2EFE9]/50 transition-colors"
                  onClick={() => setExpandedRoutineId(isExpanded ? null : r.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-[14px] flex items-center justify-center border border-[#E3DFD5] bg-[#F2EFE9] shadow-sm" style={{ color: r.color }}>
                        {getIcon(r.icon)}
                      </div>
                      <div>
                        <h3 className="text-[17px] font-bold text-[#2C2A28] tracking-tight leading-tight">{r.name}</h3>
                        <p className="text-[11px] font-medium text-[#7D7973] mt-1.5 tracking-wider uppercase font-serif flex items-center gap-1.5">
                          {r.member} <span className="w-1 h-1 rounded-full bg-[#D1CFC7]"></span> 每 {r.interval} 天
                        </p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9]">
                       <ChevronDown size={18} strokeWidth={2} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#2C2A28]' : ''}`} />
                    </div>
                  </div>

                  {/* 鋼筆細線進度條 */}
                  <div className="mb-2 relative">
                    <div className="flex justify-between mb-1.5 items-center">
                      <span className="px-2.5 py-0.5 rounded-sm border text-[10px] font-bold tracking-widest bg-white" style={{ borderColor: statusColor, color: statusColor }}>
                        {statusText}
                      </span>
                    </div>
                    {/* 手帳虛線軌道 */}
                    <div className="h-[6px] w-full bg-[#E3DFD5] rounded-full overflow-hidden shadow-inner relative">
                      <div className="absolute inset-0 border-b-2 border-dashed border-[#FBF9F6] opacity-30"></div>
                      <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: statusColor }}></div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-medium text-[#7D7973] tracking-widest uppercase">
                      <span>上次: {lastLog ? lastLog.date.substring(5).replace('-','/') : '—'}</span>
                      <span>下次預計: {lastLog ? shiftDays(lastLog.date, r.interval).substring(5).replace('-','/') : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 獨立操作按鈕區 */}
                <div className="px-5 pb-5 pt-1">
                   <button 
                      onClick={(e) => { e.stopPropagation(); setLogModalRoutine(r); }} 
                      className="w-full py-3.5 bg-white border border-[#E3DFD5] hover:border-[#2C2A28] text-[#2C2A28] rounded-[14px] text-[14px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                    >
                      <PenLine size={16} strokeWidth={2} className="text-[#7D7973]" /> 紀錄本次維護
                    </button>
                </div>

                {/* 歷史紀錄抽屜 */}
                <div className={`overflow-hidden transition-all duration-400 ease-in-out bg-[#F2EFE9] border-t border-[#E3DFD5] border-dashed ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-5">
                    <h4 className="text-[11px] font-bold text-[#7D7973] tracking-widest flex items-center gap-2 mb-4 uppercase">
                      <History size={14} strokeWidth={1.5} /> 執行歷史軌跡
                    </h4>
                    
                    <div className="relative border-l border-[#D1CFC7] ml-2 space-y-4 pb-2">
                      {r.logs.map((log, idx) => (
                        <div key={log.id} className="relative pl-5">
                          {/* 時間軸節點 */}
                          <div className={`absolute -left-[5.5px] top-1.5 w-[10px] h-[10px] rounded-full border-[1.5px] border-[#F2EFE9] ${idx === 0 ? 'bg-[#2C2A28]' : 'bg-[#D1CFC7]'}`}></div>
                          
                          <div className="flex items-center gap-3">
                            <span className={`text-[13px] font-serif font-bold ${idx === 0 ? 'text-[#2C2A28]' : 'text-[#7D7973]'}`}>
                              {log.date.substring(5).replace('-', '月')}日
                            </span>
                            <span className="text-[11px] font-medium text-[#D1CFC7]">{daysSince(log.date)} 天前</span>
                          </div>
                          
                          {log.note && (
                            <div className="mt-2 text-[13px] font-medium text-[#2C2A28] bg-[#FBF9F6] px-3.5 py-2.5 rounded-xl border border-[#E3DFD5] shadow-sm inline-block">
                              {log.note}
                            </div>
                          )}
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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2A28]/50 backdrop-blur-md transition-opacity p-0 sm:p-4">
        <div className="bg-[#FBF9F6] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col pb-safe animate-in slide-in-from-bottom-8 duration-300 border border-[#E3DFD5]">
          <div className="p-6 relative">
            <button onClick={() => setLogModalRoutine(null)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] hover:bg-[#E3DFD5] transition-colors active:scale-90">
              <X size={18} strokeWidth={2}/>
            </button>

            <div className="mb-6 border-b border-[#E3DFD5] border-dashed pb-5">
              <h3 className="text-[22px] font-bold text-[#2C2A28] font-serif tracking-wide">新增紀錄</h3>
              <p className="text-[13px] font-medium text-[#7D7973] mt-1.5 tracking-wider">{routine.name}</p>
            </div>

            <div className="mb-6">
              <label className="block text-[13px] font-bold text-[#2C2A28] mb-2.5 flex items-center gap-2">
                <PenLine size={16} className="text-[#7D7973]" strokeWidth={2} /> 筆記備註 <span className="text-[#D1CFC7] font-normal tracking-wider">(選填)</span>
              </label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：更換了原廠耗材、加了半桶..."
                className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-[16px] p-4 text-[15px] font-medium text-[#2C2A28] focus:outline-none focus:border-[#7D7973] focus:bg-white transition-all resize-none h-32 placeholder:text-[#D1CFC7] shadow-inner"
              ></textarea>
            </div>

            <button 
              onClick={() => handleAddLog(routine.id, note)}
              className="w-full py-4 bg-[#2C2A28] hover:bg-black text-[#FBF9F6] rounded-[16px] text-[15px] font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 tracking-widest"
            >
              <Check size={18} strokeWidth={2.5} /> 儲存紀錄
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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2A28]/50 backdrop-blur-md transition-opacity p-2 sm:p-4">
        <div className="bg-[#FBF9F6] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col pb-safe animate-in slide-in-from-bottom-8 duration-300 border border-[#E3DFD5]">
          <div className="p-6 relative">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] hover:bg-[#E3DFD5] transition-colors active:scale-90">
              <X size={18} strokeWidth={2}/>
            </button>
            
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#2C2A28] flex items-center justify-center shadow-md">
                 <Sparkles size={16} className="text-[#FBF9F6]" strokeWidth={2} />
              </div>
              <span className="text-[20px] font-bold text-[#2C2A28] font-serif tracking-wide">AI 手札助理</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-6 tracking-widest leading-relaxed">
              寫下生活瑣事，自動蓋上時間與分類章。<br/>
            </p>

            <div className="relative">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="「明天要去超市買鮮奶，爸爸負責」"
                className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-[20px] p-5 pb-16 text-[16px] font-medium text-[#2C2A28] placeholder:text-[#D1CFC7] focus:outline-none focus:border-[#7D7973] focus:bg-white transition-all resize-none h-40 shadow-inner"
              ></textarea>
              
              <button 
                onClick={() => { if(input.trim()) handleAiSubmit(input); }}
                disabled={!input.trim()}
                className="absolute right-3 bottom-3 bg-[#2C2A28] disabled:bg-[#E3DFD5] disabled:text-[#7D7973] text-[#FBF9F6] py-2.5 px-6 rounded-full shadow-md flex items-center gap-2 text-[14px] font-bold transition-all hover:scale-105 active:scale-95 disabled:scale-100 tracking-widest"
              >
                寫入
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 🌟 全新 UI 元件：成員管理面板 (Member Modal) ---
  const MemberModal = () => {
    const [nameInput, setNameInput] = useState('');
    const [roleInput, setRoleInput] = useState('');
    if (!isMemberModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2A28]/50 backdrop-blur-md transition-opacity p-2 sm:p-4">
        <div className="bg-[#FBF9F6] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col pb-safe animate-in slide-in-from-bottom-8 duration-300 border border-[#E3DFD5]">
          <div className="p-6 relative max-h-[80vh] flex flex-col">
            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] hover:bg-[#E3DFD5] transition-colors active:scale-90">
              <X size={18} strokeWidth={2}/>
            </button>
            
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#566B56] flex items-center justify-center shadow-md">
                 <Users size={16} className="text-[#FBF9F6]" strokeWidth={2} />
              </div>
              <span className="text-[20px] font-bold text-[#2C2A28] font-serif tracking-wide">動態成員設定</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-6 tracking-widest leading-relaxed border-b border-[#E3DFD5] border-dashed pb-5">
              在此自定義家人的暱稱與角色定位。設定完成後，這些角色將連動至系統供指派與提醒使用。
            </p>

            {/* 成員列表展示 */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
              {members.length === 0 ? (
                <div className="text-center py-6 text-[#D1CFC7] text-[13px] font-medium border border-dashed border-[#E3DFD5] rounded-[20px]">尚無建立任何角色</div>
              ) : (
                members.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-3.5 bg-[#F2EFE9] rounded-[16px] border border-[#E3DFD5]">
                    <span className="text-[15px] font-bold text-[#2C2A28]">{m.name}</span>
                    <span className="text-[11px] font-medium text-[#566B56] bg-[#FBF9F6] px-2 py-1 rounded-md border border-[#E3DFD5] tracking-widest">{m.role_name}</span>
                  </div>
                ))
              )}
            </div>

            {/* 新增成員表單 */}
            <div className="bg-[#F2EFE9] p-4 rounded-[20px] border border-[#E3DFD5] space-y-3 shadow-inner">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">系統名稱</label>
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例：林老杯" className="w-full bg-[#FBF9F6] border border-[#E3DFD5] rounded-[14px] px-3 py-2.5 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#566B56] shadow-sm placeholder:text-[#D1CFC7]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">角色稱謂</label>
                  <input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} placeholder="例：室友/爸爸" className="w-full bg-[#FBF9F6] border border-[#E3DFD5] rounded-[14px] px-3 py-2.5 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#566B56] shadow-sm placeholder:text-[#D1CFC7]" />
                </div>
              </div>
              <button 
                onClick={() => { handleAddMember(nameInput, roleInput); setNameInput(''); setRoleInput(''); }}
                disabled={!nameInput.trim() || !roleInput.trim()}
                className="w-full mt-2 bg-[#2C2A28] disabled:bg-[#E3DFD5] disabled:text-[#7D7973] text-[#FBF9F6] py-3 rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-bold transition-all active:scale-[0.98] shadow-md tracking-widest"
              >
                <UserPlus size={16} /> 新增角色
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 根佈局 ---
  return (
    <div className={`min-h-screen bg-[#DFDCD4] font-sans flex justify-center selection:bg-[#E3DFD5] ${hideScrollbar}`}>
      {/* App Container - 模擬實體筆記本比例 */}
      <div className="w-full max-w-[480px] h-dvh bg-[#F2EFE9] relative flex flex-col overflow-hidden sm:border-x border-[#D1CFC7] sm:rounded-[40px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-[0_20px_60px_rgba(44,42,40,0.1)]">
        
        {/* 右側經典手帳綁帶 (Elastic Band Accent) */}
        <div className="absolute top-0 bottom-0 right-[6px] w-[2.5px] bg-[#2C2A28]/10 z-0 pointer-events-none border-l border-[#FBF9F6]/50"></div>

        {/* Header */}
        <header className="flex-none pt-12 pb-3 px-6 flex justify-between items-center z-30 bg-[#F2EFE9]/95 backdrop-blur-xl border-b border-[#E3DFD5] sticky top-0">
          <div>
            <h1 className="text-[24px] font-bold tracking-wider text-[#2C2A28] font-serif">Family Hub</h1>
            <p className="text-[9px] text-[#7D7973] tracking-[0.3em] uppercase mt-1">Traveler's Logbook</p>
          </div>
          {/* 右上角工具列 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border-2 border-[#566B56]/70 bg-[#FBF9F6]/50 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-[#566B56] uppercase tracking-widest opacity-90">LINE Sync</span>
            </div>
            {/* 👈 新增：觸發成員管理面板的按鈕 */}
            <button onClick={() => setIsMemberModalOpen(true)} className="w-8 h-8 bg-[#FBF9F6] border-2 border-[#E3DFD5] rounded-full flex items-center justify-center text-[#2C2A28] shadow-sm hover:bg-[#F2EFE9] active:scale-90 transition-all">
              <Users size={16} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        {/* 主內容區 */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth ${hideScrollbar}`}>
          {activeTab === 'board' ? <BoardView /> : <RoutinesView />}
        </main>

        {/* 懸浮按鈕 FAB (質感皮釦鈕) */}
        <button 
          onClick={() => setIsAiModalOpen(true)}
          className="absolute bottom-[112px] right-6 w-14 h-14 rounded-full flex items-center justify-center z-40 transition-transform active:scale-90 hover:scale-105 shadow-[0_8px_20px_rgba(44,42,40,0.3)] bg-[#2C2A28] text-[#FBF9F6] border-2 border-[#FBF9F6]/10"
        >
          <Sparkles size={22} strokeWidth={1.5} />
        </button>

        <AiModal />
        <RoutineLogModal />
        <MemberModal /> {/* 👈 渲染成員管理面板 */}

        {/* 通知 Toast */}
        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#2C2A28]/95 backdrop-blur-md text-[#FBF9F6] text-[13px] font-bold tracking-widest px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-[#7D7973]/30">
            <Check size={18} className="text-[#E3DFD5]" strokeWidth={2.5} />
            {toast}
          </div>
        )}

        {/* Bottom Tab Bar (高質感實體書籤底座) */}
        <nav className="absolute bottom-0 left-0 w-full h-[90px] bg-[#FBF9F6]/95 backdrop-blur-2xl border-t border-[#E3DFD5] z-30 flex justify-around items-start pt-3 pb-safe px-2 shadow-[0_-10px_30px_rgba(44,42,40,0.03)]">
          <button 
            onClick={() => setActiveTab('board')} 
            className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'board' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7] hover:text-[#7D7973]'}`}
          >
            <CalendarDays size={24} strokeWidth={activeTab === 'board' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">手札看板</span>
            {activeTab === 'board' && <div className="w-1.5 h-1.5 rounded-full bg-[#A84C3D] shadow-sm"></div>}
          </button>
          
          <button 
            onClick={() => setActiveTab('routines')} 
            className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'routines' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7] hover:text-[#7D7973]'}`}
          >
            <RotateCw size={24} strokeWidth={activeTab === 'routines' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">週期維護</span>
            {activeTab === 'routines' && <div className="w-1.5 h-1.5 rounded-full bg-[#A84C3D] shadow-sm"></div>}
          </button>
        </nav>

      </div>
    </div>
  );
}
