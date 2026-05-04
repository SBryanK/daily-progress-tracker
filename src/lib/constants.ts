// Single source of truth for enum-like values. Matches the PRD §4.A choices.
export const STATUS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "WAITING_CUSTOMER", label: "Waiting for Customer" },
  { value: "WAITING_INTERNAL", label: "Waiting for Internal Team" },
  { value: "COMPLETED", label: "Completed" },
] as const;

export type StatusValue = (typeof STATUS)[number]["value"];

export const STATUS_COLOR: Record<StatusValue, string> = {
  NOT_STARTED: "bg-bg-muted text-fg-muted",
  IN_PROGRESS: "bg-info/15 text-info",
  BLOCKED: "bg-danger/15 text-danger",
  WAITING_CUSTOMER: "bg-warning/15 text-warning",
  WAITING_INTERNAL: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
};

export const PRIORITY = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export type PriorityValue = (typeof PRIORITY)[number]["value"];

export const PRIORITY_COLOR: Record<PriorityValue, string> = {
  LOW: "bg-bg-muted text-fg-muted",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/15 text-warning",
  CRITICAL: "bg-danger/15 text-danger",
};

export const STATUS_VALUES = STATUS.map((s) => s.value) as StatusValue[];
export const PRIORITY_VALUES = PRIORITY.map((p) => p.value) as PriorityValue[];

export function statusLabel(v: string): string {
  return STATUS.find((s) => s.value === v)?.label ?? v;
}
export function priorityLabel(v: string): string {
  return PRIORITY.find((p) => p.value === v)?.label ?? v;
}
