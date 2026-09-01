export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentIntentId } = req.body || {};

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' });
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(400).json({
        error: result.error?.message || 'Unable to cancel payment'
      });
    }

    return res.status(200).json({
      canceled: true,
      paymentIntentId: result.id
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Server error'
    });
  }
}
