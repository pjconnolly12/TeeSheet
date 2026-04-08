export interface Database {
  public: {
    Tables: {
      rounds: {
        Row: {
          created_at: string;
          created_by: string;
          holes: number;
          id: string;
          location: string;
          max_players: number;
          tee_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          holes: number;
          id?: string;
          location: string;
          max_players: number;
          tee_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          holes?: number;
          id?: string;
          location?: string;
          max_players?: number;
          tee_time?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      round_players: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          reminder_sent_at: string | null;
          round_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          reminder_sent_at?: string | null;
          round_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          reminder_sent_at?: string | null;
          round_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_players_round_id_fkey";
            columns: ["round_id"];
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          }
        ];
      };
      distribution_list_entries: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string | null;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name?: string | null;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string | null;
          owner_id?: string;
        };
        Relationships: [];
      };
      round_waitlist_entries: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          promoted_at: string | null;
          round_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          promoted_at?: string | null;
          round_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          promoted_at?: string | null;
          round_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "round_waitlist_entries_round_id_fkey";
            columns: ["round_id"];
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
