CREATE DATABASE IF NOT EXISTS campus_lost_found
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

USE campus_lost_found;

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS items (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    report_type ENUM('lost', 'found') NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    color VARCHAR(50) DEFAULT NULL,
    brand VARCHAR(100) DEFAULT NULL,
    location VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    image VARCHAR(255) DEFAULT NULL,
    status ENUM('pending', 'approved', 'claimed', 'returned', 'rejected')
        NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY items_user_id_index (user_id),
    CONSTRAINT items_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS claims (
    id INT NOT NULL AUTO_INCREMENT,
    item_id INT NOT NULL,
    claimant_id INT NOT NULL,
    verification_answer TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY claims_item_id_index (item_id),
    KEY claims_claimant_id_index (claimant_id),
    CONSTRAINT claims_item_id_fk
        FOREIGN KEY (item_id) REFERENCES items (id),
    CONSTRAINT claims_claimant_id_fk
        FOREIGN KEY (claimant_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
