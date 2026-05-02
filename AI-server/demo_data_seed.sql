-- Optional demo seed for AI questions that need contributions, costs, and notifications.
-- Review @demo_account_id before running.

SET @demo_account_id := 20;

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

SET @demo_manager_account_id := (
  SELECT a.id
  FROM accounts a
  LEFT JOIN people p ON p.id = a.person_id
  LEFT JOIN account_clans ac ON ac.account_id = a.id AND ac.status = 'active'
  WHERE a.role_id = 2
    AND COALESCE(p.clan_id, ac.clan_id) = @demo_clan_id
  ORDER BY a.id ASC
  LIMIT 1
);

INSERT INTO events (clan_id, title, event_date, description)
SELECT @demo_clan_id, 'Su kien demo AI', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'Du lieu demo cho tro ly AI'
WHERE @demo_clan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM events WHERE clan_id = @demo_clan_id AND title = 'Su kien demo AI'
  );

SET @demo_event_id := (
  SELECT id
  FROM events
  WHERE clan_id = @demo_clan_id
  ORDER BY event_date DESC, id DESC
  LIMIT 1
);

INSERT INTO event_contributions (event_id, person_id, amount, contribution_date, method, note)
SELECT @demo_event_id, @demo_person_id, 500000, CURDATE(), 'Tien mat', 'Dong gop demo AI'
WHERE @demo_event_id IS NOT NULL
  AND @demo_person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM event_contributions
    WHERE event_id = @demo_event_id AND person_id = @demo_person_id AND note = 'Dong gop demo AI'
  );

INSERT INTO event_costs (event_id, item_name, amount, note)
SELECT @demo_event_id, 'Hoa va huong', 250000, 'Chi phi demo AI'
WHERE @demo_event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM event_costs
    WHERE event_id = @demo_event_id AND item_name = 'Hoa va huong' AND note = 'Chi phi demo AI'
  );

INSERT INTO notifications (receiver_person_id, type, title, message, link_url)
SELECT @demo_person_id, 'ai_demo', 'Thong bao demo AI', 'Day la thong bao demo de hoi AI.', '/member'
WHERE @demo_person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE receiver_person_id = @demo_person_id AND type = 'ai_demo'
  );

INSERT INTO manager_announcements (manager_account_id, title, content, priority)
SELECT @demo_manager_account_id, 'Thong bao quan ly demo AI', 'Noi dung thong bao demo cho tro ly AI.', 'normal'
WHERE @demo_manager_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manager_announcements
    WHERE manager_account_id = @demo_manager_account_id AND title = 'Thong bao quan ly demo AI'
  );
