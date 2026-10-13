DELETE FROM public.user_profiles
WHERE LOWER(email) = 'group.pastor@cekorlebu.org'
  AND username = 'group.pastor'
  AND full_name = 'Pastor Joseph (Group Pastor)'
  AND role = 'Superadmin';
