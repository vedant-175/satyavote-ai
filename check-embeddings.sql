SELECT
    COUNT(*) AS total_claims,
    COUNT(*) FILTER (WHERE embedding IS NULL) AS null_embeddings
FROM public."Claim";
