export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'admin' | 'operator' | 'reviewer';
export type MappingStatusEnum = 'pending' | 'verified' | 'disabled';
export type DecisionStatusEnum =
  | 'accepted'
  | 'review_required'
  | 'mapping_unconfigured'
  | 'rejected';
export type ClassificationReviewStatusEnum =
  | 'not_required'
  | 'pending'
  | 'in_progress'
  | 'confirmed'
  | 'relabelled'
  | 'unresolved';
export type ManualReviewOutcomeEnum = 'confirmed' | 'relabelled' | 'unresolved';
export type ManualReviewQueueStatusEnum =
  | 'pending'
  | 'in_progress'
  | 'confirmed'
  | 'relabelled'
  | 'unresolved';
export type ModelDeploymentStatusEnum = 'staged' | 'active' | 'retired' | 'archived';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      waste_taxonomy: {
        Row: {
          id: string;
          class_code: string;
          display_name: string;
          description: string;
          active: boolean;
          taxonomy_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_code: string;
          display_name: string;
          description?: string;
          active?: boolean;
          taxonomy_version: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_code?: string;
          display_name?: string;
          description?: string;
          active?: boolean;
          taxonomy_version?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bin_mappings: {
        Row: {
          id: string;
          class_id: string;
          bin_code: string;
          display_name: string;
          mapping_status: MappingStatusEnum;
          policy_reference: string;
          verified_by: string | null;
          verified_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          bin_code: string;
          display_name: string;
          mapping_status?: MappingStatusEnum;
          policy_reference: string;
          verified_by?: string | null;
          verified_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          bin_code?: string;
          display_name?: string;
          mapping_status?: MappingStatusEnum;
          policy_reference?: string;
          verified_by?: string | null;
          verified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bin_mappings_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'waste_taxonomy';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bin_mappings_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      model_versions: {
        Row: {
          id: string;
          model_version: string;
          artifact_path: string;
          sha256: string;
          framework: string;
          input_shape: Json;
          preprocessing_version: string;
          class_mapping_version: string;
          metrics: Json;
          deployment_status: ModelDeploymentStatusEnum;
          created_at: string;
        };
        Insert: {
          id?: string;
          model_version: string;
          artifact_path: string;
          sha256: string;
          framework: string;
          input_shape: Json;
          preprocessing_version: string;
          class_mapping_version: string;
          metrics?: Json;
          deployment_status?: ModelDeploymentStatusEnum;
          created_at?: string;
        };
        Update: {
          id?: string;
          model_version?: string;
          artifact_path?: string;
          sha256?: string;
          framework?: string;
          input_shape?: Json;
          preprocessing_version?: string;
          class_mapping_version?: string;
          metrics?: Json;
          deployment_status?: ModelDeploymentStatusEnum;
          created_at?: string;
        };
        Relationships: [];
      };
      classification_events: {
        Row: {
          id: string;
          created_by: string;
          image_object_path: string;
          predicted_class_id: string | null;
          candidate_predictions: Json;
          model_score: number | null;
          calibrated_confidence: number | null;
          confidence_threshold: number | null;
          decision_status: DecisionStatusEnum;
          recommended_bin_code: string | null;
          review_status: ClassificationReviewStatusEnum;
          model_version_id: string;
          request_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          image_object_path: string;
          predicted_class_id?: string | null;
          candidate_predictions?: Json;
          model_score?: number | null;
          calibrated_confidence?: number | null;
          confidence_threshold?: number | null;
          decision_status: DecisionStatusEnum;
          recommended_bin_code?: string | null;
          review_status?: ClassificationReviewStatusEnum;
          model_version_id: string;
          request_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          image_object_path?: string;
          predicted_class_id?: string | null;
          candidate_predictions?: Json;
          model_score?: number | null;
          calibrated_confidence?: number | null;
          confidence_threshold?: number | null;
          decision_status?: DecisionStatusEnum;
          recommended_bin_code?: string | null;
          review_status?: ClassificationReviewStatusEnum;
          model_version_id?: string;
          request_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'classification_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classification_events_predicted_class_id_fkey';
            columns: ['predicted_class_id'];
            isOneToOne: false;
            referencedRelation: 'waste_taxonomy';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classification_events_model_version_id_fkey';
            columns: ['model_version_id'];
            isOneToOne: false;
            referencedRelation: 'model_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      manual_reviews: {
        Row: {
          id: string;
          classification_id: string;
          reviewer_id: string | null;
          confirmed_class_id: string | null;
          review_outcome: ManualReviewOutcomeEnum;
          queue_status: ManualReviewQueueStatusEnum;
          review_reason: string;
          claimed_by: string | null;
          claimed_at: string | null;
          version: number;
          approved_for_dataset_export: boolean;
          dataset_export_approved_by: string | null;
          dataset_export_approved_at: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          classification_id: string;
          reviewer_id?: string | null;
          confirmed_class_id?: string | null;
          review_outcome?: ManualReviewOutcomeEnum;
          queue_status?: ManualReviewQueueStatusEnum;
          review_reason?: string;
          claimed_by?: string | null;
          claimed_at?: string | null;
          version?: number;
          approved_for_dataset_export?: boolean;
          dataset_export_approved_by?: string | null;
          dataset_export_approved_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          classification_id?: string;
          reviewer_id?: string | null;
          confirmed_class_id?: string | null;
          review_outcome?: ManualReviewOutcomeEnum;
          queue_status?: ManualReviewQueueStatusEnum;
          review_reason?: string;
          claimed_by?: string | null;
          claimed_at?: string | null;
          version?: number;
          approved_for_dataset_export?: boolean;
          dataset_export_approved_by?: string | null;
          dataset_export_approved_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'manual_reviews_classification_id_fkey';
            columns: ['classification_id'];
            isOneToOne: true;
            referencedRelation: 'classification_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_reviews_confirmed_class_id_fkey';
            columns: ['confirmed_class_id'];
            isOneToOne: false;
            referencedRelation: 'waste_taxonomy';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          event_type: string;
          entity_type: string;
          entity_id: string;
          before_state: Json | null;
          after_state: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          event_type: string;
          entity_type: string;
          entity_id: string;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'audit_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      retention_policies: {
        Row: {
          policy_key: string;
          retention_days: number;
          updated_at: string;
        };
        Insert: {
          policy_key: string;
          retention_days: number;
          updated_at?: string;
        };
        Update: {
          policy_key?: string;
          retention_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      operational_alert_thresholds: {
        Row: {
          id: string;
          pending_review_backlog_threshold: number;
          classification_failure_threshold: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pending_review_backlog_threshold?: number;
          classification_failure_threshold?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pending_review_backlog_threshold?: number;
          classification_failure_threshold?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'operational_alert_thresholds_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      daily_classification_counts: {
        Row: {
          classification_date: string;
          total_events: number;
          accepted_count: number;
          review_required_count: number;
          mapping_unconfigured_count: number;
          rejected_count: number;
        };
        Relationships: [];
      };
      class_distribution: {
        Row: {
          class_id: string;
          class_code: string;
          display_name: string;
          event_count: number;
          accepted_count: number;
        };
        Relationships: [];
      };
      decision_status_summary: {
        Row: {
          decision_status: DecisionStatusEnum;
          event_count: number;
        };
        Relationships: [];
      };
      manual_review_summary: {
        Row: {
          review_outcome: ManualReviewOutcomeEnum;
          review_count: number;
          completed_count: number;
          pending_count: number;
        };
        Relationships: [];
      };
      model_version_usage: {
        Row: {
          model_version_id: string;
          model_version: string;
          framework: string;
          deployment_status: ModelDeploymentStatusEnum;
          classification_count: number;
          last_used_at: string | null;
        };
        Relationships: [];
      };
      virtual_bin_assignment_counts: {
        Row: {
          bin_code: string;
          virtual_assignment_count: number;
          last_assigned_at: string | null;
          physical_sensor_status: 'unavailable';
          physical_fill_level_pct: null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<string, never>;
        Returns: AppRole;
      };
      list_expired_evidence_paths: {
        Args: Record<string, never>;
        Returns: {
          classification_id: string;
          image_object_path: string;
          created_at: string;
        }[];
      };
      get_monitoring_analytics: {
        Args: {
          p_date_from?: string | null;
          p_date_to?: string | null;
          p_category?: string | null;
          p_decision_status?: DecisionStatusEnum | null;
          p_model_version?: string | null;
          p_review_status?: ClassificationReviewStatusEnum | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: AppRole;
      mapping_status_enum: MappingStatusEnum;
      decision_status_enum: DecisionStatusEnum;
      classification_review_status_enum: ClassificationReviewStatusEnum;
      manual_review_outcome_enum: ManualReviewOutcomeEnum;
      model_deployment_status_enum: ModelDeploymentStatusEnum;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
