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
  const [lineUsers, setLineUsers] = useState([]); 
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHideListOpen, setIsHideListOpen] = useState(false); 
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentUserLineId, setCurrentUserLineId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); 

  const unboundLineUsers = useMemo(() => {
    const unbound = lineUsers.filter(lu => !lu.is_ignored && !members.some(m => m.line_user_id === lu.user_id));
    const uniqueUnbound = [];
    const seenIds = new Set();
    for (const user of unbound) {
      if (!seenIds.has(user.user_id)) {
        seenIds.add(user.user_id);
        uniqueUnbound.push(user);
      }
    }
    return uniqueUnbound;
  }, [lineUsers, members]);

  const ignoredLineUsers = useMemo(() => {
    const ignored = lineUsers.filter(lu => lu.is_ignored && !members.some(m => m.line_user_id === lu.user_id));
    const uniqueIgnored = [];
    const seenIds = new Set();
    for (const user of ignored) {
      if (!seenIds.has(user.user_id)) {
        seenIds.add(user.user_id);
        uniqueIgnored.push(user);
      }
    }
    return uniqueIgnored;
  }, [lineUsers, members]);

  const fetchSupabaseData = async () => {
    setIsRefreshing(true);
    try {
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
              icon: r.icon || 'activity',
              color: r.color || '#425C73',
              logs: myLogs.map(l => ({ id: l.id, date: l.last_done_at, note: l.note })).sort((a, b) => new Date(b.date) - new Date(a.date)),
            };
          })
        );
      }

      const { data: membersData } = await supabase.from('members').select('*');
      if (membersData) setMembers(membersData);

      const { data: lineUsersData } = await supabase.from('line_users').select('*');
      if (lineUsersData) setLineUsers(lineUsersData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    async function initLiff() {
      try {
        await liff.init({ liffId: '2010165775-xmYZj7n4' });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const profile = await liff.getProfile();
          setCurrentUserLineId(profile.userId);
        }
      } catch (err) {
        console.error('LIFF 初始化失敗:', err);
      }
    }
    fetchSupabaseData(); 
    initLiff();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleIgnoreUser = async (userId, shouldIgnore) => {
    try {
      await supabase.from('line_users').update({ is_ignored: shouldIgnore }).eq('user_id', userId);
      setLineUsers(prev => prev.map(lu => lu.user_id === userId ? { ...lu, is_ignored: shouldIgnore } : lu));
      showToast(shouldIgnore ? '🙈 已移至隱藏名單' : '👀 已恢復至待安排名單');
    } catch (err) {
      alert('操作失敗，請重新整理頁面重試。');
    }
  };

  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const { data, error } = await supabase.from('members').insert([{ name, role_name: role }]).select();
    if (!error && data) { 
      setMembers(prev => [...prev, data[0]]); 
      showToast('✅ 角色已成功建立'); 
      return true; 
    }
    return false;
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

 const handleNotify = async (e, ev) => {

  const handleToggleDone = async (e, ev) => {
    e.stopPropagation();
    const newStatus = !ev.is_done;

    // 先樂觀更新 UI
    setEvents(prev => prev.map(item => item.id === ev.id ? { ...item, is_done: newStatus } : item));

    const { error } = await supabase.from('events').update({ is_done: newStatus }).eq('id', ev.id);
    
    if (!error) {
      if (newStatus) showToast('✅ 任務已完成');
      else showToast('取消完成');

      // 週期永動機
      if (newStatus && ev.is_routine && ev.routine_id) {
        const routine = routines.find(r => r.id === ev.routine_id);
        if (routine) {
          const nextDate = shiftDays(ev.date, routine.interval_days || 30); 
          const { data: existing } = await supabase.from('events').select('id').eq('routine_id', routine.id).eq('date', nextDate);
          
          if (!existing || existing.length === 0) {
            await supabase.from('events').insert([{
              title: ev.title, text: ev.text, type: ev.type, member: ev.member,
              date: nextDate, is_routine: true, routine_id: routine.id, is_done: false
            }]);
            showToast(`🔄 已自動排定下次任務：${nextDate}`);
            fetchSupabaseData(); 
          }
        }
      }
    } else {
      setEvents(prev => prev.map(item => item.id === ev.id ? { ...item, is_done: !newStatus } : item));
      showToast('網路錯誤，請重試');
    }
  };

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
            <button onClick={() => setFilter('all')} className={`snap-start whitespace-nowrap px-4 py-1.5 text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center rounded-md ${filter === 'all' ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-sm' : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm'}`}>
              所有紀錄
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <button key={key} onClick={() => setFilter(key)} className={`snap-start whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95 rounded-md ${filter === key ? 'bg-[#2C2A28] text-[#FBF9F6] shadow-sm' : 'bg-[#FBF9F6] text-[#7D7973] border border-[#E3DFD5] shadow-sm'}`}>
                <span className="w-2 h-2 rounded-md" style={{ backgroundColor: filter === key ? '#FBF9F6' : config.color }}></span>
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-2 relative min-h-[350px]" style={{ backgroundImage: 'radial-gradient(#E3DFD5 1.5px, transparent 1.5px)', backgroundSize: '16px 16px', backgroundPosition: '-8px -8px' }}>
          <div className="flex items-center justify-between py-3 mb-2 bg-[#F2EFE9]/90 backdrop-blur-md -mx-5 px-5 sticky top-[60px] z-10 border-b border-[#E3DFD5]/40">
            <h3 className="text-[17px] font-bold text-[#2C2A28] tracking-wide flex items-baseline gap-2">
              <span className="text-[22px] leading-none">{new Date(selectedDate).getDate()}</span> <span className="leading-none">日</span>
              {isTodaySelected && <span className="text-[10px] text-[#A84C3D] border border-[#A84C3D]/60 px-1.5 py-0.5 rounded-md uppercase tracking-widest font-bold ml-1 opacity-90 transform -translate-y-[1px]">Today</span>}
            </h3>
          </div>

          <div key={animKey} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out pb-6">
            {dayEvents.length === 0 ? (
              <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-sm mt-4">
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
                        
                        {/* 🌟 這裡就是打卡按鈕！點擊左側的圖示就能完成任務 */}
                        <div 
                          className={`absolute left-[8px] top-3.5 w-[26px] h-[26px] rounded-lg border-2 flex items-center justify-center shadow-sm z-20 transition-all active:scale-90 ${e.is_done ? 'bg-[#566B56] border-[#566B56] text-[#FBF9F6]' : 'bg-[#FBF9F6] border-[#E3DFD5]'}`} 
                          onClick={(event) => handleToggleDone(event, e)}
                        >
                          {e.is_done ? <Check size={14} strokeWidth={3} /> : (e.type === 'mood' ? <span className="text-[12px] leading-none mb-[1px]">{e.mood}</span> : <TypeIcon size={12} strokeWidth={2.5} style={{ color: TYPE_CONFIG[e.type].color }} />)}
                        </div>

                        {/* 任務卡片本體 */}
                        <div className={`bg-[#FBF9F6]/95 backdrop-blur-sm p-4 rounded-xl border border-[#E3DFD5] shadow-sm flex flex-col gap-2.5 active:bg-[#F2EFE9] transition-all ${e.is_done ? 'opacity-60 grayscale-[0.3]' : ''}`}>
                          <div className="flex justify-between items-center h-5">
                            <span className={`text-[11px] font-bold tracking-widest uppercase leading-none ${e.is_done ? 'text-[#7D7973]' : ''}`} style={{ color: e.is_done ? undefined : TYPE_CONFIG[e.type].color }}>{TYPE_CONFIG[e.type].label}</span>
                            
                            {/* 🌟 推播鈴鐺！這裡確保有把卡片資料 (e) 傳給函式 */}
                            <button onClick={(event) => handleNotify(event, e)} className="text-[#D1CFC7] hover:text-[#A84C3D] bg-[#F2EFE9] w-7 h-7 flex items-center justify-center rounded-lg transition-colors active:bg-[#E3DFD5] m-0 p-0 z-20">
                              <Bell size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                          
                          <div className={`text-[15px] font-medium leading-snug m-0 transition-all ${e.is_done ? 'text-[#D1CFC7] line-through' : 'text-[#2C2A28]'}`}>
                            {e.text}
                          </div>
                          
                          <div className="flex items-center pt-2.5 border-t border-[#E3DFD5]/60 border-dashed m-0">
                            <span className="text-[11px] text-[#7D7973] flex items-center gap-1.5 bg-[#F2EFE9] px-2 py-1 rounded-md leading-none">
                               <div className="w-1.5 h-1.5 rounded-md bg-[#A84C3D]"></div>
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
        <h2 className="text-[22px] font-bold text-[#2C2A28] tracking-wide mb-6 px-1">週期事務追蹤</h2>
        <div className="bg-[#FBF9F6]/80 backdrop-blur-sm border border-[#E3DFD5] border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-sm mt-2">
          <Activity size={28} strokeWidth={1.5} className="text-[#D1CFC7] mb-3" />
          <p className="text-[#7D7973] text-[14px] tracking-widest font-medium m-0">目前沒有週期事務</p>
        </div>
      </div>
    );
  };

  // 🌟 修復：全面恢復極簡雜誌風格，去除死板的膠囊按鈕，改回俐落的 rounded-xl
  const EventEditModal = () => {
    if (!editingEvent) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-3xl rounded-b-none shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300">
          {/* 🌟 加入底部墊高空間，避開 Safari 導航列 */}
          <div className="p-6 relative" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 32px)' }}>
            <button onClick={() => setEditingEvent(null)} className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <h3 className="text-[20px] font-bold text-[#2C2A28] tracking-wide mb-5 border-b border-[#E3DFD5] border-dashed pb-4">手札內容管理</h3>
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

  const AiModal = () => {
    const [input, setInput] = useState('');
    if (!isAiModalOpen) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-3xl rounded-b-none shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300">
          {/* 🌟 加入底部墊高空間，避開 Safari 導航列 */}
          <div className="p-6 relative" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 32px)' }}>
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#2C2A28] flex items-center justify-center shadow-md"><Sparkles size={16} className="text-[#FBF9F6]" strokeWidth={2} /></div>
              <span className="text-[20px] font-bold text-[#2C2A28] tracking-wide">AI 手札助理</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-6 tracking-widest leading-relaxed">寫下生活瑣事，自動蓋上時間與分類章。</p>
            <div className="relative mb-2">
              <textarea autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="「明天要去超市買鮮奶，爸爸負責」" className="w-full bg-[#F2EFE9] border border-[#E3DFD5] rounded-xl p-5 pb-16 text-[16px] font-medium text-[#2C2A28] placeholder:text-[#D1CFC7] focus:outline-none focus:border-[#7D7973] resize-none h-40"></textarea>
              <button onClick={() => { if(input.trim()) handleAiSubmit(input); }} disabled={!input.trim()} className="absolute right-3 bottom-3 bg-[#2C2A28] disabled:bg-[#E3DFD5] disabled:text-[#7D7973] text-[#FBF9F6] py-2.5 px-6 rounded-lg shadow-sm flex items-center gap-2 text-[14px] font-bold transition-all active:scale-95 disabled:scale-100 tracking-widest">寫入</button>
            </div>
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
      <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center bg-[#2C2A28]/40 backdrop-blur-sm p-0 transition-opacity">
        <div className="bg-[#FBF9F6] w-full max-w-[480px] rounded-t-3xl rounded-b-none shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300">
          {/* 🌟 加入底部墊高空間，避開 Safari 導航列 */}
          <div className="p-6 relative flex flex-col h-full" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 32px)' }}>
            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-[#7D7973] bg-[#F2EFE9] active:bg-[#E3DFD5] transition-colors"><X size={18} strokeWidth={2}/></button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#566B56] flex items-center justify-center shadow-md"><Users size={16} className="text-[#FBF9F6]" strokeWidth={2} /></div>
              <span className="text-[20px] font-bold text-[#2C2A28] tracking-wide">群體角色設定</span>
            </div>
            <p className="text-[13px] text-[#7D7973] mb-5 tracking-widest leading-relaxed border-b border-[#E3DFD5] border-dashed pb-4">建立專屬稱謂，以便自動分派任務。</p>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {/* --- 內容區域維持不變，省略以節省篇幅 --- */}
              {unboundLineUsers.length > 0 && (
                <div className="mb-4 p-3.5 bg-[#B87A45]/5 border border-[#B87A45]/20 rounded-xl">
                  <p className="text-[11px] font-bold text-[#A84C3D] mb-2.5 flex items-center gap-1.5">
                    <Wind size={14} /> 待安排專屬角色的 LINE 成員：
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unboundLineUsers.map(u => (
                      <span key={u.user_id} className="text-[12px] bg-[#FBF9F6] pl-2.5 pr-1.5 py-1.5 rounded-lg border border-[#E3DFD5] shadow-sm flex items-center gap-2 font-medium text-[#2C2A28]">
                        {u.picture_url ? (
                          <img src={u.picture_url} className="w-5 h-5 rounded-full border border-[#E3DFD5]" alt="avatar" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#D1CFC7] flex items-center justify-center text-[10px] text-white">?</div>
                        )}
                        <span className="truncate max-w-[70px]">{u.display_name}</span>
                        <button onClick={() => handleIgnoreUser(u.user_id, true)} className="text-[#7D7973] hover:text-[#A84C3D] p-0.5 rounded transition-colors active:bg-[#E3DFD5]">
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5 mb-2">
                {members.length === 0 ? (
                  <div className="text-center py-6 text-[#D1CFC7] text-[13px] font-medium border border-dashed border-[#E3DFD5] rounded-xl">尚無建立任何角色</div>
                ) : (
                  members.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3.5 bg-[#F2EFE9] rounded-xl border border-[#E3DFD5]">
                      <div>
                        <span className="block text-[15px] font-bold text-[#2C2A28]">{m.name}</span>
                        <span className="text-[11px] font-medium text-[#566B56] bg-[#FBF9F6] px-1.5 py-0.5 mt-1 rounded-md border border-[#E3DFD5] inline-block">{m.role_name}</span>
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
                          className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all ${m.line_user_id === currentUserLineId ? 'bg-[#566B56] text-[#FBF9F6] active:scale-95' : m.line_user_id ? 'bg-[#E3DFD5] text-[#7D7973] cursor-not-allowed opacity-70' : 'bg-[#2C2A28] text-[#FBF9F6] active:scale-95' }`}
                        >
                          {m.line_user_id === currentUserLineId ? '✅ 我的身分' : m.line_user_id ? '已被綁定' : '綁定我'}
                        </button>
                        <button onClick={() => handleDeleteMember(m.id)} className="text-[11px] bg-[#FBF9F6] text-[#A84C3D] px-2.5 py-1.5 rounded-lg active:scale-95 border border-[#E3DFD5] transition-all flex items-center justify-center"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!isAddingRole ? (
                <button onClick={() => setIsAddingRole(true)} className="w-full py-3 border-2 border-dashed border-[#E3DFD5] text-[#7D7973] rounded-xl flex items-center justify-center gap-2 font-bold text-[13px] hover:bg-[#F2EFE9] transition-colors mt-3 mb-6 tracking-widest active:scale-[0.99]"><Plus size={16} strokeWidth={2.5} /> 建立新角色</button>
              ) : (
                <div className="bg-[#F2EFE9] p-4 rounded-xl border border-[#E3DFD5] space-y-3 mt-3 mb-6 animate-in fade-in zoom-in-95 duration-200">
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
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setIsAddingRole(false); setNameInput(''); setRoleInput(''); }} className="flex-[1] h-[44px] bg-[#E3DFD5] text-[#7D7973] rounded-xl flex items-center justify-center text-[13px] font-bold active:scale-[0.98] transition-transform tracking-widest">取消</button>
                    <button onClick={async () => { const ok = await handleAddMember(nameInput, roleInput); if(ok) { setNameInput(''); setRoleInput(''); setIsAddingRole(false); } }} disabled={!nameInput.trim() || !roleInput.trim()} className="flex-[2] h-[44px] bg-[#2C2A28] disabled:bg-[#D1CFC7] disabled:text-[#FBF9F6] text-[#FBF9F6] rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold active:scale-[0.98] transition-transform tracking-widest"><Check size={16} strokeWidth={3} /> 確認建立</button>
                  </div>
                </div>
              )}

              {ignoredLineUsers.length > 0 && (
                <div className="mb-4 pt-3 border-t border-[#E3DFD5] border-dashed">
                  <button onClick={() => setIsHideListOpen(!isHideListOpen)} className="w-full flex items-center justify-between text-[11px] font-bold text-[#7D7973] uppercase tracking-widest py-1 hover:text-[#2C2A28] focus:outline-none">
                    <span>🙈 已隱藏的成員 ({ignoredLineUsers.length})</span>
                    <ChevronDown size={14} className={`transform transition-transform duration-200 ${isHideListOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isHideListOpen && (
                    <div className="flex flex-wrap gap-2 mt-2.5 p-2.5 bg-[#F2EFE9] rounded-xl border border-[#E3DFD5]">
                      {ignoredLineUsers.map(u => (
                        <span key={u.user_id} className="text-[11px] bg-[#FBF9F6] pl-2.5 pr-1.5 py-1 rounded-md border border-[#E3DFD5] flex items-center gap-1.5 text-[#7D7973] font-medium shadow-sm">
                          {u.display_name}
                          <button onClick={() => handleIgnoreUser(u.user_id, false)} className="text-[#566B56] hover:text-[#2C2A28] p-0.5 rounded transition-colors"><RotateCw size={10} strokeWidth={3} /></button>
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


  return (
    // 請將最外層的兩個 div 替換成這樣：
<div className={`fixed inset-0 bg-[#DFDCD4] flex justify-center overflow-hidden select-none selection:bg-[#E3DFD5] ${hideScrollbar}`} style={{ fontFamily: 'PingFang TC, PingFang SC, sans-serif', fontStyle: 'normal' }}>
  <div className="w-full max-w-[480px] h-full bg-[#F2EFE9] relative flex flex-col overflow-hidden sm:border-x border-[#D1CFC7] sm:rounded-[40px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-[0_20px_60px_rgba(44,42,40,0.1)]">
        
        <header className="flex-none pt-12 pb-3 px-6 flex justify-between items-center z-30 bg-[#F2EFE9]/95 backdrop-blur-xl border-b border-[#E3DFD5] sticky top-0">
          <div>
            <h1 className="text-[24px] font-bold tracking-wider text-[#2C2A28]">Family Hub</h1>
            <p className="text-[9px] text-[#7D7973] tracking-[0.3em] uppercase mt-1">生活導航 Life Navigator</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchSupabaseData} disabled={isRefreshing} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-[#566B56]/70 bg-[#FBF9F6]/80 active:scale-95 transition-all disabled:opacity-70 shadow-sm">
              <RotateCw size={11} strokeWidth={3} className={`text-[#566B56] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold text-[#566B56] uppercase tracking-widest mt-[1px]">{isRefreshing ? 'SYNCING' : 'SYNC'}</span>
            </button>
            <button onClick={() => setIsMemberModalOpen(true)} className="relative w-9 h-9 bg-[#FBF9F6] border-2 border-[#E3DFD5] rounded-lg flex items-center justify-center text-[#2C2A28] shadow-sm active:bg-[#E3DFD5] transition-colors">
              <Users size={16} strokeWidth={2.5} />
              {unboundLineUsers.length > 0 && (
                <span className="absolute -top-[5px] -right-[5px] flex h-[10px] w-[10px]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A84C3D] opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-[10px] w-[10px] bg-[#A84C3D] border-2 border-[#F2EFE9]"></span>
                </span>
              )}
            </button>
          </div>
        </header>

        {unboundLineUsers.length > 0 && (
          <div className="bg-[#B87A45]/10 border-b border-[#E3DFD5] px-6 py-3 flex items-start animate-in slide-in-from-top duration-300">
            <p className="text-[12px] font-bold text-[#2C2A28] m-0 tracking-wide text-left leading-relaxed">
              📢 偵測到 {unboundLineUsers.length} 位夥伴已加入，請點選右上角按鈕進行綁定。
            </p>
          </div>
        )}

        <main className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth ${hideScrollbar}`}>
          {activeTab === 'board' ? <BoardView /> : <RoutinesView />}
        </main>

        {/* 🌟 修復設計細節：精準的 AI 按鈕懸浮定位，完美避開安全距離 */}
        <button 
          onClick={() => setIsAiModalOpen(true)} 
          className="absolute right-6 w-14 h-14 rounded-xl flex items-center justify-center z-20 active:scale-90 hover:scale-105 shadow-lg bg-[#2C2A28] text-[#FBF9F6] transition-transform"
          style={{ bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Sparkles size={22} strokeWidth={1.5} />
        </button>

        <AiModal />
        <MemberModal />
        <EventEditModal />

        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#2C2A28]/95 backdrop-blur-md text-[#FBF9F6] text-[13px] font-bold tracking-widest px-6 py-3.5 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <Check size={18} className="text-[#E3DFD5]" strokeWidth={2.5} />
            {toast}
          </div>
        )}

        {/* 🌟 修復設計細節：保留 70px 基礎固定高度 + 安全距離，讓導航列在任何裝置都完美貼合底部 */}
        <nav 
          className="absolute bottom-0 left-0 w-full bg-[#FBF9F6]/95 backdrop-blur-2xl border-t border-[#E3DFD5] z-10 flex justify-around items-start pt-3 px-2"
          style={{ height: 'calc(70px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button onClick={() => setActiveTab('board')} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'board' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7]'}`}>
            <CalendarDays size={24} strokeWidth={activeTab === 'board' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">任務看板</span>
            {activeTab === 'board' && <div className="w-1.5 h-1.5 rounded-md bg-[#A84C3D]"></div>}
          </button>
          <button onClick={() => setActiveTab('routines')} className={`flex flex-col items-center gap-1.5 w-20 transition-all duration-300 ${activeTab === 'routines' ? 'text-[#2C2A28] -translate-y-1' : 'text-[#D1CFC7]'}`}>
            <RotateCw size={24} strokeWidth={activeTab === 'routines' ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-widest">週期事務</span>
            {activeTab === 'routines' && <div className="w-1.5 h-1.5 rounded-md bg-[#A84C3D]"></div>}
          </button>
        </nav>
      </div>
    </div>
  );
}
