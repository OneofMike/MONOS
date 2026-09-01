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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({
        error: 'Google Sheets webhook is not configured'
      });
    }

   
const data = req.body || {};

let payload;

if (data.action === 'payment_update') {
  let name = '';
  let email = '';

  if (data.paymentIntentId && process.env.STRIPE_SECRET_KEY) {
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/${data.paymentIntentId}?expand[]=payment_method`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      }
    );

    if (stripeResponse.ok) {
      const paymentIntent = await stripeResponse.json();

      const billingDetails =
        paymentIntent.payment_method?.billing_details || {};

      name = billingDetails.name || '';
      email =
        billingDetails.email ||
        paymentIntent.receipt_email ||
        '';
    }
  }

  payload = {
    action: 'payment_update',
    submissionId: data.submissionId || '',
    name,
    email,
    package: data.package || '',
    paymentStatus: data.paymentStatus || 'Paid',
    paymentIntentId: data.paymentIntentId || ''
  };

} else {
  payload = {
    submissionId: data.submissionId || '',
    firstName: data.firstName || '',
lastName: data.lastName || '',
email: data.email || '',
    problem: data.problem || '',
    helpType: data.helpType || '',
    difficult: Array.isArray(data.difficult) ? data.difficult : [],
    success: data.success || '',
    materials: Array.isArray(data.materials) ? data.materials : [],
    storage: data.storage || '',
    actions: Array.isArray(data.actions) ? data.actions : [],
    device: data.device || '',
    users: data.users || '',
    style: Array.isArray(data.style) ? data.style : [],
    files: Array.isArray(data.files) ? data.files : []
  };
}
   
    const googleResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!googleResponse.ok) {
      const text = await googleResponse.text();

      return res.status(502).json({
        error: 'Google Sheets request failed',
        details: text
      });
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error('Intake submission error:', error);

    return res.status(500).json({
      error: 'Failed to submit intake'
    });
  }
}
