SELECT id, type, status, "createdAt"
FROM public."Submission"
ORDER BY "createdAt" DESC
LIMIT 5;

SELECT COUNT(*) AS total_claims FROM public."Claim";

SELECT COUNT(*) AS total_evidence FROM public."Evidence";
