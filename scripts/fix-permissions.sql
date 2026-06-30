-- =============================================================
--  Fix permissions for Neon user 'neondb_owner'
--  Run this in Neon's SQL Editor
-- =============================================================

-- Grant full access to the public schema
GRANT ALL PRIVILEGES ON SCHEMA public TO neondb_owner;

-- Grant usage on all existing and future tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neondb_owner;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neondb_owner;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO neondb_owner;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO neondb_owner;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON SEQUENCES TO neondb_owner;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON FUNCTIONS TO neondb_owner;

-- Re-create Caroline with correct permissions
DO $$
DECLARE
  v_company uuid;
  v_user uuid;
BEGIN
  -- Create company if missing
  SELECT id INTO v_company FROM companies WHERE slug = 'indlela-data';
  IF NOT FOUND THEN
    INSERT INTO companies (name, slug, industry, plan)
    VALUES ('Indlela Data', 'indlela-data', 'Technology', 'enterprise')
    RETURNING id INTO v_company;
  END IF;

  -- Create or update user
  SELECT id INTO v_user FROM users WHERE email = 'caroline@indleladata.co.za';
  IF FOUND THEN
    UPDATE users SET 
      password_hash = '$2b$10$oF5rdYjOji79NMf.h5FXuOBwlWF3xp5Jx1JBjgPDJX/IPsJlvA5Ne',
      name = 'Caroline',
      role = 'owner',
      company_id = v_company,
      status = 'active',
      email_verified = true
    WHERE id = v_user;
  ELSE
    INSERT INTO users (company_id, name, email, password_hash, role, job_title, email_verified, status)
    VALUES (v_company, 'Caroline', 'caroline@indleladata.co.za', '$2b$10$oF5rdYjOji79NMf.h5FXuOBwlWF3xp5Jx1JBjgPDJX/IPsJlvA5Ne', 'owner', 'Company Owner', true, 'active')
    RETURNING id INTO v_user;
  END IF;

  RAISE NOTICE 'Caroline account is ready. Login with: caroline@indleladata.co.za / 2015@Indlela';
END $$;
