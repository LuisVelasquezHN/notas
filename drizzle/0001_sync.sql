CREATE TABLE `sync_outbox` (
	`tbl` text NOT NULL,
	`row_id` text NOT NULL,
	`changed_at` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`tbl`, `row_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`applying` integer DEFAULT false NOT NULL
);
