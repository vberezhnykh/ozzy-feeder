
import React, { useState, useEffect, useMemo } from 'react';
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
  X 
} from 'lucide-react';

const App: React.FC = () => {
  useEffect(() => {
    const WebApp = (window as any).Telegram?.WebApp;
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('secondary_bg_color');
    }
  }, []);

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

  useEffect(() => {
    localStorage.setItem('kitten_state_bot', JSON.stringify(state));
  }, [state]);

  const now = new Date();
  const currentAge = useMemo(() => calculateMonthsAge(now), [now]);
  const currentWeight = useMemo(() => estimateWeight(state.lastManualWeight, state.lastWeightDate), [state, now]);
  const dailyNorm = useMemo(() => getDailyNorm(currentWeight, currentAge), [currentWeight, currentAge]);
  
  const weightGained = useMemo(() => {
    return (currentWeight - state.lastManualWeight) * 1000; // in grams
  }, [currentWeight, state.lastManualWeight]);

  const todayHistory = useMemo(() => {
    const todayStr = new Date().toDateString();
    return state.history.filter(log => new Date(log.timestamp).toDateString() === todayStr);
  }, [state.history]);

  const consumedToday = useMemo(() => {
    return todayHistory.reduce((acc, log) => acc + log.equivalentGrams, 0);
  }, [todayHistory]);

  const remainingToday = Math.max(0, dailyNorm - consumedToday);
  const totalMealsTarget = 4;
  const mealsLeftToday = Math.max(0, totalMealsTarget - todayHistory.length);
  
  const nextMealAmount = useMemo(() => {
    if (mealsLeftToday > 0) return (remainingToday / mealsLeftToday).toFixed(0);
    return remainingToday > 0 ? remainingToday.toFixed(0) : "0";
  }, [remainingToday, mealsLeftToday]);

  const addFeeding = () => {
    let val: number;
    let equiv: number;

    if (selectedFood === FoodType.POUCH) {
      val = 1; // 1 whole pouch
      equiv = POUCH_DRY_EQUIVALENT; // 20g dry
    } else {
      val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return;
      equiv = val; // Dry and Pate are 1:1 ratio
    }

    const newLog: FeedingLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: selectedFood,
      amount: val,
      equivalentGrams: equiv
    };
    
    setState(prev => ({ ...prev, history: [newLog, ...prev.history] }));
    setAmount('');
    
    const haptic = (window as any).Telegram?.WebApp?.HapticFeedback;
    if (haptic) haptic.notificationOccurred('success');
  };

  const updateWeight = () => {
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) return;
    setState(prev => ({ ...prev, lastManualWeight: val, lastWeightDate: new Date().toISOString() }));
    setNewWeight('');
    setShowWeightModal(false);
    const haptic = (window as any).Telegram?.WebApp?.HapticFeedback;
    if (haptic) haptic.impactOccurred('medium');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto pb-32">
      <div className="px-4 py-3 flex justify-between items-center bg-[var(--tg-theme-secondary-bg-color)]">
         <div className="flex flex-col">
            <span className="text-[var(--tg-theme-hint-color)] text-[10px] uppercase font-bold tracking-wider">Котёнок</span>
            <span className="text-[var(--tg-theme-text-color)] text-lg font-bold">Оззи</span>
         </div>
         <button onClick={() => setShowWeightModal(true)} className="bg-[var(--tg-theme-bg-color)] p-2 rounded-full text-[var(--tg-theme-link-color)] shadow-sm active:scale-95 transition-transform">
           <Scale size={20} />
         </button>
      </div>

      <div className="tg-card !mt-0 !mb-2 flex justify-between gap-4">
          <div className="flex-1">
            <p className="text-[var(--tg-theme-hint-color)] text-xs mb-1">Возраст</p>
            <p className="font-bold text-sm">{currentAge.toFixed(1)} мес.</p>
          </div>
          <div className="flex-1 border-x border-[var(--tg-theme-secondary-bg-color)] px-4">
            <div className="flex justify-between items-start mb-1">
               <p className="text-[var(--tg-theme-hint-color)] text-xs">Вес</p>
               {weightGained > 0 && (
                 <span className="text-[9px] text-green-500 font-bold flex items-center bg-green-50 px-1 rounded whitespace-nowrap">
                   +{weightGained.toFixed(0)}г
                 </span>
               )}
            </div>
            <p className="font-bold text-sm text-[var(--tg-theme-link-color)] mb-1">{currentWeight.toFixed(3)} кг</p>
            <div className="flex items-center gap-1 text-[8px] text-green-600 bg-green-50 px-1 rounded-sm font-bold w-fit">
               <TrendingUp size={8} /> +16г/день
            </div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-[var(--tg-theme-hint-color)] text-xs mb-1">Норма/день</p>
            <p className="font-bold text-sm">{dailyNorm.toFixed(0)}г <span className="text-[10px] font-normal opacity-60">сух.</span></p>
          </div>
      </div>

      <div className="tg-card space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-sm font-bold">Прогресс дня</span>
          <span className="text-xl font-black">{consumedToday.toFixed(0)}г <span className="text-xs text-[var(--tg-theme-hint-color)]">/ {dailyNorm.toFixed(0)}г</span></span>
        </div>
        <div className="w-full bg-[var(--tg-theme-secondary-bg-color)] rounded-full h-2 overflow-hidden">
          <div className="h-full bg-[var(--tg-theme-button-color)] transition-all duration-700" style={{ width: `${Math.min(100, (consumedToday / dailyNorm) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-[var(--tg-theme-hint-color)] font-medium">
          <span>Остаток: {remainingToday.toFixed(0)}г</span>
          <span>{mealsLeftToday > 0 ? `Еще ${mealsLeftToday} ${mealsLeftToday === 1 ? 'прием' : 'приема'} по ${nextMealAmount}г` : remainingToday > 0 ? `Докормить: ${remainingToday.toFixed(0)}г` : 'Норма выполнена!'}</span>
        </div>
      </div>

      <div className="px-4 mt-4 mb-2">
        <span className="text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">Добавить кормление</span>
      </div>

      <div className="tg-card !mt-0 space-y-4">
        <div className="flex p-1 bg-[var(--tg-theme-secondary-bg-color)] rounded-xl overflow-x-auto no-scrollbar">
          {(Object.keys(FOOD_LABELS) as FoodType[]).map((type) => (
            <button key={type} onClick={() => setSelectedFood(type)} className={`flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${selectedFood === type ? 'bg-[var(--tg-theme-bg-color)] shadow-sm text-[var(--tg-theme-text-color)]' : 'text-[var(--tg-theme-hint-color)]'}`}>
              {FOOD_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-stretch">
          {selectedFood === FoodType.POUCH ? (
            <div className="flex-1 flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color)] rounded-xl px-4 font-bold text-sm text-[var(--tg-theme-hint-color)]">
              1 целый пауч
            </div>
          ) : (
            <input 
              type="number" 
              inputMode="decimal" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="Грамм" 
              className="flex-1 min-w-0 bg-[var(--tg-theme-secondary-bg-color)] border-none rounded-xl py-3 px-4 outline-none font-bold text-lg" 
            />
          )}
          <button 
            onClick={addFeeding} 
            disabled={selectedFood !== FoodType.POUCH && !amount} 
            className={`tg-button-main px-4 sm:px-8 rounded-xl shrink-0 ${selectedFood !== FoodType.POUCH && !amount ? 'opacity-50 grayscale' : ''}`}
          >
            ОК
          </button>
        </div>
      </div>

      <div className="px-4 mt-4 mb-2 text-[var(--tg-theme-hint-color)] text-[11px] uppercase font-bold ml-2">История за сегодня</div>
      <div className="tg-card !mt-0 p-0 overflow-hidden divide-y divide-[var(--tg-theme-secondary-bg-color)]">
        {todayHistory.length === 0 ? <div className="p-8 text-center text-[var(--tg-theme-hint-color)] text-sm italic">Список пуст</div> : todayHistory.map((log) => (
          <div key={log.id} className="flex items-center justify-between p-4 bg-[var(--tg-theme-bg-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-[var(--tg-theme-link-color)]"><Utensils size={18} /></div>
              <div>
                <p className="text-sm font-bold">{FOOD_LABELS[log.type]}</p>
                <p className="text-[10px] text-[var(--tg-theme-hint-color)]">
                  {formatTime(log.timestamp)} • {log.type === FoodType.POUCH ? '1 шт' : `${log.amount}г`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">+{log.equivalentGrams.toFixed(0)}г</span>
              <button onClick={() => setState(p => ({...p, history: p.history.filter(l => l.id !== log.id)}))} className="text-red-400 p-1"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-6 p-4 rounded-2xl bg-[var(--tg-theme-link-color)] bg-opacity-10 border border-[var(--tg-theme-link-color)] border-opacity-20 mb-8">
         <div className="flex gap-3">
            <Calendar className="text-[var(--tg-theme-link-color)] shrink-0" size={20} />
            <p className="text-[11px] leading-relaxed text-[var(--tg-theme-text-color)] opacity-80 font-medium">
              Вес увеличивается <b>ежедневно</b>. Сегодня расчетная норма построена на весе {currentWeight.toFixed(3)} кг. Чем выше вес, тем больше грамм в норме.
            </p>
         </div>
      </div>

      {showWeightModal && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-[2px]">
          <div className="absolute inset-0" onClick={() => setShowWeightModal(false)} />
          <div className="relative bg-[var(--tg-theme-bg-color)] rounded-t-[24px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-[var(--tg-theme-secondary-bg-color)] rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Вес</h2><button onClick={() => setShowWeightModal(false)} className="bg-[var(--tg-theme-secondary-bg-color)] p-1.5 rounded-full"><X size={20} /></button></div>
            <div className="relative mb-8">
              <input type="number" step="0.01" inputMode="decimal" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} autoFocus className="w-full text-center text-4xl font-black bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl py-6 outline-none" placeholder="0.00" />
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-lg font-bold opacity-30">кг</span>
            </div>
            <button onClick={updateWeight} className="w-full tg-button-main py-4 rounded-xl text-lg mb-2">Обновить</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 right-4 bg-[var(--tg-theme-bg-color)] border border-[var(--tg-theme-secondary-bg-color)] p-3 rounded-2xl shadow-xl flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${remainingToday > 0 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
          <div><p className="text-[10px] uppercase font-bold text-[var(--tg-theme-hint-color)]">Рекомендация</p>
          <p className="text-xs font-bold">{remainingToday > 0 ? `Порция: ${nextMealAmount}г` : 'Норма дня выполнена'}</p></div>
        </div>
        <ChevronRight size={16} className="text-[var(--tg-theme-hint-color)]" />
      </div>
    </div>
  );
};

export default App;
