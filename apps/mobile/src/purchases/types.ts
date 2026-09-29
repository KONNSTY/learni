export type Plan = "monthly" | "yearly";
export interface PurchaseResult { pro: boolean; cancelled: boolean }
export interface Purchases {
  readonly sandbox: boolean;
  init(userId: string): Promise<void>;
  purchase(plan: Plan): Promise<PurchaseResult>;
  restore(): Promise<boolean>;
}
