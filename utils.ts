
import {
  BIRTH_DATE,
  GROWTH_RATES,
  FEEDING_TABLE
} from './constants';

import { WeightLog } from './types';

export const calculateMonthsAge = (date: Date): number => {
  const birth = new Date(BIRTH_DATE);
  const diffTime = Math.abs(date.getTime() - birth.getTime());
  return diffTime / (1000 * 60 * 60 * 24 * 30.44);
};

export const getPersonalGrowthRate = (history: WeightLog[]): number | null => {
  if (!history || history.length < 2) return null;

  // Берем последние две точки взвешивания
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const p1 = sorted[0]; // Новое
  const p2 = sorted[1]; // Предыдущее

  const diffGrams = (p1.weight - p2.weight) * 1000;
  const diffDays = (p1.timestamp - p2.timestamp) / (1000 * 60 * 60 * 24);

  if (diffDays <= 0.5) return null; // Слишком маленький интервал для точности

  const rate = diffGrams / diffDays;
  // Ограничиваем разумными пределами (от 5 до 40г в день)
  return Math.max(5, Math.min(40, rate));
};

export const estimateWeight = (history: WeightLog[]): number => {
  if (!history || history.length === 0) return 0;

  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const lastMeasurement = sorted[0];
  const now = Date.now();
  const diffDays = (now - lastMeasurement.timestamp) / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) return lastMeasurement.weight;

  const ageAtMeasurement = calculateMonthsAge(new Date(lastMeasurement.timestamp));

  // После 12 месяцев рост прекращается
  if (ageAtMeasurement >= 12) return lastMeasurement.weight;

  // Рассчитываем темп роста: либо персональный, либо стандартный по возрасту
  let dailyRate = getPersonalGrowthRate(history);

  if (dailyRate === null) {
    if (ageAtMeasurement < 1) dailyRate = GROWTH_RATES.PRE_1_MONTH;
    else if (ageAtMeasurement < 4) dailyRate = GROWTH_RATES.MONTH_1_TO_4;
    else dailyRate = GROWTH_RATES.MONTH_4_TO_12;
  }

  // Если в процессе прогноза кот перешагнет 12 месяцев, останавливаем рост
  const daysUntil12Mo = Math.max(0, (12 - ageAtMeasurement) * 30.44);
  const effectiveGrowthDays = Math.min(diffDays, daysUntil12Mo);

  const estimatedGrams = lastMeasurement.weight * 1000 + effectiveGrowthDays * dailyRate;
  return estimatedGrams / 1000;
};

export const getDailyNorm = (weight: number, ageMonths: number): number => {
  let bracket = FEEDING_TABLE.MO_7_TO_12;
  if (ageMonths < 3) bracket = FEEDING_TABLE.UNDER_3_MO;
  else if (ageMonths < 7) bracket = FEEDING_TABLE.MO_4_TO_6;

  const sorted = [...bracket].sort((a, b) => a.weight - b.weight);

  if (weight <= sorted[0].weight) return sorted[0].norm;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (weight >= p1.weight && weight <= p2.weight) {
      return p1.norm + (weight - p1.weight) * (p2.norm - p1.norm) / (p2.weight - p1.weight);
    }
  }

  // Если вес больше последнего значения в таблице, экстраполируем по последним двум точкам
  if (sorted.length >= 2) {
    const pLast = sorted[sorted.length - 1];
    const pPrev = sorted[sorted.length - 2];
    const ratePerKg = (pLast.norm - pPrev.norm) / (pLast.weight - pPrev.weight);
    return pLast.norm + (weight - pLast.weight) * ratePerKg;
  }

  return sorted[sorted.length - 1].norm;
};

export const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const getIntervalText = (currentTimestamp: number, prevTimestamp: number): string => {
  const diffMs = currentTimestamp - prevTimestamp;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 2) return 'только что';
  if (diffMins < 60) return `${diffMins}м`;

  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hrs}ч ${mins}м` : `${hrs}ч`;
};
