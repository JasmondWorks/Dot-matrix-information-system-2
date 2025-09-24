import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ScrollSpeed = "slow" | "normal" | "fast";
export type SwitchAnimation = "cut" | "slide" | "fade";
export type MessageTag = "saved" | "scheduled";

export interface Message {
  id: string;
  title: string;
  body: string;
  soundFileId?: string;
  soundEnabled?: boolean;
  scrollSpeed: ScrollSpeed;
  animation: SwitchAnimation;
  durationSec?: number;
  numScrolls?: number;
  muted?: boolean;
  createdAt: string;
  updatedAt: string;
  tags: MessageTag[];
}

export interface MessageInput {
  title: string;
  body: string;
  soundFileId?: string;
  soundEnabled?: boolean;
  scrollSpeed: ScrollSpeed;
  animation: SwitchAnimation;
  durationSec?: number;
  numScrolls?: number;
  tags?: MessageTag[];
}

export interface Schedule {
  id: string;
  messageId: string;
  days?: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">;
  specificDates?: string[];
  time: string;
  timezone?: string;
  nextRunAt?: string;
  enabled: boolean;
  recurrenceSummary?: string;
}

export interface ScheduleInput {
  messageId: string;
  days?: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">;
  specificDates?: string[];
  time: string;
  timezone?: string;
  enabled?: boolean;
}

export interface DeviceState {
  connected: boolean;
  ip?: string;
  name?: string;
  isOn?: boolean;
  currentMessageId?: string;
  currentMessageExcerpt?: string;
  scrollsDone?: number;
  timeLeftSec?: number;
  ledColor?: string;
  font?: string;
  rtcTime?: string;
  batteryPct?: number;
}

export interface DeviceCapabilities {
  maxCharsPerFrame: number;
  supportsSound: boolean;
  supportsMultiMessageBatch: boolean;
}

export interface DeviceSettings {
  dateDisplayEnabled: boolean;
  calendarVisible: boolean;
  ledColor: string;
  font: string;
  soundEnabled: boolean;
}

export interface RouteDefinition {
  path: string;
  label: string;
  page: ReactNode;
  icon?: LucideIcon;
  showInNav?: boolean;
  description?: string;
}

export interface DeviceOverview {
  device: DeviceState;
  capabilities: DeviceCapabilities;
}

export interface NextScheduled {
  schedule?: Schedule;
  message?: Message;
}

