# clear-chat Edge Function

Deploy the function:

```sh
supabase functions deploy clear-chat
```

Set the admin password as a Supabase secret. Do not commit the real password:

```sh
supabase secrets set CHAT_ADMIN_PASSWORD="choose-a-long-password"
```

Confirm the Edge Function environment has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available. The service role key must stay server-side in Supabase secrets and must never be added to frontend code.

The same function also supports public pruning without the admin password. This keeps only the newest messages in a room:

```sh
curl -X POST "$SUPABASE_URL/functions/v1/clear-chat" \
  -H "Content-Type: application/json" \
  -d '{"action":"prune","room":"index","maxMessages":20}'
```
