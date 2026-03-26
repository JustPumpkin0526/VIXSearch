CREATE TABLE `vss_search_states` (
	`USER_ID` VARCHAR(255) NOT NULL COLLATE 'utf8mb3_general_ci',
	`STATE_DATA` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
	`UPDATED_AT` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	PRIMARY KEY (`USER_ID`) USING BTREE
)
COLLATE='utf8mb3_general_ci'
ENGINE=InnoDB
;
