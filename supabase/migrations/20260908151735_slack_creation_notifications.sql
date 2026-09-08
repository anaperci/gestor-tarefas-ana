BEGIN;
CREATE TABLE IF NOT EXISTS slack_group_channels (
 group_key text PRIMARY KEY CHECK(group_key='criacao'), webhook_url text NOT NULL,
 canal_nome text NOT NULL DEFAULT 'Criação', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS slack_task_outbox (
 task_id text PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lock_token uuid, locked_until timestamptz, delivered_at timestamptz,
 last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE slack_group_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_task_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON slack_group_channels,slack_task_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON slack_group_channels,slack_task_outbox TO service_role;
CREATE INDEX IF NOT EXISTS slack_task_outbox_pending_idx ON slack_task_outbox(next_attempt_at) WHERE status IN ('pending','processing');
CREATE OR REPLACE FUNCTION is_creation_group(p_name text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT translate(lower(btrim(normalize(p_name,NFC))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')='criacao';
$$;
-- Reuse a uniquely identifiable existing Creation webhook, even if its old project was removed.
-- Never overwrite an existing global connection or choose between conflicting destinations.
INSERT INTO slack_group_channels(group_key,webhook_url,canal_nome)
SELECT 'criacao',min(webhook_url),min(canal_nome) FROM slack_channels
WHERE is_creation_group(regexp_replace(btrim(canal_nome),'^#\s*','')) AND webhook_url<>''
HAVING count(DISTINCT webhook_url)=1
ON CONFLICT(group_key) DO NOTHING;
CREATE OR REPLACE FUNCTION queue_creation_slack(p_task_id text,p_force boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tasks t JOIN task_groups g ON g.id=t.group_id AND g.project_id=t.project_id
  JOIN projects p ON p.id=t.project_id LEFT JOIN workspaces w ON w.id=p.workspace_id
  WHERE t.id=p_task_id AND t.deleted_at IS NULL AND g.deleted_at IS NULL AND p.deleted_at IS NULL
  AND p.id NOT LIKE 'personal-%' AND (p.workspace_id IS NULL OR w.deleted_at IS NULL)
  AND is_creation_group(g.name)) THEN RETURN false; END IF;
 INSERT INTO slack_task_outbox(task_id,next_attempt_at) VALUES(p_task_id,now()+interval '10 seconds')
 ON CONFLICT(task_id) DO UPDATE SET status='pending',attempts=0,next_attempt_at=now()+interval '10 seconds',
 lock_token=NULL,locked_until=NULL,delivered_at=NULL,last_error=NULL
 WHERE slack_task_outbox.status='cancelled' OR (p_force AND slack_task_outbox.status IN ('failed','sent'));
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION queue_creation_slack_trigger() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM queue_creation_slack(NEW.id); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creation_slack_notification ON tasks;
CREATE TRIGGER creation_slack_notification AFTER INSERT OR UPDATE OF group_id,project_id ON tasks
 FOR EACH ROW EXECUTE FUNCTION queue_creation_slack_trigger();
-- Atomic leases allow recovery after worker restarts and exclude simultaneous consumers.
CREATE OR REPLACE FUNCTION claim_creation_slack() RETURNS SETOF slack_task_outbox
LANGUAGE sql SET search_path=public AS $$
 UPDATE slack_task_outbox q SET status='processing',lock_token=gen_random_uuid(),locked_until=now()+interval '120 seconds',attempts=q.attempts+1
 WHERE q.task_id=(SELECT task_id FROM slack_task_outbox WHERE
 (status='pending' AND next_attempt_at<=now()) OR (status='processing' AND locked_until<now())
 ORDER BY next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 RETURNING q.*;
$$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('is_creation_group','queue_creation_slack','queue_creation_slack_trigger','claim_creation_slack') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
