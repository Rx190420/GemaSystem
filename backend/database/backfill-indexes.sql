-- ============================================================
-- Backfill de índices faltantes — corre esto UNA VEZ en el SQL
-- Editor de Supabase (producción). Es seguro volver a correrlo
-- (todo usa IF NOT EXISTS), y no toca datos, solo crea índices.
-- ============================================================

-- ── 1) Schema compartido (gyms gratuitos/trial + tabla gyms) ──
CREATE INDEX IF NOT EXISTS gyms_stripe_subscription_id_index ON public.gyms(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS gyms_status_index                 ON public.gyms(status);
CREATE INDEX IF NOT EXISTS class_schedules_class_id_index     ON public.class_schedules(class_id);
CREATE INDEX IF NOT EXISTS member_labels_label_id_index       ON public.member_labels(label_id);

-- ── 2) Cada schema de gym de pago (gym_1, gym_2, gym_7, ...) ──
-- Recorre todos los schemas "gym_<id>" que ya existen y les crea
-- los mismos índices que ya quedaron en la plantilla para los nuevos.
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name ~ '^gym_[0-9]+$'
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS members_status_index ON %I.members(status)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS classes_trainer_id_index ON %I.classes(trainer_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS classes_member_id_index ON %I.classes(member_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS class_schedules_class_id_index ON %I.class_schedules(class_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS memberships_member_id_index ON %I.memberships(member_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS memberships_status_index ON %I.memberships(status)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS memberships_end_date_index ON %I.memberships(end_date)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS visits_member_id_index ON %I.visits(member_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS visits_visit_date_index ON %I.visits(visit_date)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS visits_class_id_index ON %I.visits(class_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS visits_trainer_id_index ON %I.visits(trainer_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS payments_member_id_index ON %I.payments(member_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS payments_membership_id_index ON %I.payments(membership_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS member_labels_label_id_index ON %I.member_labels(label_id)', s);

    RAISE NOTICE 'Índices creados en schema: %', s;
  END LOOP;
END $$;
