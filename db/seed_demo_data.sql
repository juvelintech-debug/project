-- ============================================================================
--  DEVELOPMENT / TESTING DATA ONLY  -  synthetic, no real student information.
--  Never run against production, never commit a dump of real data (SEC-19).
--  Load AFTER db/schema.sql.
-- ============================================================================
SET NAMES utf8mb4;

INSERT INTO academic_years (id, year_label, starts_on, ends_on, is_current) VALUES
 (1,'2025-26','2025-06-01','2026-04-30',0),
 (2,'2026-27','2026-06-01','2027-04-30',1);

INSERT INTO departments (id, department_code, name, degree_programme) VALUES
 (1,'BSCIT','B.Sc. Information Technology','B.Sc. IT'),
 (2,'BCA','Bachelor of Computer Applications','BCA'),
 (3,'BSCCS','B.Sc. Computer Science','B.Sc. CS');

INSERT INTO batches (id, batch_label, academic_year_id, graduation_year) VALUES
 (1,'2023-2026',1,2026),
 (2,'2024-2027',2,2027);

INSERT INTO skills (id, skill_name, skill_category, aliases) VALUES
 (1,'MySQL','technical','["MySQL 8","SQL"]'),
 (2,'JavaScript','technical','["JS","ECMAScript"]'),
 (3,'React','technical','["React.js","ReactJS"]'),
 (4,'Node.js','technical','["NodeJS","Express"]'),
 (5,'Python','technical','["Python 3"]'),
 (6,'HTML & CSS','technical','["HTML5","CSS3"]'),
 (7,'Communication','soft',NULL),
 (8,'Git','tool','["GitHub","Version Control"]');

INSERT INTO qualification_levels (id,label) VALUES
 (1,'B.Sc. Information Technology'),(2,'BCA'),(3,'Any Graduate');

-- users: id 1 admin, 2-4 students, 5-6 recruiters.  password_hash = bcrypt placeholder.
INSERT INTO users (id, full_name, email, password_hash, role, account_status, token_version, phone) VALUES
 (1,'Placement Officer','tpo@college.edu','$2b$12$devhashadminaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Admin','Active',1,NULL),
 (2,'Aarav Sharma','aarav@college.edu','$2b$12$devhashstud01aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Student','Active',1,'9820000001'),
 (3,'Diya Patel','diya@college.edu','$2b$12$devhashstud02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Student','Active',1,'9820000002'),
 (4,'Rohan Nair','rohan@college.edu','$2b$12$devhashstud03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Student','Active',1,'9820000003'),
 (5,'Neha Verma (Nexlab)','hr@nexlab.example','$2b$12$devhashcomp01aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Company','Active',1,'9810000001'),
 (6,'Imran Qureshi (Quantumsoft)','hr@quantumsoft.example','$2b$12$devhashcomp02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Company','Active',1,'9810000002');

UPDATE users SET last_login_at = NOW() WHERE id IN (1,2,3,4,5,6);

INSERT INTO student_profiles (id, user_id, role, roll_number, department_id, batch_id, programme, semester,
   cgpa_value, cgpa_scale_max, active_backlogs, preferred_role_types, consent_given_at, consent_policy_version) VALUES
 (2,2,'Student','BSCIT2023001',1,1,'B.Sc. IT',6, 8.40,10.00,0,'full_time,internship','2026-01-10 09:00:00','v1'),
 (3,3,'Student','BSCIT2023002',1,1,'B.Sc. IT',6, 6.40,10.00,1,'full_time','2026-01-11 10:00:00','v1'),
 (4,4,'Student','BCA2023010',2,1,'BCA',6, 7.80,10.00,0,NULL,NULL,NULL);

INSERT INTO student_education (student_profile_id, qualification, institution_name, board_university, year_of_passing, percentage, cgpa_value, is_current) VALUES
 (2,'Class X','St. Xavier HS','MH State Board',2021,88.00,NULL,0),
 (2,'Class XII','N.Y. Higher Secondary','MH State Board',2023,79.50,NULL,0),
 (2,'B.Sc. IT','College of Applied Sciences','SPPU',NULL,NULL,8.40,1),
 (3,'B.Sc. IT','College of Applied Sciences','SPPU',NULL,NULL,6.40,1);

INSERT INTO student_projects (id, student_profile_id, title, project_type, description, tools_used, outcome) VALUES
 (1,2,'Campus Placement Tracker','academic','Web app tracking student applications for our college placement cell.','React, Node.js, MySQL','Used by 40 students in one semester'),
 (2,3,'Weather Dashboard','personal','API-driven dashboard with forecast charts.','HTML, CSS, JavaScript',NULL);
INSERT INTO student_project_skills (student_project_id, skill_id) VALUES (1,3),(1,4),(1,1),(2,6),(2,2);

INSERT INTO student_skills (student_profile_id, skill_id, proficiency_level, skill_source) VALUES
 (2,1,'advanced','from_project'),(2,2,'proficient','from_resume'),(2,3,'advanced','from_project'),
 (2,4,'proficient','from_project'),(2,8,'intermediate','self_declared'),
 (3,2,'intermediate','self_declared'),(3,6,'proficient','from_project');

INSERT INTO student_profile_items (student_profile_id, item_type, title, issuer, item_date) VALUES
 (2,'certification','MySQL for Beginners','Coursera','2025-11-02'),
 (2,'achievement','Best Project - Department Tech Fest','College','2025-09-15');

INSERT INTO resumes (id, student_id, version_label, original_filename, stored_path, file_type, file_size_bytes, content_hash, is_active) VALUES
 (1,2,'v2 - full stack focus','Aarav_Resume_v2.pdf','/var/app/uploads/resumes/8f21c4a7-1b3e-4f60-9d2a-000000000001.pdf','application/pdf',286431,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',1),
 (2,3,'v1 basic','diya_resume.docx','/var/app/uploads/resumes/8f21c4a7-1b3e-4f60-9d2a-000000000002.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',64120,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',1);

INSERT INTO companies (id, owner_user_id, owner_role, organisation_name, industry, company_size_band, website_url,
   hr_contact_name, hr_contact_email, company_status, approved_by_admin_id, approved_at, typical_roles_offered) VALUES
 (1,5,'Company','Nexlab Technologies','IT Services','51-200','https://nexlab.example','Neha Verma','hr@nexlab.example','Approved',1,'2026-01-05 11:00:00','Junior Developer, QA Trainee'),
 (2,6,'Company','Quantumsoft Solutions','FinTech','201-500','https://quantumsoft.example','Imran Qureshi','hr@quantumsoft.example','Pending',NULL,NULL,'Support Engineer');
INSERT INTO recruiter_profiles (user_id, company_id, designation, is_primary) VALUES (5,1,'Talent Lead',1);
INSERT INTO company_approvals (company_id, admin_user_id, decision, reason, reviewed_at) VALUES
 (1,1,'Approved',NULL,'2026-01-05 11:00:00');

INSERT INTO jobs (id, company_id, title, job_type, employment_mode, location, vacancy_count, package_declared, package_min, package_max,
   description, min_cgpa, cgpa_scale_required, max_active_backlogs, eligibility_snapshot_json, deadline, job_status, submitted_at,
   approved_by_admin_id, approved_at, created_at) VALUES
 (1,1,'Junior Frontend Developer','full_time','on_campus','Pune',4,1,4.50,6.00,
  'Build and maintain React interfaces for internal products, working with the backend team on API integration.',
  7.00,10.00,0,'{"min_cgpa":7.0,"scale":10.0,"max_backlogs":0,"departments":[1,2]}',
  '2026-03-20 18:00:00','Approved','2026-02-01 10:00:00',1,'2026-02-02 09:30:00','2026-02-01 09:00:00'),
 (2,1,'QA Intern','internship','hybrid','Pune',6,0,NULL,NULL,
  'Manual and basic automation testing for a payments module. 3-month internship with PPO.',
  6.00,10.00,1,'{"min_cgpa":6.0,"scale":10.0,"max_backlogs":1,"departments":[]}',
  '2026-03-25 18:00:00','Approved','2026-02-03 10:00:00',1,'2026-02-04 09:00:00','2026-02-03 09:00:00'),
 (3,2,'Support Engineer','full_time','remote','Mumbai',2,1,3.60,3.60,
  'L1 support for a fintech dashboard.',NULL,10.00,255,'{"min_cgpa":null,"scale":10.0,"max_backlogs":255,"departments":[]}',
  '2026-02-10 18:00:00','Pending Approval','2026-02-05 10:00:00',NULL,NULL,'2026-02-05 10:00:00');
INSERT INTO job_skills (job_id, skill_id, is_required) VALUES (1,3,1),(1,2,1),(1,6,1),(1,1,0),(2,2,0),(2,7,1);
INSERT INTO job_departments (job_id, department_id) VALUES (1,1),(1,2);
INSERT INTO job_qualifications (job_id, qualification_level_id) VALUES (1,1),(1,2),(2,3);

INSERT INTO applications (id, student_user_id, student_profile_id, job_id, company_id, resume_id, status,
   declaration_accepted_at, eligibility_snapshot_json, applied_at, last_status_change_at) VALUES
 (1,2,2,1,1,1,'Interview Scheduled','2026-02-05 09:00:00',
  '{"cgpa":8.40,"scale":10.0,"backlogs":0,"min_cgpa_required":7.0,"eligible":true,"failed_rule":null}',
  '2026-02-05 09:00:00','2026-02-12 15:00:00'),
 (2,3,3,2,1,2,'Not Shortlisted','2026-02-06 11:00:00',
  '{"cgpa":6.40,"scale":10.0,"backlogs":1,"min_cgpa_required":6.0,"eligible":true,"failed_rule":null}',
  '2026-02-06 11:00:00','2026-02-14 10:00:00'),
 (3,4,4,1,1,NULL,'Under Review',NULL,'{"cgpa":7.80,"scale":10.0,"backlogs":0,"min_cgpa_required":7.0,"eligible":true,"failed_rule":null}',
  '2026-02-07 09:30:00','2026-02-08 09:00:00');

INSERT INTO application_status_history (application_id, from_status, to_status, changed_by_user_id, actor_role, is_correction, reason, changed_at) VALUES
 (1,NULL,'Applied',2,'Student',0,NULL,'2026-02-05 09:00:00'),
 (1,'Applied','Under Review',5,'Company',0,NULL,'2026-02-08 09:00:00'),
 (1,'Under Review','Shortlisted',5,'Company',0,NULL,'2026-02-10 11:00:00'),
 (1,'Shortlisted','Interview Scheduled',5,'Company',0,'Round 1 on 22 Feb, campus lab 3','2026-02-12 15:00:00'),
 (2,NULL,'Applied',3,'Student',0,NULL,'2026-02-06 11:00:00'),
 (2,'Applied','Under Review',5,'Company',0,NULL,'2026-02-09 10:00:00'),
 (2,'Under Review','Not Shortlisted',5,'Company',0,NULL,'2026-02-14 10:00:00'),
 (3,NULL,'Applied',4,'Student',0,NULL,'2026-02-07 09:30:00'),
 (3,'Applied','Under Review',5,'Company',0,NULL,'2026-02-08 09:00:00');

INSERT INTO notifications (recipient_user_id, event_type, title, message, related_entity_type, related_entity_id, is_read, is_non_deletable) VALUES
 (2,'APPLICATION_STATUS_CHANGED','Application updated','Your application to Nexlab Technologies - Junior Frontend Developer is now Interview Scheduled.','application',1,0,1),
 (3,'APPLICATION_STATUS_CHANGED','Application updated','Your application to Nexlab Technologies - QA Intern is now Not Shortlisted. Check the timeline for details.','application',2,0,1),
 (5,'APPLICATION_SUBMITTED','New applicant','Aarav Sharma applied for Junior Frontend Developer.','application',1,1,0),
 (1,'JOB_APPROVED','Job approved','Junior Frontend Developer by Nexlab Technologies was approved and published.','job',1,1,0),
 (6,'COMPANY_APPROVED','Awaiting verification','Your company Quantumsoft Solutions is still pending review.','company',2,0,0);

INSERT INTO job_notifications (job_id, notification_id, recipient_user_id) VALUES (1,4,2);
INSERT INTO announcements (admin_user_id, title, body, target_type, published_at) VALUES
 (1,'Pre-placement talk','PPT for Nexlab on 18 Feb, 3 PM, seminar hall.','all','2026-02-10 10:00:00');
INSERT INTO settings (setting_key, setting_value, value_type, description, updated_by_user_id) VALUES
 ('ai_enabled','true','boolean','Global AI kill switch (FR-AI-GEN-05)',1),
 ('ai_daily_quota_per_student','8','number','Per-user per-day AI request cap',1),
 ('max_resume_mb','3','number','Upload size cap (FR-FILE-03)',1),
 ('allowed_file_types','["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]','json','Allow-list (FR-FILE-01)',1),
 ('package_bands','["0-3","3-6","6-10","10+"]','json','FR-ANA-07 band definitions',1);

INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, summary, performed_at) VALUES
 (1,'COMPANY_APPROVE','company',1,'Approved Nexlab Technologies','2026-01-05 11:00:00'),
 (1,'JOB_APPROVE','job',1,'Approved Junior Frontend Developer','2026-02-02 09:30:00');

INSERT INTO ai_resume_analyses (resume_id, requested_by_user_id, readiness_band, band_definition, issue_count,
   strengths_json, weaknesses_json, next_actions_json, input_content_hash, profile_completeness_snapshot,
   ai_model_label, disclaimer_text) VALUES
 (1,2,'Reasonable','Core sections present; several claims lack quantified evidence',3,
  '["Three listed projects with a stated outcome","Deployment evidence present"]',
  '["Skills list has no proficiency levels","No certifications section"]',
  '["Quantify project impact in one line each","Move skills above education","Add one certification"]',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',72,'gemini-flash (demo)','Advisory only. Not a prediction of selection or hiring.');

INSERT INTO ai_match_runs (student_user_id, method, eligible_job_count, ai_model_label, disclaimer_text, profile_completeness_snapshot)
 VALUES (2,'ai_ranked',2,'gemini-flash (demo)','Advisory only. Not a prediction of selection or hiring.',72);
INSERT INTO ai_match_results (match_run_id, student_user_id, job_id, relevance_band, relevance_score, rank_in_run, why_text, why_not_text, matched_count, missing_required_count) VALUES
 (1,2,1,'Strong',88.00,1,'React, JavaScript and HTML/CSS are all evidenced in your listed projects.','Package is at the lower end for a front-end role.',3,0),
 (1,2,2,'Good',61.00,2,'You meet the CGPA bar and have relevant internship-scale project work.','Testing is not shown anywhere in your documents.',1,1);
INSERT INTO ai_match_skill_items (match_result_id, skill_id, item_type, evidence_note) VALUES
 (1,3,'matched','Project: Campus Placement Tracker'),(1,2,'matched','Resume: 2 years coursework'),(1,6,'matched','Project 2'),
 (2,2,'matched','Resume listing'),(2,7,'missing_required','Not evidenced anywhere');

INSERT INTO ai_skill_gap_runs (student_user_id, target_job_id, missing_count, partial_count, summary_json, disclaimer_text) VALUES
 (2,2,1,1,'{"missing":1,"partial":1,"covered":1}','Advisory only. A job description is not a reliable map of what an interview will test.');
INSERT INTO ai_skill_gap_items (gap_run_id, skill_id, classification, requirement_level, priority, evidence_note, closure_suggestion) VALUES
 (1,7,'missing','required',1,NULL,'Practise writing a clear bug report for one of your own projects - that is evidence of communication.'),
 (1,2,'claimed_only','preferred',2,'Listed on the resume, no supporting project.','Add one small JS project so the claim becomes evidence.');

INSERT INTO ai_interview_prep_sessions (student_user_id, target_job_id, prep_mode, difficulty, question_count, status, completed_at)
 VALUES (2,1,'mixed','intermediate',2,'completed',NOW());
INSERT INTO ai_interview_questions (session_id, question_order, question_text, category, guidance_points_json, student_answer, feedback_text, cannot_assess_note) VALUES
 (1,1,'Walk me through how you stored data in your Campus Placement Tracker project.','project','["Mention schema and why","Mention one trade-off you made"]',
  'I used MySQL with students and jobs tables and a junction for applications.',
  'Good start: you named the schema. Add WHY you chose that structure and one problem you hit - that is what interviewers follow up on.',
  'Written answer only - speech, confidence and body language are not assessed.'),
 (1,2,'Why do you want a front-end role rather than a back-end role?','hr','["Be specific about your own work","Avoid generic praise of the company"]',
  NULL,NULL,NULL);

INSERT INTO ai_resume_improvements (student_user_id, source_resume_id, source_analysis_id, category, original_excerpt, suggested_excerpt,
   reason_text, requires_student_input, decision, created_resume_id, run_id, disclaimer_text) VALUES
 (2,1,1,'quantification','Worked on a placement tracking web app.',
  'Built a placement tracking web app used by 40 students in one semester (React, Node.js, MySQL).',
  'Adds the outcome figure already present in your project record - no new facts invented.',0,'accepted',3,'run-0001','Advisory only. Edit wording into your own voice.'),
 (2,1,1,'quantification','Improved application performance.',NULL,
  'I do not have a real number for this, and inventing one would be dishonest. Add the actual figure if you measured it.',1,'pending',NULL,'run-0001','Advisory only. Edit wording into your own voice.');

-- The resume produced by the ACCEPTED AI suggestion above: a NEW draft version,
-- the original (id 1) is untouched - this is BR-26 / FR-AI-IMP-04 in data form.
INSERT INTO resumes (id, student_id, version_label, original_filename, stored_path, file_type, file_size_bytes, content_hash, is_active) VALUES
 (3,2,'v3 - AI-assisted draft (pending review)','Aarav_Resume_v3_draft.pdf','/var/app/uploads/resumes/8f21c4a7-1b3e-4f60-9d2a-000000000003.pdf','application/pdf',291004,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',0);
