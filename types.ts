
export enum FoodType {
  DRY = 'DRY',
  POUCH = 'POUCH',
  PATE = 'PATE'
}

export interface FeedingLog {
  id: string;
  timestamp: number;
  type: FoodType;
  amount: number; // in grams (or count for pouches)
  equivalentGrams: number; // converted to dry equivalent
}

export interface KittenSettings {
  remindersEnabled: boolean;
}

export interface KittenState {
  birthDate: string; // ISO string
  lastManualWeight: number; // in kg
  lastWeightDate: string; // ISO string
  history: FeedingLog[];
  settings: KittenSettings;
  lastReminderTimestamp?: number;
}

export interface FeedingNorm {
  minWeight: number;
  maxWeight: number;
  minNorm: number;
  maxNorm: number;
}
