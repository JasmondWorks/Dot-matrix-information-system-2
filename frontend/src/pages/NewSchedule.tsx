import { useLocation, useNavigate } from "react-router-dom";

import ConnectionPrompt from "@/components/common/ConnectionPrompt";
import ScheduleForm, { type ScheduleFormValues } from "@/components/schedule/ScheduleForm";
import { useAppData } from "@/state/AppDataContext";

const NewSchedule = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, schedules, actions, device } = useAppData();

  const editId = (location.state as { edit?: string; messageId?: string } | undefined)?.edit;
  const presetMessageId = (location.state as { messageId?: string } | undefined)?.messageId;
  const editingSchedule = schedules.find((schedule) => schedule.id === editId);

  const initialValues: Partial<ScheduleFormValues> | undefined = editingSchedule
    ? {
        messageId: editingSchedule.messageId,
        days: editingSchedule.days ?? [],
        specificDates: editingSchedule.specificDates ?? [],
        time: editingSchedule.time,
        enabled: editingSchedule.enabled,
      }
    : presetMessageId
      ? { messageId: presetMessageId }
      : undefined;

  const handleSubmit = (input: Parameters<typeof actions.createSchedule>[0]) => {
    if (editingSchedule) {
      actions.updateSchedule(editingSchedule.id, {
        ...input,
        time: input.time,
        days: input.days,
        specificDates: input.specificDates,
        enabled: input.enabled ?? true,
      });
    } else {
      actions.createSchedule(input);
    }
    navigate("/schedules");
  };

  return (
    <div className="space-y-6">
      {!device.connected ? (
        <ConnectionPrompt title="Connect your device to preview next runs" />
      ) : null}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {editingSchedule ? "Edit schedule" : "Create a schedule"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick the message, choose recurrence or specific dates, and confirm when it should run.
        </p>
      </div>
      <ScheduleForm
        messages={messages}
        initialValues={initialValues}
        submitLabel={editingSchedule ? "Update schedule" : "Save schedule"}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default NewSchedule;

