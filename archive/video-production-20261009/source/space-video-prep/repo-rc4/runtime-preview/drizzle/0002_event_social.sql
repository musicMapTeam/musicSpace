CREATE TABLE `event_social_blocks` (
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`unblocked_at` text,
	PRIMARY KEY(`actor_id`, `target_id`),
	FOREIGN KEY (`actor_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_social_block_distinct" CHECK("event_social_blocks"."actor_id" != "event_social_blocks"."target_id"),
	CONSTRAINT "event_social_block_revision" CHECK("event_social_blocks"."revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX `event_social_block_target` ON `event_social_blocks` (`target_id`,`unblocked_at`,`actor_id`);--> statement-breakpoint
CREATE TABLE `event_social_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`low_id` text NOT NULL,
	`high_id` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`greeting_id` text,
	`sender_id` text,
	`recipient_id` text,
	`room_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`friends_at` text,
	`cooldown_until` text,
	FOREIGN KEY (`low_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`high_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_social_pair_order" CHECK("event_social_pairs"."low_id" < "event_social_pairs"."high_id"),
	CONSTRAINT "event_social_revision" CHECK("event_social_pairs"."revision" >= 1),
	CONSTRAINT "event_social_status" CHECK("event_social_pairs"."status" IN ('pending','accepted','rejected','cancelled','removed','blocked')),
	CONSTRAINT "event_social_friend_time" CHECK(("event_social_pairs"."status" = 'accepted') = ("event_social_pairs"."friends_at" IS NOT NULL)),
	CONSTRAINT "event_social_participants" CHECK("event_social_pairs"."status" = 'blocked' OR ("event_social_pairs"."greeting_id" IS NOT NULL AND "event_social_pairs"."room_id" IS NOT NULL AND "event_social_pairs"."sender_id" IS NOT NULL AND "event_social_pairs"."recipient_id" IS NOT NULL AND (("event_social_pairs"."sender_id" = "event_social_pairs"."low_id" AND "event_social_pairs"."recipient_id" = "event_social_pairs"."high_id") OR ("event_social_pairs"."sender_id" = "event_social_pairs"."high_id" AND "event_social_pairs"."recipient_id" = "event_social_pairs"."low_id"))))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_social_pairs_greeting_id_unique` ON `event_social_pairs` (`greeting_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_social_pair_unique` ON `event_social_pairs` (`low_id`,`high_id`);--> statement-breakpoint
CREATE INDEX `event_social_incoming` ON `event_social_pairs` (`recipient_id`,`status`,`greeting_id`);--> statement-breakpoint
CREATE INDEX `event_social_outgoing` ON `event_social_pairs` (`sender_id`,`status`,`greeting_id`);--> statement-breakpoint
CREATE INDEX `event_social_low` ON `event_social_pairs` (`low_id`,`status`,`id`);--> statement-breakpoint
CREATE INDEX `event_social_high` ON `event_social_pairs` (`high_id`,`status`,`id`);