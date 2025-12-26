
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  KittenState, 
  FoodType, 
  FeedingLog 
} from './types';
import { 
  INITIAL_WEIGHT, 
  INITIAL_WEIGHT_DATE, 
  BIRTH_DATE, 
  FOOD_LABELS,
  POUCH_DRY_EQUIVALENT
} from './constants';
import { 
  calculateMonthsAge, 
  estimateWeight, 
  getDailyNorm,
  formatTime 
} from './utils';
import { 
  Plus, 
  Scale, 
  History, 
  Utensils, 
  Calendar, 
  ChevronRight, 
  Trash2, 
  TrendingUp,
  X,
  Cloud,
  CloudOff,
  Settings,
  RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  // --- Состояния ---
  const [familyId, setFamilyId] = useState<string>(() => localStorage.getItem('ozzy_family_id') || '');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('ozzy_family_id'));
  
  const [state, setState] = useState<KittenState>(() => {
    const saved = localStorage.getItem('kitten_state_bot');
    if (saved) return JSON.parse(saved);
    return {
      birthDate: BIRTH_DATE,
      lastManualWeight: INITIAL_WEIGHT,
      lastWeightDate: INITIAL_WEIGHT_DATE,
      history: []
    };
  });

  const [amount, setAmount] = useState<string>('');
  const [selectedFood, setSelectedFood] = useState<FoodType>(FoodType.DRY);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState<string>('');

  // --- API Функции ---
  const fetchRemoteData = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/state/${id}`);
      const remoteState = await res.json();
      if (remoteState) {
        setState(remoteState);
        localStorage.setItem('kitten_state_bot', JSON.stringify(remoteState));
      }
      setSyncStatus('synced');
    } catch (e) {
      console.error('Sync error:', e);
      setSyncStatus('error');
    }
  }, []);

  const pushData = async (id: string, currentState: KittenState) => {
    if (!id) return;
    try {
      setSyncStatus('syncing');
      await fetch(`/api/state/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentState)
      });
      setSyncStatus('synced');
    } catch (e) {
      setSyncStatus('error');
    }
  };

  // --- Эффекты ---
  useEffect(() => {
    const WebApp = (window as any).Telegram?.WebApp;
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('secondary_bg_color');
    }
    if (familyId) fetchRemoteData(familyId);
  }, []);

  useEffect(() => {
    if (!familyId) return;
    const interval = setInterval(() => fetchRemoteData(familyId), 30000);
    return () => clearInterval(interval);
  }, [familyId, fetchRemoteData]);

  const updateStateAndSync = (newState: KittenState) => {
    setState(newState);
    localStorage.setItem('kitten_state_bot', JSON.stringify(newState));
    if (familyId) pushData(familyId, newState);
  };

  // --- Расчеты ---
  const now = new Date();
  const currentAge = useMemo(() => calculateMonthsAge(now), [now]);
  const currentWeight = useMemo(() => estimateWeight(state.lastManualWeight, state.lastWeightDate), [state, now]);
  const dailyNorm = useMemo(() => getDailyNorm(currentWeight, currentAge), [currentWeight, currentAge]);
  
  const weightGained = useMemo(() => (currentWeight - state.lastManualWeight) * 1000, [currentWeight, state.lastManualWeight]);

  const todayHistory = useMemo(() => {
    const todayStr = new Date().toDateString();
    return state.history.filter(log => new Date(log.timestamp).toDateString() === todayStr);
  }, [state.history]);

  const consumedToday = useMemo(() => todayHistory.reduce((acc, log) => acc + log.equivalentGrams, 0), [todayHistory]);

  const remainingToday = Math.max(0, dailyNorm - consumedToday);
  const totalMealsTarget = 4;
  const mealsLeftToday = Math.max(0, totalMealsTarget - todayHistory.length);
  const nextMealAmount = mealsLeftToday > 0 ? (remainingToday / mealsLeftToday).toFixed(0) : remainingToday.toFixed(0);

  // --- Обработчики ---
  const addFeeding = () => {
    let val: number, equiv: number;
    if (selectedFood === FoodType.POUCH) {
      val = 1; equiv = POUCH_DRY_EQUIVALENT;
    } else {
      val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return;
      equiv = val;
    }

    const newLog: FeedingLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: selectedFood,
      amount: val,
      equivalentGrams: equiv
    };
    
    updateStateAndSync({ ...state, history: [newLog, ...state.history] });
    setAmount('');
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const updateWeight = () => {
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) return;
    updateStateAndSync({ ...state, lastManualWeight: val, lastWeightDate: new Date().toISOString() });
    setNewWeight('');
    setShowWeightModal(false);
  };

  const saveSettings = () => {
    localStorage.setItem('ozzy_family_id', familyId);
    setShowSettings(false);
    fetchRemoteData(familyId);
  };

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto pb-10">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center bg-[var(--tg-theme-secondary-bg-color)]">
         <div className="flex flex-col">
            <span className="text-[var(--tg-theme-hint-color)] text-[10px] uppercase font-bold tracking-wider">Котёнок Оззи</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[var(--tg-theme-text-color)] text-lg font-bold truncate max-w-[120px]">
                {familyId || 'Без синхр.'}
              </span>
            </div>
         </div>
         <div className="flex gap-2">
           <button onClick={() => fetchRemoteData(familyId)} className="bg-[var(--tg-theme-bg-color)] p-2 rounded-full text-[var(--tg-theme-hint-color)] shadow-sm active:rotate-180 transition-transform duration-500">
             <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
           </button>
           <button onClick={() => setShowSettings(true)} className="bg-[var(--tg-theme-bg-color)] p-2 rounded-full text-[var(--tg-theme-link-color)] shadow-sm">
             <Settings size={20} />
           </button>
         </div>
      </div>

      {/* Stats Cards */}
      <div className="tg-card !mt-0 !mb-2 flex justify-between gap-4 shadow-sm">
          <div className="flex-1">
            <p className="text-[var(--tg-theme-hint-color)] text-[10px] mb-1">Возраст</p>
            <p className="font-bold text-sm leading-tight">{currentAge.toFixed(1)} мес.</p>
          </div>
          <div className="flex-1 border-x border-[var(--tg-theme-secondary-bg-color)] px-4" onClick={() => setShowWeightModal(true)}>
            <div className="flex justify-between items-start mb-1">
               <p className="text-[var(--tg-theme-hint-color)] text-[10px]">Вес</p>
               {weightGained > 0 && <span className="text-[9px] text-green-500 font-bold bg-green-50 px-1 rounded">+{weightGained.toFixed(0)}г</span>}
            </div>
            <p className="font-bold text-sm text-[var(--tg-theme-link-color)] mb-1 leading-tight">{currentWeight.toFixed(3)} кг</p>
            <div className="flex items-center gap-1 text-[8px] text-green-600 bg-green-50 px-1 rounded-sm font-bold w-fit">
               <TrendingUp size={8} /> +16г/день
            </div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-[var(--tg-theme-hint-color)] text-[10px] mb-1">Норма/день</p>
            <p className="font-bold text-sm leading-tight">{dailyNorm.toFixed(0)}г</p>
          </div>
      </div>

      {/* Progress Bar */}
      <div className="tg-card space-y-3 shadow-sm">
        <div className="flex justify-between items-end">
          <span className="text-sm font-bold">Прогресс дня</span>
          <span className="text-xl font-black">{consumedToday.toFixed(0)}г <span className="text-xs text-[var(--tg-theme-hint-color)] font-normal">/ {dailyNorm.toFixed(0)}г</span></span>
        </div>
        <div className="w-full bg-[var(--tg-theme-secondary-bg-color)] rounded-full h-2.5 overflow-hidden">
          <div className="h-full bg-[var(--tg-theme-button-color)] transition-all duration-700 rounded-full" style={{ width: `${Math.min(100, (consumedToday / dailyNorm) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-[var(--tg-theme-hint-color)] font-medium">
          <span>Остаток: <span className="text-[var(--tg-theme-text-color)] font-bold">{remainingToday.toFixed(0)}г</span></span>
          <span>{mealsLeftToday > 0 ? `Порция: ~${nextMealAmount}г` : 'Норма выполнена!'}</span>
        </div>
      </div>

      {/* Add Feeding */}
      <div className="px-4 mt-6 mb-2">
        <span className="text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">Добавить кормление</span>
      </div>
      <div className="tg-card !mt-0 space-y-4 shadow-sm">
        <div className="flex p-1 bg-[var(--tg-theme-secondary-bg-color)] rounded-xl overflow-x-auto no-scrollbar">
          {(Object.keys(FOOD_LABELS) as FoodType[]).map((type) => (
            <button key={type} onClick={() => setSelectedFood(type)} className={`flex-1 py-2 px-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${selectedFood === type ? 'bg-[var(--tg-theme-bg-color)] shadow-sm text-[var(--tg-theme-text-color)]' : 'text-[var(--tg-theme-hint-color)]'}`}>
              {FOOD_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {selectedFood === FoodType.POUCH ? (
            <div className="flex-1 flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color)] rounded-xl px-4 font-bold text-base text-[var(--tg-theme-hint-color)]">1 пауч</div>
          ) : (
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Грамм" className="flex-1 min-w-0 bg-[var(--tg-theme-secondary-bg-color)] border-none rounded-xl py-3.5 px-4 outline-none font-bold text-xl" />
          )}
          <button onClick={addFeeding} disabled={selectedFood !== FoodType.POUCH && !amount} className={`tg-button-main px-10 rounded-xl shrink-0 ${selectedFood !== FoodType.POUCH && !amount ? 'opacity-50 grayscale' : ''}`}>ОК</button>
        </div>
      </div>

      {/* History */}
      <div className="px-4 mt-6 mb-2 text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">История за сегодня</div>
      <div className="tg-card !mt-0 p-0 overflow-hidden divide-y divide-[var(--tg-theme-secondary-bg-color)] shadow-sm">
        {todayHistory.length === 0 ? <div className="p-10 text-center text-[var(--tg-theme-hint-color)] text-sm italic">Пока пусто</div> : todayHistory.map((log) => (
          <div key={log.id} className="flex items-center justify-between p-4 bg-[var(--tg-theme-bg-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-[var(--tg-theme-link-color)]"><Utensils size={18} /></div>
              <div>
                <p className="text-sm font-bold">{FOOD_LABELS[log.type]}</p>
                <p className="text-[10px] text-[var(--tg-theme-hint-color)] font-medium uppercase tracking-tighter">{formatTime(log.timestamp)} • {log.type === FoodType.POUCH ? '1 шт' : `${log.amount}г`}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">+{log.equivalentGrams.toFixed(0)}г</span>
              <button onClick={() => updateStateAndSync({...state, history: state.history.filter(l => l.id !== log.id)})} className="text-red-400 p-2 active:bg-red-50 rounded-full transition-colors"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Settings Modal (Family ID) */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-2 tracking-tight">Настройка семьи</h2>
            <p className="text-[var(--tg-theme-hint-color)] text-sm mb-8 leading-snug">Придумайте секретный ID (например, <code>ozzy-2025</code>) и дайте его жене, чтобы ваши данные объединились.</p>
            <input type="text" value={familyId} onChange={(e) => setFamilyId(e.target.value.toLowerCase().replace(/\s/g, '-'))} className="w-full text-center text-3xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-5 outline-none mb-8 border-2 border-transparent focus:border-[var(--tg-theme-link-color)] transition-all" placeholder="ID-семьи" />
            <button onClick={saveSettings} disabled={!familyId} className="w-full tg-button-main py-4.5 rounded-2xl text-lg font-black tracking-wide disabled:opacity-50 shadow-lg active:scale-[0.98] transition-all">СОХРАНИТЬ И ВОЙТИ</button>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-[2px]">
          <div className="absolute inset-0" onClick={() => setShowWeightModal(false)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] p-8 shadow-2xl">
            <div className="w-14 h-1.5 bg-[var(--tg-theme-secondary-bg-color)] rounded-full mx-auto mb-8" />
            <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black">Вес котёнка (кг)</h2><button onClick={() => setShowWeightModal(false)} className="bg-[var(--tg-theme-secondary-bg-color)] p-2 rounded-full"><X size={20} /></button></div>
            <input type="number" step="0.01" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} autoFocus className="w-full text-center text-5xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-8 outline-none mb-8" placeholder="0.00" />
            <button onClick={updateWeight} className="w-full tg-button-main py-5 rounded-2xl text-lg font-black shadow-lg">ОБНОВИТЬ ВЕС</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
