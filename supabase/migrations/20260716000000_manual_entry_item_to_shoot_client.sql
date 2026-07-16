-- Manual entries now use shoot_client as the "Item" label (matching hourly's
-- shoot_client-as-label pattern); description becomes an optional sub-line.
-- Move existing manual entry text from description into shoot_client so old
-- entries keep rendering as the item, not the sub-line.
update entries
set shoot_client = description,
    description = null
where billing_type_snapshot = 'manual'
  and shoot_client is null
  and description is not null;
