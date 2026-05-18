-- ═══════════════════════════════════════════════════════════════════
-- HyperSync Engine — Media & Session Logs
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE room_media (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    media_type        TEXT NOT NULL
                        CHECK (media_type IN ('video', 'audio', 'hls-stream', 'youtube', 'mp4')),
    source_url        TEXT NOT NULL,
    title             TEXT,
    description       TEXT,
    duration_seconds  FLOAT,
    thumbnail_url     TEXT,
    added_by          UUID REFERENCES users(id),
    queue_position    INT NOT NULL DEFAULT 0,
    play_count        INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_room ON room_media(room_id, queue_position) WHERE is_active;

CREATE TABLE session_logs (
    id           BIGSERIAL PRIMARY KEY,
    room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    event_type   TEXT NOT NULL,
    metadata     JSONB,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_room_time ON session_logs(room_id, created_at DESC);
CREATE INDEX idx_session_user_time ON session_logs(user_id, created_at DESC);

CREATE TABLE user_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token  TEXT NOT NULL UNIQUE,
    refresh_token  TEXT UNIQUE,
    ip_address     INET,
    user_agent     TEXT,
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON user_sessions(session_token) WHERE expires_at > NOW();
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
