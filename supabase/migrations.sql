-- ============================================================
-- Pending migrations — paste into Supabase SQL editor and Run
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ============================================================

-- ── 1. Admin: verification columns on tutor_profiles ────────
--    Required for the /admin verification page to function.
ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS is_verified               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_requested    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_document_url text;

-- ── 2. Admin: flag on profiles ──────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- ── 3. Admin: grant yourself admin access ───────────────────
--    Replace the email if needed.
UPDATE profiles
  SET is_admin = true
  WHERE id = (SELECT id FROM auth.users WHERE email = 'henry.andy.s@gmail.com');

-- ── 4. RLS: admin can read all tutor_profiles ───────────────
DROP POLICY IF EXISTS "admins_read_tutor_profiles" ON tutor_profiles;
CREATE POLICY "admins_read_tutor_profiles" ON tutor_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- ── 5. RLS: admin can update all tutor_profiles ─────────────
DROP POLICY IF EXISTS "admins_update_tutor_profiles" ON tutor_profiles;
CREATE POLICY "admins_update_tutor_profiles" ON tutor_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- ── 6. Email notifications preference ──────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

-- ── 7. Booking reminder tracking ────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ── 8. pg_cron: session reminder emails every hour ──────────
--    Requires pg_cron and pg_net extensions to be enabled in
--    Supabase Dashboard → Database → Extensions.
--
--    Replace YOUR_PROJECT_REF and YOUR_ANON_KEY below, then run.
--
-- SELECT cron.schedule(
--   'send-session-reminders',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-session-reminders',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );

-- ── 9. RLS: student milestone insert ────────────────────────
--    Prevents students from inserting milestones on goals they don't own.
DROP POLICY IF EXISTS "milestones_student_insert" ON goal_milestones;
CREATE POLICY "milestones_student_insert" ON goal_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM learning_goals
      WHERE id = goal_id AND student_id = auth.uid()
    )
  );
