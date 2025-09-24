import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import TagChip from "@/components/common/TagChip";
import SoundBadge from "@/components/messages/SoundBadge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatDuration,
  formatScrolls,
} from "@/lib/time";
import { useAppData } from "@/state/AppDataContext";

const MessageDetails = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { device, messages, schedules, actions } = useAppData();

  const message = useMemo(() => messages.find((item) => item.id === params.id), [messages, params.id]);
  const relatedSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.messageId === message?.id),
    [schedules, message?.id]
  );

  if (!message) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <p>Message not found. It may have been removed.</p>
        <Button asChild>
          <Link to="/messages">Back to saved messages</Link>
        </Button>
      </div>
    );
  }

  const handleSend = () => {
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
          <h1 className="text-2xl font-semibold">{message.title}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(message.createdAt)} · Updated {formatDateTime(message.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/messages/new`, { state: { edit: message.id } })}>
            Edit message
          </Button>
          <Button variant="outline" onClick={() => navigate("/schedules/new", { state: { messageId: message.id } })}>
            Schedule
          </Button>
          <Button onClick={handleSend}>Send now</Button>
          <Button variant="destructive" onClick={() => {
            actions.deleteMessage(message.id);
            navigate("/messages");
          }}>
            Delete
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <article className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {message.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
              <SoundBadge enabled={message.soundEnabled} />
            </div>
            <p className="text-base text-foreground">{message.body}</p>
          </article>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Scroll speed</dt>
              <dd className="mt-1 text-base font-semibold uppercase">{message.scrollSpeed}</dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Switch animation</dt>
              <dd className="mt-1 text-base font-semibold capitalize">{message.animation}</dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Duration / Scrolls</dt>
              <dd className="mt-1 text-base font-semibold">
                {message.durationSec
                  ? formatDuration(message.durationSec)
                  : formatScrolls(message.numScrolls) || "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Sound file</dt>
              <dd className="mt-1 text-base font-semibold">
                {message.soundFileId ?? "Default"}
              </dd>
            </div>
          </dl>
        </div>
        <aside className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold">Schedules using this message</h2>
          {relatedSchedules.length ? (
            <div className="space-y-3">
              {relatedSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm">
                  <p className="font-semibold">{schedule.recurrenceSummary ?? "Custom"}</p>
                  <p className="text-xs text-muted-foreground">
                    Next run {formatDateTime(schedule.nextRunAt)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/schedules/new`, { state: { edit: schedule.id } })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => actions.deleteSchedule(schedule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This message has no schedules yet.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default MessageDetails;

