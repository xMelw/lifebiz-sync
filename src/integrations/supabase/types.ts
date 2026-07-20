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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          priority: string
          proposed_data: Json | null
          reference_id: string | null
          reference_table: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_comment: string | null
          status: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          priority?: string
          proposed_data?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: string
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          priority?: string
          proposed_data?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          status?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          duration_minutes: number | null
          event_date: string
          event_time: string | null
          id: string
          location: string | null
          notes: string | null
          order_id: string | null
          responsible_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          duration_minutes?: number | null
          event_date: string
          event_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          order_id?: string | null
          responsible_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          duration_minutes?: number | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          order_id?: string | null
          responsible_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferred_channel:
            | Database["public"]["Enums"]["preferred_channel"]
            | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferred_channel?:
            | Database["public"]["Enums"]["preferred_channel"]
            | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_channel?:
            | Database["public"]["Enums"]["preferred_channel"]
            | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      home_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      home_stock_items: {
        Row: {
          auto_deduct: boolean
          category: string | null
          created_at: string
          created_by: string
          expiry_date: string | null
          id: string
          last_deducted_at: string | null
          location: Database["public"]["Enums"]["home_location"]
          min_stock: number
          name: string
          quantity: number
          status: Database["public"]["Enums"]["record_status"]
          unit: Database["public"]["Enums"]["stock_unit"]
          updated_at: string
          weekly_consumption: number | null
          workspace_id: string
        }
        Insert: {
          auto_deduct?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          expiry_date?: string | null
          id?: string
          last_deducted_at?: string | null
          location?: Database["public"]["Enums"]["home_location"]
          min_stock?: number
          name: string
          quantity?: number
          status?: Database["public"]["Enums"]["record_status"]
          unit?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          weekly_consumption?: number | null
          workspace_id: string
        }
        Update: {
          auto_deduct?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          last_deducted_at?: string | null
          location?: Database["public"]["Enums"]["home_location"]
          min_stock?: number
          name?: string
          quantity?: number
          status?: Database["public"]["Enums"]["record_status"]
          unit?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          weekly_consumption?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_stock_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_items: {
        Row: {
          custom_meal: string | null
          day_of_week: number
          id: string
          meal_type: string
          plan_id: string
          recipe_id: string | null
          servings: number
        }
        Insert: {
          custom_meal?: string | null
          day_of_week: number
          id?: string
          meal_type: string
          plan_id: string
          recipe_id?: string | null
          servings?: number
        }
        Update: {
          custom_meal?: string | null
          day_of_week?: number
          id?: string
          meal_type?: string
          plan_id?: string
          recipe_id?: string | null
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          week_start: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
          notes?: string | null
          week_start: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          origin_id: string | null
          origin_type: string | null
          priority: string
          read: boolean
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          origin_id?: string | null
          origin_type?: string | null
          priority?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          origin_id?: string | null
          origin_type?: string | null
          priority?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_client_actions: {
        Row: {
          action: string
          client_name: string | null
          comment: string | null
          created_at: string
          id: string
          order_id: string
          proposed_date: string | null
          proposed_location: string | null
        }
        Insert: {
          action: string
          client_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          proposed_date?: string | null
          proposed_location?: string | null
        }
        Update: {
          action?: string
          client_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          proposed_date?: string | null
          proposed_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_client_actions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          custom_name: string | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
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
          channel: string | null
          client_notes: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          delivery_date: string | null
          discount: number
          duration_minutes: number | null
          event_date: string | null
          id: string
          internal_notes: string | null
          location: string | null
          notes: string | null
          order_number: string | null
          priority: string
          public_pin: string | null
          public_pin_attempts: number | null
          public_pin_locked_until: string | null
          public_token: string | null
          public_token_expires_at: string | null
          responsible_id: string | null
          sale_id: string | null
          signal_amount: number | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel?: string | null
          client_notes?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          delivery_date?: string | null
          discount?: number
          duration_minutes?: number | null
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          location?: string | null
          notes?: string | null
          order_number?: string | null
          priority?: string
          public_pin?: string | null
          public_pin_attempts?: number | null
          public_pin_locked_until?: string | null
          public_token?: string | null
          public_token_expires_at?: string | null
          responsible_id?: string | null
          sale_id?: string | null
          signal_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: string | null
          client_notes?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivery_date?: string | null
          discount?: number
          duration_minutes?: number | null
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          location?: string | null
          notes?: string | null
          order_number?: string | null
          priority?: string
          public_pin?: string | null
          public_pin_attempts?: number | null
          public_pin_locked_until?: string | null
          public_token?: string | null
          public_token_expires_at?: string | null
          responsible_id?: string | null
          sale_id?: string | null
          signal_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          min_stock: number
          name: string
          price: number
          sku: string | null
          status: Database["public"]["Enums"]["record_status"]
          stock_available: number | null
          stock_reserved: number
          stock_total: number
          unit: Database["public"]["Enums"]["stock_unit"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          min_stock?: number
          name: string
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          stock_available?: number | null
          stock_reserved?: number
          stock_total?: number
          unit?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          min_stock?: number
          name?: string
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          stock_available?: number | null
          stock_reserved?: number
          stock_total?: number
          unit?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          optional: boolean
          quantity: number | null
          recipe_id: string
          stock_item_id: string | null
          unit: string | null
        }
        Insert: {
          id?: string
          name: string
          optional?: boolean
          quantity?: number | null
          recipe_id: string
          stock_item_id?: string | null
          unit?: string | null
        }
        Update: {
          id?: string
          name?: string
          optional?: boolean
          quantity?: number | null
          recipe_id?: string
          stock_item_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "home_stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          cook_minutes: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instructions: string | null
          is_system: boolean
          name: string
          prep_minutes: number | null
          servings: number
          tags: string[] | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          category?: string
          cook_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_system?: boolean
          name: string
          prep_minutes?: number | null
          servings?: number
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          cook_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_system?: boolean
          name?: string
          prep_minutes?: number | null
          servings?: number
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          custom_name: string | null
          id: string
          product_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          date: string
          discount: number
          id: string
          notes: string | null
          origin: Database["public"]["Enums"]["sale_origin"]
          status: Database["public"]["Enums"]["sale_status"]
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          date?: string
          discount?: number
          id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["sale_origin"]
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          date?: string
          discount?: number
          id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["sale_origin"]
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          category: string | null
          checked: boolean
          id: string
          list_id: string
          name: string
          quantity: number | null
          recipe_id: string | null
          sort_order: number | null
          stock_item_id: string | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          checked?: boolean
          id?: string
          list_id: string
          name: string
          quantity?: number | null
          recipe_id?: string | null
          sort_order?: number | null
          stock_item_id?: string | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          checked?: boolean
          id?: string
          list_id?: string
          name?: string
          quantity?: number | null
          recipe_id?: string | null
          sort_order?: number | null
          stock_item_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "home_stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          access_casa: boolean
          access_negocio: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_casa?: boolean
          access_negocio?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_casa?: boolean
          access_negocio?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_weekly_consumption: {
        Args: { _workspace_id: string }
        Returns: number
      }
      convert_order_to_sale: { Args: { _order_id: string }; Returns: string }
      generate_order_public_link: { Args: { _order_id: string }; Returns: Json }
      submit_client_action: {
        Args: {
          _action: string
          _client_name?: string
          _comment?: string
          _pin: string
          _proposed_date?: string
          _proposed_location?: string
          _token: string
        }
        Returns: Json
      }
      verify_order_pin: {
        Args: { _pin: string; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "colaborador" | "visualizador"
      home_location:
        | "despensa"
        | "frigorifico"
        | "congelador"
        | "casa_de_banho"
        | "outro"
      member_status: "active" | "pending" | "inactive"
      order_status:
        | "pendente"
        | "confirmada"
        | "em_preparacao"
        | "pronta"
        | "entregue"
        | "cancelada"
        | "rascunho"
        | "pendente_aprovacao"
        | "alteracoes_pedidas"
        | "aprovada_envio"
        | "enviada_cliente"
        | "vista_pelo_cliente"
        | "em_negociacao"
        | "convertida_venda"
        | "arquivada"
      preferred_channel:
        | "whatsapp"
        | "telefone"
        | "email"
        | "instagram"
        | "outro"
      record_status: "active" | "archived"
      sale_origin: "manual" | "encomenda"
      sale_status: "pendente" | "confirmada" | "cancelada"
      stock_unit: "unidade" | "kg" | "g" | "L" | "ml" | "pacote" | "caixa"
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
      app_role: ["admin", "gestor", "colaborador", "visualizador"],
      home_location: [
        "despensa",
        "frigorifico",
        "congelador",
        "casa_de_banho",
        "outro",
      ],
      member_status: ["active", "pending", "inactive"],
      order_status: [
        "pendente",
        "confirmada",
        "em_preparacao",
        "pronta",
        "entregue",
        "cancelada",
        "rascunho",
        "pendente_aprovacao",
        "alteracoes_pedidas",
        "aprovada_envio",
        "enviada_cliente",
        "vista_pelo_cliente",
        "em_negociacao",
        "convertida_venda",
        "arquivada",
      ],
      preferred_channel: [
        "whatsapp",
        "telefone",
        "email",
        "instagram",
        "outro",
      ],
      record_status: ["active", "archived"],
      sale_origin: ["manual", "encomenda"],
      sale_status: ["pendente", "confirmada", "cancelada"],
      stock_unit: ["unidade", "kg", "g", "L", "ml", "pacote", "caixa"],
    },
  },
} as const
