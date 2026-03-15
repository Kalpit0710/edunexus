-- Migration: Create notification logs table
-- Description: Tracks all outgoing emails, sms, or push notifications

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'email', 'sms', 'push'
    event TEXT NOT NULL, -- e.g., 'welcome', 'fee_receipt', 'attendance_alert'
  recipient_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    recipient_email TEXT,
    subject TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    error_msg TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_notification_logs_school_id ON notification_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_id ON notification_logs(recipient_id);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can see everything
CREATE POLICY "super_admin_all_notification_logs" ON notification_logs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- School users see only their school's logs
CREATE POLICY "school_isolation_notification_logs" ON notification_logs
  FOR SELECT
  TO authenticated
  USING (
    school_id = (auth.jwt() ->> 'school_id')::UUID
  );

-- Service role bypass
CREATE POLICY "service_role_bypass_notification_logs" ON notification_logs
  FOR ALL
  TO service_role
  USING (true);
