-- ============================================================
--  GemaSystem â€” Base de datos COMPARTIDA (free / cuentas gratuitas)
--  VersiÃ³n: 4.0  â€”  Arquitectura dual:
--
--    gemasystem          â†’ cuentas free (este archivo) + datos maestros
--                     de TODOS los gyms (gyms, users, tokens)
--    gemasystem_gym_{id} â†’ base dedicada por gym de pago (ver gemasystem_tenant.sql)
--
--  Uso: ejecuta este archivo en MySQL Workbench:
--    File > Open SQL Script > selecciona este archivo > Run All
-- ============================================================

CREATE DATABASE IF NOT EXISTS `gemasystem`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `gemasystem`;

-- --------------------------------------------------------
-- Tabla: gyms  (directorio maestro de TODOS los gymnasios)
-- --------------------------------------------------------
--   plan_type = 'free'  â†’ datos en esta misma DB (gemasystem) con gym_id
--   plan_type = 'paid'  â†’ datos en gemasystem_gym_{id}; db_name apunta ahÃ­
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gyms` (
  `id`                      BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`                    VARCHAR(255)         NOT NULL,
  `plan`                    VARCHAR(50)          NOT NULL COMMENT 'weekly | monthly | annual | basic | full | custom',
  `plan_type`               ENUM('free','paid')  NOT NULL DEFAULT 'free'
                            COMMENT 'free = DB compartida con gym_id | paid = DB dedicada',
  `plan_features`           JSON                 NULL DEFAULT NULL
                            COMMENT 'Solo para plan=custom: {"whatsapp":bool,"products":bool,"classes":bool,"import":bool,"export":bool}. NULL para planes viejos (weekly/monthly/annual, acceso total) y para basic/full (derivado del plan).',
  `db_name`                 VARCHAR(100)         NULL DEFAULT NULL
                            COMMENT 'gemasystem_gym_{id} â€” solo para cuentas de pago',
  `stripe_subscription_id`  VARCHAR(255)         NULL DEFAULT NULL,
  `stripe_customer_id`      VARCHAR(255)         NULL DEFAULT NULL,
  `status`                  ENUM('active','trialing','cancelled') NOT NULL DEFAULT 'active',
  `billing_status`          ENUM('active','payment_failed','cancelled','none') NOT NULL DEFAULT 'none',
  `subscription_starts_at`  TIMESTAMP            NULL DEFAULT NULL,
  `subscription_ends_at`    TIMESTAMP            NULL DEFAULT NULL,
  `last_payment_at`         TIMESTAMP            NULL DEFAULT NULL,
  `created_at`              TIMESTAMP            NULL DEFAULT NULL,
  `updated_at`              TIMESTAMP            NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `gyms_stripe_subscription_id_index` (`stripe_subscription_id`),
  KEY `gyms_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: users  (todos los usuarios, free y paid)
-- Los de pago apuntan a su gym en gemasystem_gym_{id} vÃ­a middleware
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `gym_id`               BIGINT UNSIGNED  NULL DEFAULT NULL COMMENT 'FK a gyms.id (siempre en esta DB)',
  `username`             VARCHAR(50)      NOT NULL,
  `email`                VARCHAR(150)     NOT NULL,
  `password`             VARCHAR(255)     NOT NULL,
  `role`                 ENUM('admin','user') NOT NULL DEFAULT 'user',
  `access_code`          VARCHAR(255)     NULL DEFAULT NULL COMMENT 'bcrypt del cÃ³digo de acceso',
  `access_code_plain`    VARCHAR(100)     NULL DEFAULT NULL COMMENT 'texto plano para mostrar en ConfiguraciÃ³n',
  `access_code_changes`  TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'mÃ¡x. 5 cambios',
  `onboarding_completed` TINYINT(1)       NOT NULL DEFAULT 0,
  `account_status`       ENUM('active','suspended','restricted') NOT NULL DEFAULT 'active',
  `extended_access`      TINYINT(1)       NOT NULL DEFAULT 0 COMMENT 'feature flag â€” no exponer en API',
  `last_login`           TIMESTAMP        NULL DEFAULT NULL,
  `remember_token`       VARCHAR(100)     NULL DEFAULT NULL,
  `created_at`           TIMESTAMP        NULL DEFAULT NULL,
  `updated_at`           TIMESTAMP        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_gym_id_index` (`gym_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  OPERADOR DEL SISTEMA (super-admin oculto)
--
--  ⚠️  Credenciales redactadas antes de subir este archivo a git — el hash y
--  la contraseña reales de este seed NO deben vivir en un repositorio.
--  Genera tu propio hash con `php artisan tinker`:
--    Hash::make('tu-contraseña-nueva-aquí')
--  y pega el resultado abajo antes de correr este script contra una DB nueva.
--
--  El campo extended_access=1 es el único indicador; el role='user'
--  hace que parezca una cuenta normal en cualquier listado.
-- ============================================================
INSERT IGNORE INTO `users`
  (`gym_id`,`username`,`email`,`password`,`role`,`account_status`,`extended_access`,`onboarding_completed`,`created_at`,`updated_at`)
VALUES
  (NULL,
   'gema_root7x',
   'root7x@gemasystem.internal',
   '$2y$12$REPLACE.WITH.YOUR.OWN.BCRYPT.HASH.GENERATED.LOCALLY',
   'user',
   'active',
   1,
   1,
   NOW(), NOW());

-- --------------------------------------------------------
-- Tabla: personal_access_tokens  (Sanctum â€” siempre en gemasystem)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(255)    NOT NULL,
  `tokenable_id`   BIGINT UNSIGNED NOT NULL,
  `name`           VARCHAR(255)    NOT NULL,
  `token`          VARCHAR(64)     NOT NULL,
  `abilities`      TEXT            NULL DEFAULT NULL,
  `last_used_at`   TIMESTAMP       NULL DEFAULT NULL,
  `expires_at`     TIMESTAMP       NULL DEFAULT NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: pending_checkouts  (proceso de pago Stripe)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pending_checkouts` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `stripe_session_id` VARCHAR(255)    NULL DEFAULT NULL,
  `gym_name`          VARCHAR(100)    NOT NULL,
  `username`          VARCHAR(50)     NOT NULL,
  `email`             VARCHAR(150)    NOT NULL,
  `password`          VARCHAR(255)    NOT NULL,
  `plan_id`           VARCHAR(20)     NOT NULL COMMENT 'weekly | monthly | annual | basic | full | custom',
  `plan_features`     JSON            NULL DEFAULT NULL COMMENT 'Selección de extras si plan_id=custom — igual formato que gyms.plan_features',
  `status`            VARCHAR(20)     NOT NULL DEFAULT 'pending' COMMENT 'pending | completed',
  `created_at`        TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`        TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pending_checkouts_stripe_session_id_unique` (`stripe_session_id`),
  KEY `pending_checkouts_email_index` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  TABLAS DE DATOS â€” Solo se usan para cuentas FREE (plan_type='free')
--  Las cuentas de pago guardan esto en su propia gemasystem_gym_{id}
--  Todas tienen gym_id para aislar los datos entre gyms free
-- ============================================================

-- --------------------------------------------------------
-- Tabla: members
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `members` (
  `id`                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`                   BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'solo para cuentas free',
  `member_code`              VARCHAR(20)     NULL DEFAULT NULL,
  `user_id`                  BIGINT UNSIGNED NULL DEFAULT NULL,
  `first_name`               VARCHAR(100)    NOT NULL,
  `last_name`                VARCHAR(100)    NOT NULL,
  `email`                    VARCHAR(150)    NULL DEFAULT NULL,
  `phone`                    VARCHAR(20)     NULL DEFAULT NULL,
  `birth_date`               DATE            NULL DEFAULT NULL,
  `gender`                   ENUM('male','female','other') NULL DEFAULT NULL,
  `address`                  TEXT            NULL DEFAULT NULL,
  `emergency_contact_name`   VARCHAR(100)    NULL DEFAULT NULL,
  `emergency_contact_phone`  VARCHAR(20)     NULL DEFAULT NULL,
  `membership_type`          ENUM('basic','premium','vip') NOT NULL DEFAULT 'basic',
  `membership_start`         DATE            NULL DEFAULT NULL,
  `membership_end`           DATE            NULL DEFAULT NULL,
  `status`                   ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `qr_token`                 VARCHAR(64)     NULL DEFAULT NULL,
  `created_at`               TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`               TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `members_gym_member_code_unique` (`gym_id`,`member_code`),
  UNIQUE KEY `members_gym_email_unique` (`gym_id`,`email`),
  UNIQUE KEY `members_qr_token_unique` (`qr_token`),
  KEY `members_gym_id_index` (`gym_id`),
  KEY `members_user_id_foreign` (`user_id`),
  CONSTRAINT `members_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: trainers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trainers` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `user_id`    BIGINT UNSIGNED NULL DEFAULT NULL,
  `first_name` VARCHAR(100)    NOT NULL,
  `last_name`  VARCHAR(100)    NOT NULL,
  `email`      VARCHAR(150)    NULL DEFAULT NULL,
  `phone`      VARCHAR(20)     NULL DEFAULT NULL,
  `specialty`        VARCHAR(150)    NULL DEFAULT NULL,
  `certifications`   VARCHAR(255)    NULL DEFAULT NULL,
  `bio`              TEXT            NULL DEFAULT NULL,
  `hire_date`        DATE            NULL DEFAULT NULL,
  `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `trainers_gym_id_index` (`gym_id`),
  KEY `trainers_user_id_foreign` (`user_id`),
  CONSTRAINT `trainers_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: classes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `classes` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`      BIGINT UNSIGNED NULL DEFAULT NULL,
  `name`        VARCHAR(150)    NOT NULL,
  `description` TEXT            NULL DEFAULT NULL,
  `trainer_id`  BIGINT UNSIGNED NULL DEFAULT NULL,
  `capacity`    INT             NOT NULL DEFAULT 20,
  `duration`    INT             NOT NULL DEFAULT 60,
  `difficulty`  ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `created_at`  TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `classes_gym_id_index` (`gym_id`),
  KEY `classes_trainer_id_foreign` (`trainer_id`),
  CONSTRAINT `classes_trainer_id_foreign`
    FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: class_schedules
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `class_schedules` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `class_id`    BIGINT UNSIGNED NOT NULL,
  `day_of_week` ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  `start_time`  TIME            NOT NULL,
  `end_time`    TIME            NOT NULL,
  `room`        VARCHAR(50)     NULL DEFAULT NULL,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `class_schedules_class_id_foreign` (`class_id`),
  CONSTRAINT `class_schedules_class_id_foreign`
    FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: memberships
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `memberships` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`         BIGINT UNSIGNED NULL DEFAULT NULL,
  `member_id`      BIGINT UNSIGNED NOT NULL,
  `type`           ENUM('monthly','quarterly','biannual','annual') NOT NULL DEFAULT 'monthly',
  `start_date`     DATE            NOT NULL,
  `end_date`       DATE            NOT NULL,
  `amount`         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash','card','transfer') NOT NULL DEFAULT 'cash',
  `status`         ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `memberships_gym_id_index` (`gym_id`),
  KEY `memberships_member_id_foreign` (`member_id`),
  CONSTRAINT `memberships_member_id_foreign`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: visits
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `visits` (
  `id`             BIGINT UNSIGNED                               NOT NULL AUTO_INCREMENT,
  `gym_id`         BIGINT UNSIGNED                               NULL DEFAULT NULL,
  `member_id`      BIGINT UNSIGNED                               NOT NULL,
  `visit_date`     DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `visit_type`     ENUM('training','class','consultation','other') NOT NULL DEFAULT 'training',
  `class_id`       BIGINT UNSIGNED                               NULL DEFAULT NULL,
  `trainer_id`     BIGINT UNSIGNED                               NULL DEFAULT NULL,
  `notes`          TEXT                                          NULL DEFAULT NULL,
  `price`          DECIMAL(10,2)                                 NULL DEFAULT NULL,
  `payment_method` ENUM('cash','card','transfer')                NULL DEFAULT NULL,
  `created_at`     TIMESTAMP                                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visits_gym_id_index`       (`gym_id`),
  KEY `visits_member_id_foreign`  (`member_id`),
  KEY `visits_class_id_foreign`   (`class_id`),
  KEY `visits_trainer_id_foreign` (`trainer_id`),
  CONSTRAINT `visits_member_id_foreign`
    FOREIGN KEY (`member_id`)  REFERENCES `members`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `visits_class_id_foreign`
    FOREIGN KEY (`class_id`)   REFERENCES `classes`  (`id`) ON DELETE SET NULL,
  CONSTRAINT `visits_trainer_id_foreign`
    FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: payments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`         BIGINT UNSIGNED NULL DEFAULT NULL,
  `member_id`      BIGINT UNSIGNED NOT NULL,
  `membership_id`  BIGINT UNSIGNED NULL DEFAULT NULL,
  `amount`         DECIMAL(10,2)   NOT NULL,
  `payment_date`   DATE            NOT NULL,
  `payment_method` ENUM('cash','card','transfer') NOT NULL DEFAULT 'cash',
  `reference`      VARCHAR(255)    NULL DEFAULT NULL,
  `notes`          TEXT            NULL DEFAULT NULL,
  `status`         ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'completed',
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payments_gym_id_index`          (`gym_id`),
  KEY `payments_member_id_foreign`     (`member_id`),
  KEY `payments_membership_id_foreign` (`membership_id`),
  CONSTRAINT `payments_member_id_foreign`
    FOREIGN KEY (`member_id`)     REFERENCES `members`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_membership_id_foreign`
    FOREIGN KEY (`membership_id`) REFERENCES `memberships` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: ingresos  (registro unificado de todos los ingresos)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ingresos` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`         BIGINT UNSIGNED NULL DEFAULT NULL,
  `member_id`      BIGINT UNSIGNED NULL DEFAULT NULL,
  `concept`        VARCHAR(255)    NOT NULL                COMMENT 'DescripciÃ³n del ingreso',
  `amount`         DECIMAL(10,2)   NOT NULL,
  `payment_method` ENUM('cash','card','transfer')  NOT NULL DEFAULT 'cash',
  `origin`         ENUM('membership','visit','manual','product') NOT NULL DEFAULT 'manual',
  `reference_id`   BIGINT UNSIGNED NULL DEFAULT NULL       COMMENT 'ID del payment, visit o product_sale origen',
  `reference_type` VARCHAR(50)     NULL DEFAULT NULL       COMMENT 'payment | visit | product_sale',
  `date`           DATE            NOT NULL,
  `notes`          TEXT            NULL DEFAULT NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ingresos_gym_id_index`      (`gym_id`),
  KEY `ingresos_member_id_foreign` (`member_id`),
  KEY `ingresos_date_index`        (`date`),
  KEY `ingresos_origin_index`      (`origin`),
  CONSTRAINT `ingresos_member_id_foreign`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: products  (catálogo de productos por gym — tienda)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`               BIGINT UNSIGNED NOT NULL,
  `name`                 VARCHAR(150)    NOT NULL,
  `description`          TEXT            NULL DEFAULT NULL,
  `sku`                  VARCHAR(60)     NULL DEFAULT NULL,
  `category`             VARCHAR(100)    NULL DEFAULT NULL,
  `price`                DECIMAL(10,2)   NOT NULL,
  `cost`                 DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `stock`                INT UNSIGNED    NULL DEFAULT NULL   COMMENT 'NULL cuando unlimited_stock = 1',
  `unlimited_stock`      TINYINT(1)      NOT NULL DEFAULT 0,
  `low_stock_threshold`  INT UNSIGNED    NOT NULL DEFAULT 5,
  `image_path`           VARCHAR(255)    NULL DEFAULT NULL   COMMENT 'Ruta relativa en el disco public, siempre .webp',
  `status`               ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`           TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`           TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_gym_id_sku_unique` (`gym_id`, `sku`),
  KEY `products_gym_id_status_index` (`gym_id`, `status`),
  CONSTRAINT `products_gym_id_foreign`
    FOREIGN KEY (`gym_id`) REFERENCES `gyms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: product_sales  (ventas de productos — alimenta a ingresos)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_sales` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`         BIGINT UNSIGNED NOT NULL,
  `product_id`     BIGINT UNSIGNED NOT NULL,
  `member_id`      BIGINT UNSIGNED NULL DEFAULT NULL         COMMENT 'NULL = venta directa / sin socio',
  `quantity`       INT UNSIGNED    NOT NULL,
  `unit_price`     DECIMAL(10,2)   NOT NULL,
  `unit_cost`      DECIMAL(10,2)   NOT NULL,
  `total_amount`   DECIMAL(10,2)   NOT NULL,
  `total_cost`     DECIMAL(10,2)   NOT NULL,
  `profit`         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash','card','transfer') NOT NULL DEFAULT 'cash',
  `sold_by`        BIGINT UNSIGNED NULL DEFAULT NULL         COMMENT 'users.id de quien registró la venta',
  `date`           DATE            NOT NULL,
  `notes`          TEXT            NULL DEFAULT NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_sales_gym_id_index`     (`gym_id`),
  KEY `product_sales_date_index`       (`date`),
  KEY `product_sales_product_id_index` (`product_id`),
  KEY `product_sales_member_id_index`  (`member_id`),
  CONSTRAINT `product_sales_gym_id_foreign`
    FOREIGN KEY (`gym_id`)     REFERENCES `gyms`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_sales_product_id_foreign`
    FOREIGN KEY (`product_id`) REFERENCES `products`  (`id`),
  CONSTRAINT `product_sales_member_id_foreign`
    FOREIGN KEY (`member_id`)  REFERENCES `members`   (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_sales_sold_by_foreign`
    FOREIGN KEY (`sold_by`)    REFERENCES `users`     (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: labels
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `labels` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `name`       VARCHAR(100)    NOT NULL,
  `color`      VARCHAR(7)      NOT NULL DEFAULT '#6366f1',
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `labels_gym_name_unique` (`gym_id`,`name`),
  KEY `labels_gym_id_index` (`gym_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: member_labels  (pivot)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_labels` (
  `member_id`  BIGINT UNSIGNED NOT NULL,
  `label_id`   BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`member_id`, `label_id`),
  CONSTRAINT `member_labels_member_id_foreign`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `member_labels_label_id_foreign`
    FOREIGN KEY (`label_id`)  REFERENCES `labels`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: settings
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `key`        VARCHAR(100)    NOT NULL,
  `value`      TEXT            NULL DEFAULT NULL,
  `type`       VARCHAR(20)     NOT NULL DEFAULT 'string',
  `group`      VARCHAR(50)     NOT NULL DEFAULT 'general',
  `label`      VARCHAR(150)    NULL DEFAULT NULL,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_gym_key_unique` (`gym_id`,`key`),
  KEY `settings_gym_id_index` (`gym_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: trial_requests  (solicitudes de cuenta gratuita 10 dÃ­as)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trial_requests` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gym_name`        VARCHAR(100)    NOT NULL,
  `contact_name`    VARCHAR(100)    NOT NULL,
  `email`           VARCHAR(150)    NOT NULL,
  `phone`           VARCHAR(20)     NULL DEFAULT NULL,
  `status`          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `operator_notes`  TEXT            NULL DEFAULT NULL,
  `reviewed_by`     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'user_id del operador',
  `reviewed_at`     TIMESTAMP       NULL DEFAULT NULL,
  `created_at`      TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`      TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `trial_requests_status_index` (`status`),
  KEY `trial_requests_email_index`  (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: migrations  (requerida por Laravel)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `migrations` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch`     INT          NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `migrations` (`migration`, `batch`) VALUES
  ('2014_10_12_000000_create_users_table',                              1),
  ('2014_10_12_100000_create_password_resets_table',                   1),
  ('2019_08_19_000000_create_failed_jobs_table',                       1),
  ('2019_12_14_000001_create_personal_access_tokens_table',            1),
  ('2024_01_01_000001_create_members_table',                           1),
  ('2024_01_01_000002_create_trainers_table',                          1),
  ('2024_01_01_000003_create_classes_table',                           1),
  ('2024_01_01_000004_create_class_schedules_table',                   1),
  ('2024_01_01_000005_create_memberships_table',                       1),
  ('2024_01_01_000006_create_visits_table',                            1),
  ('2024_01_01_000007_create_payments_table',                          1),
  ('2024_01_01_000008_add_member_code_to_members',                     2),
  ('2024_01_01_000009_create_labels_table',                            2),
  ('2024_01_01_000010_create_member_labels_table',                     2),
  ('2024_01_01_000011_add_price_to_visits',                            3),
  ('2024_01_01_000012_create_settings_table',                          3),
  ('2024_01_01_000013_add_payment_method_to_visits',                   3),
  ('2024_01_01_000014_add_access_code_to_users',                       4),
  ('2026_05_26_000001_create_pending_checkouts_table',                 5),
  ('2026_05_26_000002_create_gyms_table',                              6),
  ('2026_05_26_000003_add_tenant_columns',                             6),
  ('2026_05_26_000004_fix_unique_constraints_for_multitenancy',        6),
  ('2026_05_26_000005_add_onboarding_to_users',                        6),
  ('2026_05_28_000001_add_plan_type_to_gyms',                          7),
  ('2026_05_28_000002_add_operator_fields_to_users',                   7),
  ('2026_05_28_000003_create_trial_requests_table',                    7),
  ('2026_08_23_000001_add_plan_features_to_gyms_and_pending_checkouts', 8);

-- ------------------------------------------------------------
-- Base de datos YA EXISTENTE (producción): CREATE TABLE IF NOT EXISTS de
-- arriba no le agrega la columna nueva a una tabla que ya existía — corre
-- esto una sola vez a mano contra la DB en vivo:
--
--   ALTER TABLE `gyms` ADD COLUMN `plan_features` JSON NULL DEFAULT NULL
--     COMMENT 'Solo para plan=custom' AFTER `plan_type`;
--   ALTER TABLE `pending_checkouts` ADD COLUMN `plan_features` JSON NULL
--     DEFAULT NULL AFTER `plan_id`;
-- ------------------------------------------------------------

-- ============================================================
--  NOTA: No hay datos por defecto.
--  Cada gym se registra vÃ­a Stripe â†’ recibe sus propios
--  settings, usuario admin y cÃ³digo de acceso automÃ¡ticamente.
-- ============================================================

-- â”€â”€ Migraciones incrementales (idempotentes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE `trainers`
  ADD COLUMN IF NOT EXISTS `certifications` VARCHAR(255) NULL DEFAULT NULL AFTER `specialty`;
