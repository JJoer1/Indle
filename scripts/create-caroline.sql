-- =============================================================
--  DD CRM — Create user "caroline@indleladata.co.za"
--  Paste the ENTIRE script into Neon's SQL Editor and Run.
--
--  Password: 2015@Indlela  (stored as a bcrypt hash below)
--  Role:     owner  ·  Company: Indlela Data
--
--  Safe to run multiple times:
--    - if the company/user already exist, the password is updated
--    - demo data is only seeded into an empty company (no duplicates)
-- =============================================================

DO $$
DECLARE
  v_company    uuid;
  v_user       uuid;
  v_pipeline   uuid;
  s_new        uuid;
  s_qualified  uuid;
  s_proposal   uuid;
  s_negot      uuid;
  s_won        uuid;
  s_lost       uuid;
  v_count      int;
  -- bcrypt hash for the password "2015@Indlela"
  v_hash       text := '$2b$10$oF5rdYjOji79NMf.h5FXuOBwlWF3xp5Jx1JBjgPDJX/IPsJlvA5Ne';
BEGIN
  -- ----------------------------------------------------------
  -- 1. Company
  -- ----------------------------------------------------------
  SELECT id INTO v_company FROM companies WHERE slug = 'indlela-data';
  IF NOT FOUND THEN
    INSERT INTO companies (name, slug, industry, plan)
    VALUES ('Indlela Data', 'indlela-data', 'Technology', 'enterprise')
    RETURNING id INTO v_company;
    RAISE NOTICE '✓ Created company: Indlela Data';
  ELSE
    RAISE NOTICE '• Company already exists: Indlela Data';
  END IF;

  -- ----------------------------------------------------------
  -- 2. User  (create or update password + reactivate)
  -- ----------------------------------------------------------
  SELECT id INTO v_user FROM users WHERE email = 'caroline@indleladata.co.za';
  IF FOUND THEN
    UPDATE users
       SET password_hash = v_hash,
           name = 'Caroline',
           role = 'owner',
           company_id = v_company,
           status = 'active',
           email_verified = true,
           two_factor_enabled = false
     WHERE id = v_user;
    RAISE NOTICE '✓ Updated existing user password: caroline@indleladata.co.za';
  ELSE
    INSERT INTO users (company_id, name, email, password_hash, role, job_title, email_verified, status)
    VALUES (v_company, 'Caroline', 'caroline@indleladata.co.za', v_hash, 'owner', 'Company Owner', true, 'active')
    RETURNING id INTO v_user;
    RAISE NOTICE '✓ Created user: caroline@indleladata.co.za';
  END IF;

  -- ----------------------------------------------------------
  -- 3. Pipeline + stages (only if the company has none)
  -- ----------------------------------------------------------
  SELECT count(*) INTO v_count FROM pipelines WHERE company_id = v_company;
  IF v_count = 0 THEN
    INSERT INTO pipelines (company_id, name, is_default)
    VALUES (v_company, 'Sales Pipeline', true)
    RETURNING id INTO v_pipeline;

    INSERT INTO pipeline_stages (pipeline_id, name, stage_order, probability, color) VALUES
      (v_pipeline, 'New',         0, 10,  '#3b82f6'),
      (v_pipeline, 'Qualified',   1, 25,  '#06b6d4'),
      (v_pipeline, 'Proposal',    2, 50,  '#f59e0b'),
      (v_pipeline, 'Negotiation', 3, 75,  '#f97316'),
      (v_pipeline, 'Won',         4, 100, '#10b981'),
      (v_pipeline, 'Lost',        5, 0,   '#ef4444');
    RAISE NOTICE '✓ Created pipeline + 6 stages';
  END IF;

  -- resolve the stage ids for this company (needed by deals)
  SELECT
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'New'),
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'Qualified'),
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'Proposal'),
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'Negotiation'),
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'Won'),
    (SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.company_id = v_company AND ps.name = 'Lost')
  INTO s_new, s_qualified, s_proposal, s_negot, s_won, s_lost;

  -- ----------------------------------------------------------
  -- 4. Seed demo data — ONLY if the company has no customers yet
  -- ----------------------------------------------------------
  SELECT count(*) INTO v_count FROM customers WHERE company_id = v_company;
  IF v_count > 0 THEN
    RAISE NOTICE '• Company already has data — skipping demo seed.';
  ELSE
    -- ---- Customers ----
    INSERT INTO customers (company_id, company_name, contact_person, email, phone, industry, status, rating, annual_revenue, city, province, country, tags, assigned_to_id, created_by) VALUES
      (v_company,'Globex Industries','Mark Thompson','mark@globex.io','+27 21 0142','Manufacturing','active','hot','2400000','Cape Town','WC','South Africa',ARRAY['enterprise','priority'],v_user,v_user),
      (v_company,'Initech Solutions','Lisa Park','lisa@initech.com','+27 11 0177','Technology','active','warm','980000','Johannesburg','GP','South Africa',ARRAY['saas'],v_user,v_user),
      (v_company,'Umbrella Health','Dr. Alan Grant','alan@umbrellahealth.com','+27 31 0199','Healthcare','active','hot','5400000','Durban','KZN','South Africa',ARRAY['enterprise'],v_user,v_user),
      (v_company,'Stark Logistics','Natasha R.','natasha@starklog.com','+27 12 0123','Logistics','active','warm','1750000','Pretoria','GP','South Africa',ARRAY['logistics'],v_user,v_user),
      (v_company,'Wayne Retail','Bruce W.','bruce@wayneretail.com','+27 21 0188','Retail','inactive','cold','320000','Cape Town','WC','South Africa',ARRAY['retail'],v_user,v_user),
      (v_company,'Pied Piper','Richard Hendricks','richard@piedpiper.com','+27 11 0211','Technology','lead','warm','0','Johannesburg','GP','South Africa',ARRAY['startup'],v_user,v_user),
      (v_company,'Hooli Cloud','Gavin Belson','gavin@hooli.com','+27 11 0244','Technology','active','hot','8900000','Sandton','GP','South Africa',ARRAY['enterprise','priority'],v_user,v_user),
      (v_company,'Soylent Foods','Mia Wallace','mia@soylentfoods.com','+27 31 0266','Retail','active','warm','670000','Durban','KZN','South Africa',ARRAY['retail'],v_user,v_user);

    -- ---- Leads ----
    INSERT INTO leads (company_id, name, company, email, phone, source, estimated_value, probability, status, assigned_to_id) VALUES
      (v_company,'Emily Carter','Quantum Dynamics','emily@quantum.io','+27 21 1010','Website','45000',20,'new',v_user),
      (v_company,'Robert Lang','Pym Technologies','robert@pym.tech','+27 11 1020','Referral','120000',40,'contacted',v_user),
      (v_company,'Diana Prince','Themyscira Inc','diana@themyscira.com','+27 31 1030','Trade Show','85000',60,'qualified',v_user),
      (v_company,'Clark Kent','Daily Planet','clark@dailyplanet.com','+27 11 1040','Email Campaign','30000',70,'proposal',v_user),
      (v_company,'Peter Parker','Bugle Media','peter@bugle.com','+27 21 1050','Social Media','22000',80,'negotiation',v_user),
      (v_company,'Tony Stark','Stark Enterprises','tony@stark.com','+27 11 1060','Referral','250000',100,'won',v_user),
      (v_company,'Wanda M.','Westview LLC','wanda@westview.com','+27 31 1070','Cold Call','15000',0,'lost',v_user),
      (v_company,'Stephen Strange','Sanctum Co','stephen@sanctum.com','+27 21 1080','Website','67000',25,'new',v_user);

    -- ---- Deals ----
    INSERT INTO deals (company_id, pipeline_id, stage_id, name, value, currency, expected_close_date, assigned_to_id, products, notes, probability) VALUES
      (v_company,v_pipeline,s_proposal,'Globex — Enterprise License','180000','ZAR',(CURRENT_DATE + INTERVAL '14 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_negot,  'Umbrella Health — Platform','320000','ZAR',(CURRENT_DATE + INTERVAL '7 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_qualified,'Hooli — Migration Project','450000','ZAR',(CURRENT_DATE + INTERVAL '30 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_proposal,'Initech — Starter Plan','48000','ZAR',(CURRENT_DATE + INTERVAL '10 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_won,    'Stark Logistics — Fleet Mgmt','95000','ZAR',(CURRENT_DATE - INTERVAL '5 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_won,    'Soylent Foods — POS Integration','38000','ZAR',(CURRENT_DATE - INTERVAL '12 days')::date,v_user,'[]'::jsonb,'',30),
      (v_company,v_pipeline,s_negot,  'Wayne Retail — Upgrade','54000','ZAR',(CURRENT_DATE + INTERVAL '5 days')::date,v_user,'[]'::jsonb,'',30);

    -- ---- Tasks ----
    INSERT INTO tasks (company_id, title, type, status, priority, due_date, assigned_to_id, created_by, recurrence) VALUES
      (v_company,'Follow up with Globex on proposal','follow_up','todo','high',(now() + INTERVAL '1 day'),v_user,v_user,'none'),
      (v_company,'Call Umbrella Health — contract review','call','todo','urgent',now(),v_user,v_user,'none'),
      (v_company,'Prepare Hooli migration deck','task','todo','medium',(now() + INTERVAL '3 days'),v_user,v_user,'none'),
      (v_company,'Weekly pipeline review meeting','meeting','todo','medium',(now() + INTERVAL '2 days'),v_user,v_user,'weekly'),
      (v_company,'Send quote to Initech','task','todo','high',(now() + INTERVAL '1 day'),v_user,v_user,'none'),
      (v_company,'Renew Soylent support contract','reminder','todo','low',(now() + INTERVAL '6 days'),v_user,v_user,'none');

    -- ---- Calendar events ----
    INSERT INTO calendar_events (company_id, title, type, start_at, end_at, all_day, assigned_to_id, created_by) VALUES
      (v_company,'Hooli Discovery Call','call',(now() + INTERVAL '10 hours'),(now() + INTERVAL '11 hours'),false,v_user,v_user),
      (v_company,'Globex Demo Session','meeting',(now() + INTERVAL '1 day 14 hours'),(now() + INTERVAL '1 day 15 hours'),false,v_user,v_user),
      (v_company,'Quarterly Review','meeting',(now() + INTERVAL '2 days 11 hours'),(now() + INTERVAL '2 days 12 hours 30 mins'),false,v_user,v_user),
      (v_company,'Initech Proposal Deadline','deadline',(now() + INTERVAL '3 days 17 hours'),(now() + INTERVAL '3 days 17 hours 30 mins'),false,v_user,v_user),
      (v_company,'Public Holiday','holiday',(CURRENT_DATE + INTERVAL '5 days'),(CURRENT_DATE + INTERVAL '6 days'),true,v_user,v_user);

    -- ---- Notifications ----
    INSERT INTO notifications (company_id, user_id, title, message, type, read, link) VALUES
      (v_company,v_user,'Welcome to DD CRM 🎉','Your workspace is ready. Here is some sample data to explore.','info',false,'/dashboard'),
      (v_company,v_user,'Deal moved to Won','Stark Logistics closed for $95,000','deal',false,'/deals'),
      (v_company,v_user,'Task due today','Call Umbrella Health — contract review','task',false,'/tasks');

    -- ---- Activity feed ----
    INSERT INTO activities (company_id, user_id, type, description, entity_type) VALUES
      (v_company,v_user,'deal_moved','Stark Logistics moved to Won ($95,000)','deal'),
      (v_company,v_user,'customer_created','Created customer “Globex Industries”','customer'),
      (v_company,v_user,'lead_created','New lead “Emily Carter” added','lead');

    RAISE NOTICE '✓ Seeded demo data (8 customers, 8 leads, 7 deals, 6 tasks, 5 events)';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ DONE';
  RAISE NOTICE '   Email:    caroline@indleladata.co.za';
  RAISE NOTICE '   Password: 2015@Indlela';
  RAISE NOTICE '   Role:     owner';
  RAISE NOTICE '   Login:    /login';
  RAISE NOTICE '==========================================';
END $$;
