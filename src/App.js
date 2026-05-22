import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, RotateCw, Plus, ChevronLeft, ChevronRight, Check, Droplets,
  Wind, Leaf, Car, Sparkles, Bell, X, Activity, ShoppingCart, HeartPulse,
  Smile, AlertCircle, ChevronDown, History, PenLine, Users, UserPlus, Trash2
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

// 🎨 系統色調 (保留目前配色，待最後階段統整)
const PALETTE = {
  paper: '#F2EFE9', card: '#FBF9F6', ink: '#2C2A28', inkMuted: '#7D7973', border: '#E3DFD5', accent: '#A84C3D',
  todo: '#425C73', shop: '#566B56', remind: '#B87A45', health: '#A84C3D', mood: '#6D607D',
};

const TYPE_CONFIG = {
  todo: { label: '待辦', color: PALETTE.todo, icon: Activity },
  shop: { label: '採買', color: PALETTE.shop, icon: ShoppingCart },
  remind: { label: '提醒', color: PALETTE.remind, icon: AlertCircle },
  health: { label: '健康', color: PALETTE.health, icon: HeartPulse },
  mood: { label: '心情', color: PALETTE.mood, icon: Smile },
  routine: { label: '週期', color: PALETTE.inkMuted, icon: RotateCw },
};

const HOLIDAYS = { '2026-05-01':'勞動節', '2026-06-19':'端午節', '2026-09-25':'中秋節', '2026-10-10':'國慶日' };
const MOOD_MAP = { '開心':'😊', '快樂':'😄', '累':'😴', '煩':'😤', '難過':'😢', '期待':'🥰', '放鬆':'😌', '不錯':'🙂' };

const hideScrollbar = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']";

export default function FamilyHub() {
  const [activeTab, setActiveTab] = useState('board');
  const [events, setEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  
  // 彈窗控制
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [logModalRoutine, setLogModalRoutine] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
    async function fetchSupabaseData() {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .gte('date', '2026-05-22')
        .order('date', { ascending: true });

      if (eventsData) setEvents(eventsData);

      const { data: routinesData } = await supabase
        .from('routines')
        .select('*')
        .gte('created_at', '2026-05-22T00:00:00Z');

      const { data: logsData } = await supabase
        .from('routine_logs')
        .select('*');

      if (routinesData) {
        setRoutines(
          routinesData.map(r => {
            const myLogs = logsData
              ? logsData.filter(log => log.routine_name === r.name)
              : [];

            return {
              ...r,
              icon: r.icon || 'activity',
              color: r.color || '#425C73',
              logs: myLogs
                .map(l => ({
                  id: l.id,
                  date: l.last_done_at,
                  note: l.note,
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date)),
            };
          })
        );
      }

      const { data: membersData } = await supabase
        .from('members')
        .select('*');

      if (membersData) setMembers(membersData);
    }

    async function initLiff() {
      try {
        if (!window.liff) {
          console.warn('LIFF SDK 尚未載入');
          return;
        }

        await window.liff.init({ liffId: '2010165775-xmYZj7n4' });

        if (!window.liff.isLoggedIn()) {
          window.liff.login();
        } else {
          const profile = await window.liff.getProfile();
          console.log('當前使用者 LINE ID:', profile.userId);
        }
      } catch (err) {
        console.error('LIFF 初始化失敗:', err);
      }
    }

    fetchSupabaseData();
    initLiff();
  }, []);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // --- API 寫入操作 ---
  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const { data, error } = await supabase.from('members').insert([{ name, role_name: role }]).select();
    if (!error && data) { setMembers(prev => [...prev, data[0]]); showToast('✅ 角色已成功建立'); }
  };

  const handleAiSubmit = async (text) => {
    let type = 'todo', member = '全家', date = fmtDate(TODAY), mood = null;
    const lower = text.toLowerCase();
    for (const [word, emoji] of Object.entries(MOOD_MAP)) { if (lower.includes(word)) { type = 'mood'; mood = emoji; break; } }
    if (type !== 'mood') {
      if (/買|採買|超市/.test(lower)) type = 'shop';
      else if (/醫|看診|回診|健康/.test(lower)) type = 'health';
      else if (/提醒|記得|截止|到期/.test(lower)) type = 'remind';
    }
    
    // 動態比對成員名單
    for (const m of members) {
      if (lower.includes(m.name.toLowerCase()) || lower.includes(m.role_name.toLowerCase())) { member = m.name; break; }
    }

    if (/明天/.test(lower)) date = shiftDays(TODAY, 1);
    else if (/後天/.test(lower)) date = shiftDays(TODAY, 2);

    const { data, error } = await supabase.from('events').insert([{ date, type, text, member, mood }]).select();
    if (!error && data) {
      setEvents(prev => [...prev, data[0]].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setSelectedDate(date);
      setIsAiModalOpen(false);
      showToast('已安全存入手札');
    }
  };

  const handleAddLog = async (routineId, routineName, noteText) => {
    const { data, error } = await supabase.from('routine_logs').insert([{ routine_name: routineName, note: noteText, last_done_at: fmtDate(TODAY) }]).select();
    if (!error && data) {
      setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, logs: [{ id: data[0].id, date: data[0].last_done_at, note: data[0].note }, ...r.logs] } : r));
      setLogModalRoutine(null);
      showToast('歷史紀錄已更新');
    }
  };

  const handleUpdateEvent = async (updatedEvent) => {
    const { error } = await supabase.from('events').update(updatedEvent).eq('id', updatedEvent.id);
    if (!error) { setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e)); setEditingEvent(null); showToast('手札已更新'); }
  };

  const handleDeleteEvent = async (eventId) => {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (!error) { setEvents(prev => prev.filter(e => e.id !== eventId)); setEditingEvent(null); showToast('手札已刪除'); }
  };

  const handleNotify = (e) => {
    e.stopPropagation();
    showToast('已發送推播請求至 LINE');
  };

  // --- UI 元件：手札看板 ---
  const BoardView = () => {
    const calendarDays = useMemo(() => {
      const days = [];
      const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
      const firstDay = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < firstDay; i++) days.push({ type: "empty", id: `empty-${i}` });
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = fmtDate(new Date(y, m, i));
        days.push({ type: "day", date: dateStr, dayNum: i, events: events.filter(e => e.date === dateStr), isSun: new Date(y, m, i).getDay() === 0, holiday: HOLIDAYS[dateStr] || null });
      }
      return days;
    }, [currentMonth, events]);

    const dayEvents = events.filter(e => e.date === selectedDate && (filter === 'all' || e.type === filter));
    const isTodaySelected = selectedDate === fmtDate(TODAY);
    const monthEvents = events.filter(e => e.date.startsWith(fmtDate(currentMonth).substring(0, 7)));
    const stats = { todo: 0, shop: 0, remind: 0, health: 0, mood: 0 };
    monthEvents.forEach(e => { if(stats[e.type]!==undefined) stats[e.type]++; });

    const [animKey, setAnimKey] = useState(Date.now());
    const handleDayClick = (date) => { setSelectedDate(date); setAnimKey(Date.now()); };

    return (
      <div className="flex flex-col pb-32 pt-2 relative">
        <div className="px-5 space-y-4">
          
          {/* 月曆儀表板區塊維持原樣 */}
          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-[20px] p-4 shadow-[0_2px_8px_rgba(44,42,40,0.02)] relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 relative z-10">
              <h2 className="text-[22px] font-bold text-[#2C2A28] font-serif tracking-wide leading-none m-0">
                {currentMonth.getMonth() + 1}月 <span className="text-[14px] font-sans font-medium text-[#7D7973] ml-1">{currentMonth.getFullYear()}</span>
              </h2>
              <div className="flex gap-1.5">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-xl text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all flex items-center justify-center"><ChevronLeft size={16} strokeWidth={2}/></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-xl text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all flex items-center justify-center"><ChevronRight size={16} strokeWidth={2}/></button>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-[#E3DFD5] border-dashed relative z-10">
              {Object.keys(TYPE_CONFIG).map(type => (
                <div key={type} className="flex flex-col items-center justify-center py-2 rounded-xl hover:bg-[#F2EFE9] cursor-pointer transition-colors active:bg-[#E3DFD5]" onClick={() => setFilter(type)}>
                  <span className="text-[18px] font-bold font-serif leading-none" style={{ color: stats[type] > 0 ? TYPE_CONFIG[type].color : '#D1CFC7' }}>{stats[type]}</span>
                  <span className="text-[10px] font-medium text-[#7D7973] mt-1.5 leading-none">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 月曆 Grid */}
          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-[20px] p-4 shadow-[0_2px_8px_rgba(44,42,40,0.02)]">
            <div className="grid grid-cols-7 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={`text-center text-[10px] font-bold tracking-widest ${i===0 ? 'text-[#A84C3D]' : 'text-[#7D7973]'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {calendarDays.map((day) => {
                if (day.type === 'empty') return <div key={day.id} />;
                const isSelected = selectedDate === day.date;
                const isToday = day.date === fmtDate(TODAY);
                const hasEvents = day.events.length > 0;
                
                return (
                  <div key={day.date} onClick={() => handleDayClick(day.date)} className="relative flex flex-col items-center justify-center cursor-pointer group h-[42px] tap-highlight-transparent">
                    <div className={`absolute inset-0 rounded-xl transition-all duration-200 ${isSelected ? 'bg-[#2C2A28] scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:bg-[#E3DFD5]/40 group-hover:scale-100 group-hover:opacity-100 group-active:bg-[#E3DFD5]'}`}></div>
                    <div className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full text-[15px] font-medium font-serif transition-colors duration-200 ${isSelected ? 'text-[#FBF9F6]' : ''} ${!isSelected && isToday ? 'border-[1.5px] border-[#2C2A28] text-[#2C2A28] font-bold' : ''} ${!isSelected && !isToday ? (day.isSun ? 'text-[#A84C3D]' : 'text-[#2C2A28]') : ''}`}>
                      {day.dayNum}
                    </div>
                    {hasEvents && (
                      <div className="relative z-10 absolute bottom-0 flex gap-0.5 items-center mt-[2px]">
                        {day.events.slice(0, 3).map((e, idx) => <span key={idx} className="w-[3.5px] h-[3.5px] rounded-full transition-colors" style={{ backgroundColor: isSelected ? '#FBF9F6' : TYPE_CONFIG[e.type].color }}></span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 標籤過濾區 */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#F2EFE9] to-[#F2EFE9]/95 backdrop-blur-md pt-5 pb-3 px-5 mt-1 border-b border-[#E3DFD5]/50">
          <div className={`flex gap-3 overflow-x-auto snap-x ${hideScrollbar}`}>
            <button onClick={() => setFilter('all')} className={`snap-start whitespace-nowrap px-4 py-1.5 text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center rounded-sm ${filter === 'all' ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-md' : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm hover:-translate-y-0.5'}`}>
              所有紀錄
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <button key={key} onClick={() => setFilter(key)} className={`snap-start whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95 rounded-sm ${filter === key ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-md' : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm hover:-translate-y-0.5'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filter === key ? '#FBF9F6' : config.color }}></span>
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* 每日手札列表 - 空格與對齊全面修復 */}
        <div className="px-5 mt-2 relative min-h-[350px]" style={{ backgroundImage: 'radial-gradient(#E3DFD5 1.5px, transparent 1.5px)', backgroundSize: '16px 16px', backgroundPosition: '-8px -8px' }}>
          <div id="daily-logs-header" className="flex items-center justify-between py-3 mb-2 bg-[#F2EFE9]/90 backdrop-blur-md -mx-5 px-5 sticky top-[60px] z-10 border-b border-[#E3DFD5]/40">
            <h3 className="text-[17px] font-bold text-[#2C2A28] tracking-wide flex items-baseline gap-2">
              <span className="font-serif text-[22px] leading-none">{new Date(selectedDate).getDate()}</span> <span className="leading-none">日</span>
              {isTodaySelected && <span className="text-[10px] text-[#A84C3D] border-[1.5px] border-[#A84C3D]/60 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-bold ml-1 opacity-90 transform -translate-y-[1px]">Today</span>}
            </h3>
          </div>

          <div key={animKey} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out pb-6">
            {dayEvents.length === 0 ? (
              <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-sm mt-4">
                <Leaf size={28} strokeWidth={1.5} className="text-[#D1CFC7] mb-3" />
                <p className="text-[#7D7973] text-[14px] tracking-widest font-medium m-0">這天沒有任務排程</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[20px] top-6 bottom-4 w-[1.5px] bg-[#E3DFD5] border-l border-dashed border-[#D1CFC7]"></div>
                <div className="space-y-4 relative mt-2">
                  {dayEvents.map((e) => {
                    const TypeIcon = TYPE_CONFIG[e.type].icon;
                    return (
                      <div key={e.id} className="relative pl-12 pr-1 group cursor-pointer tap-highlight-transparent" onClick={() => setEditingEvent(e)}>
                        {/* 左側節點完美對齊 */}
                        <div className="absolute left-[8px] top-3.5 w-[26px] h-[26px] rounded-full bg-[#FBF9F6] border-2 border-[#E3DFD5] flex items-center justify-center shadow-sm z-10" style={{ color: TYPE_CONFIG[e.type].color }}>
                          {e.type === 'mood' ? <span className="text-[12px] leading-none mb-[1px]">{e.mood}</span> : <TypeIcon size={12} strokeWidth={2.5} />}
                        </div>
                        
                        {/* 內容卡片 */}
                        <div className="bg-[#FBF9F6]/95 backdrop-blur-sm p-4 rounded-[16px] border border-[#E3DFD5] shadow-sm flex flex-col gap-2.5 active:bg-[#F2EFE9] active:scale-[0.99] transition-all">
                          {/* 頂部標籤與鈴鐺 */}
                          <div className="flex justify-between items-center h-5">
                            <span className="text-[11px] font-bold tracking-widest uppercase leading-none" style={{ color: TYPE_CONFIG[e.type].color }}>{TYPE_CONFIG[e.type].label}</span>
                            <button onClick={handleNotify} className="text-[#D1CFC7] hover:text-[#2C2A28] bg-[#F2EFE9] w-7 h-7 flex items-center justify-center rounded-full transition-colors active:bg-[#E3DFD5] m-0 p-0"><Bell size={13} strokeWidth={2.5} /></button>
                          </div>
                          {/* 內文 */}
                          <div className="text-[15px] font-medium text-[#2C2A28] leading-snug m-0">
                            {e.text}
                          </div>
                          {/* 底部負責人 (微圓角、純正面字體) */}
                          <div className="flex items-center pt-2.5 border-t border-[#E3DFD5]/60 border-dashed m-0">
                            <span className="text-[11px] text-[#7D7973] flex items-center gap-1.5 bg-[#F2EFE9] px-2 py-1 rounded-md leading-none">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#A84C3D]"></div>
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

  const RoutinesView = () => {
    return (
      <div className="px-5 pb-32 pt-2 animate-in fade-in duration-300">
        <h2 className="text-[22px] font-bold text-[#2C2A28] tracking-wide font-serif mb-6 px-1">週期事務追蹤</h2>
        <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-sm mt-2">
          <Activity size={28} strokeWidth={1.5} className="text-[#D1CFC7] mb-3" />
          <p className="text-[#7D7973] text-[14px] tracking-widest font-medium m-0">目前沒有週期事務</p>
        </div>
      </div>
    );
  };

  // --- 重構為原生 APP 底部抽屜 (Native Bottom Sheets) ---
  
  // 1. 手札編輯/刪除抽屜
  const EventEditModal = () => {
    if (!editingEvent) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-[32px] rounded-b-none shadow-2xl flex flex-col pb-safe animate-in slide-in-from-bottom-full duration-300">
          <div className="p-6 relative">
            <button onClick={() => setEditingEvent(null)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <h3 className="text-[20px] font-bold text-[#2C2A28] font-serif tracking-wide mb-5 border-b border-[#E3DFD5] border-dashed pb-4">手札內容管理</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">事項內容</label>
                <textarea value={editingEvent.text} onChange={e => setEditingEvent({...editingEvent, text: e.target.value})} className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-xl p-3.5 text-[15px] font-medium text-[#2C2A28] focus:outline-none focus:border-[#7D7973] resize-none h-24" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">日期</label>
                  <input type="date" value={editingEvent.date} onChange={e => setEditingEvent({...editingEvent, date: e.target.value})} className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-xl p-3.5 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#7D7973]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">負責人</label>
                  <select value={editingEvent.member} onChange={e => setEditingEvent({...editingEvent, member: e.target.value})} className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-xl p-3.5 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#7D7973] appearance-none">
                    <option value="全家">全家</option>
                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mb-2">
              <button onClick={() => handleDeleteEvent(editingEvent.id)} className="w-14 h-[52px] bg-[#F2EFE9] text-[#A84C3D] rounded-xl font-bold flex items-center justify-center active:bg-[#E3DFD5] transition-colors"><Trash2 size={20} strokeWidth={2} /></button>
              <button onClick={() => handleUpdateEvent(editingEvent)} className="flex-1 h-[52px] bg-[#2C2A28] text-[#FBF9F6] rounded-xl text-[15px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center tracking-widest">儲存變更</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. AI 智慧輸入抽屜
  const AiModal = () => {
    const [input, setInput] = useState('');
    if (!isAiModalOpen) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-[32px] rounded-b-none shadow-2xl flex flex-col pb-safe animate-in slide-in-from-bottom-full duration-300">
          <div className="p-6 relative">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#2C2A28] flex items-center justify-center shadow-md"><Sparkles size={16} className="text-[#FBF9F6]" strokeWidth={2} /></div>
              <span className="text-[20px] font-bold text-[#2C2A28] font-serif tracking-wide">AI 手札助理</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-6 tracking-widest leading-relaxed">寫下生活瑣事，自動蓋上時間與分類章。</p>
            <div className="relative mb-2">
              <textarea autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="「明天要去超市買鮮奶，爸爸負責」" className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-2xl p-5 pb-16 text-[16px] font-medium text-[#2C2A28] placeholder:text-[#D1CFC7] focus:outline-none focus:border-[#7D7973] resize-none h-40"></textarea>
              <button onClick={() => { if(input.trim()) handleAiSubmit(input); }} disabled={!input.trim()} className="absolute right-3 bottom-3 bg-[#2C2A28] disabled:bg-[#E3DFD5] disabled:text-[#7D7973] text-[#FBF9F6] py-2.5 px-6 rounded-full shadow-md flex items-center gap-2 text-[14px] font-bold transition-all active:scale-95 disabled:scale-100 tracking-widest">寫入</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. 動態成員設定抽屜
  const MemberModal = () => {
    const [nameInput, setNameInput] = useState('');
    const [roleInput, setRoleInput] = useState('');
    if (!isMemberModalOpen) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-[32px] rounded-b-none shadow-2xl flex flex-col pb-safe max-h-[85vh] animate-in slide-in-from-bottom-full duration-300">
          <div className="p-6 relative flex flex-col h-full">
            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#566B56] flex items-center justify-center shadow-md"><Users size={16} className="text-[#FBF9F6]" strokeWidth={2} /></div>
              <span className="text-[20px] font-bold text-[#2C2A28] font-serif tracking-wide">群體角色設定</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-5 tracking-widest leading-relaxed border-b border-[#E3DFD5] border-dashed pb-4">建立專屬稱謂，以便 AI 準確分派任務。</p>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 mb-5">
              {members.length === 0 ? (
                <div className="text-center py-6 text-[#D1CFC7] text-[13px] font-medium border border-dashed border-[#E3DFD5] rounded-xl">尚無建立任何角色</div>
              ) : (
                members.map(m => (
  <div key={m.id} className="flex justify-between items-center p-3.5 bg-[#F2EFE9] rounded-[16px] border border-[#E3DFD5]">
    <div>
      <span className="block text-[15px] font-bold text-[#2C2A28]">{m.name}</span>
      <span className="text-[11px] font-medium text-[#566B56]">{m.role_name}</span>
    </div>
    
    <button 
      onClick={async () => {
        try {
          const profile = await window.liff.getProfile();
          await supabase.from("members").update({ line_user_id: profile.userId }).eq("id", m.id);
          alert(`✅ 綁定成功！您現在是：${m.name}`);
        } catch (err) {
          alert("綁定失敗，請確保在 LINE 內開啟");
        }
      }}
      className="text-[11px] bg-[#2C2A28] text-white px-3 py-1.5 rounded-lg active:scale-95"
    >
      綁定我
    </button>
  </div>
))
              )}
            </div>
            
            <div className="bg-[#F2EFE9] p-4 rounded-2xl border border-[#E3DFD5] space-y-3 mb-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">名字/暱稱</label>
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例：林老杯" className="w-full bg-[#FBF9F6] border border-[#E3DFD5] rounded-xl px-3.5 py-3 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#566B56]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#7D7973] mb-1.5 uppercase tracking-widest">擔任身分</label>
                  <input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} placeholder="例：採買總監" className="w-full bg-[#FBF9F6] border border-[#E3DFD5] rounded-xl px-3.5 py-3 text-[14px] text-[#2C2A28] focus:outline-none focus:border-[#566B56]" />
                </div>
              </div>
              <button onClick={() => { handleAddMember(nameInput, roleInput); setNameInput(''); setRoleInput(''); }} disabled={!nameInput.trim() || !roleInput.trim()} className="w-full h-[48px] bg-[#2C2A28] disabled:bg-[#E3DFD5] disabled:text-[#7D7973] text-[#FBF9F6] rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[0.98] transition-transform tracking-widest"><UserPlus size={16} /> 新增角色</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 根佈局 ---
  return (
    <div className={`min-h-screen bg-[#DFDCD4] font-sans flex justify-center selection:bg-[#E3DFD5] ${hideScrollbar}`}>
      <div className="w-full max-w-[480px] h-dvh bg-[#F2EFE9] relative flex flex-col overflow-hidden sm:border-x border-[#D1CFC7] sm:rounded-[40px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-[0_20px_60px_rgba(44,42,40,0.1)]">
        
        {/* Header 標題改為共生公會 */}
        <header className="flex-none pt-12 pb-3 px-6 flex justify-between items-center z-30 bg-[#F2EFE9]/95 backdrop-blur-xl border-b border-[#E3DFD5] sticky top-0">
          <div>
            <h1 className="text-[24px] font-bold tracking-wider text-[#2C2A28] font-serif">Family Hub</h1>
            <p className="text-[9px] text-[#7D7973] tracking-[0.3em] uppercase mt-1">共生公會 (Co-op Guild)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border-2 border-[#566B56]/70 bg-[#FBF9F6]/50">
              <span className="text-[9px] font-bold text-[#566B56] uppercase tracking-widest opacity-90">LINE Sync</span>
            </div>
            <button onClick={() => setIsMemberModalOpen(true)} className="w-9 h-9 bg-[#FBF9F6] border-2 border-[#E3DFD5] rounded-full flex items-center justify-center text-[#2C2A28] shadow-sm active:bg-[#E3DFD5] transition-colors"><Users size={16} strokeWidth={2.5} /></button>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth ${hideScrollbar}`}>
          {activeTab === 'board' ? <BoardView /> : <RoutinesView />}
        </main>

        <button onClick={() => setIsAiModalOpen(true)} className="absolute bottom-[112px] right-6 w-14 h-14 rounded-full flex items-center justify-center z-20 active:scale-90 hover:scale-105 shadow-lg bg-[#2C2A28] text-[#FBF9F6] transition-transform">
          <Sparkles size={22} strokeWidth={1.5} />
        </button>

        {/* 所有的 Native Bottom Sheets */}
        <AiModal />
        <MemberModal />
        <EventEditModal />

        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#2C2A28]/95 backdrop-blur-md text-[#FBF9F6] text-[13px] font-bold tracking-widest px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <Check size={18} className="text-[#E3DFD5]" strokeWidth={2.5} />
            {toast}
          </div>
        )}

        {/* Bottom Tab Bar */}
        <nav className="absolute bottom-0 left-0 w-full h-[90px] bg-[#FBF9F6]/95 backdrop-blur-2xl border-t border-[#E3DFD5] z-10 flex justify-around items-start pt-3 pb-safe px-2">
          <button onClick={() => setActiveTab('board')} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'board' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7]'}`}>
            <CalendarDays size={24} strokeWidth={activeTab === 'board' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">任務看板</span>
            {activeTab === 'board' && <div className="w-1.5 h-1.5 rounded-full bg-[#A84C3D]"></div>}
          </button>
          <button onClick={() => setActiveTab('routines')} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'routines' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7]'}`}>
            <RotateCw size={24} strokeWidth={activeTab === 'routines' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">週期事務</span>
            {activeTab === 'routines' && <div className="w-1.5 h-1.5 rounded-full bg-[#A84C3D]"></div>}
          </button>
        </nav>
      </div>
    </div>
  );
}
