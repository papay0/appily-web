-- Add bundle_url column to projects table for storing exported iOS bundle URL
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bundle_url TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN projects.bundle_url IS 'URL to the exported iOS bundle stored in R2, used for loading in appily-expo sandbox';
