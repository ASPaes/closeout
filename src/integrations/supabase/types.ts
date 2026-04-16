export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      asaas_charges: {
        Row: {
          amount: number
          asaas_charge_id: string
          asaas_status: string
          billing_type: string
          card_token: string | null
          client_id: string
          closeout_amount: number | null
          consumer_id: string
          created_at: string
          event_id: string
          fee_amount: number | null
          id: string
          net_amount: number | null
          order_id: string
          paid_at: string | null
          payment_id: string
          pix_copy_paste: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          refund_amount: number | null
          refunded_at: string | null
          split_amount: number | null
          updated_at: string
          webhook_data: Json | null
        }
        Insert: {
          amount: number
          asaas_charge_id: string
          asaas_status?: string
          billing_type: string
          card_token?: string | null
          client_id: string
          closeout_amount?: number | null
          consumer_id: string
          created_at?: string
          event_id: string
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          order_id: string
          paid_at?: string | null
          payment_id: string
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          split_amount?: number | null
          updated_at?: string
          webhook_data?: Json | null
        }
        Update: {
          amount?: number
          asaas_charge_id?: string
          asaas_status?: string
          billing_type?: string
          card_token?: string | null
          client_id?: string
          closeout_amount?: number | null
          consumer_id?: string
          created_at?: string
          event_id?: string
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          order_id?: string
          paid_at?: string | null
          payment_id?: string
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          split_amount?: number | null
          updated_at?: string
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "asaas_charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_customer_cards: {
        Row: {
          asaas_customer_id: string
          card_brand: string | null
          card_holder_name: string | null
          card_last_four: string
          card_token: string
          cpf_used: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          card_brand?: string | null
          card_holder_name?: string | null
          card_last_four: string
          card_token: string
          cpf_used?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          card_brand?: string | null
          card_holder_name?: string | null
          card_last_four?: string
          card_token?: string
          cpf_used?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          user_id?: string
        }
        Relationships: []
      }
      asaas_customer_map: {
        Row: {
          asaas_customer_id: string
          cpf: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          cpf: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          cpf?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_subaccounts: {
        Row: {
          asaas_account_id: string
          asaas_wallet_id: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          client_id: string
          cpf_cnpj: string
          created_at: string
          email: string
          id: string
          name: string
          pix_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asaas_account_id: string
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          client_id: string
          cpf_cnpj: string
          created_at?: string
          email: string
          id?: string
          name: string
          pix_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asaas_account_id?: string
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          client_id?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          pix_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_subaccounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_subaccounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      billing_rules: {
        Row: {
          activation_amount: number | null
          billing_day: number | null
          client_id: string
          created_at: string
          currency: string
          fee_percent: number | null
          id: string
          is_active: boolean
          monthly_amount: number | null
          notes: string | null
          rule_type: string
          updated_at: string
        }
        Insert: {
          activation_amount?: number | null
          billing_day?: number | null
          client_id: string
          created_at?: string
          currency?: string
          fee_percent?: number | null
          id?: string
          is_active?: boolean
          monthly_amount?: number | null
          notes?: string | null
          rule_type: string
          updated_at?: string
        }
        Update: {
          activation_amount?: number | null
          billing_day?: number | null
          client_id?: string
          created_at?: string
          currency?: string
          fee_percent?: number | null
          id?: string
          is_active?: boolean
          monthly_amount?: number | null
          notes?: string | null
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_items: {
        Row: {
          campaign_id: string
          combo_id: string | null
          created_at: string
          discount_percent: number | null
          id: string
          is_active: boolean
          item_type: string
          product_id: string | null
          promo_price: number | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          combo_id?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          item_type: string
          product_id?: string | null
          promo_price?: number | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          combo_id?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          item_type?: string
          product_id?: string | null
          promo_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          client_id: string
          created_at: string
          destination: string
          direction: string
          event_id: string
          id: string
          movement_type: string
          notes: string | null
          operator_id: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          client_id: string
          created_at?: string
          destination: string
          direction: string
          event_id: string
          id?: string
          movement_type: string
          notes?: string | null
          operator_id: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          client_id?: string
          created_at?: string
          destination?: string
          direction?: string
          event_id?: string
          id?: string
          movement_type?: string
          notes?: string | null
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_event_cash_movements"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "cash_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      cash_order_counters: {
        Row: {
          event_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          event_id: string
          next_number?: number
          updated_at?: string
        }
        Update: {
          event_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_order_counters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_order_counters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      cash_orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_register_id: string
          client_id: string
          created_at: string
          discount: number
          event_id: string
          id: string
          items: Json
          operator_id: string
          order_number: number
          payment_method: string
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id: string
          client_id: string
          created_at?: string
          discount?: number
          event_id: string
          id?: string
          items: Json
          operator_id: string
          order_number: number
          payment_method: string
          status?: string
          subtotal: number
          total: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id?: string
          client_id?: string
          created_at?: string
          discount?: number
          event_id?: string
          id?: string
          items?: Json
          operator_id?: string
          order_number?: number
          payment_method?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_orders_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_orders_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_event_cash_movements"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "cash_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          client_id: string
          closed_at: string | null
          closing_balance: number | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          opened_at: string
          opening_balance: number
          operator_id: string
          register_number: number
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          operator_id: string
          register_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          operator_id?: string
          register_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          catalog_id: string
          client_id: string
          combo_id: string | null
          created_at: string
          id: string
          is_active: boolean
          item_type: string
          product_id: string | null
          updated_at: string
        }
        Insert: {
          catalog_id: string
          client_id: string
          combo_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_type: string
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          client_id?: string
          combo_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_type?: string
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          asaas_subaccount_id: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_fee_percent: number | null
          document: string | null
          email: string | null
          id: string
          logo_path: string | null
          logo_url: string | null
          name: string
          owner_cpf: string | null
          owner_name: string | null
          owner_phone: string | null
          phone: string | null
          pix_key: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          asaas_subaccount_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_fee_percent?: number | null
          document?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          logo_url?: string | null
          name: string
          owner_cpf?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          phone?: string | null
          pix_key?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          asaas_subaccount_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_fee_percent?: number | null
          document?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          logo_url?: string | null
          name?: string
          owner_cpf?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          phone?: string | null
          pix_key?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      cpf_change_requests: {
        Row: {
          created_at: string
          current_cpf: string
          id: string
          justification: string
          requested_cpf: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_cpf: string
          id?: string
          justification: string
          requested_cpf: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_cpf?: string
          id?: string
          justification?: string
          requested_cpf?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      event_billing_overrides: {
        Row: {
          activation_amount: number | null
          billing_rule_id: string
          client_id: string
          created_at: string
          currency: string | null
          event_id: string
          fee_percent: number | null
          id: string
          is_active: boolean
          monthly_amount: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          activation_amount?: number | null
          billing_rule_id: string
          client_id: string
          created_at?: string
          currency?: string | null
          event_id: string
          fee_percent?: number | null
          id?: string
          is_active?: boolean
          monthly_amount?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          activation_amount?: number | null
          billing_rule_id?: string
          client_id?: string
          created_at?: string
          currency?: string | null
          event_id?: string
          fee_percent?: number | null
          id?: string
          is_active?: boolean
          monthly_amount?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_billing_overrides_billing_rule_id_fkey"
            columns: ["billing_rule_id"]
            isOneToOne: false
            referencedRelation: "billing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_billing_overrides_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_billing_overrides_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_billing_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_billing_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_catalogs: {
        Row: {
          catalog_id: string
          client_id: string
          created_at: string
          event_id: string
          id: string
          is_active: boolean
        }
        Insert: {
          catalog_id: string
          client_id: string
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
        }
        Update: {
          catalog_id?: string
          client_id?: string
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_catalogs_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_catalogs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_catalogs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_catalogs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_catalogs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          check_in_method: string
          checked_in_at: string | null
          checked_out_at: string | null
          client_id: string
          event_id: string
          id: string
          is_visible: boolean | null
          latitude: number | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          check_in_method?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          client_id: string
          event_id: string
          id?: string
          is_visible?: boolean | null
          latitude?: number | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          check_in_method?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          client_id?: string
          event_id?: string
          id?: string
          is_visible?: boolean | null
          latitude?: number | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_images: {
        Row: {
          client_id: string
          created_at: string
          event_id: string
          id: string
          public_url: string | null
          sort_order: number
          storage_path: string
        }
        Insert: {
          client_id: string
          created_at?: string
          event_id: string
          id?: string
          public_url?: string | null
          sort_order?: number
          storage_path: string
        }
        Update: {
          client_id?: string
          created_at?: string
          event_id?: string
          id?: string
          public_url?: string | null
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_settings: {
        Row: {
          client_id: string
          created_at: string
          event_id: string
          geo_radius_meters: number
          id: string
          max_order_value: number | null
          stock_control_enabled: boolean
          unretrieved_order_alert_minutes: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          event_id: string
          geo_radius_meters?: number
          id?: string
          max_order_value?: number | null
          stock_control_enabled?: boolean
          unretrieved_order_alert_minutes?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          event_id?: string
          geo_radius_meters?: number
          id?: string
          max_order_value?: number | null
          stock_control_enabled?: boolean
          unretrieved_order_alert_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          geo_radius_meters: number | null
          id: string
          max_order_value: number | null
          name: string
          payment_sandbox_mode: boolean
          start_at: string | null
          status: string
          stock_control_enabled: boolean
          unretrieved_order_alert_minutes: number | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          geo_radius_meters?: number | null
          id?: string
          max_order_value?: number | null
          name: string
          payment_sandbox_mode?: boolean
          start_at?: string | null
          status?: string
          stock_control_enabled?: boolean
          unretrieved_order_alert_minutes?: number | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          geo_radius_meters?: number | null
          id?: string
          max_order_value?: number | null
          name?: string
          payment_sandbox_mode?: boolean
          start_at?: string | null
          status?: string
          stock_control_enabled?: boolean
          unretrieved_order_alert_minutes?: number | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      exchanges: {
        Row: {
          adjustment_direction: string
          cash_order_id: string
          cash_register_id: string
          client_id: string
          created_at: string
          event_id: string
          id: string
          new_item: Json
          operator_id: string
          original_item: Json
          price_difference: number
        }
        Insert: {
          adjustment_direction: string
          cash_order_id: string
          cash_register_id: string
          client_id: string
          created_at?: string
          event_id: string
          id?: string
          new_item: Json
          operator_id: string
          original_item: Json
          price_difference: number
        }
        Update: {
          adjustment_direction?: string
          cash_order_id?: string
          cash_register_id?: string
          client_id?: string
          created_at?: string
          event_id?: string
          id?: string
          new_item?: Json
          operator_id?: string
          original_item?: Json
          price_difference?: number
        }
        Relationships: [
          {
            foreignKeyName: "exchanges_cash_order_id_fkey"
            columns: ["cash_order_id"]
            isOneToOne: false
            referencedRelation: "cash_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_event_cash_movements"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "exchanges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      order_item_deliveries: {
        Row: {
          created_at: string
          delivered_by: string
          id: string
          order_id: string
          order_item_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          delivered_by: string
          id?: string
          order_id: string
          order_item_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          delivered_by?: string
          id?: string
          order_id?: string
          order_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "oid_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oid_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          combo_id: string | null
          delivered_quantity: number
          id: string
          name: string
          notes: string | null
          order_id: string
          product_id: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          combo_id?: string | null
          delivered_quantity?: number
          id?: string
          name: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          combo_id?: string | null
          delivered_quantity?: number
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          consumer_id: string | null
          created_at: string
          delivered_at: string | null
          delivered_by_staff_id: string | null
          event_id: string
          id: string
          is_split_payment: boolean
          notes: string | null
          order_number: number
          origin: Database["public"]["Enums"]["order_origin"]
          origin_ref_id: string | null
          paid_at: string | null
          payment_method: string | null
          preparing_at: string | null
          ready_at: string | null
          split_paid_amount: number | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          consumer_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_by_staff_id?: string | null
          event_id: string
          id?: string
          is_split_payment?: boolean
          notes?: string | null
          order_number: number
          origin: Database["public"]["Enums"]["order_origin"]
          origin_ref_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          split_paid_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          consumer_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_by_staff_id?: string | null
          event_id?: string
          id?: string
          is_split_payment?: boolean
          notes?: string | null
          order_number?: number
          origin?: Database["public"]["Enums"]["order_origin"]
          origin_ref_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          split_paid_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cancelled_at: string | null
          client_id: string
          consumer_id: string
          created_at: string | null
          event_id: string
          failed_at: string | null
          gateway_ref: string | null
          gateway_response: Json | null
          id: string
          order_id: string
          paid_at: string | null
          payment_method: string
          split_index: number
          split_total: number | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          client_id: string
          consumer_id: string
          created_at?: string | null
          event_id: string
          failed_at?: string | null
          gateway_ref?: string | null
          gateway_response?: Json | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method: string
          split_index?: number
          split_total?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          client_id?: string
          consumer_id?: string
          created_at?: string | null
          event_id?: string
          failed_at?: string | null
          gateway_ref?: string | null
          gateway_response?: Json | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: string
          split_index?: number
          split_total?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          asaas_sandbox_mode: boolean
          closeout_fee_percent: number
          created_at: string
          default_fee_percent: number
          default_geo_radius_meters: number
          default_max_order_value: number
          default_unretrieved_order_alert_minutes: number
          fee_payer: string
          id: string
          min_order_amount: number
          pix_expiration_minutes: number
          updated_at: string
        }
        Insert: {
          asaas_sandbox_mode?: boolean
          closeout_fee_percent?: number
          created_at?: string
          default_fee_percent?: number
          default_geo_radius_meters?: number
          default_max_order_value?: number
          default_unretrieved_order_alert_minutes?: number
          fee_payer?: string
          id?: string
          min_order_amount?: number
          pix_expiration_minutes?: number
          updated_at?: string
        }
        Update: {
          asaas_sandbox_mode?: boolean
          closeout_fee_percent?: number
          created_at?: string
          default_fee_percent?: number
          default_geo_radius_meters?: number
          default_max_order_value?: number
          default_unretrieved_order_alert_minutes?: number
          fee_payer?: string
          id?: string
          min_order_amount?: number
          pix_expiration_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_image_library: {
        Row: {
          created_at: string
          id: string
          image_hash: string
          image_path: string
          normalized_name: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_hash: string
          image_path: string
          normalized_name: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_hash?: string
          image_path?: string
          normalized_name?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_recipes: {
        Row: {
          base_unit: string
          client_id: string
          created_at: string
          id: string
          ingredient_product_id: string
          is_active: boolean
          product_id: string
          quantity_base: number
          updated_at: string
        }
        Insert: {
          base_unit: string
          client_id: string
          created_at?: string
          id?: string
          ingredient_product_id: string
          is_active?: boolean
          product_id: string
          quantity_base: number
          updated_at?: string
        }
        Update: {
          base_unit?: string
          client_id?: string
          created_at?: string
          id?: string
          ingredient_product_id?: string
          is_active?: boolean
          product_id?: string
          quantity_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_ingredient_product_id_fkey"
            columns: ["ingredient_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_per_stock_unit: number | null
          base_unit: string | null
          brand: string | null
          category_id: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          image_source: string | null
          is_active: boolean
          is_ingredient: boolean
          is_sellable: boolean
          is_stock_tracked: boolean
          name: string
          price: number
          stock_unit: string | null
          updated_at: string
        }
        Insert: {
          base_per_stock_unit?: number | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_source?: string | null
          is_active?: boolean
          is_ingredient?: boolean
          is_sellable?: boolean
          is_stock_tracked?: boolean
          name: string
          price: number
          stock_unit?: string | null
          updated_at?: string
        }
        Update: {
          base_per_stock_unit?: number | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_source?: string | null
          is_active?: boolean
          is_ingredient?: boolean
          is_sellable?: boolean
          is_stock_tracked?: boolean
          name?: string
          price?: number
          stock_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_number: string | null
          asaas_customer_id: string | null
          avatar_url: string | null
          city: string | null
          cpf: string | null
          created_at: string
          id: string
          language: string
          last_payment_cpf: string | null
          name: string
          neighborhood: string | null
          phone: string | null
          postal_code: string | null
          registration_complete: boolean
          state: string | null
          status: string
          street: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          address_number?: string | null
          asaas_customer_id?: string | null
          avatar_url?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          id: string
          language?: string
          last_payment_cpf?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_complete?: boolean
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          address_number?: string | null
          asaas_customer_id?: string | null
          avatar_url?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          language?: string
          last_payment_cpf?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_complete?: boolean
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      qr_tokens: {
        Row: {
          generated_at: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["qr_status"]
          token: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          generated_at?: string
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["qr_status"]
          token: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          generated_at?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["qr_status"]
          token?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          authorized_by: string
          cash_order_id: string
          cash_register_id: string
          client_id: string
          created_at: string
          event_id: string
          id: string
          items: Json
          occurrence_type: string
          operator_id: string
          reason: string
          refund_amount: number
        }
        Insert: {
          authorized_by: string
          cash_order_id: string
          cash_register_id: string
          client_id: string
          created_at?: string
          event_id: string
          id?: string
          items: Json
          occurrence_type: string
          operator_id: string
          reason: string
          refund_amount: number
        }
        Update: {
          authorized_by?: string
          cash_order_id?: string
          cash_register_id?: string
          client_id?: string
          created_at?: string
          event_id?: string
          id?: string
          items?: Json
          occurrence_type?: string
          operator_id?: string
          reason?: string
          refund_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "returns_cash_order_id_fkey"
            columns: ["cash_order_id"]
            isOneToOne: false
            referencedRelation: "cash_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_event_cash_movements"
            referencedColumns: ["register_id"]
          },
          {
            foreignKeyName: "returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          allow_negative: boolean
          client_id: string
          created_at: string
          id: string
          is_enabled: boolean
          low_stock_threshold: number
          product_id: string
          quantity_available: number
          updated_at: string
        }
        Insert: {
          allow_negative?: boolean
          client_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          low_stock_threshold?: number
          product_id: string
          quantity_available?: number
          updated_at?: string
        }
        Update: {
          allow_negative?: boolean
          client_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          low_stock_threshold?: number
          product_id?: string
          quantity_available?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          entry_type: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          entry_type: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          entry_type?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          client_id: string
          event_id: string
          id: string
          order_id: string
          order_item_id: string
          product_id: string
          quantity: number
          reserved_at: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          client_id: string
          event_id: string
          id?: string
          order_id: string
          order_item_id: string
          product_id: string
          quantity: number
          reserved_at?: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          event_id?: string
          id?: string
          order_id?: string
          order_item_id?: string
          product_id?: string
          quantity?: number
          reserved_at?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consumption_limits: {
        Row: {
          id: string
          is_active: boolean | null
          limit_behavior: string
          max_order_value: number | null
          max_orders_per_event: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          limit_behavior?: string
          max_order_value?: number | null
          max_orders_per_event?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          limit_behavior?: string
          max_order_value?: number | null
          max_orders_per_event?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          email: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          used_at: string | null
          used_by: string | null
          venue_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          used_at?: string | null
          used_by?: string | null
          venue_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
          used_at?: string | null
          used_by?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "user_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_payment_methods: {
        Row: {
          card_brand: string | null
          card_last_four: string
          created_at: string | null
          gateway_token: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          method_type: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_last_four: string
          created_at?: string | null
          gateway_token: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          method_type: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_last_four?: string
          created_at?: string | null
          gateway_token?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          method_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          client_id: string | null
          created_at: string
          event_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "user_roles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      validations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          order_id: string
          qr_token_id: string
          result: string
          validated_by: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          order_id: string
          qr_token_id: string
          result: string
          validated_by: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          order_id?: string
          qr_token_id?: string
          result?: string
          validated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "validations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "validations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_qr_token_id_fkey"
            columns: ["qr_token_id"]
            isOneToOne: false
            referencedRelation: "qr_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          client_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_calls: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          call_type: string
          client_id: string
          completed_at: string | null
          consumer_id: string | null
          consumer_name: string | null
          created_at: string | null
          event_id: string
          expired_at: string | null
          id: string
          location_description: string | null
          status: string
          table_number: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          call_type?: string
          client_id: string
          completed_at?: string | null
          consumer_id?: string | null
          consumer_name?: string | null
          created_at?: string | null
          event_id: string
          expired_at?: string | null
          id?: string
          location_description?: string | null
          status?: string
          table_number?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          call_type?: string
          client_id?: string
          completed_at?: string | null
          consumer_id?: string | null
          consumer_name?: string | null
          created_at?: string | null
          event_id?: string
          expired_at?: string | null
          id?: string
          location_description?: string | null
          status?: string
          table_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      waiter_cancellation_requests: {
        Row: {
          client_id: string
          created_at: string | null
          event_id: string
          id: string
          order_id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          waiter_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          event_id: string
          id?: string
          order_id: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          waiter_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          order_id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_cancellation_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_cancellation_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_cancellation_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_cancellation_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "waiter_cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_invites: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          event_id: string
          id: string
          join_code: string
          status: string
          used_at: string | null
          used_by: string | null
          waiter_name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          join_code: string
          status?: string
          used_at?: string | null
          used_by?: string | null
          waiter_name: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          join_code?: string
          status?: string
          used_at?: string | null
          used_by?: string | null
          waiter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      waiter_sessions: {
        Row: {
          assignment_type: string
          assignment_value: string | null
          cash_collected: number | null
          cash_confirmed_at: string | null
          cash_confirmed_by: string | null
          cash_discrepancy: number | null
          cash_handed_over: number | null
          client_id: string
          closed_at: string | null
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["waiter_session_status"]
          updated_at: string | null
          waiter_id: string
        }
        Insert: {
          assignment_type?: string
          assignment_value?: string | null
          cash_collected?: number | null
          cash_confirmed_at?: string | null
          cash_confirmed_by?: string | null
          cash_discrepancy?: number | null
          cash_handed_over?: number | null
          client_id: string
          closed_at?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["waiter_session_status"]
          updated_at?: string | null
          waiter_id: string
        }
        Update: {
          assignment_type?: string
          assignment_value?: string | null
          cash_collected?: number | null
          cash_confirmed_at?: string | null
          cash_confirmed_by?: string | null
          cash_discrepancy?: number | null
          cash_handed_over?: number | null
          client_id?: string
          closed_at?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["waiter_session_status"]
          updated_at?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Views: {
      clients_limited: {
        Row: {
          id: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          status: string | null
        }
        Insert: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          status?: string | null
        }
        Update: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          status?: string | null
        }
        Relationships: []
      }
      consumer_event_stats: {
        Row: {
          event_id: string | null
          order_count: number | null
          total_spent: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      consumer_event_stats_secure: {
        Row: {
          event_id: string | null
          order_count: number | null
          total_spent: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      v_event_cancellations: {
        Row: {
          cancel_reason: string | null
          cancelled_amount: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          event_id: string | null
          order_number: number | null
          origin_id: string | null
          origin_type: string | null
        }
        Relationships: []
      }
      v_event_cash_movements: {
        Row: {
          cash_sales: number | null
          client_id: string | null
          closed_at: string | null
          closing_balance: number | null
          event_id: string | null
          opened_at: string | null
          opening_balance: number | null
          register_id: string | null
          register_number: number | null
          register_status: string | null
          total_refunds: number | null
          total_sangria: number | null
          total_suprimento: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_closing_report"
            referencedColumns: ["event_id"]
          },
        ]
      }
      v_event_closing_report: {
        Row: {
          avg_ticket: number | null
          client_id: string | null
          end_at: string | null
          event_id: string | null
          event_name: string | null
          event_status: string | null
          revenue_from_cash: number | null
          revenue_from_orders: number | null
          start_at: string | null
          total_cash: number | null
          total_cash_orders: number | null
          total_credit: number | null
          total_debit: number | null
          total_orders: number | null
          total_pix: number | null
          total_revenue: number | null
          total_transactions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      v_event_sales_summary: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          event_id: string | null
          order_number: number | null
          origin_id: string | null
          origin_type: string | null
          payment_method: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_waiter_call: { Args: { p_call_id: string }; Returns: Json }
      accept_waiter_invite: { Args: { p_join_code: string }; Returns: Json }
      bootstrap_super_admin: { Args: never; Returns: boolean }
      cancel_consumer_order: { Args: { p_order_id: string }; Returns: Json }
      check_order_rate_limit: {
        Args: { p_consumer_id: string }
        Returns: boolean
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      close_cash_register:
        | {
            Args: { p_closing_balance: number; p_register_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_closing_balance: number
              p_notes?: string
              p_register_id: string
            }
            Returns: undefined
          }
      close_event_cancel_unpaid: { Args: { p_event_id: string }; Returns: Json }
      close_waiter_session: {
        Args: { p_cash_handed_over: number; p_session_id: string }
        Returns: Json
      }
      complete_waiter_call: { Args: { p_call_id: string }; Returns: Json }
      confirm_cash_split_payment: {
        Args: { p_order_id: string; p_staff_id: string }
        Returns: Json
      }
      confirm_partial_delivery: {
        Args: { p_items: Json; p_order_id: string; p_staff_id: string }
        Returns: Json
      }
      consumer_checkin: {
        Args: {
          p_event_id: string
          p_lat?: number
          p_lng?: number
          p_method: string
        }
        Returns: Json
      }
      consumer_checkout: { Args: { p_event_id: string }; Returns: Json }
      create_consumer_order: { Args: { params: Json }; Returns: Json }
      create_consumer_split_order: { Args: { params: Json }; Returns: Json }
      create_cpf_change_request: {
        Args: { p_justification: string; p_requested_cpf: string }
        Returns: string
      }
      create_waiter_invite: {
        Args: { p_event_id: string; p_waiter_name: string }
        Returns: Json
      }
      create_waiter_order: { Args: { params: Json }; Returns: Json }
      delete_stock_entry: { Args: { p_entry_id: string }; Returns: undefined }
      ensure_consumer_role: { Args: never; Returns: undefined }
      get_client_managers: {
        Args: { p_client_id: string }
        Returns: {
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_clients_for_user_events: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_clients_for_user_venues: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_consumer_profile_stats: { Args: never; Returns: Json }
      get_event_checkin_counts: {
        Args: { p_event_ids: string[] }
        Returns: {
          active_checkins: number
          event_id: string
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: {
          client_id: string
          event_id: string
          role: Database["public"]["Enums"]["app_role"]
          venue_id: string
        }[]
      }
      get_user_client_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_event_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_venue_ids: { Args: { _user_id: string }; Returns: string[] }
      get_venues_for_user_clients: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_venues_for_user_events: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_role: string }; Returns: boolean }
      has_role_for_client: {
        Args: { p_client_id: string; p_roles: string[]; p_user_id: string }
        Returns: boolean
      }
      has_role_for_event: {
        Args: { p_event_id: string; p_roles: string[]; p_user_id: string }
        Returns: boolean
      }
      has_role_in_client:
        | { Args: { p_client_id: string }; Returns: boolean }
        | { Args: { p_client_id: string; p_role: string }; Returns: boolean }
      has_role_name: {
        Args: { _role_name: string; _user_id: string }
        Returns: boolean
      }
      is_cashier: { Args: { p_client_id: string }; Returns: boolean }
      is_client_manager: { Args: { p_client_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_waiter_for_event: { Args: { p_event_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_data?: Json
          p_old_data?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      next_cash_order_number: { Args: { p_event_id: string }; Returns: number }
      normalize_product_name: { Args: { input: string }; Returns: string }
      release_stock_for_order: { Args: { p_order_id: string }; Returns: Json }
      request_waiter_cancellation: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      reserve_stock_for_order: { Args: { p_order_id: string }; Returns: Json }
      review_waiter_cancellation: {
        Args: { p_decision: string; p_notes: string; p_request_id: string }
        Returns: Json
      }
      set_checkin_visibility: {
        Args: { p_visible: boolean }
        Returns: undefined
      }
      start_waiter_session: {
        Args: {
          p_assignment_type?: string
          p_assignment_value?: string
          p_event_id: string
        }
        Returns: Json
      }
      update_stock_entry:
        | {
            Args: {
              p_entry_id: string
              p_new_quantity: number
              p_new_reason?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_entry_id: string
              p_new_quantity: number
              p_new_reason?: string
            }
            Returns: undefined
          }
      validate_qr: {
        Args: { p_staff_id: string; p_token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "super_admin"
        | "client_admin"
        | "venue_manager"
        | "event_manager"
        | "staff"
        | "waiter"
        | "cashier"
        | "consumer"
        | "event_organizer"
        | "client_manager"
        | "bar_staff"
      campaign_status: "scheduled" | "active" | "paused" | "ended"
      cash_register_status: "open" | "closed"
      event_status: "draft" | "active" | "completed" | "cancelled"
      order_origin: "consumer_app" | "waiter_app" | "cashier"
      order_status:
        | "pending"
        | "processing_payment"
        | "partially_paid"
        | "paid"
        | "preparing"
        | "ready"
        | "partially_delivered"
        | "delivered"
        | "cancelled"
      payment_status:
        | "created"
        | "processing"
        | "approved"
        | "failed"
        | "cancelled"
        | "refunded"
        | "expired"
      qr_status: "valid" | "used" | "cancelled" | "invalid"
      stock_movement_type:
        | "entry"
        | "reservation"
        | "release"
        | "sale"
        | "adjustment"
      waiter_session_status: "active" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "super_admin",
        "client_admin",
        "venue_manager",
        "event_manager",
        "staff",
        "waiter",
        "cashier",
        "consumer",
        "event_organizer",
        "client_manager",
        "bar_staff",
      ],
      campaign_status: ["scheduled", "active", "paused", "ended"],
      cash_register_status: ["open", "closed"],
      event_status: ["draft", "active", "completed", "cancelled"],
      order_origin: ["consumer_app", "waiter_app", "cashier"],
      order_status: [
        "pending",
        "processing_payment",
        "partially_paid",
        "paid",
        "preparing",
        "ready",
        "partially_delivered",
        "delivered",
        "cancelled",
      ],
      payment_status: [
        "created",
        "processing",
        "approved",
        "failed",
        "cancelled",
        "refunded",
        "expired",
      ],
      qr_status: ["valid", "used", "cancelled", "invalid"],
      stock_movement_type: [
        "entry",
        "reservation",
        "release",
        "sale",
        "adjustment",
      ],
      waiter_session_status: ["active", "closed"],
    },
  },
} as const
