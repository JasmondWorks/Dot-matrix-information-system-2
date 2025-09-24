import {
  CalendarClock,
  Home,
  ListChecks,
  MessageSquarePlus,
  Settings2,
} from "lucide-react";

import type { RouteDefinition } from "@/lib/types";
import HomePage from "@/pages/Home";
import MessageDetails from "@/pages/MessageDetails";
import MessagesPage from "@/pages/Messages";
import NewMessagePage from "@/pages/NewMessage";
import NewSchedulePage from "@/pages/NewSchedule";
import ScheduledMessagesPage from "@/pages/ScheduledMessages";
import SettingsPage from "@/pages/Settings";

export const routes: RouteDefinition[] = [
  { path: "/", label: "Home", page: <HomePage />, icon: Home, showInNav: true },
  {
    path: "/messages",
    label: "Saved Messages",
    page: <MessagesPage />,
    icon: ListChecks,
    showInNav: true,
  },
  {
    path: "/messages/new",
    label: "New Message",
    page: <NewMessagePage />,
    icon: MessageSquarePlus,
    showInNav: true,
  },
  { path: "/messages/:id", label: "Message Details", page: <MessageDetails /> },
  {
    path: "/schedules",
    label: "Scheduled",
    page: <ScheduledMessagesPage />,
    icon: CalendarClock,
    showInNav: true,
  },
  {
    path: "/schedules/new",
    label: "Create Schedule",
    page: <NewSchedulePage />,
  },
  {
    path: "/settings",
    label: "Settings",
    page: <SettingsPage />,
    icon: Settings2,
    showInNav: true,
  },
];

export const navItems = routes.filter((route) => route.showInNav);

