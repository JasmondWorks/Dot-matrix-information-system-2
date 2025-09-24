import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Message, ScheduleInput } from "@/lib/types";
import {
  computeNextRunAt,
  formatDate,
  formatDateTime,
  formatRecurrenceSummary,
} from "@/lib/time";

interface ScheduleFormValues {
  messageId: string;
  days: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">;
  specificDates: string[];
  time: string;
  enabled: boolean;
}

interface ScheduleFormProps {
  messages: Message[];
  initialValues?: Partial<ScheduleFormValues>;
  onSubmit: (input: ScheduleInput) => void;
  submitLabel?: string;
}

const DAY_OPTIONS: ScheduleFormValues["days"] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const defaultValues: ScheduleFormValues = {
  messageId: "",
  days: [],
  specificDates: [],
  time: "09:00",
  enabled: true,
};

const ScheduleForm = ({ messages, initialValues, onSubmit, submitLabel = "Save schedule" }: ScheduleFormProps) => {
  const [values, setValues] = useState<ScheduleFormValues>({
    ...defaultValues,
    ...initialValues,
  });
  const [draftDate, setDraftDate] = useState<string>("");
  const [error, setError] = useState<string>("");

  const nextRun = useMemo(
    () =>
      computeNextRunAt({
        messageId: values.messageId,
        days: values.days,
        specificDates: values.specificDates,
        time: values.time,
        enabled: values.enabled,
      }),
    [values.days, values.enabled, values.messageId, values.specificDates, values.time]
  );

  const summary = useMemo(
    () =>
      formatRecurrenceSummary({
        messageId: values.messageId,
        days: values.days,
        specificDates: values.specificDates,
        time: values.time,
      }),
    [values.days, values.messageId, values.specificDates, values.time]
  );

  const handleDayToggle = (day: ScheduleFormValues["days"][number]) => {
    setValues((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...current.days, day],
    }));
  };

  const handleAddDate = () => {
    if (!draftDate) return;
    if (values.specificDates.includes(draftDate)) {
      setError("Date already added");
      return;
    }
    setValues((current) => ({
      ...current,
      specificDates: [...current.specificDates, draftDate],
    }));
    setDraftDate("");
  };

  const handleRemoveDate = (date: string) => {
    setValues((current) => ({
      ...current,
      specificDates: current.specificDates.filter((item) => item !== date),
    }));
  };

  const handleSubmit = () => {
    if (!values.messageId) {
      setError("Select a message to schedule");
      return;
    }
    if (!values.days.length && !values.specificDates.length) {
      setError("Choose recurring days or add specific dates");
      return;
    }
    setError("");

    const payload: ScheduleInput = {
      messageId: values.messageId,
      days: values.days.length ? values.days : undefined,
      specificDates: values.specificDates.length ? values.specificDates : undefined,
      time: values.time,
      enabled: values.enabled,
    };

    onSubmit(payload);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <label className="space-y-2 text-sm">
          <span className="font-semibold text-foreground">Select message</span>
          <select
            value={values.messageId}
            onChange={(event) =>
              setValues((current) => ({ ...current, messageId: event.target.value }))
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">Choose a saved message</option>
            {messages.map((message) => (
              <option key={message.id} value={message.id}>
                {message.title}
              </option>
            ))}
          </select>
          {!messages.length ? (
            <span className="text-xs text-muted-foreground">
              You have no saved messages yet. Create one first.
            </span>
          ) : null}
        </label>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Recurring days</p>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayToggle(day)}
                className={`rounded-full px-4 py-1 text-sm transition ${
                  values.days.includes(day)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Specific dates</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={draftDate}
              onChange={(event) => {
                setDraftDate(event.target.value);
                setError("");
              }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <Button type="button" variant="outline" onClick={handleAddDate}>
              Add date
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {values.specificDates.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
              >
                {formatDate(date)}
                <button type="button" onClick={() => handleRemoveDate(date)} className="text-foreground">
                  x
                </button>
              </span>
            ))}
          </div>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-semibold">Time of day</span>
          <input
            type="time"
            value={values.time}
            onChange={(event) =>
              setValues((current) => ({ ...current, time: event.target.value }))
            }
            className="w-fit rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, enabled: event.target.checked }))
            }
          />
          Enable schedule
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Next run preview</h2>
        <p className="text-sm text-muted-foreground">
          {summary || "Choose days or dates to preview the next execution."}
        </p>
        <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Next run</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {nextRun ? formatDateTime(nextRun) : "Select a message, time and day"}
          </p>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </div>
  );
};

export type { ScheduleFormValues };
export default ScheduleForm;

