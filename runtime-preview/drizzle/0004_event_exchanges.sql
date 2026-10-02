CREATE TABLE `event_exchange_grants` (
	`exchange_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	PRIMARY KEY(`exchange_id`, `photo_id`),
	FOREIGN KEY (`exchange_id`) REFERENCES `event_exchanges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`viewer_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_exchange_grant_distinct" CHECK("event_exchange_grants"."owner_id" != "event_exchange_grants"."viewer_id")
);
--> statement-breakpoint
CREATE INDEX `event_exchange_grant_viewer` ON `event_exchange_grants` (`viewer_id`,`photo_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `event_exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`offered_photo_id` text NOT NULL,
	`requested_photo_id` text NOT NULL,
	`offered_revision` integer NOT NULL,
	`requested_revision` integer NOT NULL,
	`low_id` text NOT NULL,
	`high_id` text NOT NULL,
	`low_photo_id` text NOT NULL,
	`high_photo_id` text NOT NULL,
	`sender_profile` text NOT NULL,
	`recipient_profile` text NOT NULL,
	`preview_key` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`ended_at` text,
	`end_reason` text,
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offered_photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`low_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`high_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`low_photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`high_photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_exchange_participants" CHECK("event_exchanges"."low_id" < "event_exchanges"."high_id" AND (("event_exchanges"."sender_id" = "event_exchanges"."low_id" AND "event_exchanges"."recipient_id" = "event_exchanges"."high_id") OR ("event_exchanges"."sender_id" = "event_exchanges"."high_id" AND "event_exchanges"."recipient_id" = "event_exchanges"."low_id"))),
	CONSTRAINT "event_exchange_photos" CHECK("event_exchanges"."low_photo_id" < "event_exchanges"."high_photo_id" AND (("event_exchanges"."offered_photo_id" = "event_exchanges"."low_photo_id" AND "event_exchanges"."requested_photo_id" = "event_exchanges"."high_photo_id") OR ("event_exchanges"."offered_photo_id" = "event_exchanges"."high_photo_id" AND "event_exchanges"."requested_photo_id" = "event_exchanges"."low_photo_id"))),
	CONSTRAINT "event_exchange_revision" CHECK("event_exchanges"."revision" >= 1 AND "event_exchanges"."offered_revision" >= 1 AND "event_exchanges"."requested_revision" >= 1),
	CONSTRAINT "event_exchange_status" CHECK("event_exchanges"."status" IN ('pending','accepted','declined','cancelled','revoked','expired')),
	CONSTRAINT "event_exchange_end" CHECK(("event_exchanges"."status" IN ('pending','accepted') AND "event_exchanges"."ended_at" IS NULL AND "event_exchanges"."end_reason" IS NULL) OR ("event_exchanges"."status" NOT IN ('pending','accepted') AND "event_exchanges"."ended_at" IS NOT NULL AND "event_exchanges"."end_reason" IN ('declined','cancelled','revoked','expired','unavailable'))),
	CONSTRAINT "event_exchange_accept" CHECK(("event_exchanges"."status" IN ('accepted','revoked')) = ("event_exchanges"."accepted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_exchange_pending_pair` ON `event_exchanges` (`room_id`,`low_id`,`high_id`) WHERE "event_exchanges"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `event_exchange_live_photos` ON `event_exchanges` (`low_photo_id`,`high_photo_id`) WHERE "event_exchanges"."status" IN ('pending','accepted');--> statement-breakpoint
CREATE INDEX `event_exchange_sender` ON `event_exchanges` (`sender_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `event_exchange_recipient` ON `event_exchanges` (`recipient_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `event_exchange_offered` ON `event_exchanges` (`offered_photo_id`,`status`);--> statement-breakpoint
CREATE INDEX `event_exchange_requested` ON `event_exchanges` (`requested_photo_id`,`status`);--> statement-breakpoint
CREATE INDEX `event_exchange_preview` ON `event_exchanges` (`preview_key`);