-- ============================================================
--  GemaSystem — Export único para Supabase (PostgreSQL)
--
--  Un solo archivo: esquema COMPLETO + datos de un gym de
--  muestra ("FitLife Gym"). Fusiona en un único set de tablas
--  lo que en MySQL son dos sistemas separados:
--    - gemasystem.sql        (DB compartida — gyms free)
--    - gemasystem_tenant.sql (DB dedicada por gym de pago)
--  En Postgres/Supabase no hay una DB por gym de pago, así que
--  ambos modelos se unifican aquí en un solo esquema con
--  gym_id en todas las tablas (el patrón que ya usa el
--  sistema compartido) — un gym de pago es simplemente otra
--  fila en `gyms` con sus propias filas scoped por gym_id, no
--  una base de datos aparte.
--
--  Deliberadamente NO incluye la infraestructura de
--  migraciones de Laravel (`migrations`, `failed_jobs`,
--  `password_resets` legacy) — no interesa para este export.
--
--  Los ENUM de MySQL se representan como VARCHAR + CHECK, más
--  simple de alterar después en el editor de Supabase que un
--  tipo ENUM nativo de Postgres.
--
--  Uso: pega y corre este archivo completo en el SQL Editor de
--  Supabase (o `psql "$SUPABASE_DB_URL" -f gemasystem_supabase.sql`).
--
--  Credenciales del gym de muestra (usuario de la app, no de
--  Supabase). El login pide contraseña y LUEGO un código de
--  acceso (segundo paso, "requires_code" en AuthController) —
--  ambos hacen falta para entrar:
--    Admin:      admin@fitlife.demo    / password123 / FIT-ADMIN
--    Trainer:    trainer@fitlife.demo  / password123 / FIT-TRNR
--    Reception:  reception@fitlife.demo / password123 / FIT-RECP
--
--  Si ya tienes una DB de producción corriendo (con datos reales), NO vuelvas
--  a correr este archivo completo — solo aplica a mano la columna nueva:
--    ALTER TABLE gyms ADD COLUMN plan_features JSONB;
--    ALTER TABLE pending_checkouts ADD COLUMN plan_features JSONB;
--
--  Gaps de esquema reales encontrados en la DB compartida de
--  PRODUCCIÓN (gemasystem) al armar este export — NO corregidos
--  ahí, solo aquí — ver detalle completo en el mensaje/chat:
--    - Faltan las tablas membership_types / discount_categories
--      en la DB compartida (sí existen en las DB de pago).
--    - `members` en la DB compartida no tiene discount_category,
--      photo_url ni notes, y membership_type sigue siendo un
--      ENUM de 3 valores en inglés en vez de texto libre.
--    - `member_labels` en la DB compartida no tiene updated_at,
--      pero Member::labels() usa withTimestamps() (requiere
--      ambas columnas) — un gym gratuito etiquetando un miembro
--      hoy probablemente recibe un 500 en producción.
--  DemoGymSeeder.php también tenía varios valores desincroniza-
--  dos del esquema real (enums en español, columnas viejas en
--  product_sales, género M/F, etc.) — ya corregidos en el
--  archivo del seeder, no solo en este export.
-- ============================================================


-- ── gyms ──────────────────────────────────────────────────────
CREATE TABLE gyms (
  id                      BIGSERIAL PRIMARY KEY,
  name                    VARCHAR(255) NOT NULL,
  code                    VARCHAR(3) UNIQUE,
  plan                    VARCHAR(255) NOT NULL,
  plan_type               VARCHAR(10) NOT NULL DEFAULT 'free'
                            CHECK (plan_type IN ('free','paid')),
  plan_features           JSONB, -- solo para plan='custom': {"whatsapp":bool,"products":bool,"classes":bool,"import":bool,"export":bool}. NULL para planes viejos (weekly/monthly/annual, acceso total) y para basic/full (derivado del plan).
  db_name                 VARCHAR(255),
  stripe_subscription_id  VARCHAR(255),
  stripe_customer_id      VARCHAR(255),
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','trialing','cancelled','suspended')),
  billing_status          VARCHAR(20) NOT NULL DEFAULT 'none'
                            CHECK (billing_status IN ('active','payment_failed','cancelled','none','payment_due','trial_expired')),
  subscription_starts_at  TIMESTAMP,
  subscription_ends_at    TIMESTAMP,
  last_payment_at         TIMESTAMP,
  created_at              TIMESTAMP,
  updated_at              TIMESTAMP
);

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE users (
  id                     BIGSERIAL PRIMARY KEY,
  gym_id                 BIGINT,
  username               VARCHAR(255) NOT NULL UNIQUE,
  first_name             VARCHAR(255),
  paternal_surname       VARCHAR(255),
  maternal_surname       VARCHAR(255),
  email                  VARCHAR(255) NOT NULL UNIQUE,
  password               VARCHAR(255) NOT NULL,
  access_code            VARCHAR(255),
  access_code_plain      VARCHAR(255),
  access_code_changes    INTEGER NOT NULL DEFAULT 0,
  onboarding_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  role                   VARCHAR(10) NOT NULL DEFAULT 'user'
                            CHECK (role IN ('admin','user')),
  last_login             TIMESTAMP,
  remember_token         VARCHAR(100),
  extended_access        SMALLINT NOT NULL DEFAULT 0,       -- feature flag — no exponer en API
  account_status         VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (account_status IN ('active','suspended','restricted')),
  restriction_reason     TEXT,
  created_at             TIMESTAMP,
  updated_at             TIMESTAMP
);
CREATE INDEX users_gym_id_index ON users(gym_id);

-- ── trainers ──────────────────────────────────────────────────
CREATE TABLE trainers (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  first_name      VARCHAR(255) NOT NULL,
  last_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(20),
  specialty       VARCHAR(255),
  certifications  VARCHAR(255),
  bio             TEXT,
  hire_date       DATE,
  status          VARCHAR(10) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX trainers_gym_id_index ON trainers(gym_id);
CREATE INDEX trainers_user_id_index ON trainers(user_id);

-- ── members ───────────────────────────────────────────────────
-- NOTE: membership_type es texto libre (no ENUM) y trae
-- discount_category/photo_url/notes — así es el esquema real de
-- las DB dedicadas por gym de pago; la DB compartida vive
-- desactualizada respecto a esto en producción (gap encontrado
-- al preparar este export, no corregido ahí, solo aquí).
CREATE TABLE members (
  id                        BIGSERIAL PRIMARY KEY,
  gym_id                    BIGINT,
  member_code               VARCHAR(20),
  user_id                   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  first_name                VARCHAR(255) NOT NULL,
  last_name                 VARCHAR(255) NOT NULL,
  email                     VARCHAR(255),
  phone                     VARCHAR(20),
  birth_date                DATE,
  gender                    VARCHAR(10)
                              CHECK (gender IN ('male','female','other')),
  address                   TEXT,
  emergency_contact_name    VARCHAR(255),
  emergency_contact_phone   VARCHAR(20),
  membership_type           VARCHAR(50) NOT NULL DEFAULT 'Básica',
  discount_category         VARCHAR(100),
  membership_start          DATE,
  membership_end            DATE,
  status                    VARCHAR(10) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','inactive','suspended')),
  qr_token                  VARCHAR(64) UNIQUE,
  photo_url                 VARCHAR(255),
  notes                     TEXT,
  created_at                TIMESTAMP,
  updated_at                TIMESTAMP,
  UNIQUE (gym_id, email)
);
CREATE INDEX members_gym_id_index ON members(gym_id);

-- ── classes ───────────────────────────────────────────────────
CREATE TABLE classes (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT,
  name            VARCHAR(255) NOT NULL,
  color           VARCHAR(7),
  description     TEXT,
  trainer_id      BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
  capacity        INTEGER NOT NULL DEFAULT 20,
  duration        INTEGER NOT NULL DEFAULT 60,
  start_date      DATE,
  difficulty      VARCHAR(15) NOT NULL DEFAULT 'beginner'
                    CHECK (difficulty IN ('beginner','intermediate','advanced')),
  type            VARCHAR(10) NOT NULL DEFAULT 'group'
                    CHECK (type IN ('group','private')),
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  total_sessions  INTEGER,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX classes_gym_id_index ON classes(gym_id);

-- ── class_schedules ───────────────────────────────────────────
-- Sin gym_id — se filtra indirecto vía class_id -> classes.gym_id.
CREATE TABLE class_schedules (
  id            BIGSERIAL PRIMARY KEY,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week   VARCHAR(10) NOT NULL
                  CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  room          VARCHAR(255),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── class_sessions ────────────────────────────────────────────
-- Sesiones numeradas de un paquete (p.ej. entrenamiento personal
-- 1 a 1), NO ocurrencias de una clase recurrente — no confundir
-- con class_schedules. Sin datos de muestra en este export.
CREATE TABLE class_sessions (
  id               BIGSERIAL PRIMARY KEY,
  class_id         BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_number   INTEGER NOT NULL,
  scheduled_date   DATE,
  status           VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','completed','missed')),
  completed_at     TIMESTAMP,
  notes            TEXT,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP,
  UNIQUE (class_id, session_number)
);

-- ── memberships ───────────────────────────────────────────────
CREATE TABLE memberships (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type            VARCHAR(10) NOT NULL DEFAULT 'monthly'
                    CHECK (type IN ('monthly','quarterly','biannual','annual','weekly','biweekly')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(10,2),
  payment_method  VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','card','transfer')),
  status          VARCHAR(10) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','cancelled')),
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX memberships_gym_id_index ON memberships(gym_id);

-- ── visits ────────────────────────────────────────────────────
CREATE TABLE visits (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  visit_date      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visit_type      VARCHAR(15) NOT NULL DEFAULT 'training'
                    CHECK (visit_type IN ('training','class','consultation','other')),
  class_id        BIGINT REFERENCES classes(id) ON DELETE SET NULL,
  trainer_id      BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
  notes           TEXT,
  price           NUMERIC(10,2),
  amount_paid     NUMERIC(10,2),
  payment_method  VARCHAR(10)
                    CHECK (payment_method IN ('cash','card','transfer')),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX visits_gym_id_index ON visits(gym_id);

-- ── payments ──────────────────────────────────────────────────
-- Sin datos de muestra (el seeder de demo no genera esta tabla).
CREATE TABLE payments (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_id   BIGINT REFERENCES memberships(id) ON DELETE SET NULL,
  amount          NUMERIC(10,2) NOT NULL,
  amount_paid     NUMERIC(10,2),
  payment_date    DATE NOT NULL,
  payment_method  VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','card','transfer')),
  reference       VARCHAR(255),
  notes           TEXT,
  status          VARCHAR(10) NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending','completed','failed','refunded')),
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX payments_gym_id_index ON payments(gym_id);

-- ── labels ────────────────────────────────────────────────────
CREATE TABLE labels (
  id          BIGSERIAL PRIMARY KEY,
  gym_id      BIGINT,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE (gym_id, name)
);

-- ── member_labels ─────────────────────────────────────────────
CREATE TABLE member_labels (
  member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  label_id    BIGINT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  PRIMARY KEY (member_id, label_id)
);

-- ── membership_types ──────────────────────────────────────────
-- NOTA: en producción esta tabla solo existe en las DB dedicadas
-- de gyms de pago (sin gym_id). Se agregó gym_id aquí porque este
-- export es una sola DB compartida estilo Supabase — gap real
-- encontrado en la DB compartida de producción, no corregido ahí.
CREATE TABLE membership_types (
  id          BIGSERIAL PRIMARY KEY,
  gym_id      BIGINT,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE (gym_id, name)
);

-- ── discount_categories ───────────────────────────────────────
-- Mismo gap que membership_types — ver nota arriba.
CREATE TABLE discount_categories (
  id                 BIGSERIAL PRIMARY KEY,
  gym_id             BIGINT,
  name               VARCHAR(100) NOT NULL,
  discount_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMP,
  updated_at         TIMESTAMP,
  UNIQUE (gym_id, name)
);

-- ── ingresos ──────────────────────────────────────────────────
CREATE TABLE ingresos (
  id               BIGSERIAL PRIMARY KEY,
  gym_id           BIGINT,
  member_id        BIGINT REFERENCES members(id) ON DELETE SET NULL,
  concept          VARCHAR(255) NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  payment_method   VARCHAR(10) NOT NULL DEFAULT 'cash'
                     CHECK (payment_method IN ('cash','card','transfer')),
  origin           VARCHAR(15) NOT NULL DEFAULT 'manual'
                     CHECK (origin IN ('membership','visit','manual','product')),
  reference_id     BIGINT,
  reference_type   VARCHAR(50),
  date             DATE NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
);
CREATE INDEX ingresos_gym_id_index ON ingresos(gym_id);
CREATE INDEX ingresos_date_index ON ingresos(date);
CREATE INDEX ingresos_origin_index ON ingresos(origin);

-- ── products ──────────────────────────────────────────────────
CREATE TABLE products (
  id                    BIGSERIAL PRIMARY KEY,
  gym_id                BIGINT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name                  VARCHAR(150) NOT NULL,
  description           TEXT,
  sku                   VARCHAR(60),
  category              VARCHAR(100),
  price                 NUMERIC(10,2) NOT NULL,
  cost                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock                 INTEGER,
  unlimited_stock       BOOLEAN NOT NULL DEFAULT FALSE,
  low_stock_threshold   INTEGER NOT NULL DEFAULT 5,
  image_path            VARCHAR(255),
  status                VARCHAR(10) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive')),
  created_at            TIMESTAMP,
  updated_at            TIMESTAMP,
  UNIQUE (gym_id, sku)
);
CREATE INDEX products_gym_id_status_index ON products(gym_id, status);

-- ── product_sales ─────────────────────────────────────────────
CREATE TABLE product_sales (
  id              BIGSERIAL PRIMARY KEY,
  gym_id          BIGINT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES products(id),
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  quantity        INTEGER NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  unit_cost       NUMERIC(10,2) NOT NULL,
  total_amount    NUMERIC(10,2) NOT NULL,
  amount_paid     NUMERIC(10,2),
  total_cost      NUMERIC(10,2) NOT NULL,
  profit          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','card','transfer')),
  sold_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX product_sales_gym_id_index ON product_sales(gym_id);
CREATE INDEX product_sales_date_index ON product_sales(date);
CREATE INDEX product_sales_product_id_index ON product_sales(product_id);
CREATE INDEX product_sales_member_id_index ON product_sales(member_id);

-- ── settings ──────────────────────────────────────────────────
-- "key" y "group" van entre comillas: son palabras reservadas/
-- casi-reservadas en Postgres.
CREATE TABLE settings (
  id          BIGSERIAL PRIMARY KEY,
  gym_id      BIGINT,
  "key"       VARCHAR(100) NOT NULL,
  value       TEXT,
  type        VARCHAR(20) NOT NULL DEFAULT 'string',
  "group"     VARCHAR(50) NOT NULL DEFAULT 'general',
  label       VARCHAR(150),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE (gym_id, "key")
);
CREATE INDEX settings_gym_id_index ON settings(gym_id);

-- ── gym_notifications ─────────────────────────────────────────
-- Sin datos de muestra en este export.
CREATE TABLE gym_notifications (
  id          BIGSERIAL PRIMARY KEY,
  gym_id      BIGINT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  type        VARCHAR(60) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read_at     TIMESTAMP,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
);
CREATE INDEX gym_notifications_gym_id_read_at_index ON gym_notifications(gym_id, read_at);
CREATE INDEX gym_notifications_gym_id_created_at_index ON gym_notifications(gym_id, created_at);

-- ── whatsapp_logs ─────────────────────────────────────────────
-- Sin datos de muestra en este export.
CREATE TABLE whatsapp_logs (
  id                BIGSERIAL PRIMARY KEY,
  gym_id            BIGINT,
  recipient_phone   VARCHAR(30) NOT NULL,
  recipient_name    VARCHAR(100),
  message_type      VARCHAR(60) NOT NULL,
  message_preview   TEXT,
  sent_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX whatsapp_logs_gym_id_index ON whatsapp_logs(gym_id);

-- ── support_tickets / ticket_messages ────────────────────────
-- Sin datos de muestra en este export.
CREATE TABLE support_tickets (
  id                     BIGSERIAL PRIMARY KEY,
  user_id                BIGINT,
  gym_id                 BIGINT,
  ticket_number          VARCHAR(20) NOT NULL UNIQUE,
  name                   VARCHAR(120) NOT NULL,
  email                  VARCHAR(150) NOT NULL,
  category               VARCHAR(60),
  subject                VARCHAR(200) NOT NULL,
  status                 VARCHAR(10) NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','accepted','resolved','closed')),
  assigned_operator_id   BIGINT,
  created_at             TIMESTAMP,
  updated_at             TIMESTAMP
);
CREATE INDEX support_tickets_user_id_index ON support_tickets(user_id);
CREATE INDEX support_tickets_gym_id_index ON support_tickets(gym_id);
CREATE INDEX support_tickets_status_index ON support_tickets(status);

CREATE TABLE ticket_messages (
  id           BIGSERIAL PRIMARY KEY,
  ticket_id    BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  VARCHAR(10) NOT NULL
                 CHECK (sender_type IN ('user','operator')),
  sender_id    BIGINT,
  sender_name  VARCHAR(120) NOT NULL,
  message      TEXT NOT NULL,
  created_at   TIMESTAMP,
  updated_at   TIMESTAMP
);

-- ── trial_requests ────────────────────────────────────────────
-- Sin datos de muestra en este export (formulario de landing page).
CREATE TABLE trial_requests (
  id              BIGSERIAL PRIMARY KEY,
  gym_name        VARCHAR(100) NOT NULL,
  contact_name    VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  phone           VARCHAR(20),
  status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','cancelled')),
  operator_notes  TEXT,
  reviewed_by     BIGINT,
  reviewed_at     TIMESTAMP,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX trial_requests_status_index ON trial_requests(status);
CREATE INDEX trial_requests_email_index ON trial_requests(email);

-- ── form_submissions ──────────────────────────────────────────
-- Sin datos de muestra en este export (formularios de landing page).
CREATE TABLE form_submissions (
  id               BIGSERIAL PRIMARY KEY,
  type             VARCHAR(10) NOT NULL
                     CHECK (type IN ('review','ticket','contact')),
  name             VARCHAR(120),
  email            VARCHAR(150),
  company          VARCHAR(120),
  subject          VARCHAR(200),
  message          TEXT,
  rating           VARCHAR(10),
  role             VARCHAR(80),
  category         VARCHAR(60),
  budget           VARCHAR(40),
  contact_method   VARCHAR(30),
  status           VARCHAR(10) NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','read','archived')),
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
);
CREATE INDEX form_submissions_type_index ON form_submissions(type);
CREATE INDEX form_submissions_status_index ON form_submissions(status);

-- ── pending_checkouts ─────────────────────────────────────────
-- Sin datos de muestra en este export (flujo de alta vía Stripe).
CREATE TABLE pending_checkouts (
  id                  BIGSERIAL PRIMARY KEY,
  stripe_session_id   VARCHAR(255) UNIQUE,
  gym_name            VARCHAR(255) NOT NULL,
  first_name          VARCHAR(255),
  paternal_surname    VARCHAR(255),
  maternal_surname    VARCHAR(255),
  username            VARCHAR(255) NOT NULL,
  email               VARCHAR(255) NOT NULL,
  password            VARCHAR(255) NOT NULL,
  plan_id             VARCHAR(255) NOT NULL,
  plan_features       JSONB, -- selección de extras si plan_id='custom' — mismo formato que gyms.plan_features
  status              VARCHAR(255) NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMP,
  updated_at          TIMESTAMP
);
CREATE INDEX pending_checkouts_email_index ON pending_checkouts(email);

-- ── password_reset_codes ──────────────────────────────────────
-- Sin datos de muestra en este export (efímera).
CREATE TABLE password_reset_codes (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code        VARCHAR(6) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
);
CREATE INDEX password_reset_codes_email_index ON password_reset_codes(email);

-- ── personal_access_tokens (Sanctum) ──────────────────────────
-- Sin datos de muestra — los tokens son por sesión, no se exportan.
CREATE TABLE personal_access_tokens (
  id               BIGSERIAL PRIMARY KEY,
  tokenable_type   VARCHAR(255) NOT NULL,
  tokenable_id     BIGINT NOT NULL,
  name             VARCHAR(255) NOT NULL,
  token            VARCHAR(64) NOT NULL UNIQUE,
  abilities        TEXT,
  last_used_at     TIMESTAMP,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
);
CREATE INDEX personal_access_tokens_tokenable_index ON personal_access_tokens(tokenable_type, tokenable_id);



BEGIN;

-- gyms (1 filas)
INSERT INTO gyms (id, name, code, plan, plan_type, db_name, stripe_subscription_id, stripe_customer_id, status, billing_status, subscription_starts_at, subscription_ends_at, last_payment_at, created_at, updated_at) VALUES (17, 'FitLife Gym', 'FIT', 'premium', 'free', NULL, NULL, NULL, 'active', 'active', '2026-08-20 04:31:58', '2026-11-20 04:31:58', NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- users (3 filas)
INSERT INTO users (id, gym_id, username, first_name, paternal_surname, maternal_surname, email, password, access_code, access_code_plain, access_code_changes, onboarding_completed, role, last_login, remember_token, extended_access, account_status, restriction_reason, created_at, updated_at) VALUES (20, 17, 'admin', 'Carlos', 'Rodríguez', 'García', 'admin@fitlife.demo', '$2y$10$Dx63EqWCXAX44VQ4fT19hORy0CqJkovn5IP1dXXQsNpYYbrwElZLS', '$2y$10$prjPzIY5JOgTQJdx4h7JmuwuefCX8dmpQ7kIeq219NhIcJPC9vkXW', 'FIT-ADMIN', 0, TRUE, 'admin', NULL, NULL, 0, 'active', NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO users (id, gym_id, username, first_name, paternal_surname, maternal_surname, email, password, access_code, access_code_plain, access_code_changes, onboarding_completed, role, last_login, remember_token, extended_access, account_status, restriction_reason, created_at, updated_at) VALUES (21, 17, 'trainer1', 'Miguel', 'Torres', 'López', 'trainer@fitlife.demo', '$2y$10$szgXxeUjdS/9orhSYFmO0.OXxl/XiQroznZDhuHA8YSFO46d5nD.6', '$2y$10$scPYTkutySQAG35Ml/nzZuguR4IquUncvokPNFgK6yvZfzWyTgz3G', 'FIT-TRNR', 0, TRUE, 'user', NULL, NULL, 0, 'active', NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO users (id, gym_id, username, first_name, paternal_surname, maternal_surname, email, password, access_code, access_code_plain, access_code_changes, onboarding_completed, role, last_login, remember_token, extended_access, account_status, restriction_reason, created_at, updated_at) VALUES (22, 17, 'reception', 'Ana', 'Martínez', 'Sánchez', 'reception@fitlife.demo', '$2y$10$1/u1UHjD8z.M3djq.POlpuiZ0IAUTRvmWhW6jAzKQYwVDRhkSUtx2', '$2y$10$9BmkThec7puabjyokTeCvej2jLigK.RL0aknQZKjp.moiclOaqx3.', 'FIT-RECP', 0, TRUE, 'user', NULL, NULL, 0, 'active', NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- trainers (3 filas)
INSERT INTO trainers (id, gym_id, user_id, first_name, last_name, email, phone, specialty, certifications, bio, hire_date, status, created_at, updated_at) VALUES (1, 17, 21, 'Miguel', 'Torres', 'miguel.torres@fitlife.demo', '+34 600 111 222', 'CrossFit / Fuerza', 'NSCA-CPT, CrossFit Level 2', 'Especialista en entrenamiento funcional y fuerza. 8 años de experiencia.', '2025-02-20', 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO trainers (id, gym_id, user_id, first_name, last_name, email, phone, specialty, certifications, bio, hire_date, status, created_at, updated_at) VALUES (2, 17, NULL, 'Laura', 'González', 'laura.gonzalez@fitlife.demo', '+34 600 333 444', 'Yoga / Pilates', 'RYT-500, Pilates Mat Certificado', 'Instructora de yoga y pilates con enfoque en movilidad y bienestar.', '2025-08-20', 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO trainers (id, gym_id, user_id, first_name, last_name, email, phone, specialty, certifications, bio, hire_date, status, created_at, updated_at) VALUES (3, 17, NULL, 'Roberto', 'Fernández', 'roberto.fernandez@fitlife.demo', '+34 600 555 666', 'Spinning / Cardio', 'Spinning Master Instructor, Les Mills', 'Entrenador de clases grupales de alta intensidad. Energía garantizada.', '2026-02-20', 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- members (15 filas)
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (1, 17, 'FIT-0001', NULL, 'María', 'García', 'maria.garcia@email.com', '+34 611 111 111', '1990-03-15', 'female', 'Calle Demo 1, Madrid', 'Contacto María', '+34 600 999 001', 'Premium', NULL, '2026-06-20', '2027-03-20', 'active', '6c34dfe4f2837b8858fbba080faeda99', NULL, NULL, '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (2, 17, 'FIT-0002', NULL, 'Juan', 'López', 'juan.lopez@email.com', '+34 622 222 222', '1985-07-22', 'male', 'Calle Demo 2, Madrid', 'Contacto Juan', '+34 600 999 002', 'Básica', 'Estudiante', '2026-06-20', '2027-06-20', 'active', '9d63b11fdc6e01bbedaf90a09c257c76', NULL, NULL, '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (3, 17, 'FIT-0003', NULL, 'Carmen', 'Martínez', 'carmen.martinez@email.com', '+34 633 333 333', '1992-11-08', 'female', 'Calle Demo 3, Madrid', 'Contacto Carmen', '+34 600 999 003', 'Premium', NULL, '2026-05-20', '2027-04-20', 'active', 'f3a8f729f4232987e1bbf6ca4d47744a', NULL, NULL, '2026-05-20 04:31:58', '2026-05-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (4, 17, 'FIT-0004', NULL, 'David', 'Rodríguez', 'david.rodriguez@email.com', '+34 644 444 444', '1988-01-30', 'male', 'Calle Demo 4, Madrid', 'Contacto David', '+34 600 999 004', 'Familiar', 'Familiar (2+)', '2026-07-20', '2027-08-20', 'active', 'c87c54e835d17c6bc6938425e462ce84', NULL, NULL, '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (5, 17, 'FIT-0005', NULL, 'Laura', 'Fernández', 'laura.fernandez@email.com', '+34 655 555 555', '1995-05-17', 'female', 'Calle Demo 5, Madrid', 'Contacto Laura', '+34 600 999 005', 'Estudiante', 'Estudiante', '2026-04-20', '2027-05-20', 'active', 'ea7400be34586edd514b3afeb70c4a7f', NULL, NULL, '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (6, 17, 'FIT-0006', NULL, 'Carlos', 'González', 'carlos.gonzalez@email.com', '+34 666 666 666', '1982-09-12', 'male', 'Calle Demo 6, Madrid', 'Contacto Carlos', '+34 600 999 006', 'Corporativa', 'Corporativo', '2026-03-20', '2026-11-20', 'active', '989ba207212d2d08ff66bf8d243e0345', NULL, NULL, '2026-03-20 04:31:58', '2026-03-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (7, 17, 'FIT-0007', NULL, 'Ana', 'Sánchez', 'ana.sanchez@email.com', '+34 677 777 777', '1991-12-03', 'female', 'Calle Demo 7, Madrid', 'Contacto Ana', '+34 600 999 007', 'Premium', NULL, '2026-02-20', '2027-01-20', 'active', 'a26a01ad54b01231eb83883ae28fbc6a', NULL, NULL, '2026-02-20 04:31:58', '2026-02-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (8, 17, 'FIT-0008', NULL, 'Pablo', 'Ramírez', 'pablo.ramirez@email.com', '+34 688 888 888', '1987-04-25', 'male', 'Calle Demo 8, Madrid', 'Contacto Pablo', '+34 600 999 008', 'Básica', NULL, '2026-05-20', '2027-08-20', 'active', 'b6d0d0f040609747473c5ff9890b5408', NULL, NULL, '2026-05-20 04:31:58', '2026-05-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (9, 17, 'FIT-0009', NULL, 'Isabel', 'Torres', 'isabel.torres@email.com', '+34 699 999 999', '1960-02-14', 'female', 'Calle Demo 9, Madrid', 'Contacto Isabel', '+34 600 999 009', 'Básica', 'Senior (+60)', '2026-04-20', '2027-04-20', 'active', '07f2864abd0764e67228f14b6a5afeb7', NULL, NULL, '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (10, 17, 'FIT-0010', NULL, 'Javier', 'Flores', 'javier.flores@email.com', '+34 600 000 111', '1993-08-19', 'male', 'Calle Demo 10, Madrid', 'Contacto Javier', '+34 600 999 010', 'Premium', 'Promoción Invierno', '2026-07-20', '2026-09-20', 'active', '25d7495d1fed25bbb65c23eff895ffca', NULL, NULL, '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (11, 17, 'FIT-0011', NULL, 'Elena', 'Morales', 'elena.morales@email.com', '+34 600 000 222', '1989-06-07', 'female', 'Calle Demo 11, Madrid', 'Contacto Elena', '+34 600 999 011', 'Familiar', 'Familiar (2+)', '2026-02-20', '2027-06-20', 'active', '7edf57fe665a84a446ec9bc567425288', NULL, NULL, '2026-02-20 04:31:58', '2026-02-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (12, 17, 'FIT-0012', NULL, 'Sergio', 'Herrera', 'sergio.herrera@email.com', '+34 600 000 333', '1994-10-11', 'male', 'Calle Demo 12, Madrid', 'Contacto Sergio', '+34 600 999 012', 'Estudiante', 'Estudiante', '2026-07-20', '2027-02-20', 'active', '4f564b75dffb162720a7fd43f890c333', NULL, NULL, '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (13, 17, 'FIT-0013', NULL, 'Patricia', 'Jiménez', 'patricia.jimenez@email.com', '+34 600 000 444', '1986-01-28', 'female', 'Calle Demo 13, Madrid', 'Contacto Patricia', '+34 600 999 013', 'Premium', NULL, '2026-06-20', '2026-10-20', 'active', 'd881772368eca7d7f071bfac0baa697b', NULL, NULL, '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (14, 17, 'FIT-0014', NULL, 'Andrés', 'Ruiz', 'andres.ruiz@email.com', '+34 600 000 555', '1996-03-05', 'male', 'Calle Demo 14, Madrid', 'Contacto Andrés', '+34 600 999 014', 'Básica', NULL, '2026-04-20', '2027-04-20', 'active', '5b82133ca89db340e8afb1fbc14dbbec', NULL, NULL, '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO members (id, gym_id, member_code, user_id, first_name, last_name, email, phone, birth_date, gender, address, emergency_contact_name, emergency_contact_phone, membership_type, discount_category, membership_start, membership_end, status, qr_token, photo_url, notes, created_at, updated_at) VALUES (15, 17, 'FIT-0015', NULL, 'Rosa', 'Díaz', 'rosa.diaz@email.com', '+34 600 000 666', '1958-07-16', 'female', 'Calle Demo 15, Madrid', 'Contacto Rosa', '+34 600 999 015', 'Básica', 'Senior (+60)', '2026-03-20', '2027-06-20', 'active', 'f43fa43faaa0bce2c124b6b094c1d0ca', NULL, NULL, '2026-03-20 04:31:58', '2026-03-20 04:31:58');

-- classes (5 filas)
INSERT INTO classes (id, gym_id, name, color, description, trainer_id, capacity, duration, start_date, difficulty, type, member_id, total_sessions, created_at, updated_at) VALUES (1, 17, 'CrossFit WOD', NULL, 'Entrenamiento funcional de alta intensidad variado constantemente.', 1, 20, 60, '2026-08-17', 'advanced', 'group', NULL, NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO classes (id, gym_id, name, color, description, trainer_id, capacity, duration, start_date, difficulty, type, member_id, total_sessions, created_at, updated_at) VALUES (2, 17, 'Yoga Vinyasa Flow', NULL, 'Flujo dinámico de posturas sincronizado con la respiración.', 2, 25, 75, '2026-08-17', 'intermediate', 'group', NULL, NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO classes (id, gym_id, name, color, description, trainer_id, capacity, duration, start_date, difficulty, type, member_id, total_sessions, created_at, updated_at) VALUES (3, 17, 'Spinning Power', NULL, 'Clase de ciclismo indoor con intervalos de alta intensidad.', 3, 30, 45, '2026-08-17', 'advanced', 'group', NULL, NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO classes (id, gym_id, name, color, description, trainer_id, capacity, duration, start_date, difficulty, type, member_id, total_sessions, created_at, updated_at) VALUES (4, 17, 'Pilates Reformer', NULL, 'Trabajo de core, flexibilidad y alineación en reformer.', 2, 10, 60, '2026-08-17', 'intermediate', 'group', NULL, NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO classes (id, gym_id, name, color, description, trainer_id, capacity, duration, start_date, difficulty, type, member_id, total_sessions, created_at, updated_at) VALUES (5, 17, 'Entrenamiento Personal', NULL, 'Sesión 1 a 1 adaptada a tus objetivos.', 1, 1, 60, '2026-08-17', 'intermediate', 'private', NULL, NULL, '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- class_schedules (18 filas)
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (1, 1, 'Monday', '07:00:00', '08:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (2, 1, 'Wednesday', '07:00:00', '08:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (3, 1, 'Friday', '07:00:00', '08:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (4, 1, 'Monday', '19:00:00', '20:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (5, 1, 'Wednesday', '19:00:00', '20:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (6, 1, 'Friday', '19:00:00', '20:00:00', 'Sala CrossFit', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (7, 2, 'Tuesday', '08:00:00', '09:15:00', 'Sala Zen', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (8, 2, 'Thursday', '08:00:00', '09:15:00', 'Sala Zen', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (9, 2, 'Saturday', '10:00:00', '11:15:00', 'Sala Zen', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (10, 3, 'Monday', '18:00:00', '18:45:00', 'Sala Spinning', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (11, 3, 'Wednesday', '18:00:00', '18:45:00', 'Sala Spinning', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (12, 3, 'Friday', '18:00:00', '18:45:00', 'Sala Spinning', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (13, 3, 'Tuesday', '07:00:00', '07:45:00', 'Sala Spinning', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (14, 3, 'Thursday', '07:00:00', '07:45:00', 'Sala Spinning', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (15, 4, 'Monday', '10:00:00', '11:00:00', 'Sala Pilates', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (16, 4, 'Thursday', '10:00:00', '11:00:00', 'Sala Pilates', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (17, 5, 'Sunday', '09:00:00', '10:00:00', 'Sala PT', '2026-08-19 22:31:58');
INSERT INTO class_schedules (id, class_id, day_of_week, start_time, end_time, room, created_at) VALUES (18, 5, 'Sunday', '11:00:00', '12:00:00', 'Sala PT', '2026-08-19 22:31:58');

-- memberships (15 filas)
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (1, 17, 1, 'monthly', '2026-06-20', '2027-03-20', 149.00, 149.00, 'card', 'active', '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (2, 17, 2, 'monthly', '2026-06-20', '2027-06-20', 89.00, 89.00, 'card', 'active', '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (3, 17, 3, 'monthly', '2026-05-20', '2027-04-20', 149.00, 149.00, 'card', 'active', '2026-05-20 04:31:58', '2026-05-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (4, 17, 4, 'monthly', '2026-07-20', '2027-08-20', 250.00, 250.00, 'card', 'active', '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (5, 17, 5, 'monthly', '2026-04-20', '2027-05-20', 69.00, 69.00, 'card', 'active', '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (6, 17, 6, 'monthly', '2026-03-20', '2026-11-20', 199.00, 199.00, 'card', 'active', '2026-03-20 04:31:58', '2026-03-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (7, 17, 7, 'monthly', '2026-02-20', '2027-01-20', 149.00, 149.00, 'card', 'active', '2026-02-20 04:31:58', '2026-02-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (8, 17, 8, 'monthly', '2026-05-20', '2027-08-20', 89.00, 89.00, 'card', 'active', '2026-05-20 04:31:58', '2026-05-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (9, 17, 9, 'monthly', '2026-04-20', '2027-04-20', 89.00, 89.00, 'card', 'active', '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (10, 17, 10, 'monthly', '2026-07-20', '2026-09-20', 149.00, 149.00, 'card', 'active', '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (11, 17, 11, 'monthly', '2026-02-20', '2027-06-20', 250.00, 250.00, 'card', 'active', '2026-02-20 04:31:58', '2026-02-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (12, 17, 12, 'monthly', '2026-07-20', '2027-02-20', 69.00, 69.00, 'card', 'active', '2026-07-20 04:31:58', '2026-07-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (13, 17, 13, 'monthly', '2026-06-20', '2026-10-20', 149.00, 149.00, 'card', 'active', '2026-06-20 04:31:58', '2026-06-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (14, 17, 14, 'monthly', '2026-04-20', '2027-04-20', 89.00, 89.00, 'card', 'active', '2026-04-20 04:31:58', '2026-04-20 04:31:58');
INSERT INTO memberships (id, gym_id, member_id, type, start_date, end_date, amount, amount_paid, payment_method, status, created_at, updated_at) VALUES (15, 17, 15, 'monthly', '2026-03-20', '2027-06-20', 89.00, 89.00, 'card', 'active', '2026-03-20 04:31:58', '2026-03-20 04:31:58');

-- visits (180 filas)
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (1, 17, 1, '2026-08-13 15:40:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (2, 17, 1, '2026-08-06 09:43:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (3, 17, 1, '2026-08-15 14:04:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (4, 17, 1, '2026-08-18 09:07:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (5, 17, 1, '2026-07-27 21:48:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (6, 17, 1, '2026-08-16 19:09:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (7, 17, 1, '2026-08-12 06:42:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (8, 17, 2, '2026-07-24 16:47:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (9, 17, 2, '2026-08-15 09:08:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (10, 17, 2, '2026-08-12 20:14:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (11, 17, 2, '2026-07-24 13:53:00', 'class', 4, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (12, 17, 2, '2026-07-26 16:14:00', 'class', 1, 1, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (13, 17, 2, '2026-08-15 18:06:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (14, 17, 2, '2026-07-21 19:41:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (15, 17, 2, '2026-08-11 19:00:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (16, 17, 2, '2026-07-23 15:52:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (17, 17, 2, '2026-08-02 12:08:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (18, 17, 2, '2026-08-10 09:22:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (19, 17, 2, '2026-07-26 20:18:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (20, 17, 2, '2026-08-07 09:32:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (21, 17, 2, '2026-07-25 16:52:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (22, 17, 2, '2026-07-31 19:56:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (23, 17, 2, '2026-07-30 09:38:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (24, 17, 2, '2026-08-07 19:37:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (25, 17, 2, '2026-07-25 08:26:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (26, 17, 3, '2026-07-31 19:04:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (27, 17, 3, '2026-07-31 08:19:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (28, 17, 3, '2026-07-21 09:11:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (29, 17, 3, '2026-08-09 21:06:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (30, 17, 3, '2026-08-20 20:00:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (31, 17, 3, '2026-08-13 16:42:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (32, 17, 3, '2026-07-27 17:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (33, 17, 3, '2026-08-18 11:23:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (34, 17, 3, '2026-07-30 17:09:00', 'class', 3, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (35, 17, 3, '2026-07-30 07:00:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (36, 17, 4, '2026-08-02 11:10:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (37, 17, 4, '2026-07-28 09:25:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (38, 17, 4, '2026-07-30 21:36:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (39, 17, 4, '2026-08-16 13:33:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (40, 17, 4, '2026-08-13 08:48:00', 'class', 1, 1, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (41, 17, 4, '2026-08-10 10:45:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (42, 17, 4, '2026-08-08 12:25:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (43, 17, 4, '2026-07-24 13:35:00', 'class', 1, 1, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (44, 17, 4, '2026-08-18 08:50:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (45, 17, 4, '2026-08-07 11:59:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (46, 17, 4, '2026-08-10 15:37:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (47, 17, 4, '2026-08-17 18:20:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (48, 17, 4, '2026-07-25 07:40:00', 'class', 4, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (49, 17, 5, '2026-08-03 12:55:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (50, 17, 5, '2026-08-08 11:07:00', 'class', 4, 3, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (51, 17, 5, '2026-08-06 12:12:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (52, 17, 5, '2026-08-14 19:33:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (53, 17, 5, '2026-07-25 18:28:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (54, 17, 5, '2026-07-30 14:22:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (55, 17, 5, '2026-07-24 10:40:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (56, 17, 5, '2026-08-04 11:59:00', 'class', 2, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (57, 17, 5, '2026-07-23 16:40:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (58, 17, 5, '2026-08-16 18:47:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (59, 17, 5, '2026-08-14 12:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (60, 17, 5, '2026-08-03 20:10:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (61, 17, 5, '2026-08-15 11:12:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (62, 17, 5, '2026-08-09 13:03:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (63, 17, 5, '2026-08-19 10:30:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (64, 17, 5, '2026-08-15 18:40:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (65, 17, 5, '2026-08-02 18:56:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (66, 17, 5, '2026-07-22 18:03:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (67, 17, 6, '2026-08-12 20:12:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (68, 17, 6, '2026-07-27 06:48:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (69, 17, 6, '2026-08-12 21:11:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (70, 17, 6, '2026-07-28 21:43:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (71, 17, 6, '2026-08-12 08:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (72, 17, 6, '2026-07-28 17:57:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (73, 17, 6, '2026-08-08 18:05:00', 'class', 4, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (74, 17, 6, '2026-07-26 08:15:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (75, 17, 6, '2026-08-16 12:37:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (76, 17, 7, '2026-08-16 18:06:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (77, 17, 7, '2026-08-03 10:23:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (78, 17, 7, '2026-08-08 11:25:00', 'class', 3, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (79, 17, 7, '2026-08-07 17:27:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (80, 17, 7, '2026-07-23 21:36:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (81, 17, 7, '2026-08-19 09:34:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (82, 17, 7, '2026-07-26 09:22:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (83, 17, 7, '2026-07-30 11:26:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (84, 17, 7, '2026-08-19 18:55:00', 'class', 2, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (85, 17, 7, '2026-08-15 12:38:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (86, 17, 7, '2026-08-18 16:14:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (87, 17, 7, '2026-08-11 06:08:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (88, 17, 7, '2026-07-23 17:50:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (89, 17, 7, '2026-07-23 19:53:00', 'class', 4, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (90, 17, 7, '2026-08-03 07:26:00', 'class', 2, 1, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (91, 17, 7, '2026-08-16 10:42:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (92, 17, 7, '2026-08-08 12:12:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (93, 17, 8, '2026-07-25 17:04:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (94, 17, 8, '2026-08-05 14:23:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (95, 17, 8, '2026-08-13 21:58:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (96, 17, 8, '2026-08-18 17:35:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (97, 17, 8, '2026-08-12 20:49:00', 'class', 2, 1, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (98, 17, 8, '2026-08-03 11:10:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (99, 17, 8, '2026-07-27 19:45:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (100, 17, 8, '2026-07-22 07:24:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (101, 17, 8, '2026-08-16 12:24:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (102, 17, 8, '2026-08-03 16:17:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (103, 17, 8, '2026-07-23 14:27:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (104, 17, 8, '2026-08-11 17:06:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (105, 17, 8, '2026-08-19 14:45:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (106, 17, 9, '2026-07-25 11:01:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (107, 17, 9, '2026-07-27 11:38:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (108, 17, 9, '2026-08-18 10:34:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (109, 17, 9, '2026-08-17 17:03:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (110, 17, 9, '2026-08-10 08:03:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (111, 17, 9, '2026-07-31 15:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (112, 17, 9, '2026-08-12 19:12:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (113, 17, 9, '2026-08-14 06:56:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (114, 17, 9, '2026-08-13 18:36:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (115, 17, 9, '2026-08-17 14:31:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (116, 17, 9, '2026-07-22 17:27:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (117, 17, 9, '2026-08-06 13:28:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (118, 17, 9, '2026-07-24 08:20:00', 'class', 2, 1, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (119, 17, 10, '2026-07-24 19:23:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (120, 17, 10, '2026-08-08 07:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (121, 17, 10, '2026-08-15 07:16:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (122, 17, 10, '2026-08-07 13:04:00', 'class', 3, 3, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (123, 17, 10, '2026-08-18 14:42:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (124, 17, 10, '2026-08-07 08:54:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (125, 17, 10, '2026-07-24 14:21:00', 'class', 5, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (126, 17, 10, '2026-08-09 15:41:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (127, 17, 10, '2026-07-22 11:53:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (128, 17, 11, '2026-07-26 14:47:00', 'class', 3, 1, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (129, 17, 11, '2026-08-14 20:27:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (130, 17, 11, '2026-08-15 15:06:00', 'class', 2, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (131, 17, 11, '2026-08-10 11:33:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (132, 17, 11, '2026-08-04 18:52:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (133, 17, 11, '2026-08-02 08:54:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (134, 17, 11, '2026-08-18 10:38:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (135, 17, 12, '2026-08-05 08:00:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (136, 17, 12, '2026-07-27 17:02:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (137, 17, 12, '2026-07-26 12:20:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (138, 17, 12, '2026-07-24 19:31:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (139, 17, 12, '2026-08-08 14:05:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (140, 17, 12, '2026-08-07 09:10:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (141, 17, 12, '2026-08-20 21:35:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (142, 17, 12, '2026-07-21 06:51:00', 'class', 3, 2, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (143, 17, 12, '2026-08-18 12:39:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (144, 17, 12, '2026-08-11 13:55:00', 'class', 1, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (145, 17, 13, '2026-07-21 21:41:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (146, 17, 13, '2026-07-22 15:13:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (147, 17, 13, '2026-08-11 13:28:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (148, 17, 13, '2026-07-29 11:45:00', 'class', 3, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (149, 17, 13, '2026-08-07 21:59:00', 'class', 1, 3, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (150, 17, 13, '2026-07-22 07:03:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (151, 17, 13, '2026-08-01 17:54:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (152, 17, 13, '2026-08-05 11:11:00', 'class', 4, 2, 'Clase grupal', 15.00, 15.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (153, 17, 13, '2026-08-08 18:31:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (154, 17, 13, '2026-08-01 18:00:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (155, 17, 13, '2026-08-19 07:15:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (156, 17, 13, '2026-08-04 18:17:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (157, 17, 13, '2026-08-04 08:14:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (158, 17, 13, '2026-08-17 07:04:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (159, 17, 13, '2026-07-24 21:19:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (160, 17, 13, '2026-08-09 12:21:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (161, 17, 13, '2026-07-21 06:16:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (162, 17, 13, '2026-08-05 16:42:00', 'class', 1, 2, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (163, 17, 13, '2026-08-05 12:30:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (164, 17, 13, '2026-08-19 15:58:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (165, 17, 14, '2026-08-09 15:50:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (166, 17, 14, '2026-08-08 14:32:00', 'class', 5, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (167, 17, 14, '2026-07-23 21:19:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (168, 17, 14, '2026-07-22 13:01:00', 'class', 1, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (169, 17, 14, '2026-08-20 21:48:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (170, 17, 14, '2026-08-05 18:10:00', 'class', 1, 3, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (171, 17, 14, '2026-08-20 14:36:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (172, 17, 14, '2026-07-24 15:30:00', 'class', 2, 2, 'Clase grupal', 15.00, 15.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (173, 17, 15, '2026-08-08 08:14:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (174, 17, 15, '2026-08-09 13:49:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (175, 17, 15, '2026-08-11 14:41:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'transfer', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (176, 17, 15, '2026-08-20 09:21:00', 'class', 2, 3, 'Clase grupal', 15.00, 15.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (177, 17, 15, '2026-08-01 07:06:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (178, 17, 15, '2026-07-23 06:12:00', 'training', NULL, NULL, 'Entrenamiento libre', 50.00, 50.00, 'cash', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (179, 17, 15, '2026-08-05 18:42:00', 'training', NULL, NULL, 'Entrenamiento libre', 150.00, 150.00, 'card', '2026-08-19 22:31:59');
INSERT INTO visits (id, gym_id, member_id, visit_date, visit_type, class_id, trainer_id, notes, price, amount_paid, payment_method, created_at) VALUES (180, 17, 15, '2026-08-17 12:13:00', 'training', NULL, NULL, 'Entrenamiento libre', 10.00, 10.00, 'card', '2026-08-19 22:31:59');

-- labels (5 filas)
INSERT INTO labels (id, gym_id, name, color, created_at, updated_at) VALUES (1, 17, 'VIP', '#F59E0B', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO labels (id, gym_id, name, color, created_at, updated_at) VALUES (2, 17, 'Competidor', '#EF4444', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO labels (id, gym_id, name, color, created_at, updated_at) VALUES (3, 17, 'Rehabilitación', '#3B82F6', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO labels (id, gym_id, name, color, created_at, updated_at) VALUES (4, 17, 'Embarazada', '#EC4899', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO labels (id, gym_id, name, color, created_at, updated_at) VALUES (5, 17, 'Nuevo', '#10B981', '2026-08-20 04:32:00', '2026-08-20 04:32:00');

-- member_labels (8 filas)
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (3, 2, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (3, 4, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (8, 2, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (8, 3, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (9, 1, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (10, 1, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (10, 3, '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO member_labels (member_id, label_id, created_at, updated_at) VALUES (15, 5, '2026-08-20 04:32:00', '2026-08-20 04:32:00');

-- membership_types (5 filas)
INSERT INTO membership_types (id, gym_id, name, color, created_at, updated_at) VALUES (1, 17, 'Básica', '#3B82F6', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO membership_types (id, gym_id, name, color, created_at, updated_at) VALUES (2, 17, 'Premium', '#8B5CF6', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO membership_types (id, gym_id, name, color, created_at, updated_at) VALUES (3, 17, 'Estudiante', '#10B981', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO membership_types (id, gym_id, name, color, created_at, updated_at) VALUES (4, 17, 'Familiar', '#F59E0B', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO membership_types (id, gym_id, name, color, created_at, updated_at) VALUES (5, 17, 'Corporativa', '#EF4444', '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- discount_categories (5 filas)
INSERT INTO discount_categories (id, gym_id, name, discount_percent, created_at, updated_at) VALUES (1, 17, 'Estudiante', 20.00, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO discount_categories (id, gym_id, name, discount_percent, created_at, updated_at) VALUES (2, 17, 'Senior (+60)', 15.00, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO discount_categories (id, gym_id, name, discount_percent, created_at, updated_at) VALUES (3, 17, 'Familiar (2+)', 10.00, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO discount_categories (id, gym_id, name, discount_percent, created_at, updated_at) VALUES (4, 17, 'Corporativo', 15.00, '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO discount_categories (id, gym_id, name, discount_percent, created_at, updated_at) VALUES (5, 17, 'Promoción Invierno', 25.00, '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- ingresos (89 filas)
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (1, 17, 1, 'Membresía mensual', 163.00, 'card', 'membership', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (2, 17, 1, 'Clase grupal', 45.00, 'cash', 'visit', NULL, NULL, '2026-08-02', 'Generado automáticamente para demo', '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (3, 17, 1, 'Venta producto', 25.00, 'transfer', 'product', NULL, NULL, '2026-08-18', 'Generado automáticamente para demo', '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (4, 17, 1, 'Visita diaria', 121.00, 'transfer', 'visit', NULL, NULL, '2026-08-04', 'Generado automáticamente para demo', '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (5, 17, 1, 'Entrenamiento personal', 50.00, 'transfer', 'visit', NULL, NULL, '2026-08-14', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (6, 17, 1, 'Membresía mensual', 139.00, 'cash', 'membership', NULL, NULL, '2026-08-01', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (7, 17, 1, 'Clase grupal', 21.00, 'cash', 'visit', NULL, NULL, '2026-07-31', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (8, 17, 2, 'Clase grupal', 142.00, 'cash', 'visit', NULL, NULL, '2026-08-16', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (9, 17, 2, 'Venta producto', 13.00, 'card', 'product', NULL, NULL, '2026-08-11', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (10, 17, 2, 'Clase grupal', 143.00, 'card', 'visit', NULL, NULL, '2026-07-31', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (11, 17, 2, 'Membresía mensual', 184.00, 'card', 'membership', NULL, NULL, '2026-08-12', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (12, 17, 2, 'Venta producto', 47.00, 'cash', 'product', NULL, NULL, '2026-08-02', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (13, 17, 2, 'Clase grupal', 100.00, 'cash', 'visit', NULL, NULL, '2026-07-24', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (14, 17, 2, 'Clase grupal', 110.00, 'card', 'visit', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (15, 17, 3, 'Clase grupal', 73.00, 'transfer', 'visit', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (16, 17, 3, 'Clase grupal', 37.00, 'transfer', 'visit', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (17, 17, 3, 'Clase grupal', 37.00, 'cash', 'visit', NULL, NULL, '2026-08-10', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (18, 17, 3, 'Entrenamiento personal', 84.00, 'cash', 'visit', NULL, NULL, '2026-08-17', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (19, 17, 3, 'Membresía mensual', 234.00, 'card', 'membership', NULL, NULL, '2026-08-17', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (20, 17, 3, 'Membresía mensual', 121.00, 'card', 'membership', NULL, NULL, '2026-08-10', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (21, 17, 3, 'Venta producto', 39.00, 'transfer', 'product', NULL, NULL, '2026-08-08', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (22, 17, 4, 'Membresía mensual', 204.00, 'transfer', 'membership', NULL, NULL, '2026-07-28', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (23, 17, 4, 'Membresía mensual', 160.00, 'cash', 'membership', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (24, 17, 4, 'Entrenamiento personal', 25.00, 'cash', 'visit', NULL, NULL, '2026-07-26', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (25, 17, 4, 'Entrenamiento personal', 112.00, 'card', 'visit', NULL, NULL, '2026-08-06', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (26, 17, 5, 'Membresía mensual', 129.00, 'transfer', 'membership', NULL, NULL, '2026-08-01', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (27, 17, 5, 'Visita diaria', 58.00, 'transfer', 'visit', NULL, NULL, '2026-08-12', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (28, 17, 5, 'Visita diaria', 134.00, 'cash', 'visit', NULL, NULL, '2026-07-30', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (29, 17, 5, 'Venta producto', 22.00, 'cash', 'product', NULL, NULL, '2026-07-30', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (30, 17, 5, 'Entrenamiento personal', 37.00, 'transfer', 'visit', NULL, NULL, '2026-08-07', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (31, 17, 5, 'Clase grupal', 89.00, 'cash', 'visit', NULL, NULL, '2026-08-18', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (32, 17, 5, 'Entrenamiento personal', 66.00, 'transfer', 'visit', NULL, NULL, '2026-08-08', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (33, 17, 6, 'Entrenamiento personal', 140.00, 'card', 'visit', NULL, NULL, '2026-08-11', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (34, 17, 6, 'Venta producto', 20.00, 'transfer', 'product', NULL, NULL, '2026-08-01', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (35, 17, 6, 'Venta producto', 34.00, 'cash', 'product', NULL, NULL, '2026-08-07', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (36, 17, 7, 'Entrenamiento personal', 138.00, 'transfer', 'visit', NULL, NULL, '2026-08-06', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (37, 17, 7, 'Clase grupal', 66.00, 'card', 'visit', NULL, NULL, '2026-08-16', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (38, 17, 7, 'Visita diaria', 89.00, 'transfer', 'visit', NULL, NULL, '2026-07-31', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (39, 17, 7, 'Membresía mensual', 75.00, 'transfer', 'membership', NULL, NULL, '2026-07-23', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (40, 17, 7, 'Clase grupal', 116.00, 'transfer', 'visit', NULL, NULL, '2026-08-15', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (41, 17, 7, 'Visita diaria', 83.00, 'transfer', 'visit', NULL, NULL, '2026-08-14', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (42, 17, 7, 'Clase grupal', 51.00, 'card', 'visit', NULL, NULL, '2026-08-13', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (43, 17, 8, 'Membresía mensual', 212.00, 'transfer', 'membership', NULL, NULL, '2026-08-02', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (44, 17, 8, 'Venta producto', 39.00, 'card', 'product', NULL, NULL, '2026-07-24', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (45, 17, 8, 'Entrenamiento personal', 25.00, 'card', 'visit', NULL, NULL, '2026-08-20', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (46, 17, 8, 'Visita diaria', 90.00, 'transfer', 'visit', NULL, NULL, '2026-07-26', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (47, 17, 9, 'Clase grupal', 85.00, 'transfer', 'visit', NULL, NULL, '2026-07-28', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (48, 17, 9, 'Venta producto', 40.00, 'transfer', 'product', NULL, NULL, '2026-08-15', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (49, 17, 9, 'Clase grupal', 88.00, 'cash', 'visit', NULL, NULL, '2026-07-26', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (50, 17, 9, 'Venta producto', 42.00, 'cash', 'product', NULL, NULL, '2026-08-11', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (51, 17, 9, 'Entrenamiento personal', 104.00, 'transfer', 'visit', NULL, NULL, '2026-07-21', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (52, 17, 9, 'Venta producto', 8.00, 'card', 'product', NULL, NULL, '2026-07-22', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (53, 17, 10, 'Visita diaria', 107.00, 'cash', 'visit', NULL, NULL, '2026-08-07', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (54, 17, 10, 'Clase grupal', 33.00, 'card', 'visit', NULL, NULL, '2026-08-05', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (55, 17, 10, 'Clase grupal', 44.00, 'card', 'visit', NULL, NULL, '2026-07-24', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (56, 17, 10, 'Venta producto', 22.00, 'transfer', 'product', NULL, NULL, '2026-07-28', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (57, 17, 10, 'Entrenamiento personal', 52.00, 'transfer', 'visit', NULL, NULL, '2026-07-28', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (58, 17, 10, 'Clase grupal', 67.00, 'card', 'visit', NULL, NULL, '2026-08-11', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (59, 17, 10, 'Entrenamiento personal', 19.00, 'card', 'visit', NULL, NULL, '2026-08-03', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (60, 17, 11, 'Entrenamiento personal', 12.00, 'transfer', 'visit', NULL, NULL, '2026-07-24', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (61, 17, 11, 'Clase grupal', 22.00, 'card', 'visit', NULL, NULL, '2026-08-01', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (62, 17, 11, 'Clase grupal', 138.00, 'transfer', 'visit', NULL, NULL, '2026-08-10', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (63, 17, 11, 'Visita diaria', 132.00, 'cash', 'visit', NULL, NULL, '2026-07-27', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (64, 17, 12, 'Clase grupal', 60.00, 'card', 'visit', NULL, NULL, '2026-08-20', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (65, 17, 12, 'Membresía mensual', 226.00, 'card', 'membership', NULL, NULL, '2026-08-19', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (66, 17, 12, 'Clase grupal', 35.00, 'card', 'visit', NULL, NULL, '2026-08-19', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (67, 17, 12, 'Membresía mensual', 162.00, 'card', 'membership', NULL, NULL, '2026-08-16', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (68, 17, 12, 'Clase grupal', 75.00, 'card', 'visit', NULL, NULL, '2026-08-17', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (69, 17, 13, 'Visita diaria', 36.00, 'card', 'visit', NULL, NULL, '2026-07-23', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (70, 17, 13, 'Membresía mensual', 218.00, 'card', 'membership', NULL, NULL, '2026-07-30', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (71, 17, 13, 'Visita diaria', 92.00, 'card', 'visit', NULL, NULL, '2026-07-21', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (72, 17, 13, 'Membresía mensual', 121.00, 'card', 'membership', NULL, NULL, '2026-08-05', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (73, 17, 13, 'Membresía mensual', 168.00, 'cash', 'membership', NULL, NULL, '2026-07-24', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (74, 17, 13, 'Clase grupal', 10.00, 'card', 'visit', NULL, NULL, '2026-08-04', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (75, 17, 14, 'Visita diaria', 133.00, 'transfer', 'visit', NULL, NULL, '2026-08-15', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (76, 17, 14, 'Visita diaria', 126.00, 'cash', 'visit', NULL, NULL, '2026-08-20', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (77, 17, 14, 'Venta producto', 15.00, 'cash', 'product', NULL, NULL, '2026-08-08', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (78, 17, 14, 'Membresía mensual', 194.00, 'transfer', 'membership', NULL, NULL, '2026-08-20', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (79, 17, 14, 'Visita diaria', 148.00, 'card', 'visit', NULL, NULL, '2026-08-19', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (80, 17, 14, 'Venta producto', 31.00, 'cash', 'product', NULL, NULL, '2026-08-01', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (81, 17, 14, 'Membresía mensual', 152.00, 'card', 'membership', NULL, NULL, '2026-07-29', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (82, 17, 14, 'Visita diaria', 91.00, 'transfer', 'visit', NULL, NULL, '2026-07-22', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (83, 17, 15, 'Venta producto', 40.00, 'cash', 'product', NULL, NULL, '2026-08-19', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (84, 17, 15, 'Entrenamiento personal', 144.00, 'card', 'visit', NULL, NULL, '2026-07-30', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (85, 17, 15, 'Clase grupal', 123.00, 'cash', 'visit', NULL, NULL, '2026-08-02', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (86, 17, 15, 'Clase grupal', 23.00, 'card', 'visit', NULL, NULL, '2026-08-11', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (87, 17, 15, 'Entrenamiento personal', 32.00, 'transfer', 'visit', NULL, NULL, '2026-08-15', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (88, 17, 15, 'Venta producto', 20.00, 'transfer', 'product', NULL, NULL, '2026-08-12', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');
INSERT INTO ingresos (id, gym_id, member_id, concept, amount, payment_method, origin, reference_id, reference_type, date, notes, created_at, updated_at) VALUES (89, 17, 15, 'Clase grupal', 94.00, 'cash', 'visit', NULL, NULL, '2026-08-12', 'Generado automáticamente para demo', '2026-08-20 04:32:00', '2026-08-20 04:32:00');

-- products (10 filas)
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (1, 17, 'Proteína Whey 2kg', 'Proteína de suero sabor chocolate', 'PROT-0001', 'Suplementos', 49.90, 30.00, 25, FALSE, 10, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (2, 17, 'Creatina Monohidrato 300g', 'Creatina pura sin sabor', 'CREA-0001', 'Suplementos', 19.90, 12.00, 55, FALSE, 15, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (3, 17, 'Pre-Entreno 300g', 'Energía y foco para entrenamientos', 'PREE-0001', 'Suplementos', 29.90, 18.00, 31, FALSE, 8, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (4, 17, 'Toalla Microfibra', 'Toalla deportiva absorbente', 'TOAL-0001', 'Accesorios', 12.90, 7.00, 92, FALSE, 20, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (5, 17, 'Botella Agua 750ml', 'Botella deportiva libre BPA', 'BOTE-0001', 'Accesorios', 8.90, 4.50, 115, FALSE, 25, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (6, 17, 'Guantes Gimnasio', 'Guantes de agarre transpirables', 'GUAN-0001', 'Accesorios', 15.90, 9.00, 37, FALSE, 12, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (7, 17, 'Cinturón Lumbar', 'Soporte lumbar para levantamiento', 'CINT-0001', 'Accesorios', 24.90, 14.00, 17, FALSE, 6, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (8, 17, 'Bandas Resistencia Set', '5 bandas de diferentes resistencias', 'BAND-0001', 'Accesorios', 22.90, 13.00, 18, FALSE, 10, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (9, 17, 'Barrita Proteica (x12)', 'Pack 12 barritas sabor variado', 'BARR-0001', 'Nutrición', 18.90, 11.00, 56, FALSE, 15, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');
INSERT INTO products (id, gym_id, name, description, sku, category, price, cost, stock, unlimited_stock, low_stock_threshold, image_path, status, created_at, updated_at) VALUES (10, 17, 'Electrolitos Polvo 500g', 'Recuperación hidratación', 'ELEC-0001', 'Suplementos', 16.90, 10.00, 22, FALSE, 12, NULL, 'active', '2026-08-20 04:31:58', '2026-08-20 04:31:59');

-- product_sales (89 filas)
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (1, 17, 1, 15, 3, 49.90, 30.00, 149.70, 149.70, 90.00, 59.70, 'card', NULL, '2026-07-28', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (2, 17, 1, 5, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'transfer', NULL, '2026-08-11', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (3, 17, 1, 12, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'transfer', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (4, 17, 1, 12, 1, 49.90, 30.00, 49.90, 49.90, 30.00, 19.90, 'cash', NULL, '2026-07-23', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (5, 17, 1, 3, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'card', NULL, '2026-08-04', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (6, 17, 1, 4, 1, 49.90, 30.00, 49.90, 49.90, 30.00, 19.90, 'transfer', NULL, '2026-08-12', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (7, 17, 1, 1, 3, 49.90, 30.00, 149.70, 149.70, 90.00, 59.70, 'card', NULL, '2026-08-03', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (8, 17, 1, 2, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'card', NULL, '2026-08-15', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (9, 17, 1, 7, 1, 49.90, 30.00, 49.90, 49.90, 30.00, 19.90, 'cash', NULL, '2026-08-17', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (10, 17, 1, 15, 3, 49.90, 30.00, 149.70, 149.70, 90.00, 59.70, 'card', NULL, '2026-07-29', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (11, 17, 1, 12, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'transfer', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (12, 17, 1, 11, 1, 49.90, 30.00, 49.90, 49.90, 30.00, 19.90, 'cash', NULL, '2026-07-27', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (13, 17, 1, 15, 2, 49.90, 30.00, 99.80, 99.80, 60.00, 39.80, 'card', NULL, '2026-07-26', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (14, 17, 2, 6, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'cash', NULL, '2026-08-18', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (15, 17, 2, 13, 3, 19.90, 12.00, 59.70, 59.70, 36.00, 23.70, 'transfer', NULL, '2026-07-23', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (16, 17, 2, 6, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'transfer', NULL, '2026-07-30', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (17, 17, 2, 12, 3, 19.90, 12.00, 59.70, 59.70, 36.00, 23.70, 'transfer', NULL, '2026-07-23', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (18, 17, 2, 3, 3, 19.90, 12.00, 59.70, 59.70, 36.00, 23.70, 'cash', NULL, '2026-07-27', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (19, 17, 2, 2, 1, 19.90, 12.00, 19.90, 19.90, 12.00, 7.90, 'cash', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (20, 17, 2, 7, 1, 19.90, 12.00, 19.90, 19.90, 12.00, 7.90, 'transfer', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (21, 17, 2, 11, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'transfer', NULL, '2026-07-28', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (22, 17, 2, 7, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'card', NULL, '2026-08-18', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (23, 17, 2, 14, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'transfer', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (24, 17, 2, 1, 1, 19.90, 12.00, 19.90, 19.90, 12.00, 7.90, 'card', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (25, 17, 2, 12, 1, 19.90, 12.00, 19.90, 19.90, 12.00, 7.90, 'transfer', NULL, '2026-08-02', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (26, 17, 2, 10, 2, 19.90, 12.00, 39.80, 39.80, 24.00, 15.80, 'transfer', NULL, '2026-08-13', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (27, 17, 3, 10, 2, 29.90, 18.00, 59.80, 59.80, 36.00, 23.80, 'card', NULL, '2026-08-16', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (28, 17, 3, 13, 1, 29.90, 18.00, 29.90, 29.90, 18.00, 11.90, 'transfer', NULL, '2026-07-21', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (29, 17, 3, 1, 3, 29.90, 18.00, 89.70, 89.70, 54.00, 35.70, 'transfer', NULL, '2026-08-13', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (30, 17, 3, 13, 3, 29.90, 18.00, 89.70, 89.70, 54.00, 35.70, 'card', NULL, '2026-08-03', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (31, 17, 4, 3, 2, 12.90, 7.00, 25.80, 25.80, 14.00, 11.80, 'transfer', NULL, '2026-08-19', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (32, 17, 4, 13, 3, 12.90, 7.00, 38.70, 38.70, 21.00, 17.70, 'transfer', NULL, '2026-08-04', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (33, 17, 4, 6, 3, 12.90, 7.00, 38.70, 38.70, 21.00, 17.70, 'card', NULL, '2026-08-03', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (34, 17, 5, 11, 1, 8.90, 4.50, 8.90, 8.90, 4.50, 4.40, 'card', NULL, '2026-08-14', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (35, 17, 5, 5, 3, 8.90, 4.50, 26.70, 26.70, 13.50, 13.20, 'transfer', NULL, '2026-08-12', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (36, 17, 5, 9, 1, 8.90, 4.50, 8.90, 8.90, 4.50, 4.40, 'cash', NULL, '2026-08-04', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (37, 17, 6, 11, 1, 15.90, 9.00, 15.90, 15.90, 9.00, 6.90, 'card', NULL, '2026-08-12', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (38, 17, 6, 8, 1, 15.90, 9.00, 15.90, 15.90, 9.00, 6.90, 'transfer', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (39, 17, 6, 15, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'card', NULL, '2026-08-17', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (40, 17, 6, 7, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'transfer', NULL, '2026-07-25', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (41, 17, 6, 10, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'cash', NULL, '2026-08-06', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (42, 17, 6, 7, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'cash', NULL, '2026-08-08', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (43, 17, 6, 3, 3, 15.90, 9.00, 47.70, 47.70, 27.00, 20.70, 'cash', NULL, '2026-08-04', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (44, 17, 6, 14, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'card', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (45, 17, 6, 2, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'card', NULL, '2026-08-20', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (46, 17, 6, 10, 1, 15.90, 9.00, 15.90, 15.90, 9.00, 6.90, 'transfer', NULL, '2026-07-25', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (47, 17, 6, 13, 2, 15.90, 9.00, 31.80, 31.80, 18.00, 13.80, 'card', NULL, '2026-08-20', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (48, 17, 6, 6, 3, 15.90, 9.00, 47.70, 47.70, 27.00, 20.70, 'card', NULL, '2026-07-26', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (49, 17, 7, 1, 1, 24.90, 14.00, 24.90, 24.90, 14.00, 10.90, 'cash', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (50, 17, 7, 7, 3, 24.90, 14.00, 74.70, 74.70, 42.00, 32.70, 'card', NULL, '2026-07-28', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (51, 17, 7, 4, 3, 24.90, 14.00, 74.70, 74.70, 42.00, 32.70, 'transfer', NULL, '2026-08-17', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (52, 17, 7, 4, 3, 24.90, 14.00, 74.70, 74.70, 42.00, 32.70, 'card', NULL, '2026-08-16', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (53, 17, 7, 4, 3, 24.90, 14.00, 74.70, 74.70, 42.00, 32.70, 'cash', NULL, '2026-08-03', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (54, 17, 8, 10, 2, 22.90, 13.00, 45.80, 45.80, 26.00, 19.80, 'transfer', NULL, '2026-08-06', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (55, 17, 8, 8, 3, 22.90, 13.00, 68.70, 68.70, 39.00, 29.70, 'transfer', NULL, '2026-08-05', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (56, 17, 8, 9, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'cash', NULL, '2026-08-11', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (57, 17, 8, 12, 3, 22.90, 13.00, 68.70, 68.70, 39.00, 29.70, 'card', NULL, '2026-07-25', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (58, 17, 8, 8, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'card', NULL, '2026-07-25', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (59, 17, 8, 11, 3, 22.90, 13.00, 68.70, 68.70, 39.00, 29.70, 'cash', NULL, '2026-07-24', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (60, 17, 8, 7, 3, 22.90, 13.00, 68.70, 68.70, 39.00, 29.70, 'cash', NULL, '2026-08-05', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (61, 17, 8, 5, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'card', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (62, 17, 8, 8, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'transfer', NULL, '2026-08-11', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (63, 17, 8, 10, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'transfer', NULL, '2026-07-29', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (64, 17, 8, 9, 2, 22.90, 13.00, 45.80, 45.80, 26.00, 19.80, 'transfer', NULL, '2026-08-09', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (65, 17, 8, 13, 3, 22.90, 13.00, 68.70, 68.70, 39.00, 29.70, 'card', NULL, '2026-07-21', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (66, 17, 8, 12, 2, 22.90, 13.00, 45.80, 45.80, 26.00, 19.80, 'card', NULL, '2026-08-14', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (67, 17, 8, 15, 1, 22.90, 13.00, 22.90, 22.90, 13.00, 9.90, 'card', NULL, '2026-08-03', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (68, 17, 9, 14, 2, 18.90, 11.00, 37.80, 37.80, 22.00, 15.80, 'transfer', NULL, '2026-08-19', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (69, 17, 9, 9, 1, 18.90, 11.00, 18.90, 18.90, 11.00, 7.90, 'cash', NULL, '2026-07-30', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (70, 17, 9, 9, 3, 18.90, 11.00, 56.70, 56.70, 33.00, 23.70, 'cash', NULL, '2026-08-05', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (71, 17, 9, 8, 2, 18.90, 11.00, 37.80, 37.80, 22.00, 15.80, 'cash', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (72, 17, 9, 12, 1, 18.90, 11.00, 18.90, 18.90, 11.00, 7.90, 'cash', NULL, '2026-07-29', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (73, 17, 9, 7, 2, 18.90, 11.00, 37.80, 37.80, 22.00, 15.80, 'transfer', NULL, '2026-07-26', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (74, 17, 9, 1, 3, 18.90, 11.00, 56.70, 56.70, 33.00, 23.70, 'card', NULL, '2026-07-23', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (75, 17, 10, 2, 1, 16.90, 10.00, 16.90, 16.90, 10.00, 6.90, 'card', NULL, '2026-07-24', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (76, 17, 10, 4, 1, 16.90, 10.00, 16.90, 16.90, 10.00, 6.90, 'card', NULL, '2026-08-14', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (77, 17, 10, 6, 2, 16.90, 10.00, 33.80, 33.80, 20.00, 13.80, 'card', NULL, '2026-08-14', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (78, 17, 10, 5, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'transfer', NULL, '2026-08-19', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (79, 17, 10, 3, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'cash', NULL, '2026-08-20', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (80, 17, 10, 9, 1, 16.90, 10.00, 16.90, 16.90, 10.00, 6.90, 'cash', NULL, '2026-07-22', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (81, 17, 10, 8, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'cash', NULL, '2026-07-26', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (82, 17, 10, 6, 2, 16.90, 10.00, 33.80, 33.80, 20.00, 13.80, 'cash', NULL, '2026-08-05', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (83, 17, 10, 15, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'cash', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (84, 17, 10, 9, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'transfer', NULL, '2026-07-21', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (85, 17, 10, 5, 2, 16.90, 10.00, 33.80, 33.80, 20.00, 13.80, 'transfer', NULL, '2026-08-07', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (86, 17, 10, 7, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'cash', NULL, '2026-07-31', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (87, 17, 10, 9, 1, 16.90, 10.00, 16.90, 16.90, 10.00, 6.90, 'transfer', NULL, '2026-08-16', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (88, 17, 10, 9, 3, 16.90, 10.00, 50.70, 50.70, 30.00, 20.70, 'cash', NULL, '2026-08-09', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');
INSERT INTO product_sales (id, gym_id, product_id, member_id, quantity, unit_price, unit_cost, total_amount, amount_paid, total_cost, profit, payment_method, sold_by, date, notes, created_at, updated_at) VALUES (89, 17, 10, 11, 2, 16.90, 10.00, 33.80, 33.80, 20.00, 13.80, 'card', NULL, '2026-07-29', NULL, '2026-08-20 04:31:59', '2026-08-20 04:31:59');

-- settings (16 filas)
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (23, 17, 'gym_name', 'FitLife Gym', 'string', 'general', 'Nombre del gimnasio', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (24, 17, 'gym_phone', '+34 912 345 678', 'string', 'general', 'Teléfono', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (25, 17, 'gym_email', 'info@fitlife.demo', 'string', 'general', 'Email', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (26, 17, 'gym_address', 'Calle Mayor 123, 28001 Madrid', 'string', 'general', 'Dirección', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (27, 17, 'theme_color', 'emerald', 'string', 'appearance', 'Color del tema', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (28, 17, 'dark_mode', 'false', 'boolean', 'appearance', 'Modo oscuro', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (29, 17, 'price_visit_daily', '10.00', 'decimal', 'pricing', 'Precio visita diaria', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (30, 17, 'price_visit_weekly', '50.00', 'decimal', 'pricing', 'Precio visita semanal', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (31, 17, 'price_visit_monthly', '150.00', 'decimal', 'pricing', 'Precio visita mensual', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (32, 17, 'price_membership_basic', '89.00', 'decimal', 'pricing', 'Membresía básica mensual', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (33, 17, 'price_membership_premium', '149.00', 'decimal', 'pricing', 'Membresía premium mensual', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (34, 17, 'price_membership_annual', '1200.00', 'decimal', 'pricing', 'Membresía anual', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (35, 17, 'currency', 'EUR', 'string', 'pricing', 'Moneda', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (36, 17, 'receipt_footer', 'Gracias por su visita - FitLife Gym', 'string', 'receipts', 'Pie de recibo', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (37, 17, 'whatsapp_enabled', 'false', 'boolean', 'notifications', 'WhatsApp habilitado', '2026-08-20 04:31:58', '2026-08-20 04:31:58');
INSERT INTO settings (id, gym_id, "key", value, type, "group", label, created_at, updated_at) VALUES (38, 17, 'auto_backup', 'true', 'boolean', 'system', 'Backup automático', '2026-08-20 04:31:58', '2026-08-20 04:31:58');

-- Reajustar las secuencias BIGSERIAL tras insertar ids explícitos
SELECT setval(pg_get_serial_sequence('gyms', 'id'), COALESCE((SELECT MAX(id) FROM gyms), 1), true);
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('trainers', 'id'), COALESCE((SELECT MAX(id) FROM trainers), 1), true);
SELECT setval(pg_get_serial_sequence('members', 'id'), COALESCE((SELECT MAX(id) FROM members), 1), true);
SELECT setval(pg_get_serial_sequence('classes', 'id'), COALESCE((SELECT MAX(id) FROM classes), 1), true);
SELECT setval(pg_get_serial_sequence('class_schedules', 'id'), COALESCE((SELECT MAX(id) FROM class_schedules), 1), true);
SELECT setval(pg_get_serial_sequence('memberships', 'id'), COALESCE((SELECT MAX(id) FROM memberships), 1), true);
SELECT setval(pg_get_serial_sequence('visits', 'id'), COALESCE((SELECT MAX(id) FROM visits), 1), true);
SELECT setval(pg_get_serial_sequence('labels', 'id'), COALESCE((SELECT MAX(id) FROM labels), 1), true);
SELECT setval(pg_get_serial_sequence('membership_types', 'id'), COALESCE((SELECT MAX(id) FROM membership_types), 1), true);
SELECT setval(pg_get_serial_sequence('discount_categories', 'id'), COALESCE((SELECT MAX(id) FROM discount_categories), 1), true);
SELECT setval(pg_get_serial_sequence('ingresos', 'id'), COALESCE((SELECT MAX(id) FROM ingresos), 1), true);
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1), true);
SELECT setval(pg_get_serial_sequence('product_sales', 'id'), COALESCE((SELECT MAX(id) FROM product_sales), 1), true);
SELECT setval(pg_get_serial_sequence('settings', 'id'), COALESCE((SELECT MAX(id) FROM settings), 1), true);

COMMIT;
