-- ═══════════════════════════════════════════════════════════════════
-- HyperSync Engine — Document Snapshots & History
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE document_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL
                      CHECK (doc_type IN ('text', 'whiteboard', 'code', 'metadata')),
    state_vector    BYTEA NOT NULL,
    snapshot_data   BYTEA NOT NULL,
    byte_size       INT NOT NULL,
    operation_count BIGINT NOT NULL DEFAULT 0,
    checksum        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, doc_type, created_at)
);

CREATE INDEX idx_doc_snap_room ON document_snapshots(room_id, doc_type, created_at DESC);
CREATE INDEX idx_doc_snap_size ON document_snapshots(byte_size DESC);

CREATE TABLE history_snapshots (
    id                BIGSERIAL PRIMARY KEY,
    room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    doc_type          TEXT NOT NULL,
    snapshot_ref      BYTEA NOT NULL,
    operation_count   BIGINT NOT NULL,
    active_user_count INT,
    event_label       TEXT,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_room_time ON history_snapshots(room_id, doc_type, created_at);
CREATE INDEX idx_history_room_ops ON history_snapshots(room_id, doc_type, operation_count);
