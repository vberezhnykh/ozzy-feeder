
import { 
  BIRTH_DATE, 
  GROWTH_RATES, 
  FEEDING_TABLE 
} from './constants';

export const calculateMonthsAge = (date: Date): number => {
  const birth = new Date(BIRTH_DATE);
  const diffTime = Math.abs(date.getTime() - birth.getTime());
  return diffTime / (1000 * 60 * 60 * 24 * 30.44);
};

export const estimateWeight = (lastWeight: number, lastDateStr: string): number => {
  const lastDate = new Date(lastDateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return lastWeight;

  const ageMonthsAtLastWeight = calculateMonthsAge(lastDate);
  let estimatedWeight = lastWeight * 1000; // to grams

  for (let i = 0; i < diffDays; i++) {
    const currentAge = calculateMonthsAge(new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000));
    let rate = 0;
    if (currentAge < 1) rate = GROWTH_RATES.PRE_1_MONTH;
    else if (currentAge < 4) rate = GROWTH_RATES.MONTH_1_TO_4;
    else rate = GROWTH_RATES.MONTH_4_TO_12;
    
    estimatedWeight += rate;
  }

  return estimatedWeight / 1000; // back to kg
};

export const getDailyNorm = (weight: number, ageMonths: number): number => {
  let bracket = FEEDING_TABLE.MO_7_TO_12;
  if (ageMonths < 3) bracket = FEEDING_TABLE.UNDER_3_MO;
  else if (ageMonths < 7) bracket = FEEDING_TABLE.MO_4_TO_6;

  const sorted = [...bracket].sort((a, b) => a.weight - b.weight);
  
  if (weight <= sorted[0].weight) return sorted[0].norm;
  if (weight >= sorted[sorted.length - 1].weight) return sorted[sorted.length - 1].norm;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i+1];
    if (weight >= p1.weight && weight <= p2.weight) {
      return p1.norm + (weight - p1.weight) * (p2.norm - p1.norm) / (p2.weight - p1.weight);
    }
  }

  return sorted[sorted.length - 1].norm;
};

export const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const getIntervalText = (currentTimestamp: number, prevTimestamp: number): string => {
  const diffMs = currentTimestamp - prevTimestamp;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 0) return '';
  if (diffMins < 60) return `${diffMins}м`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hrs}ч ${mins}м` : `${hrs}ч`;
};
