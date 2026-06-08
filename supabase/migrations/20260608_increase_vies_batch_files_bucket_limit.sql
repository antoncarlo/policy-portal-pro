-- Increase VIES batch staging bucket upload limit for real-world batches.
-- The VIES import flow uploads ZIP packages once to this staging bucket and
-- links practices to those staged objects, avoiding duplication in practice-documents.
-- A 500 MB limit supports larger batches while keeping an explicit safety bound.

UPDATE storage.buckets
SET file_size_limit = 524288000,
    allowed_mime_types = NULL
WHERE id = 'vies-batch-files';

UPDATE storage.buckets
SET file_size_limit = 524288000,
    allowed_mime_types = NULL
WHERE id = 'practice-documents';
