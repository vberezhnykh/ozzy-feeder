
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  KittenState,
  FoodType,
  FeedingLog,
  WeightLog
} from './types';
import {
  INITIAL_WEIGHT,
  INITIAL_WEIGHT_DATE,
  BIRTH_DATE,
  FOOD_LABELS,
  POUCH_DRY_EQUIVALENT,
  PATE_DRY_EQUIVALENT_RATIO,
  DEFAULT_FAMILY_ID
} from './constants';
import {
  calculateMonthsAge,
  estimateWeight,
  getDailyNorm,
  formatTime,
  getIntervalText
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
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Timer,
  Lock,
  Package,
  Beef
} from 'lucide-react';

const INITIAL_STATE: KittenState = {
  birthDate: BIRTH_DATE,
  lastManualWeight: INITIAL_WEIGHT,
  lastWeightDate: INITIAL_WEIGHT_DATE,
  history: [],
  weightHistory: [
    { id: 'initial', timestamp: new Date(INITIAL_WEIGHT_DATE).getTime(), weight: INITIAL_WEIGHT }
  ],
  settings: {}
};

const App: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showWeightHistoryModal, setShowWeightHistoryModal] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(3);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const [state, setState] = useState<KittenState>(() => {
    const saved = localStorage.getItem('kitten_state_bot');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.settings) parsed.settings = {};
        if (!parsed.weightHistory) {
          parsed.weightHistory = [{ id: 'initial', timestamp: new Date(parsed.lastWeightDate || INITIAL_WEIGHT_DATE).getTime(), weight: parsed.lastManualWeight }];
        }
        parsed.history.sort((a: FeedingLog, b: FeedingLog) => b.timestamp - a.timestamp);
        parsed.weightHistory.sort((a: WeightLog, b: WeightLog) => b.timestamp - a.timestamp);
        return parsed;
      } catch (e) {
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [amount, setAmount] = useState<string>('');
  const [selectedFood, setSelectedFood] = useState<FoodType>(FoodType.DRY);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState<string>('');
  const [weightDate, setWeightDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [editingLog, setEditingLog] = useState<FeedingLog | null>(null);
  const [editHour, setEditHour] = useState<string>('');
  const [editMin, setEditMin] = useState<string>('');

  const now = new Date(nowTick);
  const currentAge = useMemo(() => calculateMonthsAge(now), [nowTick]);
  const currentWeight = useMemo(() => estimateWeight(state.weightHistory || []), [state.weightHistory, nowTick]);
  const dailyNorm = useMemo(() => getDailyNorm(currentWeight, currentAge), [currentWeight, currentAge]);
  const weightGained = useMemo(() => (currentWeight - state.lastManualWeight) * 1000, [currentWeight, state.lastManualWeight]);

  const todayStr = useMemo(() => new Date().toDateString(), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayHistory = useMemo(() => {
    return state.history
      .filter(log => new Date(log.timestamp).toDateString() === todayStr)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [state.history, todayStr]);

  const consumedToday = useMemo(() => todayHistory.reduce((acc, log) => acc + log.equivalentGrams, 0), [todayHistory]);

  const lastFeedingEver = useMemo(() => {
    return state.history.length > 0 ? state.history[0].timestamp : null;
  }, [state.history]);

  const lastFeedingToday = useMemo(() => {
    if (todayHistory.length === 0) return null;
    return todayHistory[todayHistory.length - 1].timestamp;
  }, [todayHistory]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, FeedingLog[]> = {};
    const sorted = [...state.history].sort((a, b) => b.timestamp - a.timestamp);
    sorted.forEach(log => {
      const dateKey = new Date(log.timestamp).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [state.history]);

  const timeSinceLastFeedingStr = useMemo(() => {
    if (!lastFeedingToday) return 'Еще не ел сегодня';
    return getIntervalText(nowTick, lastFeedingToday);
  }, [lastFeedingToday, nowTick]);

  const isHungry = useMemo(() => {
    if (!lastFeedingEver) return false;
    const hoursSinceLastMeal = (nowTick - lastFeedingEver) / (1000 * 60 * 60);
    return hoursSinceLastMeal > 4;
  }, [lastFeedingEver, nowTick]);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setDbConnected(data.dbConnected);
      }
    } catch (e) {
      setDbConnected(false);
    }
  };

  const fetchAiAdvice = async () => {
    try {
      const res = await fetch('/api/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: currentWeight,
          age: currentAge,
          consumed: consumedToday,
          norm: dailyNorm,
          currentTime: new Date(nowTick).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          mealsCount: todayHistory.length
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiAdvice(data.advice);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRemoteData = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/state/${DEFAULT_FAMILY_ID}`);
      if (!res.ok) throw new Error('Fetch failed');
      const text = await res.text();
      if (!text || text === 'null') {
        setSyncStatus('synced');
        return;
      }
      const remoteState = JSON.parse(text);
      if (remoteState) {
        if (!remoteState.settings) remoteState.settings = {};
        remoteState.history.sort((a: any, b: any) => b.timestamp - a.timestamp);
        setState(remoteState);
        localStorage.setItem('kitten_state_bot', JSON.stringify(remoteState));
      }
      setSyncStatus('synced');
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const pushData = async (currentState: KittenState) => {
    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/state/${DEFAULT_FAMILY_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentState)
      });
      if (res.ok) setSyncStatus('synced');
      else setSyncStatus('error');
    } catch (e) {
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    const WebApp = (window as any).Telegram?.WebApp;
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('secondary_bg_color');
    }
    checkHealth();
    fetchRemoteData();
    fetchAiAdvice();
  }, []);

  const updateStateAndSync = (newState: KittenState) => {
    newState.history.sort((a, b) => b.timestamp - a.timestamp);
    setState(newState);
    localStorage.setItem('kitten_state_bot', JSON.stringify(newState));
    pushData(newState);
    setNowTick(Date.now());
  };

  const addFeeding = () => {
    let val: number, equiv: number;
    if (selectedFood === FoodType.POUCH) {
      val = 1; equiv = POUCH_DRY_EQUIVALENT;
    } else {
      val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return;
      equiv = selectedFood === FoodType.PATE ? val * PATE_DRY_EQUIVALENT_RATIO : val;
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
    setTimeout(fetchAiAdvice, 1000);
  };

  const updateWeight = () => {
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) return;

    // Создаем timestamp из выбранной даты
    const dateObj = new Date(weightDate);
    dateObj.setHours(12, 0, 0, 0); // Ставим полдень для стабильности
    const timestamp = dateObj.getTime();

    const newWeightLog = {
      id: crypto.randomUUID(),
      timestamp: timestamp,
      weight: val
    };

    const newHistory = [newWeightLog, ...(state.weightHistory || [])]
      .sort((a, b) => b.timestamp - a.timestamp);

    const latest = newHistory[0];

    const newState = {
      ...state,
      lastManualWeight: latest.weight,
      lastWeightDate: new Date(latest.timestamp).toISOString(),
      weightHistory: newHistory
    };

    updateStateAndSync(newState);
    setNewWeight('');
    setShowWeightModal(false);
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const deleteWeight = (id: string) => {
    const newWeightHistory = (state.weightHistory || []).filter(w => w.id !== id);
    if (newWeightHistory.length === 0) return; // Не удаляем последнюю запись

    const lastWeight = newWeightHistory[0];
    updateStateAndSync({
      ...state,
      weightHistory: newWeightHistory,
      lastManualWeight: lastWeight.weight,
      lastWeightDate: new Date(lastWeight.timestamp).toISOString()
    });
  };

  const startEditTime = (log: FeedingLog) => {
    const d = new Date(log.timestamp);
    setEditingLog(log);
    setEditHour(d.getHours().toString().padStart(2, '0'));
    setEditMin(d.getMinutes().toString().padStart(2, '0'));
  };

  const saveEditedTime = () => {
    if (!editingLog) return;
    const d = new Date(editingLog.timestamp);
    d.setHours(parseInt(editHour));
    d.setMinutes(parseInt(editMin));
    const newHistory = state.history.map(l => l.id === editingLog.id ? { ...l, timestamp: d.getTime() } : l);
    updateStateAndSync({ ...state, history: newHistory });
    setEditingLog(null);
  };

  const deleteFeeding = (id: string) => {
    updateStateAndSync({ ...state, history: state.history.filter(l => l.id !== id) });
  };

  const formatDateLabel = (dateKey: string) => {
    if (dateKey === todayStr) return 'Сегодня';
    const d = new Date(dateKey);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const getFoodIcon = (type: FoodType) => {
    switch (type) {
      case FoodType.DRY: return <Zap size={18} />;
      case FoodType.POUCH: return <Package size={18} />;
      case FoodType.PATE: return <Beef size={18} />;
      default: return <Utensils size={18} />;
    }
  };

  const getFoodIconBg = (type: FoodType) => {
    switch (type) {
      case FoodType.DRY: return 'bg-amber-100 text-amber-600';
      case FoodType.POUCH: return 'bg-blue-100 text-blue-600';
      case FoodType.PATE: return 'bg-rose-100 text-rose-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const renderTimeline = () => {
    const startHour = 6;
    const endHour = 24;
    const totalHours = endHour - startHour;

    return (
      <div className="mt-4 pt-4 border-t border-[var(--tg-theme-secondary-bg-color)]">
        <div className="flex justify-between items-center mb-2">
          <div className="flex justify-between text-[8px] text-[var(--tg-theme-hint-color)] font-bold flex-1 px-1">
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>
        <div className="relative h-2 bg-[var(--tg-theme-secondary-bg-color)] rounded-full overflow-hidden">
          {todayHistory.map((log) => {
            const date = new Date(log.timestamp);
            const hour = date.getHours() + date.getMinutes() / 60;
            if (hour < startHour) return null;
            const pos = ((hour - startHour) / totalHours) * 100;
            return (
              <div
                key={log.id}
                className="absolute top-0 bottom-0 w-1 bg-[var(--tg-theme-button-color)] shadow-[0_0_4px_rgba(36,139,237,0.5)] rounded-full transition-all"
                style={{ left: `${Math.min(99, pos)}%` }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const remainingToday = Math.max(0, dailyNorm - consumedToday);
  const nextMealAmount = (remainingToday / Math.max(1, 4 - todayHistory.length)).toFixed(0);

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto pb-10">
      <div className="px-4 py-3 flex justify-between items-center bg-[var(--tg-theme-secondary-bg-color)]">
        <div className="flex flex-col">
          <span className="text-[var(--tg-theme-hint-color)] text-[10px] uppercase font-bold tracking-wider mb-1">Оззи Трекер</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            <span className="text-[var(--tg-theme-text-color)] text-lg font-bold">Семья</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRemoteData} className="bg-[var(--tg-theme-bg-color)] p-2 rounded-full text-[var(--tg-theme-hint-color)]">
            <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowStatusModal(true)} className="bg-[var(--tg-theme-bg-color)] p-2 rounded-full text-[var(--tg-theme-link-color)]">
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="tg-card !mt-0 !mb-2 flex justify-between gap-4 shadow-sm">
        <div className="flex-1">
          <p className="text-[var(--tg-theme-hint-color)] text-[10px] mb-1">Возраст</p>
          <p className="font-bold text-sm leading-tight">{currentAge.toFixed(1)} мес.</p>
        </div>
        <div className="flex-1 border-x border-[var(--tg-theme-secondary-bg-color)] px-4 active:opacity-60 transition-opacity" onClick={() => setShowWeightHistoryModal(true)}>
          <div className="flex justify-between items-start mb-1">
            <p className="text-[var(--tg-theme-hint-color)] text-[10px]">Вес</p>
            {weightGained > 0 && <span className="text-[9px] text-green-500 font-bold">+{weightGained.toFixed(0)}г</span>}
          </div>
          <p className="font-bold text-sm text-[var(--tg-theme-link-color)] mb-1">{currentWeight.toFixed(3)} кг</p>
          <div className="flex items-center gap-1 text-[8px] text-green-600 bg-green-50 px-1 rounded-sm font-bold w-fit">
            <TrendingUp size={8} /> Динамика <ChevronRight size={8} />
          </div>
        </div>
        <div className="flex-1 text-right">
          <p className="text-[var(--tg-theme-hint-color)] text-[10px] mb-1">Норма/день</p>
          <p className="font-bold text-sm leading-tight">{dailyNorm.toFixed(0)}г</p>
        </div>
      </div>

      <div className="tg-card space-y-3 shadow-sm relative overflow-hidden">
        {isHungry && <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 -rotate-45 translate-x-12 -translate-y-12 pointer-events-none" />}

        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <span className="text-[var(--tg-theme-hint-color)] text-[10px] uppercase font-bold mb-1">Прогресс дня</span>
            <span className="text-xl font-black">{consumedToday.toFixed(0)}г <span className="text-xs text-[var(--tg-theme-hint-color)] font-normal">/ {dailyNorm.toFixed(0)}г</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[var(--tg-theme-hint-color)] text-[10px] uppercase font-bold mb-1">
              {isHungry ? (
                <span className="flex items-center gap-1 text-orange-600 animate-pulse">
                  <AlertCircle size={10} /> Пора покормить!
                </span>
              ) : 'С последней еды'}
            </span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-500 ${isHungry ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105' : 'bg-blue-50 text-blue-700'}`}>
              <Timer size={16} className={`${isHungry ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-black whitespace-nowrap">
                {timeSinceLastFeedingStr}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full bg-[var(--tg-theme-secondary-bg-color)] rounded-full h-2.5 overflow-hidden">
          <div className="h-full bg-[var(--tg-theme-button-color)] transition-all duration-700 rounded-full" style={{ width: `${Math.min(100, (consumedToday / dailyNorm) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-[var(--tg-theme-hint-color)]">
          <span>Остаток: <span className="text-[var(--tg-theme-text-color)] font-bold">{remainingToday.toFixed(0)}г</span></span>
          <span>Порция: ~{nextMealAmount}г</span>
        </div>

        {renderTimeline()}

        {aiAdvice && (
          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2">
            <Sparkles className="text-blue-400 shrink-0 mt-0.5" size={14} />
            <p className="text-[11px] text-blue-800 font-medium italic leading-snug">{aiAdvice}</p>
          </div>
        )}
      </div>

      <div className="px-4 mt-4 mb-2">
        <span className="text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">Добавить кормление</span>
      </div>
      <div className="tg-card !mt-0 space-y-4 shadow-sm">
        <div className="flex p-1 bg-[var(--tg-theme-secondary-bg-color)] rounded-xl">
          {(Object.keys(FOOD_LABELS) as FoodType[]).map((type) => (
            <button key={type} onClick={() => setSelectedFood(type)} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${selectedFood === type ? 'bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] shadow-sm' : 'text-[var(--tg-theme-hint-color)]'}`}>
              {FOOD_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-stretch">
          {selectedFood === FoodType.POUCH ? (
            <div className="flex-1 flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color)] rounded-xl px-4 py-3.5 font-bold text-xl text-[var(--tg-theme-hint-color)]">1 пауч</div>
          ) : (
            <input type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Грамм" className="flex-1 bg-[var(--tg-theme-secondary-bg-color)] rounded-xl py-3.5 px-4 outline-none font-bold text-xl" />
          )}
          <button onClick={addFeeding} className="tg-button-main px-10 rounded-xl font-bold">ОК</button>
        </div>
      </div>

      <div className="px-4 mt-6 mb-2">
        <span className="text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">История</span>
      </div>

      <div className="space-y-4 px-4">
        {groupedHistory.slice(0, historyLimit).map(([dateKey, logs]) => {
          const isToday = dateKey === todayStr;
          const dayTotal = logs.reduce((sum, l) => sum + l.equivalentGrams, 0);
          const dayLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

          return (
            <div key={dateKey}>
              <div className="flex items-center justify-between mb-2 ml-2 pr-2">
                <div className="flex items-center gap-2">
                  <Calendar size={10} className="text-[var(--tg-theme-hint-color)]" />
                  <span className="text-[10px] text-[var(--tg-theme-hint-color)] font-bold uppercase">
                    {formatDateLabel(dateKey)}
                    {!isToday && <span className="text-[var(--tg-theme-text-color)] ml-1 font-black"> • {dayTotal.toFixed(0)}г</span>}
                  </span>
                </div>
                {!isToday && <div className="flex items-center gap-1 text-[8px] text-[var(--tg-theme-hint-color)] font-bold uppercase tracking-tight"><Lock size={8} /> Архив</div>}
              </div>
              <div className="tg-card !m-0 p-0 overflow-hidden divide-y divide-[var(--tg-theme-secondary-bg-color)] shadow-sm">
                {[...dayLogs].reverse().map((log, idx, arr) => {
                  const prev = arr[idx + 1];
                  const interval = prev ? getIntervalText(log.timestamp, prev.timestamp) : null;
                  return (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-[var(--tg-theme-bg-color)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${getFoodIconBg(log.type)}`}>
                          {getFoodIcon(log.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold">{FOOD_LABELS[log.type]}</p>
                            {interval && <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-black uppercase">через {interval}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--tg-theme-hint-color)] flex items-center gap-1">
                              <Clock size={10} /> {formatTime(log.timestamp)} • {log.type === FoodType.POUCH ? '1 шт' : `${log.amount}г`}
                            </span>
                            {isToday && (
                              <button onClick={() => startEditTime(log)} className="text-[10px] text-[var(--tg-theme-link-color)] flex items-center gap-1 active:opacity-50">
                                <Edit2 size={8} /> Правка
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-sm">+{log.equivalentGrams.toFixed(0)}г</span>
                        {isToday && (
                          <button onClick={() => deleteFeeding(log.id)} className="text-red-400 p-2"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groupedHistory.length > historyLimit && (
          <button
            onClick={() => setHistoryLimit(prev => prev + 5)}
            className="w-full py-4 mt-2 mb-6 border-2 border-dashed border-[var(--tg-theme-secondary-bg-color)] rounded-2xl text-[var(--tg-theme-hint-color)] font-bold active:bg-[var(--tg-theme-secondary-bg-color)] transition-colors"
          >
            Показать еще (осталось {groupedHistory.length - historyLimit} дн.)
          </button>
        )}
      </div>

      {editingLog && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setEditingLog(null)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-8">Изменить время</h2>
            <div className="flex justify-center items-center gap-4 mb-10">
              <input type="number" value={editHour} onChange={(e) => setEditHour(e.target.value.slice(0, 2))} className="w-20 text-center text-4xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-4 outline-none" min="0" max="23" />
              <span className="text-4xl font-black">:</span>
              <input type="number" value={editMin} onChange={(e) => setEditMin(e.target.value.slice(0, 2))} className="w-20 text-center text-4xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-4 outline-none" min="0" max="59" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditingLog(null)} className="py-4 rounded-2xl font-bold bg-[var(--tg-theme-secondary-bg-color)]">ОТМЕНА</button>
              <button onClick={saveEditedTime} className="tg-button-main py-4 rounded-2xl font-bold">СОХРАНИТЬ</button>
            </div>
          </div>
        </div>
      )}

      {showWeightModal && (
        <div className="fixed inset-0 z-[140] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowWeightModal(false)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Взвешивание</h2>
              <button onClick={() => setShowWeightModal(false)}><X size={24} /></button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase font-bold mb-2 ml-1">Вес (кг)</p>
                <input type="number" step="0.01" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} autoFocus className="w-full text-center text-5xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-6 outline-none" placeholder="0.00" />
              </div>

              <div className="flex flex-col">
                <p className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase font-bold mb-2 ml-1">Дата</p>
                <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} className="w-full bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-3 font-bold outline-none" />
              </div>

              <button onClick={updateWeight} className="w-full tg-button-main py-5 rounded-2xl text-lg font-black mt-4">СОХРАНИТЬ</button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowStatusModal(false)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] p-8">
            <h2 className="text-2xl font-black mb-6">Настройки</h2>
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center gap-4">
                <CheckCircle2 size={24} className={dbConnected ? 'text-green-500' : 'text-red-500'} />
                <span className="font-bold">База данных {dbConnected ? 'онлайн' : 'оффлайн'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center gap-4">
                <RefreshCw size={24} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                <span className="font-bold">{syncStatus === 'synced' ? 'Синхронизировано' : 'Обновление...'}</span>
              </div>
            </div>
            <button onClick={() => setShowStatusModal(false)} className="w-full tg-button-main py-4 rounded-2xl font-bold">ЗАКРЫТЬ</button>
          </div>
        </div>
      )}

      {showWeightHistoryModal && (
        <div className="fixed inset-0 z-[130] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowWeightHistoryModal(false)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[28px] flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-6 flex justify-between items-center border-b border-[var(--tg-theme-secondary-bg-color)]">
              <h2 className="text-xl font-black">Дневник веса</h2>
              <button onClick={() => setShowWeightHistoryModal(false)} className="p-2"><X size={24} /></button>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              <button
                onClick={() => { setShowWeightHistoryModal(false); setShowWeightModal(true); }}
                className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 mb-2"
              >
                <Plus size={20} /> Записать новый вес
              </button>

              {(state.weightHistory || []).map((log, idx, arr) => {
                const prev = arr[idx + 1];
                const diff = prev ? (log.weight - prev.weight) * 1000 : null;

                return (
                  <div key={log.id} className="bg-[var(--tg-theme-secondary-bg-color)] p-4 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--tg-theme-bg-color)] rounded-full flex items-center justify-center text-[var(--tg-theme-link-color)]">
                        <Scale size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black">{log.weight.toFixed(3)} кг</p>
                        <p className="text-[10px] text-[var(--tg-theme-hint-color)]">
                          {new Date(log.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {diff !== null && (
                        <span className={`text-[10px] font-bold ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(0)}г
                        </span>
                      )}
                      {log.id !== 'initial' && (
                        <button onClick={() => deleteWeight(log.id)} className="text-red-400 p-2"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6">
              <button onClick={() => setShowWeightHistoryModal(false)} className="w-full bg-[var(--tg-theme-secondary-bg-color)] py-4 rounded-2xl font-bold">ЗАКРЫТЬ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
