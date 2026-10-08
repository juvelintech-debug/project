-- ============================================================================
--  DEMO DATA — NOT REAL RECORDS
--  AI-Powered Student Placement Management System
--
--  ■ Everything in this file is invented for development and demonstration:
--    the people, roll numbers, companies, emails, phone numbers and salaries
--    are fictional. Company domains use the reserved `.example` TLD and student
--    addresses use `student.college.edu` so no message can ever reach a real
--    organisation. Nothing here was collected from a student.
--
--  ■ Apply with:  cd arena/backend && npm run db:seed
--    (idempotent: the demo tables are emptied first, so re-running is safe)
--
--  ■ Credentials are real bcrypt hashes ($2b, cost 10) of these documented
--    demo passwords. Plaintext appears nowhere in this file:
--        admin    Admin@123
--        student  Student@123
--        company  Company@123
--    Change them before this schema is used with anything real, and never seed
--    a production database (the seed script refuses unless SEED_ALLOW_PROD=true).
--
--  ■ Dates are written as DATE_ADD/DATE_SUB around NOW()/CURDATE() so deadlines
--    stay in the future whenever the file is run — a reviewer in six months
--    still gets usable "apply before it closes" data instead of an empty board.
-- ============================================================================

-- ── Clear previous demo rows, children before parents ───────────────────────
DELETE FROM `interviews`;
DELETE FROM `applications`;
DELETE FROM `ai_activity`;
DELETE FROM `notifications`;
DELETE FROM `jobs`;
DELETE FROM `student_skills`;
DELETE FROM `companies`;
DELETE FROM `students`;
DELETE FROM `users`;

ALTER TABLE `users`       AUTO_INCREMENT = 1;
ALTER TABLE `students`    AUTO_INCREMENT = 1;
ALTER TABLE `student_skills` AUTO_INCREMENT = 1;
ALTER TABLE `companies`   AUTO_INCREMENT = 1;
ALTER TABLE `jobs`        AUTO_INCREMENT = 1;
ALTER TABLE `applications` AUTO_INCREMENT = 1;
ALTER TABLE `interviews`  AUTO_INCREMENT = 1;
ALTER TABLE `notifications` AUTO_INCREMENT = 1;
ALTER TABLE `ai_activity` AUTO_INCREMENT = 1;

-- ── users ───────────────────────────────────────────────────────────────────
-- id 1 is the placement office. ids 2-9 are students, 10-13 recruiters.
-- status is 'Active' except for one suspended recruiter account (used to test
-- the login gate) and one inactive student who stopped using the portal.
INSERT INTO `users`
  (`id`, `role`, `email`, `password_hash`, `full_name`, `status`, `last_login_at`, `created_at`)
VALUES
  (1,  'Admin',   'admin@placementcell.edu',
      '$2b$10$DHr46T5tBQT/.shhbU392.l3qVeIoIAAGcsX10ZMhgRkwIYXcszPa',
      'Priya Raghavan', 'Active', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 400 DAY)),

  (2,  'Student', 'aarav.sharma@student.college.edu',
      '$2b$10$q11kJ.4tbBrhgeP84WL8aON7JxPDFqsOIF/0La9/7n9kMl2b.mMw.',
      'Aarav Sharma', 'Active', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 120 DAY)),
  (3,  'Student', 'diya.menon@student.college.edu',
      '$2b$10$26Lyaq1a9ZauwaDnjQ2WGe32hxvlQPcS1oM5gFHQzywJFE/6G.SOK',
      'Diya Menon', 'Active', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 118 DAY)),
  (4,  'Student', 'kabir.desai@student.college.edu',
      '$2b$10$pTfhoi4sniranN8mRWiFRO8qRvk1ZlXC9DEdwZh4WWzZagMflmF8W',
      'Kabir Desai', 'Active', DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 115 DAY)),
  (5,  'Student', 'ananya.iyer@student.college.edu',
      '$2b$10$mXZRW6LgtaLxJ0SXhD9GU.cM3DCtW9l9upGAWJX.eI38RvytP85/q',
      'Ananya Iyer', 'Active', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 110 DAY)),
  (6,  'Student', 'rohan.patil@student.college.edu',
      '$2b$10$GAmhawVJ6t1eo.PP43volu8xTK3MQ4YzN91bCtuO.iuR6UrDNrrgC',
      'Rohan Patil', 'Active', NULL, DATE_SUB(NOW(), INTERVAL 95 DAY)),
  (7,  'Student', 'sara.qureshi@student.college.edu',
      '$2b$10$WTR0NHV7CwUevJZvdzYAaOU4bntY4F0NvBUplYXLb9NbBnSquD.rW',
      'Sara Qureshi', 'Active', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 90 DAY)),
  (8,  'Student', 'vivaan.kulkarni@student.college.edu',
      '$2b$10$hnJoEkx6X1IekmKHkPj5ZuzgVV88JkOZyLFmp4UfgIV4KqmsO9yNO',
      'Vivaan Kulkarni', 'Inactive', NULL, DATE_SUB(NOW(), INTERVAL 88 DAY)),
  (9,  'Student', 'isha.nair@student.college.edu',
      '$2b$10$ifWWsCu6H9dtO8w6j2F5AOSmDJwycxcYpZZRDyNCJZzFtN6QQ5MAC',
      'Isha Nair', 'Active', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY)),

  (10, 'Company', 'careers@northwindtech.example',
      '$2b$10$04lkooDMQecepxYdUMSAduvnreFep1oQla.7GpszaDSN0XNtk82Jm',
      'Neha Kulkarni (Northwind Tech)', 'Active', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 60 DAY)),
  (11, 'Company', 'hr@brightwaveanalytics.example',
      '$2b$10$n/s.owOFOoORzY1AYv01RuCO8ay.wi8QJMryFjtzfsRTJFgq0tbei',
      'Arjun Rao (BrightWave Analytics)', 'Active', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (12, 'Company', 'talent@skylineconstructors.example',
      '$2b$10$G0ILwK812S/JaBDlaapphem4nhHvTJlc2l3bWh52I9ke5srUyWfxu',
      'Farida Sheikh (Skyline Constructors)', 'Active', NULL, DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (13, 'Company', 'people@vertexretail.example',
      '$2b$10$bHdSjWQQtvLOyr/1nUJYQudRIQGMsVK5V6/N5ksmKhyRSgW6VTejy',
      'Imran Qasim (Vertex Retail)', 'Suspended', NULL, DATE_SUB(NOW(), INTERVAL 30 DAY));

-- ── students (1:1 with users 2-9) ────────────────────────────────────────────
-- Aarav (id 1) already accepted an offer, hence placement_status = 'Placed'.
-- Vivaan (id 7) opted out for a master's degree. Rohan (id 5) has a thin
-- profile on purpose: it is the case the "complete your profile" reminder and
-- the profile-completion meter have to handle.
INSERT INTO `students`
  (`id`, `user_id`, `roll_number`, `program`, `department`, `batch_start_year`, `graduation_year`,
   `cgpa`, `backlog_count`, `date_of_birth`, `gender`, `phone`, `city`, `state`,
   `linkedin_url`, `github_url`, `bio`, `higher_studies`, `placement_status`,
   `resume_path`, `resume_original_name`, `resume_size_bytes`, `resume_uploaded_at`, `created_at`)
VALUES
  (1, 2, 'BIT2023014', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     8.64, 0, '2004-03-18', 'Male', '+91 90000 11111', 'Thane', 'Maharashtra',
     'https://linkedin.example/in/aarav-sharma', 'https://github.example/aaravsh',
     'Final-year B.Sc. IT student who enjoys building React interfaces and has shipped two college fest apps.',
     0, 'Placed',
     'resume-2-aarav.pdf', 'Aarav_Sharma_Resume.pdf', 248573, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 120 DAY)),

  (2, 3, 'BIT2023021', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     9.12, 0, '2004-07-02', 'Female', '+91 90000 22222', 'Pune', 'Maharashtra',
     'https://linkedin.example/in/diya-menon', 'https://github.example/diyam',
     'Interested in data roles; comfortable with SQL, Python and Power BI dashboards.',
     0, 'Unplaced',
     'resume-3-diya.pdf', 'Diya_Menon_Resume.pdf', 190233, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 118 DAY)),

  (3, 4, 'BIT2023007', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     7.41, 1, '2003-11-25', 'Male', '+91 90000 33333', 'Mumbai', 'Maharashtra',
     NULL, 'https://github.example/kabird',
     'Backlog in Discrete Mathematics cleared in the April supplement. Strong at debugging, weak at writing docs.',
     0, 'Unplaced',
     'resume-4-kabir.pdf', 'Kabir_Desai_CV.pdf', 171004, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 115 DAY)),

  (4, 5, 'BCA2023032', 'B.C.A.', 'Information Technology', 2023, 2026,
     8.05, 0, '2004-01-09', 'Female', '+91 90000 44444', 'Nashik', 'Maharashtra',
     'https://linkedin.example/in/ananya-iyer', NULL,
     'Testing and automation: wrote the Selenium suite for the third-year project.',
     0, 'Unplaced',
     'resume-5-ananya.pdf', 'Ananya_Iyer_Resume.pdf', 205114, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 110 DAY)),

  (5, 6, 'BIT2023045', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     6.88, 2, '2003-09-14', 'Male', '+91 90000 55555', 'Thane', 'Maharashtra',
     NULL, NULL, NULL,
     0, 'Unplaced',
     NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 95 DAY)),

  (6, 7, 'BIT2023002', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     8.90, 0, '2004-05-30', 'Female', '+91 90000 66666', 'Bengaluru', 'Karnataka',
     'https://linkedin.example/in/sara-qureshi', 'https://github.example/saraq',
     'Node.js and Express backend projects; looking for a full-time role from August.',
     0, 'Unplaced',
     'resume-7-sara.pdf', 'Sara_Qureshi_Resume.pdf', 262001, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 90 DAY)),

  (7, 8, 'MSCIT2024011', 'M.Sc. Information Technology', 'Information Technology', 2024, 2026,
     8.30, 0, '2001-12-12', 'Male', '+91 90000 77777', 'Thane', 'Maharashtra',
     NULL, NULL, 'Pursuing an M.Sc. and a part-time teaching assistant role.',
     1, 'Opted Out',
     NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 88 DAY)),

  (8, 9, 'BIT2023019', 'B.Sc. Information Technology', 'Information Technology', 2023, 2026,
     7.75, 0, '2004-02-21', 'Female', '+91 90000 88888', 'Nagpur', 'Maharashtra',
     'https://linkedin.example/in/isha-nair', 'https://github.example/ishan',
     'Cloud and DevOps interested; completed an AWS cloud practitioner course in 2025.',
     0, 'Unplaced',
     'resume-9-isha.pdf', 'Isha_Nair_Resume.pdf', 218440, DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY));

-- ── student_skills ────────────────────────────────────────────────────────────
-- normalized_name is lower(trim(skill_name)) exactly, as the CHECK requires.
-- Note the near-duplicates that were merged on purpose (JavaScript vs javascript)
-- and one deliberately repeated skill name across students.
INSERT INTO `student_skills` (`student_id`, `skill_name`, `normalized_name`, `proficiency`) VALUES
  (1, 'JavaScript',   'javascript',   'Advanced'),
  (1, 'React',        'react',        'Advanced'),
  (1, 'HTML & CSS',   'html & css',   'Intermediate'),
  (1, 'Git',          'git',          'Intermediate'),
  (1, 'Node.js',      'node.js',      'Beginner'),
  (2, 'Python',       'python',       'Advanced'),
  (2, 'SQL',          'sql',          'Advanced'),
  (2, 'Power BI',     'power bi',     'Intermediate'),
  (2, 'Excel',        'excel',        'Expert'),
  (2, 'Statistics',   'statistics',   'Intermediate'),
  (3, 'Java',         'java',         'Intermediate'),
  (3, 'Debugging',    'debugging',    'Advanced'),
  (3, 'MySQL',        'mysql',        'Beginner'),
  (4, 'Selenium',     'selenium',     'Advanced'),
  (4, 'Python',       'python',       'Intermediate'),
  (4, 'Manual Testing', 'manual testing', 'Intermediate'),
  (4, 'SQL',          'sql',          'Beginner'),
  (5, 'C++',          'c++',          'Intermediate'),
  (6, 'Node.js',      'node.js',      'Advanced'),
  (6, 'Express',      'express',      'Advanced'),
  (6, 'MongoDB',      'mongodb',      'Intermediate'),
  (6, 'REST APIs',    'rest apis',    'Advanced'),
  (6, 'Git',          'git',          'Intermediate'),
  (7, 'Teaching',     'teaching',     'Advanced'),
  (8, 'AWS',          'aws',          'Intermediate'),
  (8, 'Docker',       'docker',       'Beginner'),
  (8, 'Linux',        'linux',        'Intermediate'),
  (8, 'JavaScript',   'javascript',   'Intermediate'),
  (8, 'SQL',          'sql',          'Intermediate');

-- ── companies ─────────────────────────────────────────────────────────────────
-- Two Approved, one Pending (nothing posted yet — that is the point of the
-- approval gate), one Rejected with a public reason, and the fourth recruiter's
-- account is Suspended while the company row itself stays Rejected/Pending.
INSERT INTO `companies`
  (`id`, `user_id`, `company_name`, `description`, `website`, `industry`, `company_size`,
   `city`, `state`, `contact_person`, `contact_email`, `contact_phone`,
   `status`, `reviewed_by`, `reviewed_at`, `review_note`, `rejection_reason`, `created_at`)
VALUES
  (1, 10, 'Northwind Tech',
      'Product engineering services company building internal tools for logistics clients. Runs a six-month structured onboarding programme for freshers.',
      'https://northwindtech.example', 'Information Technology', '201-1000',
      'Pune', 'Maharashtra', 'Neha Kulkarni', 'careers@northwindtech.example', '+91 20 4000 1000',
      'Approved', 1, DATE_SUB(NOW(), INTERVAL 55 DAY),
      'Verified against the recruiter''s college partnership letter.', NULL, DATE_SUB(NOW(), INTERVAL 60 DAY)),

  (2, 11, 'BrightWave Analytics',
      'Data and reporting consultancy for retail and insurance. Hire-train-deploy model with a paid apprenticeship quarter.',
      'https://brightwaveanalytics.example', 'Analytics', '51-200',
      'Bengaluru', 'Karnataka', 'Arjun Rao', 'hr@brightwaveanalytics.example', '+91 80 5000 2000',
      'Approved', 1, DATE_SUB(NOW(), INTERVAL 40 DAY),
      'Approved for the 2026 season; revisit their stipend policy next year.', NULL, DATE_SUB(NOW(), INTERVAL 45 DAY)),

  (3, 12, 'Skyline Constructors',
      'Civil and infrastructure contractor that also hires IT graduates for its ERP and site-reporting team.',
      'https://skylineconstructors.example', 'Construction', '1000+',
      'Mumbai', 'Maharashtra', 'Farida Sheikh', 'talent@skylineconstructors.example', '+91 22 6000 3000',
      'Pending', NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 9 DAY)),

  (4, 13, 'Vertex Retail',
      'Multi-store retail chain recruiting for point-of-sale support.',
      NULL, 'Retail', '1-50',
      'Nagpur', 'Maharashtra', 'Imran Qasim', 'people@vertexretail.example', '+91 71 2000 4000',
      'Rejected', 1, DATE_SUB(NOW(), INTERVAL 25 DAY),
      'Company asked for a security deposit from candidates — not permitted on campus.',
      'Rejected: the placement cell does not allow recruiters to charge candidates any deposit or training fee.',
      DATE_SUB(NOW(), INTERVAL 30 DAY));

-- ── jobs ──────────────────────────────────────────────────────────────────────
-- 1,2,3,6 Approved (visible to students)   4 Pending Approval
-- 5 Rejected                                7 Closed   8 Expired
-- Every Approved row has posted_at, as the CHECK demands.
INSERT INTO `jobs`
  (`id`, `company_id`, `title`, `description`, `required_qualification`, `skills_required`,
   `min_cgpa`, `max_backlogs`, `job_type`, `work_mode`, `location`,
   `salary_min`, `salary_max`, `salary_unit`, `openings`,
   `application_deadline`, `start_date`, `status`, `posted_at`,
   `approved_by`, `approved_at`, `rejection_reason`, `created_at`)
VALUES
  (1, 1, 'Frontend Developer Intern',
      'Six-month paid internship building customer dashboards in React with a mentor assigned from week one. Expect to ship small features by month two.',
      'B.Sc. IT / B.C.A. final year', 'JavaScript, React, HTML & CSS, Git',
      7.00, 1, 'Internship', 'Hybrid', 'Pune',
      18000.00, 24000.00, 'Per Month', 6,
      DATE_ADD(CURDATE(), INTERVAL 21 DAY), '2026-08-03', 'Approved',
      DATE_SUB(NOW(), INTERVAL 20 DAY), 1, DATE_SUB(NOW(), INTERVAL 20 DAY), NULL, DATE_SUB(NOW(), INTERVAL 21 DAY)),

  (2, 1, 'Software Associate - Full Stack',
      'Full-time role on a product squad: Express and MySQL APIs on the backend, React on the frontend. On-campus pre-placement talk scheduled before the deadline.',
      'Any Graduate', 'JavaScript, Node.js, Express, SQL, Git',
      7.50, 0, 'Full Time', 'On-site', 'Pune',
      4.50, 6.00, 'LPA', 4,
      DATE_ADD(CURDATE(), INTERVAL 12 DAY), '2026-07-06', 'Approved',
      DATE_SUB(NOW(), INTERVAL 18 DAY), 1, DATE_SUB(NOW(), INTERVAL 18 DAY), NULL, DATE_SUB(NOW(), INTERVAL 19 DAY)),

  (3, 2, 'Data Analyst Trainee',
      'Join the reporting team: SQL modelling, Power BI dashboards and weekly readouts for two retail clients. Strong Excel is valued as much as coding.',
      'B.Sc. IT / B.C.A. / any graduate with SQL', 'SQL, Python, Excel, Power BI, Statistics',
      7.50, 1, 'Full Time', 'Remote', 'Bengaluru',
      3.60, 4.20, 'LPA', 8,
      DATE_ADD(CURDATE(), INTERVAL 8 DAY), '2026-07-20', 'Approved',
      DATE_SUB(NOW(), INTERVAL 15 DAY), 1, DATE_SUB(NOW(), INTERVAL 15 DAY), NULL, DATE_SUB(NOW(), INTERVAL 16 DAY)),

  (4, 2, 'QA Automation Associate',
      'Write and maintain the Playwright suite for a payments dashboard, and own the nightly regression run.',
      'Any Graduate', 'Selenium, Python, SQL, Manual Testing',
      7.00, 2, 'Full Time', 'Hybrid', 'Bengaluru',
      3.80, 4.40, 'LPA', 3,
      DATE_ADD(CURDATE(), INTERVAL 25 DAY), NULL, 'Pending Approval',
      NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  (5, 1, 'DevOps Support Trainee',
      'Night-shift infrastructure support covering deployments, log triage and on-call escalation for two client environments.',
      'Any Graduate', 'Linux, Docker, AWS',
      6.50, NULL, 'Contract', 'On-site', 'Pune',
      25000.00, 30000.00, 'Per Month', 2,
      DATE_ADD(CURDATE(), INTERVAL 30 DAY), NULL, 'Rejected',
      NULL, 1, DATE_SUB(NOW(), INTERVAL 7 DAY),
      'Night-shift-only hiring for a trainee role needs the dean''s written sign-off; resubmit with that approval attached.',
      DATE_SUB(NOW(), INTERVAL 8 DAY)),

  (6, 2, 'Business Intelligence Assistant',
      'Build and maintain the metric layer for a subscription analytics product; you will write a lot of SQL and review it with a senior analyst.',
      'B.Sc. IT / M.Sc. IT', 'SQL, Power BI, Python, Statistics',
      8.00, 0, 'Full Time', 'Hybrid', 'Bengaluru',
      5.00, 6.50, 'LPA', 3,
      DATE_ADD(CURDATE(), INTERVAL 17 DAY), '2026-08-10', 'Approved',
      DATE_SUB(NOW(), INTERVAL 10 DAY), 1, DATE_SUB(NOW(), INTERVAL 10 DAY), NULL, DATE_SUB(NOW(), INTERVAL 11 DAY)),

  (7, 1, 'Support Engineer - Night Shift',
      'Handled the 2025 drive; kept open for reference so the closed state has real data behind it.',
      'Any Graduate', 'SQL, Communication',
      6.00, NULL, 'Full Time', 'On-site', 'Pune',
      3.20, 3.60, 'LPA', 2,
      DATE_SUB(CURDATE(), INTERVAL 5 DAY), '2026-01-12', 'Closed',
      DATE_SUB(NOW(), INTERVAL 120 DAY), 1, DATE_SUB(NOW(), INTERVAL 120 DAY), NULL, DATE_SUB(NOW(), INTERVAL 130 DAY)),

  (8, 2, 'Analyst - Reporting',
      'Reporting analyst opening that closed when the team filled it through the referral pool.',
      'Any Graduate', 'Excel, SQL',
      7.00, 1, 'Full Time', 'On-site', 'Bengaluru',
      3.40, 4.00, 'LPA', 1,
      DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL, 'Expired',
      DATE_SUB(NOW(), INTERVAL 40 DAY), 1, DATE_SUB(NOW(), INTERVAL 40 DAY), NULL, DATE_SUB(NOW(), INTERVAL 42 DAY));

-- ── applications ──────────────────────────────────────────────────────────────
-- Only jobs 1,2,3,6,7,8 carry applications: a student can never see a job that
-- is not Approved, so the Pending/Rejected postings have none.
-- Every row is a distinct (student_id, job_id) pair — the UNIQUE key that makes
-- a second application to the same posting impossible.
INSERT INTO `applications`
  (`id`, `student_id`, `job_id`, `status`, `cover_letter`, `submitted_resume_path`,
   `recruiter_notes`, `reviewed_by`, `reviewed_at`, `status_changed_at`, `withdrawn_at`, `applied_at`)
VALUES
  (1, 1, 1, 'Accepted',
      'I built two React apps for the college fest and can start on 3 August with the rest of the batch.',
      'resume-2-aarav.pdf', 'Best portfolio of the shortlist; offered the intern-to-hire track.',
      10, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), NULL, DATE_SUB(NOW(), INTERVAL 19 DAY)),

  (2, 1, 2, 'Interview Scheduled',
      'Comfortable with Express and MySQL on the backend side of my fest projects too.',
      'resume-2-aarav.pdf', NULL, 10, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), NULL,
      DATE_SUB(NOW(), INTERVAL 10 DAY)),

  (3, 2, 1, 'Offer Received',
      'My three internships were all dashboard work, mostly React with a bit of D3.',
      'resume-3-diya.pdf', 'Offer letter sent on 12th; awaiting her parents'' decision on relocation.',
      10, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, DATE_SUB(NOW(), INTERVAL 17 DAY)),

  (4, 2, 3, 'Applied',
      'SQL and Power BI are my strongest tools; I have already built a weekly sales readout for a local shop.',
      'resume-3-diya.pdf', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 4 DAY), NULL, DATE_SUB(NOW(), INTERVAL 4 DAY)),

  (5, 3, 2, 'Under Review',
      'I cleared my Discrete Maths backlog in April and I am the person who fixes the build when it breaks.',
      'resume-4-kabir.pdf', NULL, 10, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), NULL,
      DATE_SUB(NOW(), INTERVAL 9 DAY)),

  (6, 3, 6, 'Not Shortlisted',
      'Interested in the metric layer work and I write careful SQL.',
      'resume-4-kabir.pdf', 'CGPA below the 8.0 cut-off the client set for this requisition.',
      11, DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY), NULL, DATE_SUB(NOW(), INTERVAL 13 DAY)),

  (7, 4, 3, 'Shortlisted',
      'Automation is what I like doing: I wrote the Selenium suite for our third-year project.',
      'resume-5-ananya.pdf', 'Good SQL instincts; schedule the online test.',
      11, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), NULL, DATE_SUB(NOW(), INTERVAL 6 DAY)),

  (8, 4, 1, 'Applied',
      'I have shipped a React app for the cultural fest and would love to do it properly.',
      'resume-5-ananya.pdf', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, DATE_SUB(NOW(), INTERVAL 5 DAY)),

  (9, 5, 6, 'Interview Completed',
      'I am comfortable writing joins and I have read our senior''s Power BI files.',
      NULL, 'Communication is strong; SQL window functions still shaky. Second round pending.',
      11, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, DATE_SUB(NOW(), INTERVAL 7 DAY)),

  (10, 5, 8, 'Expired',
      'Happy to start immediately.', NULL, 'Application lapsed when the requisition closed.',
      11, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), NULL, DATE_SUB(NOW(), INTERVAL 30 DAY)),

  (11, 6, 1, 'Withdrawn',
      'I would like to be considered for the full-time track instead if that is possible.',
      'resume-7-sara.pdf', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY),
      DATE_SUB(NOW(), INTERVAL 4 DAY)),

  (12, 6, 2, 'Rejected',
      'Two years of Node.js side projects and an Express API used by 300 students for the fest.',
      'resume-7-sara.pdf', 'Strong on Node, but the frontend assessment was below the bar for this squad.',
      10, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, DATE_SUB(NOW(), INTERVAL 16 DAY)),

  (13, 7, 3, 'Applied',
      'I have TA''d two database labs and I enjoy explaining a query to someone who is stuck.',
      NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  (14, 7, 7, 'Expired',
      'Night shifts are fine for me.', NULL, 'Drive closed before review.',
      10, DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY), NULL, DATE_SUB(NOW(), INTERVAL 112 DAY)),

  (15, 8, 6, 'Applied',
      'I care about how a metric is defined before I chart it. AWS Cloud Practitioner certified in 2025.',
      'resume-9-isha.pdf', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),

  (16, 8, 8, 'Declined',
      'Interested, but I took the other offer after the second round.',
      'resume-9-isha.pdf', 'Declined our offer - accepted a closer-to-home role.',
      11, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), NULL, DATE_SUB(NOW(), INTERVAL 33 DAY));

-- ── interviews ────────────────────────────────────────────────────────────────
-- Remote/video modes all carry a meeting_link, as the CHECK requires.
INSERT INTO `interviews`
  (`id`, `application_id`, `scheduled_at`, `duration_minutes`, `interview_mode`, `location`, `meeting_link`,
   `status`, `result_rating`, `feedback`, `conducted_by`, `created_at`)
VALUES
  (1, 1, DATE_SUB(NOW(), INTERVAL 9 DAY), 45, 'Video Call', NULL, 'https://meet.example/nw-tech-r1',
     'Completed', 5, 'Clean React fundamentals, asked good questions about the mentorship track. Advance to the manager round.',
     10, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (2, 1, DATE_SUB(NOW(), INTERVAL 6 DAY), 60, 'In-person', 'Northwind Tech, Hinjewadi Phase 2, Room 3', NULL,
     'Completed', 4, 'Solid on SQL joins, weaker on system design but fine at fresher level. Offer approved.',
     10, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (3, 2, DATE_ADD(NOW(), INTERVAL 3 DAY), 45, 'Video Call', NULL, 'https://meet.example/nw-tech-fullstack',
     'Scheduled', NULL, NULL, 10, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (4, 3, DATE_ADD(NOW(), INTERVAL 2 DAY), 30, 'Phone', NULL, 'https://meet.example/nw-tech-offer-call',
     'Scheduled', NULL, NULL, 10, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (5, 7, DATE_ADD(NOW(), INTERVAL 5 DAY), 90, 'Online Test', 'Lab 2, Department of IT', NULL,
     'Scheduled', NULL, NULL, 11, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (6, 9, DATE_SUB(NOW(), INTERVAL 2 DAY), 40, 'Video Call', NULL, 'https://meet.example/bw-bi-interview',
     'Completed', 3, 'Communication strong, window functions need work. Keep for the next requisition.',
     11, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (7, 12, DATE_SUB(NOW(), INTERVAL 6 DAY), 45, 'In-person', 'Seminar Hall B', NULL,
     'No Show', NULL, 'Did not appear for the frontend assessment; slot released.',
     10, DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (8, 5, DATE_ADD(NOW(), INTERVAL 1 DAY), 30, 'Video Call', NULL, 'https://meet.example/nw-tech-screen',
     'Cancelled', NULL, 'Recruiter moved it to next week after rescheduling the campus drive.',
     10, DATE_SUB(NOW(), INTERVAL 4 DAY));

-- ── notifications ─────────────────────────────────────────────────────────────
-- A realistic unread mix so the bell menu and the "mark all read" flow have data.
INSERT INTO `notifications`
  (`id`, `user_id`, `type`, `title`, `message`, `is_read`, `read_at`, `related_entity_type`, `related_entity_id`, `created_at`)
VALUES
  (1,  2, 'Application Update', 'Offer received from Northwind Tech',
     'You have been selected for the Software Associate - Full Stack role. Reply before the deadline on the application page.',
     0, NULL, 'Application', 1, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (2,  2, 'Interview Scheduled', 'Interview in 3 days',
     'Northwind Tech scheduled a video interview for your Frontend Developer Intern application.',
     1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Interview', 3, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (3,  2, 'AI Insight', 'Your resume score improved',
     'Adding two quantified project outcomes raised your resume feedback score. Review the suggestions in Resume Analysis.',
     1, DATE_SUB(NOW(), INTERVAL 13 DAY), NULL, NULL, DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (4,  3, 'Application Update', 'Shortlisted for Data Analyst Trainee',
     'BrightWave Analytics moved your application to Shortlisted.',
     0, NULL, 'Application', 7, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (5,  3, 'New Job Posted', '3 new jobs match your skills',
     'New Approved postings mention SQL, Python and Excel. Check the job board before the deadlines pass.',
     0, NULL, 'Job', 6, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (6,  4, 'Application Update', 'Not shortlisted',
     'Your application to Business Intelligence Assistant was not shortlisted. Reason: CGPA below the client cut-off.',
     1, DATE_SUB(NOW(), INTERVAL 8 DAY), 'Application', 6, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (7,  5, 'Profile Reminder', 'Complete your student profile',
     'Your profile is missing a resume, CGPA and LinkedIn link. Recruiters see a completion score next to your name.',
     0, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (8,  6, 'Application Update', 'Interview completed',
     'BrightWave Analytics recorded feedback for your Business Intelligence Assistant interview.',
     0, NULL, 'Interview', 6, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (9,  7, 'System', 'Your application was withdrawn',
     'You withdrew from Frontend Developer Intern at Northwind Tech. You may re-apply while the posting is open.',
     1, DATE_SUB(NOW(), INTERVAL 4 DAY), 'Job', 1, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (10, 7, 'Job Rejected', 'A posting you wanted is closed',
     'Support Engineer - Night Shift is no longer accepting applications.',
     1, DATE_SUB(NOW(), INTERVAL 100 DAY), 'Job', 7, DATE_SUB(NOW(), INTERVAL 105 DAY)),
  (11, 9, 'New Job Posted', 'Business Intelligence Assistant is open',
     'BrightWave Analytics is hiring BI Assistants; the deadline is in 17 days.',
     0, NULL, 'Job', 6, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (12, 10, 'Application Update', '12 new applications on your postings',
     'Northwind Tech has new applications to review for Frontend Developer Intern and Software Associate - Full Stack.',
     0, NULL, 'Job', 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (13, 10, 'Interview Scheduled', 'Two interviews this week',
     'Your video interview slot for Software Associate - Full Stack is confirmed for the coming day.',
     1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Interview', 3, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (14, 11, 'Application Update', 'QA Automation Associate awaiting approval',
     'Your posting is queued for placement cell approval. Students cannot see it until then.',
     0, NULL, 'Job', 4, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (15, 12, 'Account Rejected', 'Approval still pending',
     'Skyline Constructors has not been approved yet, so you cannot submit a job for approval.',
     0, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (16, 13, 'Account Rejected', 'Your company was rejected',
     'Vertex Retail was rejected: the placement cell does not allow recruiters to charge candidates any deposit or training fee.',
     1, DATE_SUB(NOW(), INTERVAL 24 DAY), NULL, NULL, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (17, 1,  'Job Approved', '4 postings waiting for your review',
     'One job was submitted for approval and two companies need a decision.',
     0, NULL, 'Job', 4, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (18, 1,  'System', 'AI provider not configured',
     'Set GEMINI_API_KEY in arena/backend/.env to enable the advisory AI features. Until then the portal answers with its rule-based fallback.',
     1, DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ── ai_activity ───────────────────────────────────────────────────────────────
-- Metadata only: no prompt text, no model output, no keys, no resume content.
-- Note the Fallback and error rows - that is what the "AI degraded" UI state
-- reads from, and what the quota counter counts.
INSERT INTO `ai_activity`
  (`id`, `user_id`, `job_id`, `activity_type`, `status`, `provider`, `model`,
   `input_chars`, `output_chars`, `duration_ms`, `summary`, `error_code`, `error_message`, `created_at`)
VALUES
  (1,  2, NULL, 'Resume Analysis',      'Success', 'gemini', 'gemini-2.5-flash',
     3120, 1480, 4200, 'Resume reviewed: 4 strengths, 5 suggestions', NULL, NULL, DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (2,  2, 1,    'Job Matching',         'Success', 'gemini', 'gemini-2.5-flash',
     5240, 1710, 5100, 'Advisory match against Frontend Developer Intern', NULL, NULL, DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (3,  2, NULL, 'Skill Gap Analysis',   'Success', 'gemini', 'gemini-2.5-flash',
     2980, 1320, 3900, 'Gap report for 5 skills, 3 recommended courses', NULL, NULL, DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (4,  2, NULL, 'Interview Preparation','Success', 'gemini', 'gemini-2.5-flash',
     4110, 2640, 6800, '10 practice questions with model answers and feedback', NULL, NULL, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (5,  3, 3,    'Job Matching',         'Fallback', NULL, NULL,
     NULL, 900, 12, 'Rule-based overlap score (skill and CGPA comparison)',
     'AI_UNAVAILABLE', 'No AI provider configured - answered from the local scoring rules instead.', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (6,  3, NULL, 'Resume Improvement',   'Failed', 'gemini', 'gemini-2.5-flash',
     3450, NULL, 25003, NULL, 'AI_TIMEOUT', 'Provider did not respond within 25000 ms.', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (7,  4, 2,    'Job Matching',         'Success', 'gemini', 'gemini-2.5-flash',
     4870, 1590, 4700, 'Advisory match against Software Associate - Full Stack', NULL, NULL, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (8,  4, NULL, 'Skill Gap Analysis',   'Invalid Output', 'gemini', 'gemini-2.5-flash',
     2740, 640, 3100, NULL, 'AI_BAD_JSON', 'Model reply was not valid JSON; nothing was shown to the student.',
     DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (9,  6, NULL, 'Interview Preparation','Success', 'gemini', 'gemini-2.5-flash',
     3990, 2280, 5900, '8 practice questions for a Node.js and SQL round', NULL, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (10, 8, NULL, 'Resume Analysis',      'Failed', 'gemini', 'gemini-2.5-flash',
     NULL, NULL, 40, NULL, 'AI_NO_RESUME', 'Student has no resume on file to analyse.',
     DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (11, 9, 6,    'Job Matching',         'Success', 'gemini', 'gemini-2.5-flash',
     5010, 1655, 4400, 'Advisory match against Business Intelligence Assistant', NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (12, 5, NULL, 'Resume Improvement',   'Fallback', NULL, NULL,
     NULL, 720, 9, 'Checklist advice from the local rules (no resume on file for detail)',
     'AI_UNAVAILABLE', 'No AI provider configured - answered from the local scoring rules instead.',
     DATE_SUB(NOW(), INTERVAL 2 DAY));
