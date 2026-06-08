-- Increase practice document bucket limit to support larger ZIP attachments.
-- VIES batch imports now stage original ZIP files in the dedicated vies-batch-files bucket
-- and link them to practice_documents by bucket-qualified reference, avoiding duplicate uploads.
-- This limit still protects regular manual uploads while allowing realistic practice archives.

update storage.buckets
set file_size_limit = 524288000
where id = 'practice-documents'
  and (file_size_limit is null or file_size_limit < 524288000);
