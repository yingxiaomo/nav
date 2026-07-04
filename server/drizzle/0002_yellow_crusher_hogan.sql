CREATE TABLE `monitor_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`timeout` integer DEFAULT 5000 NOT NULL,
	`created_at` integer NOT NULL
);
