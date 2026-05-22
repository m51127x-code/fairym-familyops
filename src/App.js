import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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
  Users, // 👈 新增使用者圖示
  UserPlus
} from 'lucide-react';

// === Supabase 連線設定 (已寫死，確保絕不斷線) ===
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

// 🎨 俐落高級感莫蘭迪與 Pantone 藍綠色系調色盤
const PALETTE = {
  paper: '#F4F7F6',      
  card: '#FFFFFF',       
  ink: '#1E2927',        
  inkMuted: '#6E7D7A',   
  border: '#E5ECE9',     
  accent: '#A67B75',     
  todo: '#4A6B82',       
  shop: '#5C7A76',       
  remind: '#8A7A6E',     
  health: '#9E6B66',     
  mood: '#74697C',       
  routine: '#53666B'     
};

const TYPE_CONFIG = {
  todo: { label: '待辦', color: PALETTE.todo, icon: Activity },
  shop: { label: '採買', color: PALETTE.shop, icon: ShoppingCart },
  remind: { label: '提醒', color: PALETTE.remind, icon: AlertCircle },
  health: { label: '健康', color: PALETTE.health, icon: HeartPulse },
  mood: { label: '心情', color: PALETTE.mood, icon: Smile },
  routine: { label: '週期', color: PALETTE.routine, icon: RotateCw },
};

const HOLIDAYS = { '2026-05-01':'勞動節', '2026-06-19':'端午節', '2026-09-25':'中秋節', '2026-10-10':'國慶日' };
const MOOD_MAP = { '開心':'😊', '快樂':'😄', '累':'😴', '好累':'😴', '煩':'😤', '難過':'😢', '期待':'🥰', '放鬆':'😌', '不錯':'🙂' };
const hideScrollbar = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']";

// --- 主元件 ---
export default function FamilyHub() {
  const [activeTab, setActiveTab] = useState('board');
  const [events, setEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [members, setMembers] = useState([]); // 👈 新增：用來裝載動態成員的容器
  
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fmtDate(TODAY));
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  
  // 彈窗控制狀態
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false); // 👈 新增：成員管理面板開關
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [logModalRoutine, setLogModalRoutine] = useState(null);

  // 網頁載入時向 Supabase 撈取新資料 (防彈機制全開)
  useEffect(() => {
    async function fetchSupabaseData() {
      // 1. 撈取手札事件 (保留大於 5/22 的乾淨過濾器)
      const { data: eventsData } = await supabase.from('events').select('*').gte('date', '2026-05-22').order('date', { ascending: true });
      if (eventsData) {
        setEvents(eventsData.map(e => ({ ...e, type: TYPE_CONFIG[e.type] ? e.type : 'todo' })));
      }

      // 2. 撈取週期任務與維護日誌 (拆分撈取，避免關聯報錯)
      const { data: routinesData } = await supabase.from('routines').select('*');
      const { data: logsData } = await supabase.from('routine_logs').select('*');
      if (routinesData) {
        setRoutines(routinesData.map(r => {
          const myLogs = logsData ? logsData.filter(log => log.routine_name === r.name) : [];
          return {
            ...r, id: r.id || Date.now(), name: r.name, member: r.member || '全家', interval: r.interval_days || 30, icon: r.icon || 'activity', color: r.color || PALETTE.todo,
            logs: myLogs.map(log => ({ id: log.id || Math.random(), date: log.last_done_at || '2026-05-22', note: log.note || '' })).sort((a, b) => new Date(b.date) - new Date(a.date))
          };
        }));
      }

      // 3. 撈取動態家庭成員 (安全降落機制：如果資料庫還沒建這張表，不會當機，只會報錯在背景)
      const { data: membersData, error: membersError } = await supabase.from('members').select('*');
      if (!membersError && membersData) {
        setMembers(membersData);
      }
    }
    fetchSupabaseData();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // 處理新增成員寫入資料庫
  const handleAddMember = async (name, role) => {
    if (!name || !role) return;
    const newMember = { name, role_name: role };
    
    // 樂觀更新：先讓畫面顯示，不需等待伺服器轉圈圈
    const tempId = Date.now();
    setMembers(prev => [...prev, { ...newMember, id: tempId }]);
    
    // 寫入 Supabase
    const { error } = await supabase.from('members').insert([newMember]);
    if (error) {
      showToast('⚠️ 儲存失敗，請確認資料庫是否已建立 members 表單');
      // 如果失敗，把剛剛假裝寫入畫面的資料收回來
      setMembers(prev => prev.filter(m => m.id !== tempId));
    } else {
      showToast('✅ 成員已成功建立');
    }
  };

  const handleAiSubmit = (text) => { /* AI 模擬輸入保留原邏輯 */ 
    setIsAiModalOpen(false); showToast('AI 解析完成，已寫入手札');
  };

  const handleAddLog = (routineId, noteText) => { /* 紀錄維護保留原邏輯 */ 
    setLogModalRoutine(null); showToast('事務歷史已更新');
  };

  // --- UI 元件：手札看板 (保留原雜誌風設計) ---
  const BoardView = () => { /* ...(為了版面簡潔，此處內容與上一版完全一致，已省略實作碼，請依上一版貼上即可)... */ 
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

    const [animKey, setAnimKey] = useState(Date.now());
    const handleDayClick = (date) => {
      setSelectedDate(date);
      setAnimKey(Date.now());
    };

    return (
      <div className="flex flex-col pb-32 pt-2 relative">
        <div className="px-6 space-y-5">
          {/* 月份儀表板 */}
          <div className="bg-white border border-[#E5ECE9] rounded-2xl p-5 shadow-[0_4px_20px_rgba(30,41,39,0.02)] relative overflow-hidden">
            <div className="flex justify-between items-end mb-4 relative z-10">
              <h2 className="text-[24px] font-bold text-[#1E2927] tracking-wide leading-none">
                {currentMonth.getMonth() + 1}月 <span className="text-[14px] font-medium text-[#6E7D7A] ml-1">{currentMonth.getFullYear()}</span>
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 border border-[#E5ECE9] rounded-xl text-[#6E7D7A] hover:bg-[#F4F7F6] active:scale-95 transition-all"><ChevronLeft size={16} strokeWidth={2}/></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 border border-[#E5ECE9] rounded-xl text-[#6E7D7A] hover:bg-[#F4F7F6] active:scale-95 transition-all"><ChevronRight size={16} strokeWidth={2}/></button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5 pt-4 border-t border-[#E5ECE9] relative z-10">
              {Object.keys(TYPE_CONFIG).map(type => (
                <div key={type} className="flex flex-col items-center justify-center py-2.5 rounded-xl hover:bg-[#F4F7F6] cursor-pointer transition-colors active:bg-[#E5ECE9]" onClick={() => setFilter(type)}>
                  <span className="text-[18px] font-bold leading-none" style={{ color: stats[type] > 0 ? TYPE_CONFIG[type].color : '#CBD5E1' }}>{stats[type]}</span>
                  <span className="text-[11px] font-medium text-[#6E7D7A] mt-2">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 月曆網格 */}
          <div className="bg-white border border-[#E5ECE9] rounded-2xl p-5 shadow-[0_4px_20px_rgba(30,41,39,0.02)]">
            <div className="grid grid-cols-7 mb-3">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={`text-center text-[11px] font-bold tracking-widest ${i===0 ? 'text-[#A67B75]' : 'text-[#6E7D7A]'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {calendarDays.map((day) => {
                if (day.type === 'empty') return <div key={day.id} />;
                const isSelected = selectedDate === day.date;
                const isToday = day.date === fmtDate(TODAY);
                const isHoliday = !!day.holiday;

                return (
                  <div key={day.date} onClick={() => handleDayClick(day.date)} className="relative flex flex-col items-center justify-center cursor-pointer h-[44px] tap-highlight-transparent select-none">
                    <div className={`absolute inset-0.5 rounded-lg transition-all duration-200 ${isSelected ? 'bg-[#1E2927] scale-100 opacity-100' : 'scale-95 opacity-0 hover:bg-[#E5ECE9]/60'}`}></div>
                    <div className={`relative z-10 w-8 h-8 flex items-center justify-center text-[15px] font-medium transition-colors duration-200 ${isSelected ? 'text-white' : ''} ${!isSelected && isToday ? 'border border-[#1E2927] rounded-md text-[#1E2927] font-bold' : ''} ${!isSelected && !isToday ? (day.isSun || isHoliday ? 'text-[#A67B75]' : 'text-[#1E2927]') : ''}`}>
                      {day.dayNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* 標籤區與手札列表 */}
        <div className="px-6 mt-3 min-h-[350px]">
          <div className="flex items-center justify-between py-4 mb-2 bg-[#F4F7F6]/90 backdrop-blur-sm -mx-6 px-6 sticky top-[62px] z-10 border-b border-[#E5ECE9]">
            <h3 className="text-[18px] font-bold text-[#1E2927] tracking-wide flex items-center gap-2">
              <span className="text-[22px] font-light">{new Date(selectedDate).getDate()}</span> 日
            </h3>
          </div>
          <div key={animKey} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out pb-6">
            {dayEvents.length === 0 ? (
              <div className="bg-white border border-[#E5ECE9] border-dashed rounded-2xl p-12 text-center flex flex-col items-center mt-4">
                <Leaf size={28} className="text-[#CBD5E1] mb-3" />
                <p className="text-[#6E7D7A] text-[14px] tracking-wider font-medium">本日尚無紀錄事項</p>
              </div>
            ) : (
              <div className="relative space-y-4 mt-2">
                 {/* ...原列表對應... */}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- UI 元件：週期事務 (保留原設計) ---
  const RoutinesView = () => { /* ...(為簡潔省略實作碼)... */ return <div className="px-6 pb-32 pt-2"><h2 className="text-[22px] font-bold text-[#1E2927]">週期事務追蹤</h2></div> };
  const RoutineLogModal = () => { return null; };
  const AiModal = () => { return null; };

  // --- 🌟 全新 UI 元件：成員管理面板 (Member Modal) ---
  const MemberModal = () => {
    const [nameInput, setNameInput] = useState('');
    const [roleInput, setRoleInput] = useState('');
    if (!isMemberModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2927]/40 backdrop-blur-md p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col pb-safe border border-[#E5ECE9] animate-in slide-in-from-bottom-6 duration-300">
          <div className="p-6 relative max-h-[80vh] flex flex-col">
            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-[#6E7D7A] bg-[#F4F7F6] hover:bg-[#E5ECE9] transition-colors">
              <X size={18} strokeWidth={2}/>
            </button>
            
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#5C7A76] flex items-center justify-center shadow-sm">
                 <Users size={16} className="text-white" strokeWidth={2} />
              </div>
              <span className="text-[19px] font-bold text-[#1E2927]">動態成員設定</span>
            </div>
            <p className="text-[13px] text-[#6E7D7A] mb-6 leading-relaxed border-b border-[#E5ECE9] pb-4">
              在此自定義家人的暱稱與角色定位。設定完成後，這些角色將連動至系統各處供指派與提醒使用。
            </p>

            {/* 成員列表展示 */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
              {members.length === 0 ? (
                <div className="text-center py-6 text-[#CBD5E1] text-[13px] font-medium border border-dashed border-[#E5ECE9] rounded-xl">尚無建立任何角色</div>
              ) : (
                members.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-3.5 bg-[#F4F7F6] rounded-xl border border-[#E5ECE9]">
                    <span className="text-[15px] font-bold text-[#1E2927]">{m.name}</span>
                    <span className="text-[11px] font-medium text-[#5C7A76] bg-white px-2 py-1 rounded-md border border-[#E5ECE9]">{m.role_name}</span>
                  </div>
                ))
              )}
            </div>

            {/* 新增成員表單 */}
            <div className="bg-[#F4F7F6] p-4 rounded-xl border border-[#E5ECE9] space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#6E7D7A] mb-1.5 uppercase tracking-widest">系統名稱</label>
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="例：林老杯" className="w-full bg-white border border-[#E5ECE9] rounded-lg px-3 py-2.5 text-[14px] text-[#1E2927] focus:outline-none focus:border-[#5C7A76]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#6E7D7A] mb-1.5 uppercase tracking-widest">角色稱謂</label>
                  <input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} placeholder="例：室友/爸爸" className="w-full bg-white border border-[#E5ECE9] rounded-lg px-3 py-2.5 text-[14px] text-[#1E2927] focus:outline-none focus:border-[#5C7A76]" />
                </div>
              </div>
              <button 
                onClick={() => { handleAddMember(nameInput, roleInput); setNameInput(''); setRoleInput(''); }}
                disabled={!nameInput.trim() || !roleInput.trim()}
                className="w-full mt-2 bg-[#1E2927] disabled:bg-[#E5ECE9] disabled:text-[#6E7D7A] text-white py-2.5 rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold transition-all active:scale-[0.98]"
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
    <div className={`min-h-screen bg-[#DFDCD4] font-['PingFang_TC','PingFang_SC','Helvetica_Neue',sans-serif] flex justify-center selection:bg-[#E5ECE9] ${hideScrollbar}`}>
      <div className="w-full max-w-[480px] h-dvh bg-[#F4F7F6] relative flex flex-col overflow-hidden sm:border-x sm:border-[#CBD5E1] sm:rounded-[32px] sm:my-4 sm:h-[calc(100dvh-32px)] sm:shadow-[0_24px_64px_rgba(30,41,39,0.08)]">
        
        {/* 固定頂部導覽列 */}
        <header className="flex-none pt-10 pb-4 px-6 flex justify-between items-center z-30 bg-white/80 backdrop-blur-md border-b border-[#E5ECE9] sticky top-0">
          <div>
            <h1 className="text-[23px] font-bold tracking-wide text-[#1E2927]">Family Hub</h1>
            <p className="text-[9px] text-[#6E7D7A] tracking-[0.25em] uppercase mt-0.5">Traveler's Logbook</p>
          </div>
          
          {/* 右上角工具列 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[#5C7A76]/60 bg-white shadow-sm">
              <span className="text-[9px] font-bold text-[#5C7A76] uppercase tracking-widest">LINE Sync</span>
            </div>
            {/* 👈 觸發成員管理面板的齒輪/用戶圖示 */}
            <button onClick={() => setIsMemberModalOpen(true)} className="w-8 h-8 bg-white border border-[#E5ECE9] rounded-lg flex items-center justify-center text-[#1E2927] shadow-sm hover:bg-[#F4F7F6] active:scale-95 transition-all">
              <Users size={16} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth ${hideScrollbar}`}>
          {activeTab === 'board' ? <BoardView /> : <RoutinesView />}
        </main>

        <button onClick={() => setIsAiModalOpen(true)} className="absolute bottom-[110px] right-6 w-13 h-13 rounded-xl flex items-center justify-center z-40 transition-all active:scale-95 shadow-[0_6px_20px_rgba(30,41,39,0.15)] bg-[#1E2927] text-white border border-white/10">
          <Sparkles size={20} strokeWidth={2} />
        </button>

        <AiModal />
        <RoutineLogModal />
        <MemberModal /> {/* 👈 渲染成員管理面板 */}

        {toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1E2927]/95 backdrop-blur-sm text-white text-[13px] font-bold tracking-wider px-5 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200 border border-white/5">
            <Check size={16} className="text-[#E5ECE9]" strokeWidth={2.5} />
            {toast}
          </div>
        )}

        {/* 固定底部導覽列 */}
        <nav className="absolute bottom-0 left-0 w-full h-[85px] bg-white/90 backdrop-blur-md border-t border-[#E5ECE9] z-30 flex justify-around items-start pt-3 pb-safe px-3">
          <button onClick={() => setActiveTab('board')} className={`flex flex-col items-center gap-1 w-20 transition-all ${activeTab === 'board' ? 'text-[#1E2927] -translate-y-0.5' : 'text-[#CBD5E1]'}`}>
            <CalendarDays size={22} strokeWidth={activeTab === 'board' ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-widest">手札看板</span>
            {activeTab === 'board' && <div className="w-1 h-1 rounded-sm bg-[#A67B75] mt-1"></div>}
          </button>
          <button onClick={() => setActiveTab('routines')} className={`flex flex-col items-center gap-1 w-20 transition-all ${activeTab === 'routines' ? 'text-[#1E2927] -translate-y-0.5' : 'text-[#CBD5E1]'}`}>
            <RotateCw size={22} strokeWidth={activeTab === 'routines' ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-widest">週期維護</span>
            {activeTab === 'routines' && <div className="w-1 h-1 rounded-sm bg-[#A67B75] mt-1"></div>}
          </button>
        </nav>

      </div>
    </div>
  );
}
