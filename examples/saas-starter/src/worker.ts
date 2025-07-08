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
    const active = isActiveStatus(status);
    BillingSchema.parse({ customerId, subscriptionId, active });
    await this.billing.put('plan', {
      customerId,
      subscriptionId,
      active
    });
  }
}

// Export for Durable Object binding
export { SaaSDO as UserDO };

const app = createUserDOWorker('SAAS_DO');

const stripe = createStripeClient();

const sanitizePrompt = (input: string) => {
  const collapsed = input
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // collapse whitespace or newlines between prefix and colon
    .replace(/\b(system|assistant|user)\s*[\n\s]*:/gi, '$1:');
  return collapsed
    .split(/\r?\n+/)
    .filter((line) => !/^\s*(system|assistant|user)\s*:/i.test(line))
    .join(' ')
    .slice(0, 1000);
};

const isActiveStatus = (status: string) =>
  ['active', 'trialing', 'past_due'].includes(status);

const subscribe = async (
  priceId: string,
  email: string,
  success: string,
  cancel: string
) => {
  const customer = await stripe.customers.create({ email, metadata: { email } });
  return await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    success_url: success,
    cancel_url: cancel,
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
    user.email,
    c.env.SUCCESS_URL,
    c.env.CANCEL_URL
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        let email = session.client_reference_id || session.customer_email;
        if (!email && session.customer) {
          const cust = await stripe.customers.retrieve(session.customer);
          if (typeof cust === 'object' && 'email' in cust && cust.email) {
            email = cust.email as string;
          }
        }
        if (email && session.customer && session.subscription) {
          const userDO = c.env.SAAS_DO.get(c.env.SAAS_DO.idFromName(email));
          await userDO.setSubscription(
            session.customer,
            session.subscription,
            'active'
          );
          console.log('checkout completed for', email);
        }
        break;
      }
      case 'customer.subscription.created': {
        const sub = event.data.object as any;
        let email = sub.metadata?.email ?? sub.customer_email;
        if (!email && sub.customer) {
          const cust = await stripe.customers.retrieve(sub.customer);
          if (typeof cust === 'object' && 'email' in cust && cust.email) {
            email = cust.email as string;
          }
        }
        if (email) {
          const userDO = c.env.SAAS_DO.get(c.env.SAAS_DO.idFromName(email));
          await userDO.setSubscription(sub.customer, sub.id, sub.status);
          console.log('subscription created for', email);
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        let email = sub.metadata?.email ?? sub.customer_email;
        if (!email && sub.customer) {
          const cust = await stripe.customers.retrieve(sub.customer);
          if (typeof cust === 'object' && 'email' in cust && cust.email) {
            email = cust.email as string;
          }
        }
        if (email) {
          const userDO = c.env.SAAS_DO.get(c.env.SAAS_DO.idFromName(email));
          await userDO.updateSubscription(sub.customer, sub.id, sub.status);
          console.log('subscription updated for', email, sub.status);
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook update failed', err);
    return c.json({ error: 'Subscription update failed' }, 500);
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
