-- ============================================================================
--  PHASE 4 DESIGN VERIFICATION QUERIES
--  Each query has an EXPECTED RESULT. Run after schema.sql + seed_demo_data.sql.
--  If a query returns anything other than the expected result, the design (or
--  the application logic) is broken. These become Phase 19 test cases as-is.
-- ============================================================================

-- V-01  "exactly one active resume per student"  -> 0 rows
SELECT p.roll_number, COUNT(*) AS active_resumes
FROM student_profiles p JOIN resumes r ON r.student_id = p.id
WHERE r.deleted_at IS NULL AND r.is_active = 1
GROUP BY p.id HAVING COUNT(*) <> 1;

-- V-02  no duplicate applications per student+job  -> 0 rows
SELECT student_user_id, job_id, COUNT(*) c FROM applications
GROUP BY student_user_id, job_id HAVING COUNT(*) > 1;

-- V-03  a company must own every job its application points at  -> 0 rows
SELECT a.id
FROM applications a
JOIN jobs j     ON j.id = a.job_id
JOIN companies c ON c.id = j.company_id
WHERE a.company_id <> c.id;

-- V-04  current status in applications must equal the newest history row  -> 0 rows
SELECT a.id
FROM applications a
JOIN (SELECT application_id, to_status, MAX(changed_at) mx
      FROM application_status_history GROUP BY application_id) h
  ON h.application_id = a.id AND h.mx = a.last_status_change_at
WHERE a.status <> h.to_status;

-- V-05  only an APPROVED company may have an APPROVED job  -> 0 rows
SELECT j.id FROM jobs j JOIN companies c ON c.id = j.company_id
WHERE j.job_status = 'Approved' AND c.company_status <> 'Approved';

-- V-06  students must only ever hold Student-profile rows (sub-type FK proof) -> 0 rows
SELECT u.id FROM users u JOIN student_profiles p ON p.user_id = u.id
WHERE u.role <> 'Student';

-- V-07  no revoked token may still look valid (revocation state is complete) -> 0 rows
SELECT t.jti FROM user_tokens t
WHERE t.revoked_at IS NULL AND t.expires_at > NOW()
  AND (SELECT u.account_status FROM users u WHERE u.id = t.user_id) <> 'Active';

-- V-08  an AI result must always be labelled advisory  -> 0 rows
SELECT id FROM ai_resume_analyses WHERE is_advisory <> 1 OR disclaimer_text IS NULL;

-- V-09  AI rows must never exist on an invisible/decision column  -> 0 rows
SELECT COUNT(*) AS ai_rows FROM ai_match_results ar
JOIN jobs j ON j.id = ar.job_id
WHERE j.job_status IN ('Draft','Pending Approval','Rejected');

-- V-10  placement count is derived only from applications (BR-22)
SELECT COUNT(DISTINCT a.student_user_id) AS placed_students
FROM applications a WHERE a.status = 'Accepted';

-- V-11  placement percentage (FR-ANA-04) over ACTIVE students in one batch
SELECT
  COUNT(DISTINCT CASE WHEN a.status = 'Accepted' THEN a.student_user_id END) AS placed,
  COUNT(DISTINCT s.id) AS eligible_students,
  ROUND(100 * COUNT(DISTINCT CASE WHEN a.status='Accepted' THEN a.student_user_id END)
        / NULLIF(COUNT(DISTINCT s.id),0), 1) AS placement_pct
FROM student_profiles s
LEFT JOIN applications a ON a.student_user_id = s.user_id
JOIN users u ON u.id = s.user_id AND u.account_status = 'Active';

-- V-12  funnel per job (FR-ANA-03) - denominators shown on purpose
SELECT j.id, j.title,
       COUNT(a.id) AS applied,
       SUM(a.status IN ('Shortlisted','Interview Scheduled','Interview Completed','Offer Received','Accepted')) AS shortlisted,
       SUM(a.status IN ('Offer Received','Accepted')) AS offers,
       SUM(a.status = 'Accepted') AS accepted,
       CONCAT(ROUND(100*SUM(a.status='Shortlisted')/NULLIF(COUNT(a.id),0),1),'%') AS shortlist_rate
FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
GROUP BY j.id;

-- V-13  company-wise statistics (FR-ANA-05)
SELECT c.organisation_name,
       COUNT(DISTINCT j.id) AS jobs, COUNT(a.id) AS applications,
       SUM(a.status = 'Accepted') AS hires
FROM companies c
LEFT JOIN jobs j ON j.company_id = c.id
LEFT JOIN applications a ON a.job_id = j.id
WHERE c.company_status = 'Approved'
GROUP BY c.id;

-- V-14  skill demand vs supply (FR-ANA-08) - real skill ids, thanks to the junction rows
SELECT s.skill_name,
       COUNT(DISTINCT CASE WHEN js.is_required = 1 THEN js.job_id END) AS jobs_requiring,
       COUNT(DISTINCT ss.student_profile_id) AS students_claiming
FROM skills s
LEFT JOIN job_skills js ON js.skill_id = s.id AND js.job_id IN
       (SELECT id FROM jobs WHERE job_status = 'Approved')
LEFT JOIN student_skills ss ON ss.skill_id = s.id
GROUP BY s.id ORDER BY jobs_requiring DESC;

-- V-15  eligibility re-check for one student (the deterministic rule set, BR-09)
SELECT j.id, j.title, j.min_cgpa, j.max_active_backlogs,
  CASE WHEN p.cgpa_value >= j.min_cgpa AND p.active_backlogs <= j.max_active_backlogs
       THEN 'Eligible' ELSE 'Not eligible' END AS verdict,
  CASE WHEN p.cgpa_value < j.min_cgpa THEN CONCAT('CGPA ', p.cgpa_value, ' < required ', j.min_cgpa) END AS failed_rule
FROM jobs j
JOIN companies c ON c.id = j.company_id AND c.company_status = 'Approved'
CROSS JOIN student_profiles p
WHERE p.id = 2 AND j.job_status = 'Approved' AND j.deadline > NOW();

-- V-16  admin approval queue (FR-ADM-04)
SELECT j.id, j.title, c.organisation_name, j.submitted_at, j.deadline
FROM jobs j JOIN companies c ON c.id = j.company_id
WHERE j.job_status = 'Pending Approval' ORDER BY j.submitted_at;

-- V-17  stalled applications needing the admin (FR-ADM-05)
SELECT a.id, u.full_name, j.title, a.status,
       DATEDIFF(NOW(), a.last_status_change_at) AS days_since_update
FROM applications a
JOIN jobs j ON j.id = a.job_id
JOIN users u ON u.id = a.student_user_id
WHERE a.status = 'Under Review'
  AND a.last_status_change_at < DATE_SUB(NOW(), INTERVAL 14 DAY);

-- V-18  unread inbox counts (FR-NOT-04)
SELECT u.full_name, u.role,
       SUM(n.is_read = 0) AS unread
FROM users u LEFT JOIN notifications n ON n.recipient_user_id = u.id
GROUP BY u.id HAVING unread > 0;

-- V-19  profile completeness drift guard (the documented denormalisation risk)
SELECT p.id, p.cgpa_value, e.cgpa_value AS latest_education_cgpa
FROM student_profiles p
JOIN student_education e ON e.student_profile_id = p.id AND e.is_current = 1
WHERE p.cgpa_value IS NOT NULL AND e.cgpa_value IS NOT NULL AND p.cgpa_value <> e.cgpa_value;
