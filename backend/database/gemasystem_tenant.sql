-- ============================================================
--  GemaSystem â€” Base de datos DEDICADA por gym de pago
--  VersiÃ³n: 1.0
--
--  Este archivo es el TEMPLATE para cada gym con plan_type='paid'.
--  Cada gym de pago tiene su propia instancia de esta base de datos
--  con el nombre:  gemasystem_gym_{id}
--
--  Diferencias vs gemasystem.sql (shared/free):
--    âœ“ SIN gym_id en ninguna tabla (la DB entera es del gym)
--    âœ“ SIN tabla users          (vive en gemasystem)
--    âœ“ SIN tabla gyms           (vive en gemasystem)
--    âœ“ SIN personal_access_tokens (vive en gemasystem)
--    âœ“ SIN pending_checkouts    (vive en gemasystem)
--    âœ“ SIN FK a users           (cross-DB no es posible en MySQL)
--
--  CÃ³mo crear la DB para un gym de pago:
--    php artisan gym:create-database {gym_id}
--
--  O manualmente (reemplaza 7 con el ID real del gym):
--    CREATE DATABASE gemasystem_gym_7 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--    USE gemasystem_gym_7;
--    SOURCE gemasystem_tenant.sql;
--    UPDATE gemasystem.gyms SET plan_type='paid', db_name='gemasystem_gym_7' WHERE id=7;
-- ============================================================

-- --------------------------------------------------------
-- Tabla: members
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `members` (
  `id`                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `member_code`              VARCHAR(20)     NULL DEFAULT NULL,
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
  UNIQUE KEY `members_member_code_unique` (`member_code`),
  UNIQUE KEY `members_email_unique` (`email`),
  UNIQUE KEY `members_qr_token_unique` (`qr_token`),
  KEY `members_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: trainers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trainers` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100)    NOT NULL,
  `last_name`  VARCHAR(100)    NOT NULL,
  `email`      VARCHAR(150)    NULL DEFAULT NULL,
  `phone`      VARCHAR(20)     NULL DEFAULT NULL,
  `specialty`      VARCHAR(150)    NULL DEFAULT NULL,
  `certifications` VARCHAR(255)    NULL DEFAULT NULL,
  `bio`            TEXT            NULL DEFAULT NULL,
  `hire_date`      DATE            NULL DEFAULT NULL,
  `status`         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trainers_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: classes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `classes` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(150)    NOT NULL,
  `description` TEXT            NULL DEFAULT NULL,
  `trainer_id`  BIGINT UNSIGNED NULL DEFAULT NULL,
  `capacity`    INT             NOT NULL DEFAULT 20,
  `duration`    INT             NOT NULL DEFAULT 60,
  `difficulty`  ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `created_at`  TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
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
  KEY `memberships_member_id_foreign` (`member_id`),
  KEY `memberships_end_date_index` (`end_date`),
  CONSTRAINT `memberships_member_id_foreign`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: visits
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `visits` (
  `id`             BIGINT UNSIGNED                                NOT NULL AUTO_INCREMENT,
  `member_id`      BIGINT UNSIGNED                                NOT NULL,
  `visit_date`     DATETIME                                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `visit_type`     ENUM('training','class','consultation','other') NOT NULL DEFAULT 'training',
  `class_id`       BIGINT UNSIGNED                                NULL DEFAULT NULL,
  `trainer_id`     BIGINT UNSIGNED                                NULL DEFAULT NULL,
  `notes`          TEXT                                           NULL DEFAULT NULL,
  `price`          DECIMAL(10,2)                                  NULL DEFAULT NULL,
  `payment_method` ENUM('cash','card','transfer')                 NULL DEFAULT NULL,
  `created_at`     TIMESTAMP                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visits_member_id_foreign`  (`member_id`),
  KEY `visits_class_id_foreign`   (`class_id`),
  KEY `visits_trainer_id_foreign` (`trainer_id`),
  KEY `visits_visit_date_index`   (`visit_date`),
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
  KEY `payments_member_id_foreign`     (`member_id`),
  KEY `payments_membership_id_foreign` (`membership_id`),
  CONSTRAINT `payments_member_id_foreign`
    FOREIGN KEY (`member_id`)     REFERENCES `members`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_membership_id_foreign`
    FOREIGN KEY (`membership_id`) REFERENCES `memberships` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: labels
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `labels` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)    NOT NULL,
  `color`      VARCHAR(7)      NOT NULL DEFAULT '#6366f1',
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `labels_name_unique` (`name`)
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
-- Tabla: settings  (configuraciÃ³n del gym, sin gym_id)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key`        VARCHAR(100)    NOT NULL,
  `value`      TEXT            NULL DEFAULT NULL,
  `type`       VARCHAR(20)     NOT NULL DEFAULT 'string',
  `group`      VARCHAR(50)     NOT NULL DEFAULT 'general',
  `label`      VARCHAR(150)    NULL DEFAULT NULL,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: ingresos  (registro unificado de todos los ingresos)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ingresos` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
  KEY `ingresos_member_id_foreign` (`member_id`),
  KEY `ingresos_date_index`        (`date`),
  KEY `ingresos_origin_index`      (`origin`),
  CONSTRAINT `ingresos_member_id_foreign`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: products  (catálogo de productos del gym — tienda)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
  UNIQUE KEY `products_sku_unique` (`sku`),
  KEY `products_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: product_sales  (ventas de productos — alimenta a ingresos)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_sales` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id`     BIGINT UNSIGNED NOT NULL,
  `member_id`      BIGINT UNSIGNED NULL DEFAULT NULL         COMMENT 'NULL = venta directa / sin socio',
  `quantity`       INT UNSIGNED    NOT NULL,
  `unit_price`     DECIMAL(10,2)   NOT NULL,
  `unit_cost`      DECIMAL(10,2)   NOT NULL,
  `total_amount`   DECIMAL(10,2)   NOT NULL,
  `total_cost`     DECIMAL(10,2)   NOT NULL,
  `profit`         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash','card','transfer') NOT NULL DEFAULT 'cash',
  `sold_by`        BIGINT UNSIGNED NULL DEFAULT NULL         COMMENT 'gemasystem.users.id — sin FK, users no vive en esta DB',
  `date`           DATE            NOT NULL,
  `notes`          TEXT            NULL DEFAULT NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_sales_date_index`       (`date`),
  KEY `product_sales_product_id_index` (`product_id`),
  KEY `product_sales_member_id_index`  (`member_id`),
  CONSTRAINT `product_sales_product_id_foreign`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `product_sales_member_id_foreign`
    FOREIGN KEY (`member_id`)  REFERENCES `members`  (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  FIN DEL TEMPLATE
--  Recuerda actualizar el registro en gemasystem:
--    UPDATE gemasystem.gyms
--    SET plan_type = 'paid', db_name = 'gemasystem_gym_{id}'
--    WHERE id = {id};
-- ============================================================

-- ============================================================
