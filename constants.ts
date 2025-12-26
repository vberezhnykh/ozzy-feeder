
import { FoodType, FeedingNorm } from './types';

export const BIRTH_DATE = '2025-08-04';
export const INITIAL_WEIGHT_DATE = '2025-12-26';
export const INITIAL_WEIGHT = 2.5;

export const DEFAULT_FAMILY_ID = 'ozzy-home'; // Единый ID для вас с женой

export const POUCH_DRY_EQUIVALENT = 20; // 1 pouch = 20g dry
export const PATE_DRY_EQUIVALENT_RATIO = 0.5; // 1g pate = 0.5g dry (на основе данных Trovet)

// Growth rates in grams per day
export const GROWTH_RATES = {
  PRE_1_MONTH: 12.5, // 10-15g
  MONTH_1_TO_4: 14,
  MONTH_4_TO_12: 15.9 // 111g/week
};

// Feeding table from image (Dry equivalent grams)
export const FEEDING_TABLE: Record<string, { weight: number; norm: number }[]> = {
  UNDER_3_MO: [
    { weight: 0.5, norm: 30 },
    { weight: 1.0, norm: 55 }
  ],
  MO_4_TO_6: [
    { weight: 1.5, norm: 60 },
    { weight: 2.0, norm: 75 },
    { weight: 3.0, norm: 100 }
  ],
  MO_7_TO_12: [
    { weight: 2.0, norm: 60 },
    { weight: 3.0, norm: 80 },
    { weight: 4.0, norm: 100 },
    { weight: 5.0, norm: 120 }
  ]
};

export const FOOD_LABELS: Record<FoodType, string> = {
  [FoodType.DRY]: 'Сухой корм',
  [FoodType.POUCH]: 'Пауч',
  [FoodType.PATE]: 'Паштет'
};
