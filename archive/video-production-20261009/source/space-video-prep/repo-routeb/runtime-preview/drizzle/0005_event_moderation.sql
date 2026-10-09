CREATE TABLE `event_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`photo_id` text,
	`target_name` text NOT NULL,
	`category` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `event_photos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_report_distinct" CHECK("event_reports"."reporter_id" != "event_reports"."target_id"),
	CONSTRAINT "event_report_category" CHECK("event_reports"."category" IN ('harassment','unwanted-content','privacy','spam','other')),
	CONSTRAINT "event_report_details" CHECK(length("event_reports"."details") BETWEEN 1 AND 280),
	CONSTRAINT "event_report_status" CHECK("event_reports"."status" IN ('open','withdrawn','resolved','dismissed')),
	CONSTRAINT "event_report_resolution" CHECK(("event_reports"."status" = 'open') = ("event_reports"."resolved_at" IS NULL)),
	CONSTRAINT "event_report_revision" CHECK("event_reports"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_report_open_target` ON `event_reports` (`room_id`,`reporter_id`,`target_id`) WHERE "event_reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX `event_report_room` ON `event_reports` (`room_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `event_report_owner` ON `event_reports` (`reporter_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `event_room_exclusions` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`target_name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restored_at` text,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `event_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_exclusion_revision" CHECK("event_room_exclusions"."revision" >= 1)
);
