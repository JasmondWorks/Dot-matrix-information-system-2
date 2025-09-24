import type { MessageTag } from "@/lib/types";
import { cn } from "@/lib/utils";

const tagStyles: Record<MessageTag, string> = {
  saved: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  scheduled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
};

const tagLabel: Record<MessageTag, string> = {
  saved: "Saved",
  scheduled: "Scheduled",
};

const TagChip = ({ tag }: { tag: MessageTag }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tagStyles[tag]
      )}
    >
      {tagLabel[tag]}
    </span>
  );
};

export default TagChip;

