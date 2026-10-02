CREATE TABLE `avatar_compositions` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`guest_id` text,
	`snapshot` text NOT NULL,
	`revision` integer NOT NULL,
	`content_revision` integer NOT NULL,
	`photo_key` text,
	`invite_hash` text,
	`invite_expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "avatar_distinct_identities" CHECK("avatar_compositions"."guest_id" IS NULL OR "avatar_compositions"."host_id" != "avatar_compositions"."guest_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avatar_compositions_invite_hash_unique` ON `avatar_compositions` (`invite_hash`);--> statement-breakpoint
CREATE INDEX `avatar_host` ON `avatar_compositions` (`host_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `avatar_guest` ON `avatar_compositions` (`guest_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `avatar_photo` ON `avatar_compositions` (`photo_key`) WHERE "avatar_compositions"."photo_key" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `avatar_idempotency` (
	`actor_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` integer NOT NULL,
	`response` text NOT NULL,
	`capability_kind` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`actor_id`, `key_hash`)
);
--> statement-breakpoint
CREATE TABLE `avatar_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `avatar_mutation_guard` (
	`id` text PRIMARY KEY NOT NULL,
	`assertion` integer NOT NULL,
	CONSTRAINT "avatar_mutation_guard_assertion" CHECK("avatar_mutation_guard"."assertion" = 1)
);
--> statement-breakpoint
CREATE TABLE `avatar_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `avatar_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`token_hash` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avatar_users_token_hash_unique` ON `avatar_users` (`token_hash`);