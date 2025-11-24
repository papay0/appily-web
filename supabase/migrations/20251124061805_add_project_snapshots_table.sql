-- Create project_snapshots table for versioning AI-generated code
CREATE TABLE IF NOT EXISTS project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  description TEXT NOT NULL,
  r2_path TEXT NOT NULL, -- Path in R2: projects/{userId}/{projectId}/v{timestamp}/
  file_count INTEGER NOT NULL DEFAULT 0,
  total_size BIGINT NOT NULL DEFAULT 0, -- Size in bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique versions per project
  UNIQUE(project_id, version)
);

-- Add indexes for performance
CREATE INDEX idx_project_snapshots_project_id ON project_snapshots(project_id);
CREATE INDEX idx_project_snapshots_user_id ON project_snapshots(user_id);
CREATE INDEX idx_project_snapshots_created_at ON project_snapshots(created_at DESC);

-- Enable Row Level Security
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own snapshots
CREATE POLICY "Users can view their own project snapshots"
  ON project_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create snapshots for their own projects
CREATE POLICY "Users can create snapshots for their own projects"
  ON project_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own snapshots
CREATE POLICY "Users can delete their own project snapshots"
  ON project_snapshots
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE project_snapshots IS 'Stores version history of AI-generated project files stored in Cloudflare R2';
COMMENT ON COLUMN project_snapshots.r2_path IS 'R2 storage path prefix for this snapshot (e.g., projects/user-123/proj-456/v1732432685/)';
COMMENT ON COLUMN project_snapshots.version IS 'Sequential version number starting from 1';
