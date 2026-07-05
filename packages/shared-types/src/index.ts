// Shared domain types — mirrors DB schema in NEXUS_BUILD_SPEC.md §11

export type Role = 'pm' | 'supervisor' | 'procurement';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

export interface Site {
  id: string;
  name: string;
  city: string;
}

export interface Project {
  id: string;
  site_id: string;
  name: string;
  start_date: string;
  target_end_date: string;
  projected_end_date: string;
  daily_cost_estimate: number;
  current_phase_id: string | null;
  status: 'not_started' | 'on_track' | 'at_risk' | 'delayed' | 'nearly_complete' | 'complete';
}

export type UnlockType = 'sequential' | 'parallel' | 'merge' | 'independent';
export type PhaseStatus = 'locked' | 'available' | 'in_progress' | 'complete';

export interface Phase {
  id: string;
  project_id: string;
  template_phase_no: number;
  name: string;
  unlock_type: UnlockType;
  sequence: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  projected_end: string | null;
  delay_days: number;
  delay_cause: DelayCause | null;
  status: PhaseStatus;
}

export type DelayCause = 'material' | 'labor' | 'weather' | 'other';

export interface Subphase {
  id: string;
  phase_id: string;
  name: string;
  sequence: number;
  parallel_group: number | null;
  unlock_type: UnlockType;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  projected_end: string | null;
  delay_days: number;
  delay_cause: DelayCause | null;
  status: PhaseStatus;
}

export interface PhaseDependency {
  id: string;
  predecessor_subphase_id: string;
  successor_subphase_id: string;
  lag_days: number;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
}

export interface SubphaseMaterial {
  id: string;
  subphase_id: string;
  material_id: string;
  quantity_required: number;
  quantity_in_stock: number;
  required_by_date: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  reliability_score: number;
  contact_info: string | null;
}

export interface VendorDelivery {
  id: string;
  vendor_id: string;
  material_id: string;
  order_date: string;
  promised_date: string;
  actual_date: string;
  qty_ordered: number;
  qty_delivered: number;
  complaint: boolean;
  price: number;
}

export interface ReliabilityScoreHistory {
  id: string;
  vendor_id: string;
  recorded_at: string;
  score: number;
}

export type StockRequestStatus = 'pending_pm_approval' | 'approved' | 'sourced' | 'fulfilled' | 'rejected';

export interface StockRequest {
  id: string;
  subphase_id: string;
  material_id: string;
  quantity: number;
  status: StockRequestStatus;
  urgency: 'low' | 'medium' | 'high';
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type PurchaseOrderStatus = 'recommended' | 'approved' | 'ordered' | 'delivered';

export interface PurchaseOrder {
  id: string;
  material_id: string;
  vendor_id: string;
  quantity: number;
  status: PurchaseOrderStatus;
  source_stock_request_id: string | null;
  order_date: string;
  promised_date: string | null;
  actual_delivery_date: string | null;
  notes: string | null;
}

export interface PriceHistoryPoint {
  id: string;
  material_id: string;
  week_index: number;
  recorded_at: string;
  price_index: number;
}

export interface DemandForecast {
  id: string;
  material_id: string;
  project_id: string;
  predicted_shortfall_date: string | null;
  confidence_pct: number;
  is_fallback: boolean;
  computed_at: string;
}

export interface MaterialSubstitute {
  id: string;
  material_id: string;
  substitute_material_id: string;
  note: string | null;
}

export interface ResourceAssignment {
  id: string;
  project_id: string;
  resource_name: string;
  phase_id: string;
  start_date: string;
  end_date: string;
}

export type NotificationType = 'stock_request' | 'order_status' | 'phase_unlock' | 'delay_logged' | 'vendor_risk';

export interface Notification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  related_table: string;
  related_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
}
