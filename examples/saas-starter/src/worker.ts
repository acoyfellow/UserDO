import { createUserDOWorker, UserDO } from 'userdo';
import { z } from 'zod';
import type { Context } from 'hono';
import { createStripeClient } from 'alchemy/stripe';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Schema to store Stripe info per user
const BillingSchema = z.object({
  customerId: z.string(),
  subscriptionId: z.string(),
  active: z.boolean()
});

export class SaaSDO extends UserDO {
  billing = this.table('billing', BillingSchema, { userScoped: true });

  async setSubscription(customerId: string, subscriptionId: string, status: string) {
    await this.updateSubscription(customerId, subscriptionId, status);
  }

  async updateSubscription(customerId: string, subscriptionId: string, status: string) {
    await this.billing.put('plan', {
      customerId,
      subscriptionId,
      active: isActiveStatus(status)
    });
  }
}

// Export for Durable Object binding
export { SaaSDO as UserDO };

const app = createUserDOWorker('SAAS_DO');

const stripe = createStripeClient();

const sanitizePrompt = (input: string) =>
  input
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/\n+/)
    .filter((line) => !/^\s*(system|assistant|user)\s*[:;]/i.test(line))
    .join(' ')
    .slice(0, 1000);

const isActiveStatus = (status: string) =>
  ['active', 'trialing', 'past_due'].includes(status);

const subscribe = async (priceId: string, email: string) => {
  return await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    customer_email: email,
    client_reference_id: email,
    subscription_data: { metadata: { email } },
    line_items: [{ price: priceId, quantity: 1 }]
  });
};

app.post('/api/subscribe', async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const session = await subscribe(
    c.env.STRIPE_PRICE_ID,
    user.email
  );

  return c.json({ url: session.url });
});

app.post('/api/stripe', async (c: Context) => {
  const signature = c.req.header('stripe-signature') || '';
  const payload = await c.req.text();

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, c.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const email = session.client_reference_id;
      if (email && session.customer && session.subscription) {
        const userDO = c.env.SAAS_DO.get(c.env.SAAS_DO.idFromName(email));
        await userDO.setSubscription(
          session.customer,
          session.subscription,
          'active'
        );
      }
      break;
    }
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      const email = sub.metadata?.email;
      if (email) {
        const userDO = c.env.SAAS_DO.get(c.env.SAAS_DO.idFromName(email));
        await userDO.updateSubscription(sub.customer, sub.id, sub.status);
      }
      break;
    }
  }

  return c.json({ received: true });
});

app.post('/api/ask', async (c: Context) => {
  const { prompt } = await c.req.json();
  const clean = sanitizePrompt(String(prompt));
  const { text } = await generateText({
    model: openai('gpt-4o', { apiKey: c.env.OPENAI_API_KEY }),
    prompt: clean,
    system: 'You are a helpful assistant for our SaaS.'
  });
  return c.json({ text });
});

export default app;
