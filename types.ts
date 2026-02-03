
export enum TripType {
  BUSINESS = '商業用途',
  PRIVATE = '私人用途'
}

export enum DistanceUnit {
  KM = '公里 (km)',
  MILES = '英里 (miles)'
}

export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark'
}

export interface TripLocation {
  latitude: number;
  longitude: number;
  address?: string;
  mapsUrl?: string;
}

export interface Trip {
  id: string;
  startTime: number;
  endTime: number;
  startLocation: TripLocation;
  endLocation: TripLocation;
  distance: number; // Stored in KM internally
  unit: DistanceUnit;
  type: TripType;
  notes: string;
  durationSeconds: number;
}

export interface UserSettings {
  preferredUnit: DistanceUnit;
  theme: AppTheme;
}
