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

  async setSubscription(customerId: string, subscriptionId: string) {
    await this.billing.put('plan', { customerId, subscriptionId, active: true });
  }
}

// Export for Durable Object binding
export { SaaSDO as UserDO };

const app = createUserDOWorker('SAAS_DO');

const stripe = createStripeClient();

const sanitizePrompt = (input: string) =>
  input.replace(/(system:|assistant:|user:)/gi, '').slice(0, 1000);

const subscribe = async (priceId: string, email: string) => {
  return await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    customer_email: email,
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
