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
      academic_years: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string
          remarks: string | null
          school_id: string
          section_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          marked_by: string
          remarks?: string | null
          school_id: string
          section_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string
          remarks?: string | null
          school_id?: string
          section_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          school_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      book_loans: {
        Row: {
          book_id: string
          created_at: string
          due_date: string
          fine_amount: number
          id: string
          issued_by: string | null
          issued_by_name: string | null
          issued_date: string
          remarks: string | null
          returned_date: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          due_date: string
          fine_amount?: number
          id?: string
          issued_by?: string | null
          issued_by_name?: string | null
          issued_date?: string
          remarks?: string | null
          returned_date?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          due_date?: string
          fine_amount?: number
          id?: string
          issued_by?: string | null
          issued_by_name?: string | null
          issued_date?: string
          remarks?: string | null
          returned_date?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_loans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stops: {
        Row: {
          bus_id: string
          created_at: string
          drop_time: string | null
          id: string
          name: string
          pickup_time: string | null
          school_id: string
          stop_order: number
        }
        Insert: {
          bus_id: string
          created_at?: string
          drop_time?: string | null
          id?: string
          name: string
          pickup_time?: string | null
          school_id: string
          stop_order?: number
        }
        Update: {
          bus_id?: string
          created_at?: string
          drop_time?: string | null
          id?: string
          name?: string
          pickup_time?: string | null
          school_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bus_stops_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          attendant_name: string | null
          attendant_phone: string | null
          bus_number: string
          capacity: number
          created_at: string
          deleted_at: string | null
          driver_license: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          is_active: boolean
          model: string | null
          notes: string | null
          registration_number: string | null
          route_name: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          attendant_name?: string | null
          attendant_phone?: string | null
          bus_number: string
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          driver_license?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          notes?: string | null
          registration_number?: string | null
          route_name?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          attendant_name?: string | null
          attendant_phone?: string | null
          bus_number?: string
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          driver_license?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          notes?: string | null
          registration_number?: string | null
          route_name?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          report_card_type: string
          school_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          report_card_type?: string
          school_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          report_card_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payment_items: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payment_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "fee_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          collected_by: string
          created_at: string
          discount_amount: number
          id: string
          paid_amount: number
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_number: string
          reference_number: string | null
          remarks: string | null
          school_id: string
          student_id: string
          total_amount: number
        }
        Insert: {
          collected_by: string
          created_at?: string
          discount_amount?: number
          id?: string
          paid_amount: number
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_number: string
          reference_number?: string | null
          remarks?: string | null
          school_id: string
          student_id: string
          total_amount: number
        }
        Update: {
          collected_by?: string
          created_at?: string
          discount_amount?: number
          id?: string
          paid_amount?: number
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_number?: string
          reference_number?: string | null
          remarks?: string | null
          school_id?: string
          student_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year_id: string
          amount: number
          category_id: string
          class_id: string
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          is_active: boolean
          school_id: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          category_id: string
          class_id: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          is_active?: boolean
          school_id: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          category_id?: string
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          is_active?: boolean
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_rules: {
        Row: {
          class_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          grade_name: string
          grade_point: number | null
          id: string
          max_marks: number
          min_marks: number
          school_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          grade_name: string
          grade_point?: number | null
          id?: string
          max_marks: number
          min_marks: number
          school_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          grade_name?: string
          grade_point?: number | null
          id?: string
          max_marks?: number
          min_marks?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_rules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          school_id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          school_id: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          school_id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          homework_date: string
          id: string
          school_id: string
          section_id: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          homework_date?: string
          id?: string
          school_id: string
          section_id?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          homework_date?: string
          id?: string
          school_id?: string
          section_id?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          low_stock_alert: number
          name: string
          school_id: string
          sku: string | null
          stock_quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_alert?: number
          name: string
          school_id: string
          sku?: string | null
          stock_quantity?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_alert?: number
          name?: string
          school_id?: string
          sku?: string | null
          stock_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sale_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          sale_id: string
          school_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          sale_id: string
          school_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          sale_id?: string
          school_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "inventory_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sale_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sales: {
        Row: {
          bill_number: string
          created_at: string
          id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          sale_date: string
          school_id: string
          sold_by: string | null
          student_id: string | null
          total_amount: number
        }
        Insert: {
          bill_number: string
          created_at?: string
          id?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          sale_date?: string
          school_id: string
          sold_by?: string | null
          student_id?: string | null
          total_amount: number
        }
        Update: {
          bill_number?: string
          created_at?: string
          id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          sale_date?: string
          school_id?: string
          sold_by?: string | null
          student_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sales_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sales_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string | null
          copies_available: number
          copies_total: number
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          isbn: string | null
          school_id: string
          shelf_location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          isbn?: string | null
          school_id: string
          shelf_location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          isbn?: string | null
          school_id?: string
          shelf_location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          error_msg: string | null
          event: string
          id: string
          recipient_email: string | null
          recipient_id: string | null
          school_id: string
          sent_at: string | null
          status: string | null
          subject: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          error_msg?: string | null
          event: string
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          school_id: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          error_msg?: string | null
          event?: string
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          school_id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          relation: string
          school_id: string
          student_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          relation?: string
          school_id: string
          student_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          relation?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          plan: string
          price_inr: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          plan: string
          price_inr: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          plan?: string
          price_inr?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      report_co_scholastic_marks: {
        Row: {
          area: string
          created_at: string
          entered_by: string | null
          id: string
          school_id: string
          student_id: string
          term1: string | null
          term2: string | null
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          entered_by?: string | null
          id?: string
          school_id: string
          student_id: string
          term1?: string | null
          term2?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          school_id?: string
          student_id?: string
          term1?: string | null
          term2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_co_scholastic_marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_co_scholastic_marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_co_scholastic_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      report_publications: {
        Row: {
          academic_year_id: string | null
          class_id: string
          created_at: string
          id: string
          locked_at: string | null
          published_at: string | null
          published_by: string | null
          result_visible: boolean
          school_id: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          locked_at?: string | null
          published_at?: string | null
          published_by?: string | null
          result_visible?: boolean
          school_id: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          locked_at?: string | null
          published_at?: string | null
          published_by?: string | null
          result_visible?: boolean
          school_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_publications_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_publications_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_publications_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_publications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_scholastic_marks: {
        Row: {
          class_id: string
          created_at: string
          entered_at: string
          entered_by: string | null
          id: string
          school_id: string
          student_id: string
          subject_id: string
          term1: Json
          term2: Json
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          id?: string
          school_id: string
          student_id: string
          subject_id: string
          term1?: Json
          term2?: Json
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          id?: string
          school_id?: string
          student_id?: string
          subject_id?: string
          term1?: Json
          term2?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_scholastic_marks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_scholastic_marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_scholastic_marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_scholastic_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_scholastic_marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      report_student_meta: {
        Row: {
          created_at: string
          entered_by: string | null
          id: string
          remarks: string | null
          result_status: string | null
          school_id: string
          student_id: string
          term1_attendance: string | null
          term2_attendance: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          id?: string
          remarks?: string | null
          result_status?: string | null
          school_id: string
          student_id: string
          term1_attendance?: string | null
          term2_attendance?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          id?: string
          remarks?: string | null
          result_status?: string | null
          school_id?: string
          student_id?: string
          term1_attendance?: string | null
          term2_attendance?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_student_meta_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_student_meta_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_student_meta_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      report_subject_configs: {
        Row: {
          class_id: string
          components: Json
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          max_marks: Json
          school_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          components?: Json
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          max_marks?: Json
          school_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          components?: Json
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          max_marks?: Json
          school_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_subject_configs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_subject_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_subject_configs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          academic_year_start_month: number
          address: string | null
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          pincode: string | null
          state: string | null
          subscription_plan: string
          subscription_status: string
          theme_color: string | null
          trial_ends_at: string | null
          updated_at: string
          website: string | null
          working_days: number[]
        }
        Insert: {
          academic_year_start_month?: number
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          subscription_plan?: string
          subscription_status?: string
          theme_color?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          working_days?: number[]
        }
        Update: {
          academic_year_start_month?: number
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          subscription_plan?: string
          subscription_status?: string
          theme_color?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          working_days?: number[]
        }
        Relationships: []
      }
      sections: {
        Row: {
          capacity: number | null
          class_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
        }
        Insert: {
          capacity?: number | null
          class_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
        }
        Update: {
          capacity?: number | null
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjusted_by: string | null
          created_at: string
          id: string
          item_id: string
          quantity: number
          reason: string | null
          school_id: string
          type: Database["public"]["Enums"]["stock_adjustment_type"]
        }
        Insert: {
          adjusted_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          reason?: string | null
          school_id: string
          type: Database["public"]["Enums"]["stock_adjustment_type"]
        }
        Update: {
          adjusted_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          reason?: string | null
          school_id?: string
          type?: Database["public"]["Enums"]["stock_adjustment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transport: {
        Row: {
          bus_id: string
          created_at: string
          fee_amount: number
          id: string
          pickup_point: string | null
          school_id: string
          stop_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          fee_amount?: number
          id?: string
          pickup_point?: string | null
          school_id: string
          stop_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          fee_amount?: number
          id?: string
          pickup_point?: string | null
          school_id?: string
          stop_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transport_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string
          admission_number: string
          allergies: string | null
          blood_group: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          doctor_name: string | null
          doctor_phone: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_active: boolean
          medical_conditions: string | null
          medications: string | null
          photo_url: string | null
          roll_number: string | null
          school_id: string
          section_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admission_date?: string
          admission_number: string
          allergies?: string | null
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          medical_conditions?: string | null
          medications?: string | null
          photo_url?: string | null
          roll_number?: string | null
          school_id: string
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admission_date?: string
          admission_number?: string
          allergies?: string | null
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean
          medical_conditions?: string | null
          medications?: string | null
          photo_url?: string | null
          roll_number?: string | null
          school_id?: string
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string
          code: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
        }
        Insert: {
          class_id: string
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
        }
        Update: {
          class_id?: string
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_section_assignments: {
        Row: {
          academic_year_id: string | null
          created_at: string
          id: string
          is_class_teacher: boolean
          school_id: string
          section_id: string
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id: string
          section_id: string
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id?: string
          section_id?: string
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_section_assignments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          is_active: boolean
          join_date: string
          qualification: string | null
          school_id: string
          specialization: string | null
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          join_date?: string
          qualification?: string | null
          school_id: string
          specialization?: string | null
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          join_date?: string
          qualification?: string | null
          school_id?: string
          specialization?: string | null
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          period_id: string
          room: string | null
          school_id: string
          section_id: string
          subject_id: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          period_id: string
          room?: string | null
          school_id: string
          section_id: string
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          period_id?: string
          room?: string | null
          school_id?: string
          section_id?: string
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timetable_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_periods: {
        Row: {
          created_at: string
          display_order: number
          end_time: string | null
          id: string
          is_break: boolean
          name: string
          school_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          end_time?: string | null
          id?: string
          is_break?: boolean
          name: string
          school_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          end_time?: string | null
          id?: string
          is_break?: boolean
          name?: string
          school_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_certificates: {
        Row: {
          admission_date: string | null
          admission_number: string | null
          class_name: string | null
          conduct: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          issue_date: string
          issued_by: string | null
          issued_by_name: string | null
          leaving_date: string | null
          reason: string | null
          remarks: string | null
          school_id: string
          serial_no: number
          student_id: string
          student_name: string
          tc_number: string
        }
        Insert: {
          admission_date?: string | null
          admission_number?: string | null
          class_name?: string | null
          conduct?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          issued_by_name?: string | null
          leaving_date?: string | null
          reason?: string | null
          remarks?: string | null
          school_id: string
          serial_no: number
          student_id: string
          student_name: string
          tc_number: string
        }
        Update: {
          admission_date?: string | null
          admission_number?: string | null
          class_name?: string | null
          conduct?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          issued_by_name?: string | null
          leaving_date?: string | null
          reason?: string | null
          remarks?: string | null
          school_id?: string
          serial_no?: number
          student_id?: string
          student_name?: string
          tc_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_adjusted_by?: string
          p_item_id: string
          p_quantity: number
          p_reason?: string
          p_type: Database["public"]["Enums"]["stock_adjustment_type"]
        }
        Returns: Json
      }
      assign_student_transport: {
        Args: {
          p_bus_id: string
          p_fee: number
          p_pickup_point: string
          p_school_id: string
          p_stop_id: string
          p_student_id: string
        }
        Returns: {
          bus_id: string
          created_at: string
          fee_amount: number
          id: string
          pickup_point: string | null
          school_id: string
          stop_id: string | null
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_transport"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_grade: {
        Args: { p_class_id: string; p_percentage: number; p_school_id: string }
        Returns: string
      }
      create_inventory_sale: {
        Args: {
          p_items: Json
          p_payment_mode: Database["public"]["Enums"]["payment_mode"]
          p_school_id: string
          p_sold_by?: string
          p_student_id?: string
        }
        Returns: Json
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_my_school_id: { Args: never; Returns: string }
      get_pending_fees: {
        Args: { p_school_id: string }
        Returns: {
          admission_number: string
          balance: number
          class_name: string
          section_name: string
          student_id: string
          student_name: string
          total_fee: number
          total_paid: number
        }[]
      }
      is_admin_or_manager: { Args: never; Returns: boolean }
      is_school_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      issue_book: {
        Args: {
          p_book_id: string
          p_due_date: string
          p_school_id: string
          p_student_id: string
        }
        Returns: {
          book_id: string
          created_at: string
          due_date: string
          fine_amount: number
          id: string
          issued_by: string | null
          issued_by_name: string | null
          issued_date: string
          remarks: string | null
          returned_date: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "book_loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      issue_transfer_certificate: {
        Args: {
          p_conduct: string
          p_deactivate: boolean
          p_issue_date: string
          p_leaving_date: string
          p_reason: string
          p_remarks: string
          p_school_id: string
          p_student_id: string
        }
        Returns: {
          admission_date: string | null
          admission_number: string | null
          class_name: string | null
          conduct: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          issue_date: string
          issued_by: string | null
          issued_by_name: string | null
          leaving_date: string | null
          reason: string | null
          remarks: string | null
          school_id: string
          serial_no: number
          student_id: string
          student_name: string
          tc_number: string
        }
        SetofOptions: {
          from: "*"
          to: "transfer_certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_students: {
        Args: { p_mappings: Json; p_school_id: string; p_target_year: string }
        Returns: Json
      }
      publish_class_report: {
        Args: {
          p_academic_year_id: string
          p_class_id: string
          p_lock?: boolean
          p_result_visible?: boolean
        }
        Returns: Json
      }
      return_book: {
        Args: {
          p_fine: number
          p_loan_id: string
          p_lost: boolean
          p_returned_date: string
        }
        Returns: {
          book_id: string
          created_at: string
          due_date: string
          fine_amount: number
          id: string
          issued_by: string | null
          issued_by_name: string | null
          issued_date: string
          remarks: string | null
          returned_date: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "book_loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_attendance_atomic: {
        Args: {
          p_class_id: string
          p_date: string
          p_marked_by: string
          p_records: Json
          p_school_id: string
          p_section_id: string
        }
        Returns: number
      }
      unlock_class_report: {
        Args: { p_academic_year_id: string; p_class_id: string }
        Returns: boolean
      }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late" | "half_day" | "holiday"
      fee_status: "pending" | "partial" | "paid" | "overdue" | "waived"
      gender: "male" | "female" | "other"
      inventory_category:
        | "book"
        | "stationery"
        | "uniform"
        | "sports"
        | "lab"
        | "other"
      payment_mode: "cash" | "cheque" | "upi" | "neft" | "card" | "online"
      report_status: "draft" | "published" | "locked"
      stock_adjustment_type: "add" | "remove" | "adjustment" | "sale"
      user_role:
        | "super_admin"
        | "school_admin"
        | "teacher"
        | "manager"
        | "cashier"
        | "parent"
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
      attendance_status: ["present", "absent", "late", "half_day", "holiday"],
      fee_status: ["pending", "partial", "paid", "overdue", "waived"],
      gender: ["male", "female", "other"],
      inventory_category: [
        "book",
        "stationery",
        "uniform",
        "sports",
        "lab",
        "other",
      ],
      payment_mode: ["cash", "cheque", "upi", "neft", "card", "online"],
      report_status: ["draft", "published", "locked"],
      stock_adjustment_type: ["add", "remove", "adjustment", "sale"],
      user_role: [
        "super_admin",
        "school_admin",
        "teacher",
        "manager",
        "cashier",
        "parent",
      ],
    },
  },
} as const
