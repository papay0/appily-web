-- Add use_convex column to projects table
-- Default to false for new projects (Convex disabled by default for simpler launch)
-- Backfill existing projects to true (they were created with Convex auto-enabled)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS use_convex BOOLEAN DEFAULT false;

-- Backfill existing projects to true since they were created with Convex enabled
UPDATE projects SET use_convex = true WHERE use_convex IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN projects.use_convex IS 'Whether Convex backend is enabled for this project. New projects default to false, existing projects backfilled to true.';
