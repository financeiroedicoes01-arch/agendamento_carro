export interface Unit {
  id: string;
  name: string;
  kind: "sector" | "house";
  active: boolean;
}
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  unit_id: string | null;
  is_admin: boolean;
  active: boolean;
}
export interface Vehicle {
  id: string;
  name: string;
  model: string;
  plate: string;
  unit_id: string;
  manager_id: string;
  photo_path: string | null;
  color: string;
  active: boolean;
}
export interface Assignment {
  id: string;
  vehicle_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
}
export interface Request {
  id: string;
  driver_id: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  mode: "specific" | "any";
  status: string;
  created_at: string;
}
export interface Candidate {
  id: string;
  request_id: string;
  vehicle_id: string;
  status: string;
  decided_by: string | null;
  reason: string | null;
}
export interface Trip {
  id: string;
  driver_id: string;
  vehicle_id: string;
  request_id: string | null;
  series_id: string | null;
  destination: string;
  starts_at: string;
  ends_at: string;
  status: string;
  actual_start: string | null;
  actual_end: string | null;
  km_out: number | null;
  km_in: number | null;
  departure_by: string | null;
  return_by: string | null;
  departure_note: string | null;
  return_note: string | null;
  no_incidents: boolean | null;
}
export interface Change {
  id: string;
  reservation_id: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  kind: string;
  status: string;
}
export interface Series {
  id: string;
  driver_id: string;
  vehicle_id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  day_span: number;
  frequency: string;
  weekdays: number[];
  active: boolean;
  generated_until: string | null;
}
export interface Block {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string | null;
  reason: string;
  released_at: string | null;
}
export interface Fuel {
  id: string;
  reservation_id: string;
  amount: number;
  receipt_path: string;
}
export interface Incident {
  id: string;
  reservation_id: string;
  kind: "problem" | "accident";
  description: string;
  occurred_at: string;
  location: string;
  photos: string[];
  status: string;
  measures: string;
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  entity_id: string | null;
  entity_type: string;
  read_at: string | null;
  created_at: string;
}
export interface CalendarEvent {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string;
  kind: string;
  reservation_id: string | null;
}
export interface Audit {
  id: string;
  actor_id: string | null;
  action: string;
  entity_id: string;
  before_data: unknown;
  after_data: Record<string, unknown>;
  created_at: string;
}
export interface Snapshot {
  settings: { timezone: string; recurrence_horizon: number };
  profiles: Profile[];
  directory: Pick<Profile, "id" | "full_name">[];
  units: Unit[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  requests: Request[];
  candidates: Candidate[];
  reservations: Trip[];
  changes: Change[];
  series: Series[];
  blocks: Block[];
  fuels: Fuel[];
  incidents: Incident[];
  notifications: Notice[];
  calendar: CalendarEvent[];
  audit_log: Audit[];
}
export interface CommandResult {
  id?: string;
  reservation_id?: string;
  created?: number;
  updated?: number;
  skipped?: { date: string; reason: string }[];
}
export interface Backend {
  snapshot(): Promise<Snapshot>;
  command(
    action: string,
    payload?: Record<string, unknown>,
  ): Promise<CommandResult>;
  upload(file: File, bucket: string, tripId?: string): Promise<string>;
  fileUrl(bucket: string, path: string): Promise<string>;
  logout(): Promise<void>;
}
