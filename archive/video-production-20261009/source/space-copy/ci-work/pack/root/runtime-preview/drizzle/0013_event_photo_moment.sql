-- 「同一刻，另一面」 photo facts: when a photo was taken and which side of the night it shows. All four columns are nullable and
-- additive: existing rows, old clients and photos uploaded without them keep working. Capture time only ever comes from the camera
-- (exif) or from the person (manual); a file's modification time is never sent. A viewpoint is the person's own choice; 'ai' only records
-- that they kept the on-device suggestion unchanged. Pairing, reasons and ordering are rules computed in the client, not stored here.
ALTER TABLE event_photos ADD COLUMN taken_at INTEGER CHECK (taken_at IS NULL OR (taken_at >= 946684800000 AND taken_at <= 32503680000000));
ALTER TABLE event_photos ADD COLUMN taken_source TEXT CHECK ((taken_source IS NULL) = (taken_at IS NULL) AND (taken_source IS NULL OR taken_source IN ('exif', 'manual')));
ALTER TABLE event_photos ADD COLUMN viewpoint TEXT CHECK (viewpoint IS NULL OR viewpoint IN ('stage', 'crowd', 'friends', 'detail'));
ALTER TABLE event_photos ADD COLUMN viewpoint_source TEXT CHECK ((viewpoint_source IS NULL) = (viewpoint IS NULL) AND (viewpoint_source IS NULL OR viewpoint_source IN ('ai', 'manual')));
CREATE INDEX event_photo_moment ON event_photos (room_id, taken_at) WHERE taken_at IS NOT NULL AND deleted_at IS NULL;
