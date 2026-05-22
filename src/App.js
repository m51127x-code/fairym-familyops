import React, { useState, useMemo, useEffect } from 'react';
import liff from '@line/liff';
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
  
  // 🌟 新增：集中管理目前的 LINE 用戶 ID，避免按鈕點擊時讀取不到
  const [currentUserLineId, setCurrentUserLineId] = useState(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    async function fetchSupabaseData() {
      const { data: eventsData } = await supabase.from('events').select('*').gte('date', '2026-05-22').order('date', { ascending: true });
      if (eventsData) setEvents(eventsData);

      const { data: routinesData } = await supabase.from('routines').select('*').gte('created_at', '2026-05-22T00:00:00Z');
      const { data: logsData } = await supabase.from('routine_logs').select('*');
      
      if (routinesData) {
        setRoutines(
          routinesData.map(r => {
            const myLogs = logsData ? logsData.filter(log => log.routine_name === r.name) : [];
            return {
              ...r,
              icon: r.icon || 'activity', color: r.color || '#425C73',
              logs: myLogs.map(l => ({ id: l.id, date: l.last_done_at, note: l.note })).sort((a, b) => new Date(b.date) - new Date(a.date)),
            };
          })
        );
      }

      const { data: membersData } = await supabase.from('members').select('*');
      if (membersData) setMembers(membersData);
    }

    async function initLiff() {
      try {
        await liff.init({ liffId: '2010165775-xmYZj7n4' });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const profile = await liff.getProfile();
          setCurrentUserLineId(profile.userId);
          console.log('當前使用者 LINE ID 已就緒:', profile.userId);
        }
      } catch (err) {
        console.error('LIFF 初始化失敗:', err);
      }
    }

    fetchSupabaseData();
    initLiff();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // --- API 操作 ---
  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const { data, error } = await supabase.from('members').insert([{ name, role_name: role }]).select();
    if (!error && data) { setMembers(prev => [...prev, data[0]]); showToast('✅ 角色已成功建立'); }
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm('確定要移除此角色嗎？')) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (!error) {
        setMembers(prev => prev.filter(m => m.id !== id));
        showToast('🗑️ 角色已移除');
      }
    }
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

  const handleUpdateEvent = async (updatedEvent) => {
    const { error } = await supabase.from('events').update(updatedEvent).eq('id', updatedEvent.id);
    if (!error) { setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e)); setEditingEvent(null); showToast('手札已更新'); }
  };

  const handleDeleteEvent = async (eventId) => {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (!error) { setEvents(prev => prev.filter(e => e.id !== eventId)); setEditingEvent(null); showToast('手札已刪除'); }
  };

  const handleNotify = (e) => { e.stopPropagation(); showToast('已發送推播請求至 LINE'); };

  // --- UI 元件：看板 ---
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
          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 relative z-10">
              <h2 className="text-[22px] font-bold text-[#2C2A28] leading-none m-0">
                {currentMonth.getMonth() + 1}月 <span className="text-[14px] font-medium text-[#7D7973] ml-1">{currentMonth.getFullYear()}</span>
              </h2>
              <div className="flex gap-1.5">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-lg text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all flex items-center justify-center"><ChevronLeft size={16} strokeWidth={2}/></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 border border-[#E3DFD5] rounded-lg text-[#7D7973] hover:bg-[#F2EFE9] active:scale-90 transition-all flex items-center justify-center"><ChevronRight size={16} strokeWidth={2}/></button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-[#E3DFD5] border-dashed relative z-10">
              {Object.keys(TYPE_CONFIG).map(type => (
                <div key={type} className="flex flex-col items-center justify-center py-2 rounded-lg hover:bg-[#F2EFE9] cursor-pointer transition-colors active:bg-[#E3DFD5]" onClick={() => setFilter(type)}>
                  <span className="text-[18px] font-bold leading-none" style={{ color: stats[type] > 0 ? TYPE_CONFIG[type].color : '#D1CFC7' }}>{stats[type]}</span>
                  <span className="text-[10px] font-medium text-[#7D7973] mt-1.5 leading-none">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FBF9F6] border border-[#E3DFD5] rounded-xl p-4 shadow-sm">
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
                    <div className={`absolute inset-0 rounded-lg transition-all duration-200 ${isSelected ? 'bg-[#2C2A28] scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:bg-[#E3DFD5]/40 group-hover:scale-100 group-hover:opacity-100 group-active:bg-[#E3DFD5]'}`}></div>
                    <div className={`relative z-10 w-8 h-8 flex items-center justify-center text-[15px] font-medium transition-colors duration-200 ${isSelected ? 'text-[#FBF9F6]' : ''} ${!isSelected && isToday ? 'border-[1.5px] border-[#2C2A28] rounded-md text-[#2C2A28] font-bold' : ''} ${!isSelected && !isToday ? (day.isSun ? 'text-[#A84C3D]' : 'text-[#2C2A28]') : ''}`}>
                      {day.dayNum}
                    </div>
                    {hasEvents && (
                      <div className="relative z-10 absolute bottom-0 flex gap-0.5 items-center mt-[2px]">
                        {day.events.slice(0, 3).map((e, idx) => <span key={idx} className="w-[3.5px] h-[3.5px] rounded-md transition-colors" style={{ backgroundColor: isSelected ? '#FBF9F6' : TYPE_CONFIG[e.type].color }}></span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#F2EFE9] to-[#F2EFE9]/95 backdrop-blur-md pt-5 pb-3 px-5 mt-1 border-b border-[#E3DFD5]/50">
          <div className={`flex gap-3 overflow-x-auto snap-x ${hideScrollbar}`}>
            <button onClick={() => setFilter('all')} className={`snap-start whitespace-nowrap px-4 py-1.5 text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center rounded-md ${filter === 'all' ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-sm' :
