
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
  // Пока пусто, задел на будущее
}

export interface WeightLog {
  id: string;
  timestamp: number;
  weight: number;
}

export interface KittenState {
  birthDate: string; // ISO string
  lastManualWeight: number; // in kg
  lastWeightDate: string; // ISO string
  history: FeedingLog[];
  weightHistory?: WeightLog[];
  settings: KittenSettings;
}

export interface FeedingNorm {
  minWeight: number;
  maxWeight: number;
  minNorm: number;
  maxNorm: number;
}
