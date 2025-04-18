export interface Stop {
  id: string;
  name: string;
  type: string | null;
  timezone: string | null;
  description: string | null;
  city: string | null;
  location: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface Call {
  sequence: number;
  stop: Stop;
  arrival: string | null;
  departure: string | null;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Line {
  code: string;
  name: string | null;
  brand: Brand;
}

export interface Deviation {
  deviation_timestamp: string;
  deviation_seconds: number;
  reason: string | null;
  deviation_class:
    | "LATE"
    | "ON_TIME"
    | "EARLY"
    | "CANCELLED"
    | "UNKNOWN"
    | "DELAYED";
  deviation_type: string;
  updated_at: string;
}

export interface Status {
  segment: string | null;
  progress: string | null;
  scheduled_timestamp: string;
  deviation: Deviation;
}

export interface TheoreticalSchedule {
  is_theoretical: boolean;
  source: "night_data" | null;
  schedule_type: "THEORETICAL" | "REAL_TIME";
  last_updated: string | null;
}

export interface Ride {
  id: string;
  status: Status;
  platform: string | null;
  line: Line;
  location: {
    latitude: number;
    longitude: number;
  } | null;
  calls: Call[];
  vehicle: {
    id: string;
    name: string;
  } | null;
  theoretical_schedule: TheoreticalSchedule;
}

export interface Station {
  id: string;
  name: string;
  timezone: string;
}

export interface BlaBlaBusResponse {
  rides: Ride[];
  station: Station;
}
