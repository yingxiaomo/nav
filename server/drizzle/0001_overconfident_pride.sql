CREATE INDEX `idx_bookmarks_category` ON `bookmarks` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_bookmarks_cat_order` ON `bookmarks` (`category_id`,`order`);--> statement-breakpoint
CREATE INDEX `idx_categories_order` ON `categories` (`order`);