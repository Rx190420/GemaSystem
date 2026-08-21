-- ============================================================
--  GemaSystem — Plantilla de schema DEDICADO por gym de pago (Postgres/Supabase)
--
--  Equivalente a gemasystem_tenant.sql (la plantilla de MySQL), pero para
--  Postgres: en vez de una BASE DE DATOS separada por gym (imposible de
--  referenciar entre sí con FKs en MySQL), aquí cada gym de pago tiene su
--  propio SCHEMA dentro del mismo proyecto de Supabase — mismo aislamiento
--  real (tablas físicamente separadas, se pueden respaldar/borrar por
--  separado), sin el costo de un proyecto Supabase por gym.
--
--  Diferencias vs el esquema compartido (gemasystem_supabase.sql):
--    ✓ SIN gym_id en ninguna tabla (el schema entero es del gym)
--    ✓ SIN tablas users/gyms/personal_access_tokens/pending_checkouts
--      (viven en el schema `public`, compartido)
--    ✓ user_id/sold_by SÍ tienen FK a public.users(id) — a diferencia de
--      MySQL, Postgres permite FKs entre schemas del mismo proyecto
--
--  No incluye CREATE SCHEMA — eso lo hace CreateGymDatabase::provisionPgsqlSchema()
--  antes de correr este archivo con el search_path ya apuntando al schema
--  del gym.
--
--  Uso manual (normalmente se hace vía `php artisan gym:create-database {id}`):
--    CREATE SCHEMA IF NOT EXISTS "gym_7";
--    SET search_path TO "gym_7";
--    -- pega y corre este archivo completo
-- ============================================================

-- ── trainers ──────────────────────────────────────────────────
CREATE TABLE trainers (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
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
CREATE INDEX trainers_user_id_index ON trainers(user_id);

-- ── members ───────────────────────────────────────────────────
CREATE TABLE members (
  id                        BIGSERIAL PRIMARY KEY,
  member_code               VARCHAR(20),
  user_id                   BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
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
  UNIQUE (email)
);

-- ── classes ───────────────────────────────────────────────────
CREATE TABLE classes (
  id              BIGSERIAL PRIMARY KEY,
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

-- ── class_schedules ───────────────────────────────────────────
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

-- ── visits ────────────────────────────────────────────────────
CREATE TABLE visits (
  id              BIGSERIAL PRIMARY KEY,
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

-- ── payments ──────────────────────────────────────────────────
CREATE TABLE payments (
  id              BIGSERIAL PRIMARY KEY,
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

-- ── labels ────────────────────────────────────────────────────
CREATE TABLE labels (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE (name)
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
CREATE TABLE membership_types (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE (name)
);

-- ── discount_categories ───────────────────────────────────────
CREATE TABLE discount_categories (
  id                 BIGSERIAL PRIMARY KEY,
  name               VARCHAR(100) NOT NULL,
  discount_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMP,
  updated_at         TIMESTAMP,
  UNIQUE (name)
);

-- ── ingresos ──────────────────────────────────────────────────
CREATE TABLE ingresos (
  id               BIGSERIAL PRIMARY KEY,
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
CREATE INDEX ingresos_date_index ON ingresos(date);
CREATE INDEX ingresos_origin_index ON ingresos(origin);

-- ── products ──────────────────────────────────────────────────
CREATE TABLE products (
  id                    BIGSERIAL PRIMARY KEY,
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
  UNIQUE (sku)
);
CREATE INDEX products_status_index ON products(status);

-- ── product_sales ─────────────────────────────────────────────
CREATE TABLE product_sales (
  id              BIGSERIAL PRIMARY KEY,
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
  sold_by         BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
CREATE INDEX product_sales_date_index ON product_sales(date);
CREATE INDEX product_sales_product_id_index ON product_sales(product_id);
CREATE INDEX product_sales_member_id_index ON product_sales(member_id);

-- ── settings (configuración del gym, sin gym_id) ───────────────
CREATE TABLE settings (
  id          BIGSERIAL PRIMARY KEY,
  "key"       VARCHAR(100) NOT NULL,
  value       TEXT,
  type        VARCHAR(20) NOT NULL DEFAULT 'string',
  "group"     VARCHAR(50) NOT NULL DEFAULT 'general',
  label       VARCHAR(150),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE ("key")
);

-- ── whatsapp_logs ─────────────────────────────────────────────
CREATE TABLE whatsapp_logs (
  id                BIGSERIAL PRIMARY KEY,
  recipient_phone   VARCHAR(30) NOT NULL,
  recipient_name    VARCHAR(100),
  message_type      VARCHAR(60) NOT NULL,
  message_preview   TEXT,
  sent_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  FIN DEL TEMPLATE
-- ============================================================
