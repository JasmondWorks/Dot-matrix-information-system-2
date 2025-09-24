import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";

import {
  type DeviceCapabilities,
  type DeviceSettings,
  type DeviceState,
  type Message,
  type MessageInput,
  type MessageTag,
  type Schedule,
  type ScheduleInput,
} from "@/lib/types";
import {
  computeNextRunAt,
  formatRecurrenceSummary,
} from "@/lib/time";

interface AppState {
  device: DeviceState;
  capabilities: DeviceCapabilities;
  settings: DeviceSettings;
  messages: Message[];
  schedules: Schedule[];
}

interface AppDataContextValue extends AppState {
  recentMessages: Message[];
  actions: {
    connectDevice: () => void;
    disconnectDevice: () => void;
    syncRTC: () => void;
    updateDevice: (next: Partial<DeviceState>) => void;
    createMessage: (
      payload: MessageInput,
      options?: { tags?: MessageTag[]; sendNow?: boolean }
    ) => Message;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    deleteMessage: (id: string) => void;
    createSchedule: (payload: ScheduleInput) => Schedule;
    updateSchedule: (id: string, updates: Partial<Schedule>) => void;
    deleteSchedule: (id: string) => void;
    updateSettings: (updates: Partial<DeviceSettings>) => void;
  };
}

type AppAction =
  | { type: "CONNECT_DEVICE" }
  | { type: "DISCONNECT_DEVICE" }
  | { type: "SYNC_RTC" }
  | { type: "UPDATE_DEVICE"; payload: Partial<DeviceState> }
  | { type: "UPSERT_MESSAGE"; payload: Message }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<Message> } }
  | { type: "DELETE_MESSAGE"; payload: string }
  | { type: "UPSERT_SCHEDULE"; payload: Schedule }
  | { type: "UPDATE_SCHEDULE"; payload: { id: string; updates: Partial<Schedule> } }
  | { type: "DELETE_SCHEDULE"; payload: string }
  | { type: "SET_CURRENT_MESSAGE"; payload?: { messageId?: string; excerpt?: string } }
  | { type: "UPDATE_SETTINGS"; payload: Partial<DeviceSettings> };

const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const stamp = () => new Date().toISOString();

const ensureTags = (tags: MessageTag[] = []) => {
  const set = new Set(tags);
  if (!set.size) set.add("saved");
  return Array.from(set);
};

const cleanMessagingFields = (payload: MessageInput) => ({
  durationSec: payload.numScrolls ? undefined : payload.durationSec,
  numScrolls: payload.durationSec ? undefined : payload.numScrolls,
});

const buildMessage = (input: MessageInput, tags: MessageTag[] = []): Message => {
  const createdAt = stamp();
  const soundEnabled = input.soundEnabled ?? false;
  const cleaned = cleanMessagingFields(input);
  return {
    id: generateId("msg"),
    title: input.title,
    body: input.body,
    soundFileId: input.soundFileId,
    soundEnabled,
    scrollSpeed: input.scrollSpeed,
    animation: input.animation,
    durationSec: cleaned.durationSec,
    numScrolls: cleaned.numScrolls,
    muted: soundEnabled === false,
    createdAt,
    updatedAt: createdAt,
    tags: ensureTags(tags),
  };
};

const buildSchedule = (payload: ScheduleInput): Schedule => {
  const nextRunAt = computeNextRunAt(payload);
  return {
    id: generateId("sch"),
    messageId: payload.messageId,
    days: payload.days,
    specificDates: payload.specificDates,
    time: payload.time,
    timezone: payload.timezone,
    nextRunAt,
    enabled: payload.enabled ?? true,
    recurrenceSummary: formatRecurrenceSummary(payload),
  };
};

const withScheduledTags = (messages: Message[], schedules: Schedule[]) => {
  const scheduledIds = new Set(schedules.map((schedule) => schedule.messageId));
  return messages.map((message) => {
    const tags = new Set(message.tags);
    if (scheduledIds.has(message.id)) {
      tags.add("scheduled");
    } else {
      tags.delete("scheduled");
    }
    return { ...message, tags: Array.from(tags) };
  });
};

const initialState: AppState = {
  device: {
    connected: true,
    ip: "192.168.4.1",
    name: "PixelSign-01",
    isOn: true,
    currentMessageId: "msg-launch",
    currentMessageExcerpt: "Grand opening this weekend",
    scrollsDone: 2,
    timeLeftSec: 120,
    ledColor: "#FF5A5F",
    font: "Orbitron",
    rtcTime: stamp(),
    batteryPct: 78,
  },
  capabilities: {
    maxCharsPerFrame: 32,
    supportsSound: true,
    supportsMultiMessageBatch: false,
  },
  settings: {
    dateDisplayEnabled: true,
    calendarVisible: true,
    ledColor: "#FF5A5F",
    font: "Orbitron",
    soundEnabled: true,
  },
  messages: [
    {
      id: "msg-launch",
      title: "Grand Opening",
      body: "Grand opening this weekend! Doors open at 9AM.",
      soundEnabled: true,
      soundFileId: "snd-celebrate",
      scrollSpeed: "normal",
      animation: "slide",
      numScrolls: 5,
      createdAt: stamp(),
      updatedAt: stamp(),
      muted: false,
      tags: ["saved", "scheduled"],
    },
    {
      id: "msg-special",
      title: "Flash Deal",
      body: "Flash deal: 50% off accessories today only!",
      soundEnabled: false,
      scrollSpeed: "fast",
      animation: "cut",
      durationSec: 45,
      createdAt: stamp(),
      updatedAt: stamp(),
      muted: true,
      tags: ["saved"],
    },
    {
      id: "msg-queue",
      title: "Now Playing",
      body: "Now displaying: PixelSign product demo.",
      soundEnabled: true,
      soundFileId: "snd-loop",
      scrollSpeed: "slow",
      animation: "fade",
      durationSec: 120,
      createdAt: stamp(),
      updatedAt: stamp(),
      muted: false,
      tags: ["saved"],
    },
  ],
  schedules: [],
};

const recurringSchedule = {
  messageId: "msg-launch",
  days: ["Mon", "Wed", "Fri"] as Schedule["days"],
  time: "09:00",
};

const weekendScheduleDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2)
  .toISOString()
  .slice(0, 10);

initialState.schedules = [
  {
    id: "sch-weekdays",
    messageId: recurringSchedule.messageId,
    days: recurringSchedule.days,
    time: recurringSchedule.time,
    timezone: "UTC",
    nextRunAt: computeNextRunAt(recurringSchedule),
    enabled: true,
    recurrenceSummary: formatRecurrenceSummary(recurringSchedule),
  },
  {
    id: "sch-weekend",
    messageId: "msg-special",
    specificDates: [weekendScheduleDate],
    time: "18:00",
    timezone: "UTC",
    nextRunAt: computeNextRunAt({
      messageId: "msg-special",
      specificDates: [weekendScheduleDate],
      time: "18:00",
    }),
    enabled: true,
    recurrenceSummary: formatRecurrenceSummary({
      messageId: "msg-special",
      specificDates: [weekendScheduleDate],
      time: "18:00",
    }),
  },
];

initialState.messages = withScheduledTags(initialState.messages, initialState.schedules);

const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "CONNECT_DEVICE":
      return {
        ...state,
        device: { ...state.device, connected: true },
      };
    case "DISCONNECT_DEVICE":
      return {
        ...state,
        device: { ...state.device, connected: false },
      };
    case "SYNC_RTC":
      return {
        ...state,
        device: { ...state.device, rtcTime: stamp() },
      };
    case "UPDATE_DEVICE":
      return {
        ...state,
        device: { ...state.device, ...action.payload },
      };
    case "UPSERT_MESSAGE": {
      const message = action.payload;
      const existingIndex = state.messages.findIndex((item) => item.id === message.id);
      const nextMessages = [...state.messages];
      if (existingIndex >= 0) {
        nextMessages[existingIndex] = message;
      } else {
        nextMessages.unshift(message);
      }
      return { ...state, messages: withScheduledTags(nextMessages, state.schedules) };
    }
    case "UPDATE_MESSAGE": {
      const nextMessages = state.messages.map((message) => {
        if (message.id !== action.payload.id) return message;
        const nextSoundEnabled =
          action.payload.updates.soundEnabled ?? message.soundEnabled ?? false;
        return {
          ...message,
          ...action.payload.updates,
          soundEnabled: nextSoundEnabled,
          muted: nextSoundEnabled === false,
          updatedAt: stamp(),
        };
      });
      return { ...state, messages: withScheduledTags(nextMessages, state.schedules) };
    }
    case "DELETE_MESSAGE": {
      const filteredMessages = state.messages.filter((message) => message.id !== action.payload);
      const filteredSchedules = state.schedules.filter((schedule) => schedule.messageId !== action.payload);
      return {
        ...state,
        messages: withScheduledTags(filteredMessages, filteredSchedules),
        schedules: filteredSchedules,
        device:
          state.device.currentMessageId === action.payload
            ? { ...state.device, currentMessageId: undefined, currentMessageExcerpt: undefined }
            : state.device,
      };
    }
    case "UPSERT_SCHEDULE": {
      const schedule = action.payload;
      const nextSchedules = [...state.schedules];
      const existingIndex = state.schedules.findIndex((item) => item.id === schedule.id);
      if (existingIndex >= 0) {
        nextSchedules[existingIndex] = schedule;
      } else {
        nextSchedules.push(schedule);
      }
      return {
        ...state,
        schedules: nextSchedules,
        messages: withScheduledTags(state.messages, nextSchedules),
      };
    }
    case "UPDATE_SCHEDULE": {
      const nextSchedules = state.schedules.map((schedule) => {
        if (schedule.id !== action.payload.id) return schedule;
        const next = {
          ...schedule,
          ...action.payload.updates,
        };
        return {
          ...next,
          nextRunAt: computeNextRunAt({ ...next }),
          recurrenceSummary: formatRecurrenceSummary({ ...next }),
        };
      });
      return {
        ...state,
        schedules: nextSchedules,
        messages: withScheduledTags(state.messages, nextSchedules),
      };
    }
    case "DELETE_SCHEDULE": {
      const nextSchedules = state.schedules.filter((schedule) => schedule.id !== action.payload);
      return {
        ...state,
        schedules: nextSchedules,
        messages: withScheduledTags(state.messages, nextSchedules),
      };
    }
    case "SET_CURRENT_MESSAGE":
      return {
        ...state,
        device: {
          ...state.device,
          currentMessageId: action.payload?.messageId,
          currentMessageExcerpt: action.payload?.excerpt,
          scrollsDone: 0,
          timeLeftSec: undefined,
        },
      };
    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    default:
      return state;
  }
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const recentMessages = useMemo(
    () =>
      [...state.messages]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [state.messages]
  );

  const actions = useMemo(
    () => ({
      connectDevice: () => dispatch({ type: "CONNECT_DEVICE" }),
      disconnectDevice: () => dispatch({ type: "DISCONNECT_DEVICE" }),
      syncRTC: () => dispatch({ type: "SYNC_RTC" }),
      updateDevice: (next: Partial<DeviceState>) =>
        dispatch({ type: "UPDATE_DEVICE", payload: next }),
      createMessage: (payload: MessageInput, options?: { tags?: MessageTag[]; sendNow?: boolean }) => {
        const base = buildMessage(payload, options?.tags);
        dispatch({ type: "UPSERT_MESSAGE", payload: base });
        if (options?.sendNow) {
          dispatch({
            type: "SET_CURRENT_MESSAGE",
            payload: {
              messageId: base.id,
              excerpt: base.body.slice(0, 64),
            },
          });
        }
        return base;
      },
      updateMessage: (id: string, updates: Partial<Message>) =>
        dispatch({ type: "UPDATE_MESSAGE", payload: { id, updates } }),
      deleteMessage: (id: string) => dispatch({ type: "DELETE_MESSAGE", payload: id }),
      createSchedule: (payload: ScheduleInput) => {
        const schedule = buildSchedule(payload);
        dispatch({ type: "UPSERT_SCHEDULE", payload: schedule });
        return schedule;
      },
      updateSchedule: (id: string, updates: Partial<Schedule>) =>
        dispatch({ type: "UPDATE_SCHEDULE", payload: { id, updates } }),
      deleteSchedule: (id: string) => dispatch({ type: "DELETE_SCHEDULE", payload: id }),
      updateSettings: (updates: Partial<DeviceSettings>) =>
        dispatch({ type: "UPDATE_SETTINGS", payload: updates }),
    }),
    []
  );

  const value: AppDataContextValue = {
    ...state,
    recentMessages,
    actions,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
};

