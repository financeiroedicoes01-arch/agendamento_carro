import { createContext, useContext } from "react";
import type { Backend, Snapshot, Profile, CommandResult } from "./types";
export type Screen =
  "trips" | "pending" | "calendar" | "incidents" | "vehicles" | "admin";
export interface Dialog {
  type: string;
  id?: string;
  vehicleId?: string;
  value?: string;
}
interface AppContext {
  data: Snapshot;
  user: Profile;
  api: Backend;
  isDemo: boolean;
  screen: Screen;
  navigate(screen: Screen): void;
  manages(id: string): boolean;
  name(id: string): string;
  open(dialog: Dialog | null): void;
  run(
    action: string,
    payload?: Record<string, unknown>,
    message?: string,
  ): Promise<CommandResult>;
  notify(message: string, error?: boolean): void;
  refresh(): Promise<void>;
}
export const Context = createContext<AppContext>(null!);
export function useApp() {
  return useContext(Context);
}
