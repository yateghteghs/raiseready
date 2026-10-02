/**
 * Database types for the `public` schema, matching supabase/migrations.
 *
 * Hand-maintained in the shape `supabase gen types typescript` produces. When
 * the Supabase CLI is available, regenerate with:
 *   npx supabase gen types typescript --local > lib/supabase/database.types.ts
 * and keep the convenience aliases at the bottom of this file.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };
type OptionalTimestamps = { created_at?: string; updated_at?: string };

/** Builds Insert/Update types from a Row and the keys that have DB defaults or are nullable. */
type InsertOf<Row, Optional extends keyof Row> = Omit<Row, Optional | keyof Timestamps> &
  Partial<Pick<Row, Optional>> &
  OptionalTimestamps;
type UpdateOf<Row> = Partial<Row>;

export type UserRole = "founder" | "viewer" | "support" | "admin" | "super_admin";
export type ShowcaseKind = "logo" | "testimonial" | "partner";
export type AccountStatus = "active" | "suspended" | "terminated";
export type Plan = "free" | "pro";
export type StartupStage = "idea" | "pre_seed" | "seed" | "series_a" | "other";
export type FundingType = "equity" | "safe" | "convertible_note" | "grant" | "debt" | "other";
export type DocumentKind = "pitch_deck" | "financial_model" | "business_plan" | "other";
export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";
export type ReadinessBand = "not_ready" | "getting_there" | "nearly_ready" | "investor_ready";
export type Persona = "seed_vc" | "angel" | "grant_evaluator";
export type Difficulty = "friendly" | "analytical" | "tough";
export type SimulationStatus = "active" | "completed" | "abandoned";
export type SimulationMode = "full" | "drill";
export type InvestorConfidence = "low" | "medium" | "high";
export type TurnRole = "investor" | "founder" | "system";
export type RedFlagType = "contradiction" | "unsupported_claim" | "weak_answer" | "missing_info";
export type Severity = "low" | "medium" | "high";
export type PaymentProduct = "pro_monthly" | "credits_3" | "credits_10" | "deck_builder";
export type DeckStatus = "generating" | "ready" | "failed";
export type DeckAccess = "preview" | "pro" | "credit";
export type PaymentCurrency = "NGN" | "USD";
export type PaymentStatus = "pending" | "success" | "failed" | "abandoned" | "reversed";
export type SubscriptionStatus = "active" | "non_renewing" | "attention" | "cancelled" | "completed";

type ProfileRow = Timestamps & {
  id: string;
  full_name: string | null;
  country: string | null;
  role: UserRole;
  plan: Plan;
  credits: number;
  deck_credits: number;
  onboarding_complete: boolean;
  paystack_customer_code: string | null;
  status: AccountStatus;
  status_reason: string | null;
  status_changed_at: string | null;
  avatar_path: string | null;
  last_seen_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
};

type StartupRow = Timestamps & {
  id: string;
  owner_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  stage: StartupStage | null;
  founding_year: number | null;
  business_model: string | null;
  revenue_monthly: number | null;
  revenue_currency: string;
  customers_count: number | null;
  growth_notes: string | null;
  raising: boolean;
  amount_seeking: number | null;
  seeking_currency: string;
  funding_type: FundingType | null;
  previously_raised: boolean | null;
  use_of_funds: string | null;
  logo_path: string | null;
};

type DocumentRow = Timestamps & {
  id: string;
  startup_id: string;
  kind: DocumentKind;
  original_filename: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  error_message: string | null;
};

type KnowledgeProfileRow = Timestamps & {
  id: string;
  startup_id: string;
  version: number;
  data: Json;
  source_document_ids: string[];
};

type AssessmentRow = Timestamps & {
  id: string;
  startup_id: string;
  knowledge_profile_id: string | null;
  overall_score: number;
  band: ReadinessBand;
  dimension_scores: Json;
  strengths: Json;
  weaknesses: Json;
  recommended_actions: Json;
  rubric_version: string;
};

type SimulationRow = Timestamps & {
  id: string;
  startup_id: string;
  persona: Persona;
  difficulty: Difficulty;
  funding_type: string | null;
  status: SimulationStatus;
  current_round: number;
  overall_score: number | null;
  investor_confidence: InvestorConfidence | null;
  final_evaluation: Json | null;
  mode: SimulationMode;
  /** For drills: the investor question being practised again. */
  source_turn_id: string | null;
  /** What paid for this simulation (null for drills). */
  funded_by: "free" | "pro" | "credit" | null;
  started_at: string;
  ended_at: string | null;
};

type SimulationTurnRow = Timestamps & {
  id: string;
  simulation_id: string;
  turn_index: number;
  round: number;
  role: TurnRole;
  content: string;
  evaluation: Json | null;
  red_flags: Json | null;
};

type RedFlagRow = Timestamps & {
  id: string;
  simulation_id: string;
  turn_id: string | null;
  type: RedFlagType;
  severity: Severity;
  description: string;
  evidence: Json;
};

type PitchDeckRow = Timestamps & {
  id: string;
  user_id: string;
  startup_id: string;
  status: DeckStatus;
  access: DeckAccess;
  title: string | null;
  content: Json | null;
  rewrites_used: number;
  unlocked_at: string | null;
  error: string | null;
};

type ReportRow = Timestamps & {
  id: string;
  startup_id: string;
  assessment_id: string | null;
  simulation_id: string | null;
  content: Json;
  pdf_storage_path: string | null;
};

type PaymentRow = Timestamps & {
  id: string;
  user_id: string;
  provider: "paystack";
  reference: string;
  amount_kobo: number;
  currency: string;
  product: PaymentProduct;
  status: PaymentStatus;
  raw_event: Json | null;
  list_amount_kobo: number | null;
  discount_code_id: string | null;
  referral_discount: boolean;
};

type SubscriptionRow = Timestamps & {
  id: string;
  user_id: string;
  provider_subscription_code: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
};

type AiCallRow = Timestamps & {
  id: string;
  user_id: string | null;
  purpose: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
};

type AuditLogRow = Timestamps & {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Json;
};

type NotificationRow = Timestamps & {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  link: string | null;
  created_by: string | null;
};

type NotificationReadRow = {
  notification_id: string;
  user_id: string;
  read_at: string;
};

type ShowcaseItemRow = Timestamps & {
  id: string;
  kind: ShowcaseKind;
  name: string;
  quote: string | null;
  person_name: string | null;
  person_title: string | null;
  url: string | null;
  image_path: string | null;
  permission_confirmed: boolean;
  published: boolean;
  position: number;
  created_by: string | null;
};

type ReportSignatureRow = Timestamps & {
  id: number;
  signer_name: string | null;
  signer_title: string | null;
  signature_path: string | null;
  enabled: boolean;
  updated_by: string | null;
};

type SignInEventRow = {
  id: string;
  user_id: string | null;
  email_hash: string;
  succeeded: boolean;
  surface: "app" | "admin";
  failure_code: string | null;
  device: string | null;
  created_at: string;
};

type UserActivityDayRow = { user_id: string; day: string };

type AppErrorRow = {
  id: string;
  source: "server" | "browser";
  digest: string | null;
  message: string;
  path: string | null;
  route_type: string | null;
  user_id: string | null;
  created_at: string;
};

/** Insert/Update for tables without updated_at. */
type PlainTable<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

type DiscountCodeRow = Timestamps & {
  id: string;
  code: string;
  description: string | null;
  percent_off: number;
  products: PaymentProduct[];
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
  created_by: string | null;
};

type DiscountRedemptionRow = { id: string; code_id: string; user_id: string | null; payment_reference: string | null; created_at: string };

type ReferralRewardRow = {
  id: string;
  referrer_id: string | null;
  referred_id: string | null;
  credits: number;
  payment_reference: string | null;
  status: "locked" | "released";
  released_at: string | null;
  created_at: string;
};

type ReportShareRow = Timestamps & {
  id: string;
  report_id: string;
  created_by: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  views: number;
  last_viewed_at: string | null;
};

type ReferralSettingsRow = Timestamps & {
  id: number;
  enabled: boolean;
  friend_percent_off: number;
  referrer_credits: number;
  /** Inviter must have spent this much (kobo) — or the USD amount, or a mix — before credits unlock. */
  min_spend_ngn: number;
  min_spend_usd: number;
  updated_by: string | null;
};

type FaqItemRow = Timestamps & {
  id: string;
  slug: string | null;
  locale: string;
  category: string;
  question: string;
  answer: string;
  position: number;
  published: boolean;
  created_by: string | null;
};

type Table<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: InsertOf<Row, Optional>;
  Update: UpdateOf<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        | "full_name"
        | "country"
        | "role"
        | "plan"
        | "credits"
        | "onboarding_complete"
        | "paystack_customer_code"
        | "status"
        | "status_reason"
        | "status_changed_at"
        | "avatar_path"
        | "last_seen_at"
        | "referral_code"
        | "referred_by"
        | "deck_credits"
      >;
      startups: Table<
        StartupRow,
        | "id"
        | "website"
        | "industry"
        | "country"
        | "stage"
        | "founding_year"
        | "business_model"
        | "revenue_monthly"
        | "revenue_currency"
        | "customers_count"
        | "growth_notes"
        | "raising"
        | "amount_seeking"
        | "seeking_currency"
        | "funding_type"
        | "previously_raised"
        | "use_of_funds"
        | "logo_path"
      >;
      documents: Table<DocumentRow, "id" | "original_filename" | "status" | "error_message">;
      knowledge_profiles: Table<KnowledgeProfileRow, "id" | "source_document_ids">;
      assessments: Table<
        AssessmentRow,
        "id" | "knowledge_profile_id" | "strengths" | "weaknesses" | "recommended_actions"
      >;
      simulations: Table<
        SimulationRow,
        | "id"
        | "funding_type"
        | "status"
        | "current_round"
        | "overall_score"
        | "investor_confidence"
        | "final_evaluation"
        | "mode"
        | "source_turn_id"
        | "funded_by"
        | "started_at"
        | "ended_at"
      >;
      simulation_turns: Table<SimulationTurnRow, "id" | "evaluation" | "red_flags">;
      red_flags: Table<RedFlagRow, "id" | "turn_id" | "evidence">;
      reports: Table<ReportRow, "id" | "assessment_id" | "simulation_id" | "pdf_storage_path">;
      payments: Table<
        PaymentRow,
        "id" | "provider" | "currency" | "status" | "raw_event" | "list_amount_kobo" | "discount_code_id" | "referral_discount"
      >;
      subscriptions: Table<SubscriptionRow, "id" | "provider_subscription_code" | "current_period_end">;
      ai_calls: Table<
        AiCallRow,
        "id" | "user_id" | "input_tokens" | "output_tokens" | "latency_ms" | "error"
      >;
      audit_logs: Table<AuditLogRow, "id" | "actor_id" | "target_type" | "target_id" | "metadata">;
      notifications: Table<NotificationRow, "id" | "user_id" | "link" | "created_by">;
      notification_reads: {
        Row: NotificationReadRow;
        Insert: Omit<NotificationReadRow, "read_at"> & { read_at?: string };
        Update: Partial<NotificationReadRow>;
        Relationships: [];
      };
      showcase_items: Table<
        ShowcaseItemRow,
        "id" | "quote" | "person_name" | "person_title" | "url" | "image_path" | "permission_confirmed" | "published" | "position" | "created_by"
      >;
      sign_in_events: PlainTable<SignInEventRow, "id" | "user_id" | "failure_code" | "device" | "created_at">;
      user_activity_days: PlainTable<UserActivityDayRow, never>;
      app_errors: PlainTable<AppErrorRow, "id" | "digest" | "path" | "route_type" | "user_id" | "created_at">;
      discount_codes: Table<
        DiscountCodeRow,
        "id" | "description" | "products" | "max_redemptions" | "expires_at" | "active" | "created_by"
      >;
      discount_redemptions: PlainTable<DiscountRedemptionRow, "id" | "user_id" | "payment_reference" | "created_at">;
      referral_rewards: PlainTable<
        ReferralRewardRow,
        "id" | "referrer_id" | "referred_id" | "payment_reference" | "status" | "released_at" | "created_at"
      >;
      report_shares: Table<ReportShareRow, "id" | "revoked_at" | "views" | "last_viewed_at">;
      referral_settings: Table<
        ReferralSettingsRow,
        "id" | "enabled" | "friend_percent_off" | "referrer_credits" | "min_spend_ngn" | "min_spend_usd" | "updated_by"
      >;
      pitch_decks: Table<PitchDeckRow, "id" | "status" | "title" | "content" | "rewrites_used" | "unlocked_at" | "error">;
      faq_items: Table<FaqItemRow, "id" | "slug" | "locale" | "category" | "position" | "published" | "created_by">;
      report_signature: Table<ReportSignatureRow, "id" | "signer_name" | "signer_title" | "signature_path" | "enabled" | "updated_by">;
    };
    Views: { [_ in never]: never };
    Functions: {
      add_credits: { Args: { p_user_id: string; p_amount: number }; Returns: number | null };
      consume_credit: { Args: { p_user_id: string }; Returns: number | null };
      add_deck_credits: { Args: { p_user_id: string; p_amount: number }; Returns: number | null };
      consume_deck_credit: { Args: { p_user_id: string }; Returns: number | null };
      prune_activity: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type TableName = keyof PublicTables;
export type Tables<T extends TableName> = PublicTables[T]["Row"];
export type TablesInsert<T extends TableName> = PublicTables[T]["Insert"];
export type TablesUpdate<T extends TableName> = PublicTables[T]["Update"];
