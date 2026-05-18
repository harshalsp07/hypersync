-- ═══════════════════════════════════════════════════════════════════
-- HyperSync Engine — Rooms & Membership
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE rooms (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL
                        CONSTRAINT room_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
    slug              TEXT UNIQUE NOT NULL
                        CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]{3,64}$'),
    description       TEXT,
    created_by        UUID NOT NULL REFERENCES users(id),
    room_type         TEXT NOT NULL DEFAULT 'workspace'
                        CHECK (room_type IN ('workspace', 'video-room', 'whiteboard', 'code-lab')),
    max_participants  INT NOT NULL DEFAULT 50
                        CONSTRAINT valid_max CHECK (max_participants BETWEEN 1 AND 500),
    is_encrypted      BOOLEAN NOT NULL DEFAULT false,
    is_archived       BOOLEAN NOT NULL DEFAULT false,
    settings          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_slug ON rooms(slug);
CREATE INDEX idx_rooms_creator ON rooms(created_by);
CREATE INDEX idx_rooms_type ON rooms(room_type) WHERE NOT is_archived;
CREATE INDEX idx_rooms_active ON rooms(updated_at DESC) WHERE NOT is_archived;

CREATE TABLE room_members (
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by  UUID REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen   TIMESTAMPTZ,
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_members_user ON room_members(user_id);
CREATE INDEX idx_members_room_role ON room_members(room_id, role);

CREATE TRIGGER trg_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
