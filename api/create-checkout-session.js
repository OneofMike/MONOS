
export default async function handler(req, res) {
  const allowedOrigins = [
    'https://oneofmike.github.io',
    'https://monos-beta.vercel.app',
    'https://builtbymonos.com',
    'https://www.builtbymonos.com',
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const { tier } = req.body || {};

    const tiers = {
      STARTER: {
        amount: 12500, // $125.00 in cents
        label: 'STARTER'
      }
    };

    const selected = tiers[tier];

    if (!selected) {
      return res.status(400).json({
        error: 'Invalid project tier'
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: 'Stripe secret key is not configured'
      });
    }

    const params = new URLSearchParams();

    params.append('amount', selected.amount.toString());
    params.append('currency', 'usd');
    params.append('automatic_payment_methods[enabled]', 'true');
    params.append('metadata[tier]', selected.label);

    const stripeResponse = await fetch(
      'https://api.stripe.com/v1/payment_intents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      }
    );

    const paymentIntent = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe error:', paymentIntent);

      return res.status(500).json({
        error: 'Unable to create payment'
      });
    }

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Checkout error:', error);

    return res.status(500).json({
      error: 'Server error'
    });
  }
}
