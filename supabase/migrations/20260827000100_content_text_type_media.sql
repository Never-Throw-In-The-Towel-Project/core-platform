-- ============================================================================
-- CONTENT `text` TYPE (2/2) — relax the media constraint.
-- ============================================================================
-- Now that `text` is a committed enum value, replace the media constraint so a
-- text item needs NO media (title + summary/body is the whole item). The three
-- media types are unchanged: video still needs a Vimeo id; document/image still
-- need an asset path or an external URL.
alter table public.content_items drop constraint content_items_media_for_type;

alter table public.content_items add constraint content_items_media_for_type check (
  (type = 'video'    and vimeo_id is not null)
  or (type = 'document' and (asset_path is not null or external_url is not null))
  or (type = 'image'    and (asset_path is not null or external_url is not null))
  or (type = 'text')
);
