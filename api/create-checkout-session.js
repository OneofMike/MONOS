
export default async function handler(req, res) {
  const allowedOrigins = [
    'https://oneofmike.github.io',
    'https://monos-beta.vercel.app',
    'https://builtbymonos.com',
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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
    const { tier } = req.body;

    const tiers = {
      STARTER: {
        amount: 12500, // $125.00
        label: 'STARTER'
      }
    };

    const selected = tiers[tier];

    if (!selected) {
      return res.status(400).json({
        error: 'Invalid project tier'
      });
    }

    const params = new URLSearchParams();

    params.append('mode', 'payment');
    params.append('payment_method_types[0]', 'card');

    params.append(
      'line_items[0][price_data][currency]',
      'usd'
    );

    params.append(
      'line_items[0][price_data][unit_amount]',
      selected.amount.toString()
    );

    params.append(
      'line_items[0][price_data][product_data][name]',
      'MONOS Custom Website'
    );

    params.append(
      'line_items[0][quantity]',
      '1'
    );

    params.append('metadata[tier]', selected.label);

    params.append(
      'success_url',
      'https://builtbymonos.com/payment-success?session_id={CHECKOUT_SESSION_ID}'
    );

    params.append(
      'cancel_url',
      'https://builtbymonos.com/#checkout'
    );

    const stripeResponse = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error(session);

      return res.status(500).json({
        error: 'Unable to create checkout session'
      });
    }

    return res.status(200).json({
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Server error'
    });
  }
}
