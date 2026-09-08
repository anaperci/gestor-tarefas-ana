import type { Task, UpdateTaskPayload } from "./types";
const fields = ["title","description","status","priority","deadline","startDate","estimateHours","tagIds","projectId","groupId","assignedTo","link","checked","checklist","subtasks"] as const;
/** Each task has its own ordered stream. Failed/conflicting streams stop until explicitly retried. */
export class TaskSaveQueue {
  private streams = new Map<string, Promise<Task>>();
  private pending = 0;
  private cancelled = false;
  cancel() {this.cancelled=true;}
  constructor(private save: (id: string, patch: UpdateTaskPayload) => Promise<Task>) {}
  get busy() { return this.pending > 0; }
  reset(id: string) { this.streams.delete(id); }
  enqueue(before: Task, after: Task): Promise<Task> {
    const patch: UpdateTaskPayload = {};
    for (const key of fields) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) Object.assign(patch, { [key]: after[key] });
    const previous = this.streams.get(after.id) ?? Promise.resolve(before);
    this.pending++;
    const next = previous.then(last => {if(this.cancelled)throw new Error("Sessão encerrada. Rascunho preservado.");return this.save(after.id, { ...patch, expectedUpdatedAt: last.updatedAt });});
    this.streams.set(after.id, next);
    return next.then(result => { if (this.streams.get(after.id) === next) this.streams.delete(after.id); return result; }).finally(() => { this.pending--; });
  }
}
