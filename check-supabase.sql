SELECT current_database() AS database, current_user AS connected_as;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
