-- Seed initial admin user if no admin exists
-- This migration creates a default admin account for initial access
-- The password should be changed immediately after first login

DO $$
DECLARE
    admin_count INTEGER;
    admin_email VARCHAR(255);
    admin_password VARCHAR(255);
    admin_first_name VARCHAR(100);
    admin_last_name VARCHAR(100);
    password_hash VARCHAR(255);
BEGIN
    -- Check if any admin users already exist
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'Admin';

    -- Only create admin if none exists
    IF admin_count = 0 THEN
        -- Use environment variables or defaults
        -- NOTE: In production, these should be set via environment variables
        -- Default credentials (CHANGE IMMEDIATELY AFTER FIRST LOGIN):
        admin_email := COALESCE(current_setting('app.admin_email', true), 'admin@benchmarktours.com');
        admin_first_name := COALESCE(current_setting('app.admin_first_name', true), 'System');
        admin_last_name := COALESCE(current_setting('app.admin_last_name', true), 'Administrator');

        -- Default password: Admin123! (MUST BE CHANGED)
        -- This is the bcrypt hash for 'Admin123!' with salt rounds 12
        password_hash := '$2a$12$ZvjaUBk3pEHOXt00CmYSouE0g.QZkYjPwGFMpLVH3zBk6YbPb19Uy';

        -- Insert the admin user
        INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at)
        VALUES (
            admin_email,
            password_hash,
            admin_first_name,
            admin_last_name,
            'Admin',
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Initial admin user created: %', admin_email;
        RAISE NOTICE 'Default password: Admin123! - CHANGE IMMEDIATELY';
    ELSE
        RAISE NOTICE 'Admin user(s) already exist. Skipping seed.';
    END IF;
END $$;
