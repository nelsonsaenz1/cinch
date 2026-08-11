-- An alert that could not be delivered must not count as delivered.
--
-- `claim_commerce_alert` records the send in the same statement that decides
-- whether to send, which is right for concurrency and wrong for failure: the
-- claim is taken before the mail is attempted, so a Resend outage consumed the
-- cooldown and the condition then stayed silent for the full window. The alert
-- that mattered most — the one that fired while the mail provider was also
-- unhealthy — was exactly the one guaranteed to be swallowed.
--
-- Found by testing the path rather than by reading it: the alert fired, the
-- claim was recorded, Resend returned 400, and nothing would have fired again
-- for 24 hours.
--
-- So the caller releases the claim when delivery fails, and the next tick
-- retries. The claim is still taken first — two concurrent checks must not both
-- send — it is simply given back.

create function release_commerce_alert(p_key text)
returns void
language sql security definer set search_path = '' as $$
  -- Restores the previous state rather than deleting the row, so `send_count`
  -- keeps counting genuine attempts. A row that never had a successful send
  -- has its count returned to zero-by-deletion; one that did keeps its history.
  delete from public.commerce_alert_sends
   where key = p_key and send_count <= 1;

  update public.commerce_alert_sends
     set last_sent_at = last_sent_at - interval '100 years',
         send_count   = send_count - 1
   where key = p_key and send_count > 1;
$$;

revoke execute on function release_commerce_alert(text)
  from public, anon, authenticated;
