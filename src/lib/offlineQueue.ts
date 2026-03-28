export const QUEUE_KEY = "disasterlink_offline_queue";

export interface QueuedHelpRequest {
  queueId: string;
  data: Record<string, unknown>;
  queuedAt: number;
}

export function enqueueHelpRequest(data: Record<string, unknown>): void {
  const queue = getQueue();
  queue.push({ queueId: data.id as string, data, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedHelpRequest[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function dequeueItem(queueId: string): void {
  const updated = getQueue().filter((q) => q.queueId !== queueId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
