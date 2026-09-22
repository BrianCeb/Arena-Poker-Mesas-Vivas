-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `document_type` ENUM('DNI', 'LC', 'LE', 'PASAPORTE') NOT NULL,
    `document_number` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `sex` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `birth_date` DATETIME(3) NOT NULL,
    `status` ENUM('PENDIENTE', 'ACTIVA', 'BLOQUEADA', 'DESHABILITADA') NOT NULL DEFAULT 'PENDIENTE',
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_document_number_idx`(`document_number`),
    INDEX `users_status_idx`(`status`),
    UNIQUE INDEX `users_document_type_document_number_key`(`document_type`, `document_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,
    `assigned_by` VARCHAR(191) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_roles_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_verification_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `user_agent` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `casino_tables` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `game_type` VARCHAR(191) NOT NULL,
    `small_blind` DECIMAL(65, 30) NOT NULL,
    `big_blind` DECIMAL(65, 30) NOT NULL,
    `min_buy_in` DECIMAL(65, 30) NULL,
    `max_buy_in` DECIMAL(65, 30) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 9,
    `min_players_to_start` INTEGER NOT NULL DEFAULT 4,
    `stradle_mode` ENUM('NO', 'OPCIONAL', 'OBLIGATORIO') NOT NULL DEFAULT 'NO',
    `stradle_amount` DECIMAL(65, 30) NULL,
    `status` ENUM('CERRADA', 'ABIERTA', 'SUSPENDIDA') NOT NULL DEFAULT 'CERRADA',
    `opened_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `casino_tables_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `table_id` VARCHAR(191) NOT NULL,
    `previous_status` ENUM('CERRADA', 'ABIERTA', 'SUSPENDIDA') NOT NULL,
    `new_status` ENUM('CERRADA', 'ABIERTA', 'SUSPENDIDA') NOT NULL,
    `changed_by` VARCHAR(191) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(191) NULL,

    INDEX `table_status_history_table_id_idx`(`table_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waiting_list_entries` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `table_id` VARCHAR(191) NOT NULL,
    `document_type` ENUM('DNI', 'LC', 'LE', 'PASAPORTE') NOT NULL,
    `document_number` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `status` ENUM('ANOTADO', 'SENTADO', 'RETIRADO', 'CANCELADO_ADMIN') NOT NULL DEFAULT 'ANOTADO',
    `origin` ENUM('APP', 'MANUAL_STAFF') NOT NULL DEFAULT 'APP',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `seated_at` DATETIME(3) NULL,
    `left_at` DATETIME(3) NULL,
    `cash_out_amount` DECIMAL(65, 30) NULL,
    `cash_out_at` DATETIME(3) NULL,
    `cancelled_by` VARCHAR(191) NULL,
    `cancel_reason` VARCHAR(191) NULL,

    INDEX `waiting_list_entries_table_id_status_idx`(`table_id`, `status`),
    INDEX `waiting_list_entries_user_id_status_idx`(`user_id`, `status`),
    INDEX `waiting_list_entries_document_type_document_number_idx`(`document_type`, `document_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `previous_state` JSON NULL,
    `new_state` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tournaments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `registration_closes_at` DATETIME(3) NOT NULL,
    `buy_in` DECIMAL(65, 30) NOT NULL,
    `rake` DECIMAL(65, 30) NOT NULL,
    `initial_stack` INTEGER NULL,
    `blinds_interval_minutes` INTEGER NULL,
    `re_entry_enabled` BOOLEAN NOT NULL DEFAULT false,
    `re_entry_closes_at` DATETIME(3) NULL,
    `add_on_enabled` BOOLEAN NOT NULL DEFAULT false,
    `add_on_price` DECIMAL(65, 30) NULL,
    `add_on_rake` DECIMAL(65, 30) NULL,
    `add_on_chips` INTEGER NULL,
    `add_on_level` INTEGER NULL,
    `guaranteed_pot` DECIMAL(65, 30) NULL,
    `flyer_image_url` VARCHAR(191) NULL,
    `structure_image_url` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `tournaments_status_idx`(`status`),
    INDEX `tournaments_starts_at_idx`(`starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `terms_versions` (
    `id` VARCHAR(191) NOT NULL,
    `version_label` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_current` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_terms_acceptance` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `terms_version_id` VARCHAR(191) NOT NULL,
    `accepted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(191) NULL,

    UNIQUE INDEX `user_terms_acceptance_user_id_terms_version_id_key`(`user_id`, `terms_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `casino_tables` ADD CONSTRAINT `casino_tables_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_status_history` ADD CONSTRAINT `table_status_history_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `casino_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_status_history` ADD CONSTRAINT `table_status_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waiting_list_entries` ADD CONSTRAINT `waiting_list_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waiting_list_entries` ADD CONSTRAINT `waiting_list_entries_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `casino_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waiting_list_entries` ADD CONSTRAINT `waiting_list_entries_cancelled_by_fkey` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_terms_acceptance` ADD CONSTRAINT `user_terms_acceptance_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_terms_acceptance` ADD CONSTRAINT `user_terms_acceptance_terms_version_id_fkey` FOREIGN KEY (`terms_version_id`) REFERENCES `terms_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
