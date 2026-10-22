CREATE TABLE `secure_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`payload` text NOT NULL,
	`sort_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `secure_notes_vault_idx` ON `secure_notes` (`vault_id`);--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`kdf` text NOT NULL,
	`wrapped_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
