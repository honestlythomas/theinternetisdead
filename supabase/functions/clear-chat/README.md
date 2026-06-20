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
