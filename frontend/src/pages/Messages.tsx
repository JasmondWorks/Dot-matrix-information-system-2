import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import TagChip from "@/components/common/TagChip";
import SoundBadge from "@/components/messages/SoundBadge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatDuration,
  formatScrolls,
} from "@/lib/time";
import { useAppData } from "@/state/AppDataContext";

const Messages = () => {
  const navigate = useNavigate();
  const { device, messages, schedules, actions } = useAppData();

  const scheduleMap = useMemo(() => {
    return messages.reduce<Record<string, number>>((accumulator, message) => {
      accumulator[message.id] = schedules.filter((schedule) => schedule.messageId === message.id).length;
      return accumulator;
    }, {});
  }, [messages, schedules]);

  const handleSendNow = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) return;
    if (!device.connected) {
      window.alert("Device is disconnected. Connect before sending.");
      return;
    }
    actions.updateDevice({
      currentMessageId: message.id,
      currentMessageExcerpt: message.body.slice(0, 64),
      scrollsDone: 0,
      timeLeftSec: message.durationSec,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Saved messages</h1>
          <p className="text-sm text-muted-foreground">
            Draft and reuse messages. Send instantly or schedule them for later.
          </p>
        </div>
        <Button asChild>
          <Link to="/messages/new">New message</Link>
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border bg-muted/50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Message</span>
          <span className="text-center">Tags</span>
          <span className="text-center">Length</span>
          <span className="text-center">Updated</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-border">
          {messages.map((message) => (
            <div
              key={message.id}
              className="grid items-center gap-4 px-4 py-5 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:px-6"
            >
              <div className="space-y-2">
                <Link
                  to={`/messages/${message.id}`}
                  className="text-base font-semibold text-foreground transition hover:text-primary"
                >
                  {message.title}
                </Link>
                <p className="text-sm text-muted-foreground">{message.body}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
                  <span className="font-medium text-foreground">Updated</span>
                  <span>{formatDateTime(message.updatedAt)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-center">
                {message.tags.map((tag) => (
                  <TagChip key={`${message.id}-${tag}`} tag={tag} />
                ))}
                <SoundBadge enabled={message.soundEnabled} />
                {scheduleMap[message.id] ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {scheduleMap[message.id]} schedule{scheduleMap[message.id] === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <div className="text-sm text-muted-foreground lg:text-center">
                {message.durationSec
                  ? formatDuration(message.durationSec)
                  : formatScrolls(message.numScrolls) || "—"}
              </div>
              <div className="hidden text-sm text-muted-foreground lg:block lg:text-center">
                {formatDateTime(message.updatedAt)}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/messages/${message.id}`)}>
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSendNow(message.id)}>
                  Send now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/schedules/new", { state: { messageId: message.id } })}
                >
                  Schedule
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => actions.deleteMessage(message.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Messages;

