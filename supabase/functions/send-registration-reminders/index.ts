import { adminClient, pushStatus, secretKey, sendReminder, vapidPublicKey } from '../_shared/reminder-push.ts';

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = secretKey();
  if (!secret || request.headers.get('apikey') !== secret) return new Response('Unauthorized', { status: 401 });
  try {
    vapidPublicKey(); // Verify configuration before claiming reminders.
    if (!Deno.env.get('WEB_PUSH_PRIVATE_KEY') || !Deno.env.get('WEB_PUSH_SUBJECT')) throw new Error('VAPID secrets missing');
    const admin = adminClient();
    let claimed = 0, accepted = 0, invalid = 0, failed = 0;
    for (let batch = 0; batch < 10; batch++) {
      const { data, error } = await admin.rpc('claim_due_registration_reminders');
      if (error) throw error;
      if (!data?.length) break;
      claimed += data.length;
      for (let offset = 0; offset < data.length; offset += 10) {
        await Promise.all(data.slice(offset, offset + 10).map(async row => {
          try {
            await sendReminder(row);
            accepted++;
          } catch (err) {
            const status = pushStatus(err);
            if (status === 404 || status === 410) {
              invalid++;
              await admin.from('reminder_subscriptions').update({ enabled: false }).eq('id', row.id);
            } else {
              failed++;
              console.error('Reminder push failed with status', status || 'unknown');
            }
          }
        }));
      }
      if (data.length < 100) break;
    }
    console.log('Registration reminders', { claimed, accepted, invalid, failed });
    return Response.json({ claimed, accepted, invalid, failed });
  } catch (error) {
    console.error('Registration reminder batch failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Reminder batch unavailable' }, { status: 503 });
  }
});
