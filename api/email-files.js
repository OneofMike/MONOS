export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      clientName,
      clientEmail,
      businessName,
      fileName,
      fileType,
      content
    } = req.body || {};

    if (!fileName || !content) {
      return res.status(400).json({
        error: 'Missing file data'
      });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        error: 'RESEND_API_KEY is not configured'
      });
    }

    const subjectBusiness =
      businessName || 'New Website Client';

    const safeClientName =
      clientName || 'Website intake client';

    const safeClientEmail =
      clientEmail || 'Not provided';

    const resendResponse = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          from:
            process.env.MONOS_FROM_EMAIL ||
            'MONOS Intake <onboarding@resend.dev>',

          to: [
            'mikepd102002@gmail.com'
          ],

          reply_to:
            clientEmail || undefined,

          subject:
            `MONOS Website Files — ${subjectBusiness}`,

          text:
`New MONOS website intake file

Client: ${safeClientName}
Client email: ${safeClientEmail}
Business: ${subjectBusiness}
File: ${fileName}

This attachment came from Section 06 of the MONOS website intake form.`,

          attachments: [
            {
              filename: fileName,
              content
            }
          ]
        })
      }
    );

    const result =
      await resendResponse
        .json()
        .catch(() => ({}));

    if (!resendResponse.ok) {
      console.error(
        'Resend error:',
        result
      );

      return res.status(500).json({
        error:
          result.message ||
          'Could not send file email'
      });
    }

    return res.status(200).json({
      ok: true,
      id: result.id || null
    });

  } catch (error) {
    console.error(
      'Email file upload failed:',
      error
    );

    return res.status(500).json({
      error:
        'Could not send uploaded file'
    });
  }
}
