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

// 🌟 主應用程式
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
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentUserLineId, setCurrentUserLineId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); 

  const unboundLineUsers = useMemo(() => {
    const unbound = lineUsers.filter(lu => !members.some(m => m.line_user_id === lu.user_id));
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

  // 🌟 將撈取資料獨立成一個函式，讓按鈕可以隨時呼叫
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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null),
