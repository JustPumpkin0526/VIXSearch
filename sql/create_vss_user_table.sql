CREATE TABLE `vss_user` (
	`ID` VARCHAR(50) NOT NULL COMMENT '사용자 고유 ID' COLLATE 'utf8mb4_unicode_ci',
	`PW` VARCHAR(60) NOT NULL COMMENT 'bcrypt로 해시화된 비밀번호' COLLATE 'utf8mb4_unicode_ci',
	`EMAIL` VARCHAR(255) NOT NULL COMMENT '사용자 이메일 주소' COLLATE 'utf8mb4_unicode_ci',
	`CREATED_AT` TIMESTAMP NOT NULL DEFAULT current_timestamp() COMMENT '계정 생성일시',
	`UPDATED_AT` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '계정 정보 수정일시',
	`PROFILE_IMAGE_URL` VARCHAR(500) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`ROLE` VARCHAR(20) NOT NULL DEFAULT 'USER' COLLATE 'utf8mb4_unicode_ci',
	`APPROVED` TINYINT(1) NOT NULL DEFAULT '0',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `EMAIL` (`EMAIL`) USING BTREE,
	INDEX `idx_email` (`EMAIL`) USING BTREE,
	INDEX `idx_user_email` (`EMAIL`) USING BTREE
)
COMMENT='VSS 회원 정보 테이블'
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
;
