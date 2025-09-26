import { Link } from "react-router-dom";

import ConnectionPrompt from "@/components/common/ConnectionPrompt";
import TagChip from "@/components/common/TagChip";
import SoundBadge from "@/components/messages/SoundBadge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatDuration,
  formatRelativeToNow,
  formatScrolls,
} from "@/lib/time";
import { useAppData } from "@/state/AppDataContext";

const Home = () => {
  const { device, capabilities, messages, schedules, recentMessages, actions } = useAppData();
  const connected = !!device.connected;

  const currentMessage = messages.find((message) => message.id === device.currentMessageId);

  const upcomingSchedule = schedules
    .filter((schedule) => schedule.enabled)
    .filter((schedule) => schedule.nextRunAt)
    .sort((a, b) =>
      new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime()
    )[0];

  const nextScheduledMessage = upcomingSchedule
    ? messages.find((message) => message.id === upcomingSchedule.messageId)
    : undefined;

  return (
    <div className="space-y-6">
      {!connected ? (
        <ConnectionPrompt title="Connect your device to monitor what's displaying" />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Currently displayed message</h2>
              <p className="text-sm text-muted-foreground">
                Live view of what the LED matrix is scrolling right now.
              </p>
            </div>
            {connected && currentMessage ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/messages/${currentMessage.id}`}>View details</Link>
              </Button>
            ) : null}
          </header>

          {connected && currentMessage ? (
            <div className="rounded-xl border border-border bg-background/60 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold">{currentMessage.title}</h3>
                  <p className="text-sm text-muted-foreground">{currentMessage.body}</p>
                </div>
                <div className="flex items-center gap-2">
                  {currentMessage.tags.map((tag) => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                  {/* <SoundBadge enabled={currentMessage.soundEnabled} /> */}
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-muted-foreground">Scrolls done</dt>
                  <dd className="font-semibold">{device.scrollsDone ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-muted-foreground">Time left</dt>
                  <dd className="font-semibold">
                    {device.timeLeftSec ? formatDuration(device.timeLeftSec) : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border/80 bg-muted/40 p-6 text-sm text-muted-foreground">
              <p>Connect to your device to pull the current message and progress.</p>
              <Button size="sm" onClick={() => actions.connectDevice()}>
                Connect device
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Next scheduled message</h2>
              <p className="text-sm text-muted-foreground">Upcoming run pulled from your schedule.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/schedules">View all</Link>
            </Button>
          </header>

          {upcomingSchedule && nextScheduledMessage ? (
            <div className="space-y-3 rounded-xl border border-border bg-background/60 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{nextScheduledMessage.title}</h3>
                  <TagChip tag="scheduled" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {nextScheduledMessage.body}
                </p>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-muted-foreground">Runs</dt>
                  <dd className="font-semibold">
                    {upcomingSchedule.recurrenceSummary ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-muted-foreground">Next start</dt>
                  <dd className="font-semibold">
                    {formatDateTime(upcomingSchedule.nextRunAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="font-semibold">
                    {formatRelativeToNow(upcomingSchedule.nextRunAt)}
                  </dd>
                </div>
              </dl>
              <Button asChild size="sm" className="w-full">
                <Link to={`/messages/${nextScheduledMessage.id}`}>View details</Link>
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              <p>No upcoming runs scheduled.</p>
              <Button asChild size="sm">
                <Link to="/schedules/new">Create schedule</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Most recent messages</h2>
            <p className="text-sm text-muted-foreground">
              Saved drafts and scheduled content sync to the device when you send them.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/messages/new">New message</Link>
          </Button>
        </header>
        <div className="space-y-3">
          {recentMessages.map((message) => (
            <Link
              key={message.id}
              to={`/messages/${message.id}`}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/70 hover:bg-background"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold">{message.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{message.body}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {message.tags.map((tag) => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                  {/* <SoundBadge enabled={message.soundEnabled} /> */}
                </div>
              </div>
              <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Updated</span>
                  <span>{formatRelativeToNow(message.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Scroll speed</span>
                  <span className="uppercase">{message.scrollSpeed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Duration</span>
                  <span>
                    {message.durationSec
                      ? formatDuration(message.durationSec)
                      : formatScrolls(message.numScrolls) || "—"}
                  </span>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground">Max characters per frame</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">{capabilities.maxCharsPerFrame}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Body copy longer than this will require scroll count instead of duration.
          </p>
        </div>
        {/* <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground">Sound support</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {capabilities.supportsSound ? "Enabled" : "Disabled"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle per message or globally from Settings.
          </p>
        </div> */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground">Batch support</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {capabilities.supportsMultiMessageBatch ? "Multi-message" : "Single message"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add multiple messages when the firmware enables queueing.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;

