-- Invoker functions; only the server service role may call these RPCs.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#7B61FF',
  icon TEXT DEFAULT '📌',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_shares (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  deadline TEXT DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  link TEXT DEFAULT '',
  checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  checked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Sem título',
  content    TEXT NOT NULL DEFAULT '',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_user_id_idx          ON notes (user_id);
CREATE INDEX IF NOT EXISTS notes_user_pinned_updated  ON notes (user_id, pinned DESC, updated_at DESC);
CREATE TABLE IF NOT EXISTS routine_items (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_items_user_active_sort
  ON routine_items (user_id, active, sort_order);
CREATE TABLE IF NOT EXISTS routine_checks (
  id              TEXT PRIMARY KEY,
  routine_item_id TEXT NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  check_date      DATE NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_checks_unique_per_day UNIQUE (routine_item_id, check_date)
);
CREATE INDEX IF NOT EXISTS routine_checks_user_date
  ON routine_checks (user_id, check_date);
CREATE INDEX IF NOT EXISTS routine_checks_item_date
  ON routine_checks (routine_item_id, check_date);
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_checks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_alive_idx
  ON users (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS projects_alive_idx
  ON projects (created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_alive_idx
  ON tasks (project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notes_alive_idx
  ON notes (user_id, pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#7B61FF',
  icon        TEXT DEFAULT '🗂️',
  owner_id    TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role    TEXT,
  action        TEXT NOT NULL,            
  resource      TEXT NOT NULL,            
  resource_id   TEXT,
  metadata      JSONB,                    
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (resource, resource_id, created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_access_content BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS content_items (
  id                 TEXT PRIMARY KEY,
  title              TEXT DEFAULT '',
  body               TEXT NOT NULL DEFAULT '',
  format             TEXT NOT NULL DEFAULT 'post'
    CHECK (format IN ('post','carousel','video_short','video_long','script_class','email','thread','other')),
  status             TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','in_production','published','archived')),
  platform           TEXT
    CHECK (platform IS NULL OR platform IN ('instagram','linkedin','youtube','tiktok','newsletter','multiple','other')),
  target_audience    TEXT DEFAULT '',
  hook               TEXT DEFAULT '',
  cta                TEXT DEFAULT '',
  subject_line       TEXT DEFAULT '',
  preview_text       TEXT DEFAULT '',
  duration_seconds   INTEGER,
  tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  linked_task_id     TEXT REFERENCES tasks(id)    ON DELETE SET NULL,
  scheduled_for      TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  published_url      TEXT DEFAULT '',
  created_by         TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to        TEXT REFERENCES users(id)          ON DELETE SET NULL,
  last_edited_by     TEXT REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS content_items_alive_idx
  ON content_items (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_status_idx
  ON content_items (status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_assignee_idx
  ON content_items (assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_scheduled_idx
  ON content_items (scheduled_for) WHERE deleted_at IS NULL AND scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_items_tags_idx
  ON content_items USING GIN (tags) WHERE deleted_at IS NULL;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS content_slides (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  slide_number    INTEGER NOT NULL DEFAULT 1,
  title           TEXT DEFAULT '',
  body            TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_slides_item_idx
  ON content_slides (content_item_id, sort_order);
ALTER TABLE content_slides ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS content_comments (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_comments_item_idx
  ON content_comments (content_item_id, created_at DESC);
ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS content_status_history (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  changed_by      TEXT NOT NULL REFERENCES users(id),
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_status_history_item_idx
  ON content_status_history (content_item_id, created_at DESC);
ALTER TABLE content_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS content_items_workspace_idx
  ON content_items (workspace_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7B61FF',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tags_alive_idx
  ON tags (created_at) WHERE deleted_at IS NULL;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tag_ids        JSONB     DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date     TEXT      DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC(6,2);
CREATE INDEX IF NOT EXISTS tasks_tag_ids_idx
  ON tasks USING GIN (tag_ids)
  WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS task_groups (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#15708C',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_groups_project ON task_groups(project_id) WHERE deleted_at IS NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES task_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS asset_links (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  description  TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   TEXT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_links_workspace_idx
  ON asset_links (workspace_id, sort_order, created_at);
ALTER TABLE asset_links ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),          
  actor_id    TEXT REFERENCES users(id),                    
  type        TEXT NOT NULL DEFAULT 'mention',
  task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,                                
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, read, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS task_comments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx
  ON task_comments (task_id, created_at);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS task_attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by   TEXT NOT NULL REFERENCES users(id),
  file_name     TEXT NOT NULL,            
  storage_path  TEXT NOT NULL,            
  mime_type     TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx
  ON task_attachments (task_id, created_at);
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,            
  summary     TEXT,                     
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meeting_transcriptions_user_idx
  ON meeting_transcriptions (user_id, created_at DESC);
ALTER TABLE meeting_transcriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE routine_items ADD COLUMN IF NOT EXISTS days integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
ALTER TABLE routine_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS slack_channels (
  project_id text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  webhook_url text NOT NULL, canal_nome text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION can_access_project(p_user_id text, p_project_id text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
 SELECT EXISTS (
  SELECT 1 FROM projects p JOIN users u ON u.id=p_user_id AND u.deleted_at IS NULL
  WHERE p.id=p_project_id AND p.deleted_at IS NULL
  AND (p.workspace_id IS NULL OR EXISTS (SELECT 1 FROM workspaces w WHERE w.id=p.workspace_id AND w.deleted_at IS NULL))
  AND CASE WHEN p.id LIKE 'personal-%' THEN p.owner_id=u.id
  ELSE u.role='admin' OR p.owner_id=u.id
    OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.assigned_to=u.id AND t.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM project_shares s WHERE s.project_id=p.id AND s.user_id=u.id)
    OR (EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id=p.workspace_id AND m.user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM project_shares s WHERE s.project_id=p.id))
  END
 );
$$;
CREATE OR REPLACE FUNCTION get_user_projects(p_user_id text) RETURNS SETOF projects
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT p.* FROM projects p WHERE can_access_project(p_user_id,p.id) ORDER BY p.created_at,p.id;
$$;
CREATE OR REPLACE FUNCTION get_user_tasks(p_user_id text) RETURNS SETOF tasks
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT t.* FROM tasks t WHERE t.deleted_at IS NULL AND can_access_project(p_user_id,t.project_id) ORDER BY t.created_at DESC,t.id;
$$;

-- One consistent completion rule, including personal tasks and direct updates.
CREATE OR REPLACE FUNCTION normalize_task_state() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   NEW.checked := NEW.status='done';
   IF NEW.checked THEN NEW.completed_at:=now(); END IF;
 ELSE
   IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.checked:=NEW.status='done';
   ELSIF NEW.checked IS DISTINCT FROM OLD.checked THEN NEW.status:=CASE WHEN NEW.checked THEN 'done' ELSE 'todo' END;
   END IF;
   IF NEW.status='done' AND OLD.status<>'done' THEN NEW.completed_at:=now();
   ELSIF NEW.status<>'done' THEN NEW.completed_at:=NULL; END IF;
   NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_normalize_state ON tasks;
CREATE TRIGGER tasks_normalize_state BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION normalize_task_state();
-- Resolve historical disagreement using status as the source of truth; do not invent completion dates.
UPDATE tasks SET checked=(status='done') WHERE checked IS DISTINCT FROM (status='done');

CREATE OR REPLACE FUNCTION save_task(p_id text, p_patch jsonb, p_expected timestamptz DEFAULT NULL,
 p_checklist jsonb DEFAULT NULL, p_subtasks jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE old_task tasks; next_task tasks;
BEGIN
 SELECT * INTO old_task FROM tasks WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE='P0002'; END IF;
 IF p_expected IS NOT NULL AND old_task.updated_at IS DISTINCT FROM p_expected THEN
   RAISE EXCEPTION 'Task changed' USING ERRCODE='40001';
 END IF;
 next_task := jsonb_populate_record(old_task, p_patch);
 IF next_task.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_groups WHERE id=next_task.group_id AND project_id=next_task.project_id AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Invalid task group' USING ERRCODE='23514';
 END IF;
 UPDATE tasks SET title=next_task.title,description=next_task.description,status=next_task.status,
 priority=next_task.priority,deadline=next_task.deadline,start_date=next_task.start_date,
 estimate_hours=next_task.estimate_hours,tag_ids=next_task.tag_ids,project_id=next_task.project_id,
 group_id=next_task.group_id,assigned_to=next_task.assigned_to,link=next_task.link,checked=next_task.checked
 WHERE id=p_id RETURNING * INTO next_task;
 IF p_checklist IS NOT NULL THEN
   DELETE FROM checklist_items WHERE task_id=p_id;
   INSERT INTO checklist_items(id,task_id,text,done,sort_order)
   SELECT COALESCE(NULLIF(e->>'id',''),'cl-'||gen_random_uuid()::text),p_id,e->>'text',COALESCE((e->>'done')::boolean,false),n-1
   FROM jsonb_array_elements(p_checklist) WITH ORDINALITY a(e,n);
 END IF;
 IF p_subtasks IS NOT NULL THEN
   DELETE FROM subtasks WHERE task_id=p_id;
   INSERT INTO subtasks(id,task_id,title,status,checked,sort_order)
   SELECT COALESCE(NULLIF(e->>'id',''),'st-'||gen_random_uuid()::text),p_id,e->>'title',COALESCE(e->>'status','todo'),COALESCE(e->>'status','todo')='done',n-1
   FROM jsonb_array_elements(p_subtasks) WITH ORDINALITY a(e,n);
 END IF;
 RETURN to_jsonb(next_task);
END $$;

CREATE OR REPLACE FUNCTION replace_project_shares(p_id text,p_ids text[]) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM projects WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=x AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Invalid user'; END IF;
 DELETE FROM project_shares WHERE project_id=p_id;
 INSERT INTO project_shares(project_id,user_id) SELECT p_id,x FROM (SELECT DISTINCT unnest(p_ids) x) a;
END $$;
CREATE OR REPLACE FUNCTION replace_workspace_members(p_id text,p_ids text[]) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE owner text;
BEGIN
 SELECT owner_id INTO owner FROM workspaces WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace not found'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(p_ids||ARRAY[owner]) x WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=x AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Invalid user'; END IF;
 DELETE FROM workspace_members WHERE workspace_id=p_id;
 INSERT INTO workspace_members(workspace_id,user_id) SELECT p_id,x FROM (SELECT DISTINCT unnest(p_ids||ARRAY[owner]) x) a;
END $$;
CREATE OR REPLACE FUNCTION delete_project_tree(p_id text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM projects WHERE id=p_id FOR UPDATE;
 UPDATE tasks SET deleted_at=now() WHERE project_id=p_id AND deleted_at IS NULL;
 UPDATE task_groups SET deleted_at=now() WHERE project_id=p_id AND deleted_at IS NULL;
 UPDATE projects SET deleted_at=now() WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION delete_task_group(p_id text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM task_groups WHERE id=p_id FOR UPDATE;
 UPDATE tasks SET group_id=NULL WHERE group_id=p_id;
 UPDATE task_groups SET deleted_at=now() WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION reorder_task_groups(p_project_id text,p_ids text[]) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM projects WHERE id=p_project_id FOR UPDATE;
 IF cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) OR EXISTS (SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM task_groups WHERE id=x AND project_id=p_project_id AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Invalid groups'; END IF;
 UPDATE task_groups g SET position=a.n-1,updated_at=now() FROM unnest(p_ids) WITH ORDINALITY a(id,n) WHERE g.id=a.id;
END $$;
CREATE OR REPLACE FUNCTION bootstrap_admin(p_user jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE u users;
BEGIN
 LOCK TABLE users IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM users) THEN RAISE EXCEPTION 'Setup already completed' USING ERRCODE='23505'; END IF;
 INSERT INTO users(id,username,name,password_hash,role,avatar)
 VALUES(p_user->>'id',p_user->>'username',p_user->>'name',p_user->>'password_hash','admin','👑') RETURNING * INTO u;
 INSERT INTO workspaces(id,name,owner_id) VALUES('ws-geral','Geral',u.id) ON CONFLICT DO NOTHING;
 INSERT INTO workspace_members(workspace_id,user_id) VALUES('ws-geral',u.id) ON CONFLICT DO NOTHING;
 RETURN to_jsonb(u);
END $$;
CREATE OR REPLACE FUNCTION transform_content_task(p_content_id text,p_project_id text,p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c content_items; task_id text;
BEGIN
 SELECT * INTO c FROM content_items WHERE id=p_content_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Content not found'; END IF;
 IF c.linked_task_id IS NOT NULL AND EXISTS(SELECT 1 FROM tasks WHERE id=c.linked_task_id AND deleted_at IS NULL) THEN
  RETURN jsonb_build_object('taskId',c.linked_task_id,'alreadyLinked',true);
 END IF;
 task_id:='task-'||gen_random_uuid()::text;
 INSERT INTO tasks(id,title,description,project_id,assigned_to,created_by,status,priority,deadline,link,checked)
 VALUES(task_id,COALESCE(NULLIF(btrim(c.title),''),'Nova tarefa'),c.body,p_project_id,COALESCE(c.assigned_to,p_user_id),p_user_id,'todo','medium','','',false);
 UPDATE content_items SET linked_task_id=task_id,linked_project_id=p_project_id,updated_at=now(),last_edited_by=p_user_id WHERE id=p_content_id;
 RETURN jsonb_build_object('taskId',task_id,'alreadyLinked',false);
END $$;
-- Atomic slide ordering locks the parent to serialize concurrent drags.
CREATE OR REPLACE FUNCTION reorder_content_slides(p_content_id text,p_ids text[]) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM content_items WHERE id=p_content_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Content not found'; END IF;
 IF cardinality(p_ids)<>(SELECT count(DISTINCT v) FROM unnest(p_ids) v)
 OR cardinality(p_ids)<>(SELECT count(*) FROM content_slides WHERE content_item_id=p_content_id AND id=ANY(p_ids))
 THEN RAISE EXCEPTION 'Invalid slides'; END IF;
 UPDATE content_slides s SET sort_order=x.n-1,slide_number=x.n
 FROM unnest(p_ids) WITH ORDINALITY x(id,n) WHERE s.id=x.id;
END $$;
CREATE OR REPLACE FUNCTION create_workspace(p_id text,p_name text,p_color text,p_icon text,p_owner text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO workspaces(id,name,color,icon,owner_id) VALUES(p_id,p_name,p_color,p_icon,p_owner);
 INSERT INTO workspace_members(workspace_id,user_id) VALUES(p_id,p_owner);
END $$;
-- Persist rate limits across restarts and future replicas; no raw usernames/IPs stored.
CREATE TABLE IF NOT EXISTS clareza_rate_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
ALTER TABLE clareza_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION consume_clareza_limit(p_key text,p_limit integer,p_window_ms integer) RETURNS integer
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r clareza_rate_limits;
BEGIN
 DELETE FROM clareza_rate_limits WHERE reset_at<now();
 INSERT INTO clareza_rate_limits(key,count,reset_at) VALUES(p_key,1,now()+p_window_ms*interval '1 millisecond')
 ON CONFLICT(key) DO UPDATE SET count=clareza_rate_limits.count+1 RETURNING * INTO r;
 IF r.count>p_limit THEN RETURN greatest(1,ceil(extract(epoch FROM r.reset_at-now()))::integer); END IF;
 RETURN 0;
END $$;
-- Schedule versions preserve future routine history when days/active are edited.
CREATE TABLE IF NOT EXISTS routine_schedule_history (
 routine_item_id text NOT NULL REFERENCES routine_items(id), effective_date date NOT NULL,
 days integer[] NOT NULL, active boolean NOT NULL, PRIMARY KEY(routine_item_id,effective_date)
);
ALTER TABLE routine_schedule_history ENABLE ROW LEVEL SECURITY;
INSERT INTO routine_schedule_history SELECT id,(created_at AT TIME ZONE 'America/Sao_Paulo')::date,days,active FROM routine_items ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION record_routine_schedule() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO routine_schedule_history VALUES(NEW.id,(now() AT TIME ZONE 'America/Sao_Paulo')::date,NEW.days,NEW.active AND NEW.deleted_at IS NULL)
 ON CONFLICT(routine_item_id,effective_date) DO UPDATE SET days=excluded.days,active=excluded.active;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS record_routine_schedule ON routine_items;
CREATE TRIGGER record_routine_schedule AFTER INSERT OR UPDATE OF days,active,deleted_at ON routine_items FOR EACH ROW EXECUTE FUNCTION record_routine_schedule();

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('can_access_project','get_user_projects','get_user_tasks','save_task','replace_project_shares','replace_workspace_members','delete_project_tree','delete_task_group','reorder_task_groups','bootstrap_admin','transform_content_task','normalize_task_state','reorder_content_slides','create_workspace','consume_clareza_limit','record_routine_schedule')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
GRANT ALL ON TABLE users,projects,project_shares,tasks,subtasks,checklist_items,notes,routine_items,routine_checks,workspaces,workspace_members,audit_logs,content_items,content_slides,content_comments,content_status_history,tags,task_groups,asset_links,notifications,task_comments,task_attachments,meeting_transcriptions,slack_channels,clareza_rate_limits,routine_schedule_history TO service_role;
CREATE INDEX IF NOT EXISTS tasks_completed_at_idx ON tasks(completed_at) WHERE deleted_at IS NULL AND status='done';
-- Storage is present on Supabase, absent on the disposable PostgreSQL test instance.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('task-attachments','task-attachments',false,52428800)
  ON CONFLICT(id) DO NOTHING;
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
