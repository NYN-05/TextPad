import { enqueueOp, dequeueOp, getPendingOps } from "../db";
import type { SyncOp } from "../types";

export class StorageQueue {
  private draining = false;

  async push(op: Omit<SyncOp, "id">): Promise<void> {
    await enqueueOp(op);
  }

  async getAll(): Promise<SyncOp[]> {
    return getPendingOps();
  }

  async remove(id: number): Promise<void> {
    await dequeueOp(id);
  }

  isDraining(): boolean {
    return this.draining;
  }

  setDraining(v: boolean): void {
    this.draining = v;
  }
}
