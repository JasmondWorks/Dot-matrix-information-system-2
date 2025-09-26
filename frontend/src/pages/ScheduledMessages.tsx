import { Link, useNavigate } from "react-router-dom";

import ConnectionPrompt from "@/components/common/ConnectionPrompt";
import TagChip from "@/components/common/TagChip";
import SoundBadge from "@/components/messages/SoundBadge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatRecurrenceSummary,
  formatRelativeToNow,
} from "@/lib/time";
import { useAppData } from "@/state/AppDataContext";

const ScheduledMessages = () => {
  const navigate = useNavigate();
  const { device, schedules, messages, actions } = useAppData();
  const connected = !!device.connected;

  const sortedSchedules = [...schedules].sort(
    (a, b) =>
      new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime()
  );

  const nextSchedule = sortedSchedules.find((schedule) => schedule.enabled && schedule.nextRunAt);
  const nextMessage = nextSchedule ? messages.find((message) => message.id === nextSchedule.messageId) : undefined;

  return (
    <div className="space-y-6">
      {!connected ? (
        <ConnectionPrompt title="Connect your device to view scheduled runs" />
      ) : null}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage recurring and one-off schedules. The device will display the next message automatically.
          </p>
        </div>
        <Button asChild>
          <Link to="/schedules/new">Create schedule</Link>
        </Button>
      </header>

      {nextSchedule && nextMessage ? (
        <div className="rounded-2xl border border-primary/50 bg-primary/5 p-5">
          <p className="text-xs font-semibold uppercase text-primary">Next up</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">{nextMessage.title}</h2>
              <p className="text-sm text-muted-foreground">{nextMessage.body}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatRelativeToNow(nextSchedule.nextRunAt)} · {formatDateTime(nextSchedule.nextRunAt)}
            </div>
          </div>
        </div>
      ) : null}

      {sortedSchedules.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border bg-muted/50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Schedule</span>
            <span className="text-center">Next run</span>
            <span className="text-center">Status</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {sortedSchedules.map((schedule) => {
              const message = messages.find((item) => item.id === schedule.messageId);
              return (
                <div key={schedule.id} className="grid gap-4 px-4 py-5 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:px-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-foreground">
                        {message?.title ?? "Unknown message"}
                      </span>
                      {message ? (
                        message.tags.map((tag) => <TagChip key={`${schedule.id}-${tag}`} tag={tag} />)
                      ) : null}
                      {/* <SoundBadge enabled={message?.soundEnabled} /> */}
                    </div>
                    <p className="text-sm text-muted-foreground">{message?.body}</p>
                    <p className="text-xs uppercase text-muted-foreground">
                      {schedule.recurrenceSummary ?? formatRecurrenceSummary(schedule)}
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground lg:text-center">
                    {schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : "—"}
                    <div className="text-xs text-muted-foreground">
                      {schedule.nextRunAt ? formatRelativeToNow(schedule.nextRunAt) : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground lg:flex-col lg:items-center lg:justify-center">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={(event) =>
                          actions.updateSchedule(schedule.id, { enabled: event.target.checked })
                        }
                      />
                      {schedule.enabled ? "Enabled" : "Disabled"}
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/messages/${schedule.messageId}`)}>
                      View message
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/schedules/new`, { state: { edit: schedule.id } })}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => actions.deleteSchedule(schedule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          <p>No schedules yet. Create one to automate your display.</p>
          <Button asChild>
            <Link to="/schedules/new">Create schedule</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScheduledMessages;

