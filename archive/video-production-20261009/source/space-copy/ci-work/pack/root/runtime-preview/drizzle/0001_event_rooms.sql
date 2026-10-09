CREATE TABLE `event_idempotency` (
	`actor_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` integer NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`actor_id`, `key_hash`)
);
--> statement-breakpoint
CREATE TABLE `event_members` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_member_user` ON `event_members` (`user_id`,`left_at`);--> statement-breakpoint
CREATE TABLE `event_mutation_guard` (
	`id` text PRIMARY KEY NOT NULL,
	`assertion` integer NOT NULL,
	CONSTRAINT "event_mutation_guard_assertion" CHECK("event_mutation_guard"."assertion" = 1)
);
--> statement-breakpoint
CREATE TABLE `event_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`photo_key` text,
	`visibility` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_photo_visibility" CHECK("event_photos"."visibility" IN ('private', 'members')),
	CONSTRAINT "event_photo_storage" CHECK(("event_photos"."deleted_at" IS NULL AND "event_photos"."photo_key" IS NOT NULL) OR ("event_photos"."deleted_at" IS NOT NULL AND "event_photos"."photo_key" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `event_photo_room` ON `event_photos` (`room_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `event_photo_owner` ON `event_photos` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_photo_key` ON `event_photos` (`photo_key`) WHERE "event_photos"."photo_key" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `event_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_rate_expiry` ON `event_rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `event_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`song_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`host_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_rooms_code_unique` ON `event_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `event_room_host` ON `event_rooms` (`host_id`,`created_at`);