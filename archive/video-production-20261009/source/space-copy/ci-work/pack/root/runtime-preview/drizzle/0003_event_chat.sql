CREATE TABLE `event_chat_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`pair_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`pair_id`) REFERENCES `event_chat_threads`(`pair_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_chat_distinct" CHECK("event_chat_messages"."sender_id" != "event_chat_messages"."recipient_id"),
	CONSTRAINT "event_chat_text_length" CHECK(length("event_chat_messages"."text") BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_chat_messages_id_unique` ON `event_chat_messages` (`id`);--> statement-breakpoint
CREATE INDEX `event_chat_pair_sequence` ON `event_chat_messages` (`pair_id`,`seq`);--> statement-breakpoint
CREATE INDEX `event_chat_recipient` ON `event_chat_messages` (`pair_id`,`recipient_id`,`seq`);--> statement-breakpoint
CREATE TABLE `event_chat_receipts` (
	`message_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`delivered_at` text NOT NULL,
	`read_at` text,
	PRIMARY KEY(`message_id`, `viewer_id`),
	FOREIGN KEY (`message_id`) REFERENCES `event_chat_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`viewer_id`) REFERENCES `avatar_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_chat_threads` (
	`pair_id` text PRIMARY KEY NOT NULL,
	`low_profile` text NOT NULL,
	`high_profile` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`pair_id`) REFERENCES `event_social_pairs`(`id`) ON UPDATE no action ON DELETE no action
);
