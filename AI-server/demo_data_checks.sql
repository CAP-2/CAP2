-- Demo AI data checks for the current defaultdb.sql schema.
-- Set the account you will use for the demo, then run the checks below.

SET @demo_account_id := 20;

SELECT
  a.id AS account_id,
  a.email,
  a.status AS account_status,
  COALESCE(a.person_id, ac.person_id) AS resolved_person_id,
  COALESCE(p.clan_id, ac.clan_id) AS resolved_clan_id,
  ac.status AS account_clan_status,
  p.display_name,
  c.clan_name
FROM accounts a
LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
LEFT JOIN people p ON p.id = COALESCE(a.person_id, ac.person_id)
LEFT JOIN clans c ON c.id = COALESCE(p.clan_id, ac.clan_id)
WHERE a.id = @demo_account_id;

SET @demo_person_id := (
  SELECT COALESCE(a.person_id, ac.person_id)
  FROM accounts a
  LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
  WHERE a.id = @demo_account_id
  ORDER BY ac.id ASC
  LIMIT 1
);

SET @demo_clan_id := (
  SELECT COALESCE(p.clan_id, ac.clan_id)
  FROM accounts a
  LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
  LEFT JOIN people p ON p.id = COALESCE(a.person_id, ac.person_id)
  WHERE a.id = @demo_account_id
  ORDER BY ac.id ASC
  LIMIT 1
);

SELECT COUNT(*) AS clan_count FROM clans;
SELECT COUNT(*) AS account_count FROM accounts WHERE status = 'active';
SELECT COUNT(*) AS active_account_clan_count FROM account_clans WHERE account_id = @demo_account_id AND status = 'active';

SELECT father.display_name AS father, mother.display_name AS mother
FROM children ch
JOIN families fam ON fam.id = ch.family_id AND fam.clan_id = @demo_clan_id
LEFT JOIN people father ON father.id = fam.father_id
LEFT JOIN people mother ON mother.id = fam.mother_id
WHERE ch.person_id = @demo_person_id;

SELECT child.id, child.display_name
FROM families fam
JOIN children ch ON ch.family_id = fam.id
JOIN people child ON child.id = ch.person_id
WHERE fam.clan_id = @demo_clan_id
  AND (fam.father_id = @demo_person_id OR fam.mother_id = @demo_person_id);

SELECT spouse.id, spouse.display_name
FROM families fam
JOIN people spouse ON spouse.id IN (fam.father_id, fam.mother_id) AND spouse.id <> @demo_person_id
WHERE fam.clan_id = @demo_clan_id
  AND (fam.father_id = @demo_person_id OR fam.mother_id = @demo_person_id);

SELECT sibling.id, sibling.display_name
FROM children me
JOIN children sibling_row ON sibling_row.family_id = me.family_id
JOIN people sibling ON sibling.id = sibling_row.person_id
WHERE me.person_id = @demo_person_id
  AND sibling.id <> @demo_person_id
  AND sibling.clan_id = @demo_clan_id;

SELECT DISTINCT gp.id, gp.display_name
FROM children my_row
JOIN families parent_fam ON parent_fam.id = my_row.family_id AND parent_fam.clan_id = @demo_clan_id
JOIN people parent_person ON parent_person.id IN (parent_fam.father_id, parent_fam.mother_id)
JOIN children parent_row ON parent_row.person_id = parent_person.id
JOIN families grand_fam ON grand_fam.id = parent_row.family_id AND grand_fam.clan_id = @demo_clan_id
JOIN people gp ON gp.id IN (grand_fam.father_id, grand_fam.mother_id)
WHERE my_row.person_id = @demo_person_id
  AND gp.clan_id = @demo_clan_id;

SELECT COUNT(*) AS living_member_count FROM people WHERE clan_id = @demo_clan_id AND (is_living = 1 OR death_date IS NULL);
SELECT COUNT(*) AS deceased_member_count FROM people WHERE clan_id = @demo_clan_id AND (is_living = 0 OR death_date IS NOT NULL);
SELECT COUNT(*) AS approved_post_count FROM posts WHERE clan_id = @demo_clan_id AND status = 'approved';
SELECT COUNT(*) AS event_count FROM events WHERE clan_id = @demo_clan_id;
SELECT COUNT(*) AS contribution_count FROM event_contributions ec JOIN events ev ON ev.id = ec.event_id WHERE ev.clan_id = @demo_clan_id;
SELECT COUNT(*) AS event_cost_count FROM event_costs cost JOIN events ev ON ev.id = cost.event_id WHERE ev.clan_id = @demo_clan_id;
SELECT COUNT(*) AS my_notification_count FROM notifications WHERE receiver_person_id = @demo_person_id;
SELECT COUNT(*) AS manager_announcement_count
FROM manager_announcements ma
JOIN accounts acc ON acc.id = ma.manager_account_id
LEFT JOIN people p ON p.id = acc.person_id
WHERE p.clan_id = @demo_clan_id
   OR EXISTS (
     SELECT 1 FROM account_clans ac
     WHERE ac.account_id = acc.id AND ac.clan_id = @demo_clan_id AND ac.status = 'active'
   );
