CREATE TABLE `vss_summaries` (
	`ID` INT(11) NOT NULL AUTO_INCREMENT,
	`VIDEO_ID` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`USER_ID` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`PROMPT` LONGTEXT NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`SUMMARY_TEXT` LONGTEXT NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`CREATED_AT` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
	`UPDATED_AT` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `unique_video_summary` (`VIDEO_ID`, `USER_ID`) USING BTREE,
	INDEX `idx_user_id` (`USER_ID`) USING BTREE,
	INDEX `idx_video_id` (`VIDEO_ID`) USING BTREE,
	INDEX `idx_created_at` (`CREATED_AT`) USING BTREE,
	CONSTRAINT `vss_summaries_ibfk_1` FOREIGN KEY (`USER_ID`) REFERENCES `vss_user` (`ID`) ON UPDATE RESTRICT ON DELETE CASCADE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1333
;
