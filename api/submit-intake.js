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
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const cleaningTableId = process.env.AIRTABLE_CLEANING_TABLE_ID;
    const eventTableId = process.env.AIRTABLE_EVENT_TABLE_ID;

    if (
      !airtableToken ||
      !airtableBaseId ||
      !cleaningTableId ||
      !eventTableId
    ) {
      return res.status(500).json({
        error: 'Airtable is not configured'
      });
    }

    const data = req.body || {};

    const isEvent =
      data.industry === 'Event Planning / Balloon Decor';

    const selectedTableId = isEvent
      ? eventTableId
      : cleaningTableId;

    // ----------------------------
    // PAYMENT UPDATE
    // ----------------------------
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

      const submissionId = data.submissionId || '';

      if (!submissionId) {
        return res.status(400).json({
          error: 'Submission ID is required'
        });
      }

      /*
       * Search BOTH intake tables.
       * This lets payment updates work regardless of which
       * intake the customer originally submitted.
       */
      const formula = encodeURIComponent(
        `{Submission ID}="${submissionId.replace(/"/g, '\\"')}"`
      );

      const tablesToSearch = [
        cleaningTableId,
        eventTableId
      ];

      let record = null;
      let paymentTableId = null;

      for (const tableId of tablesToSearch) {
        const searchResponse = await fetch(
          `https://api.airtable.com/v0/${airtableBaseId}/${tableId}?filterByFormula=${formula}&maxRecords=1`,
          {
            headers: {
              Authorization: `Bearer ${airtableToken}`
            }
          }
        );

        if (!searchResponse.ok) {
          const text = await searchResponse.text();

          return res.status(502).json({
            error: 'Could not find Airtable submission',
            details: text
          });
        }

        const searchData = await searchResponse.json();

        if (searchData.records?.[0]) {
          record = searchData.records[0];
          paymentTableId = tableId;
          break;
        }
      }

      if (!record || !paymentTableId) {
        return res.status(404).json({
          error: 'Submission not found in Airtable'
        });
      }

      const updateFields = {
        'Payment Status': data.paymentStatus || 'Paid'
      };

      if (data.package) {
        updateFields['Package'] = data.package;
      }

      if (data.paymentIntentId) {
        updateFields['Payment Intent ID'] = data.paymentIntentId;
      }

      if (name) {
        updateFields['Billing Name'] = name;
      }

      if (email) {
        updateFields['Billing Email'] = email;
      }

      const updateResponse = await fetch(
        `https://api.airtable.com/v0/${airtableBaseId}/${paymentTableId}/${record.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: updateFields
          })
        }
      );

      if (!updateResponse.ok) {
        const text = await updateResponse.text();

        return res.status(502).json({
          error: 'Airtable payment update failed',
          details: text
        });
      }

      return res.status(200).json({
        success: true,
        updated: true
      });
    }

    // ----------------------------
    // EVENT + BALLOON INTAKE
    // ----------------------------
    let fields;

    if (isEvent) {
      fields = {
        'Submission ID': data.submissionId || '',
        'Industry': data.industry || '',

        'First Name': data.firstName || '',
        'Last Name': data.lastName || '',
        'Business Phone': data.businessPhone || '',
        'Business Email': data.businessEmail || '',

        'Instagram': data.contactInstagram || '',
        'Facebook': data.contactFacebook || '',

        'Business Name': data.businessName || '',
        'Business Type': data.businessType || '',

        'Business Highlights': Array.isArray(data.businessHighlights)
          ? data.businessHighlights.join(', ')
          : '',

        'Service Areas': Array.isArray(data.serviceAreas)
          ? data.serviceAreas.join(', ')
          : '',

        'Travel Range': data.travelRange || '',

        'Business Hours': Array.isArray(data.businessHours)
          ? data.businessHours
              .map(item => `${item.day}: ${item.start} - ${item.end}`)
              .join('\n')
          : '',

        'Services': Array.isArray(data.services)
          ? data.services.join(', ')
          : '',

        'Event Types': Array.isArray(data.eventTypes)
          ? data.eventTypes.join(', ')
          : '',

        'Service Details': data.serviceDetails || '',

        'Pricing Display': data.pricingDisplay || '',

        'Pricing Method': Array.isArray(data.pricingMethod)
          ? data.pricingMethod.join(', ')
          : '',

        'Pricing Details': data.pricingDetails || '',
        'Deposit Required': data.depositRequired || '',

        'Booking Flow': data.bookingFlow || '',

        'Customer Info': Array.isArray(data.customerInfo)
          ? data.customerInfo.join(', ')
          : '',

        'Show Availability': data.showAvailability || '',
        'Existing Booking System':
          data.existingBookingSystem || '',
        'Booking System': data.bookingSystem || '',

        'Event Factors': Array.isArray(data.eventFactors)
          ? data.eventFactors.join(', ')
          : '',

        'Event Environment': data.eventEnvironment || '',
        'Delivery Setup': data.deliverySetup || '',
        'Breakdown Pickup': data.breakdownPickup || '',

        'Pages': Array.isArray(data.pages)
          ? data.pages.join(', ')
          : '',

        'Tagline': data.tagline || '',

        'Style': Array.isArray(data.style)
          ? data.style.join(', ')
          : '',

        'Style Notes': data.styleNotes || '',

        'Materials': Array.isArray(data.materials)
          ? data.materials.join(', ')
          : '',

        'Trust Points': Array.isArray(data.trustPoints)
          ? data.trustPoints.join(', ')
          : '',

        'Final Details': data.finalDetails || ''
      };
    }

    // ----------------------------
    // CLEANING INTAKE
    // ----------------------------
    else {
      fields = {
        'Submission ID': data.submissionId || '',
        'First Name': data.firstName || '',
        'Last Name': data.lastName || '',

        'Business Name': data.businessName || '',
        'Business Phone': data.businessPhone || '',
        'Business Email': data.businessEmail || '',

        'Instagram': data.contactInstagram || '',
        'Facebook': data.contactFacebook || '',

        'Business Type': data.businessType || '',

        'Business Highlights': Array.isArray(data.businessHighlights)
          ? data.businessHighlights
          : [],

        'Service Areas': Array.isArray(data.serviceAreas)
          ? data.serviceAreas.join(', ')
          : '',

        'Business Hours': Array.isArray(data.businessHours)
          ? data.businessHours
              .map(item => `${item.day}: ${item.start} - ${item.end}`)
              .join('\n')
          : '',

        'Insured': data.insured || '',

        'Services': Array.isArray(data.services)
          ? data.services
          : [],

        'Recurring Frequency':
          Array.isArray(data.recurringFrequency)
            ? data.recurringFrequency
            : [],

        'Service Details': data.serviceDetails || '',
        'Pricing Display': data.pricingDisplay || '',

        'Pricing Method': Array.isArray(data.pricingMethod)
          ? data.pricingMethod
          : [],

        'Pricing Details': data.pricingDetails || '',
        'Deposit Required': data.depositRequired || '',
        'Booking Flow': data.bookingFlow || '',

        'Customer Info Requested':
          Array.isArray(data.customerInfo)
            ? data.customerInfo
            : [],

        'Show Availability': data.showAvailability || '',
        'Existing Booking System':
          data.existingBookingSystem || '',
        'Booking System': data.bookingSystem || '',

        'Website Sections': Array.isArray(data.pages)
          ? data.pages
          : [],

        'Tagline': data.tagline || '',

        'Style': Array.isArray(data.style)
          ? data.style
          : [],

        'Style Notes': data.styleNotes || '',

        'Materials': Array.isArray(data.materials)
          ? data.materials
          : [],

        'Trust Points': Array.isArray(data.trustPoints)
          ? data.trustPoints
          : [],

        'Final Details': data.finalDetails || '',

        'Payment Status': 'Pending',
        'Submission Date': new Date().toISOString()
      };
    }

    // ----------------------------
    // CREATE AIRTABLE RECORD
    // ----------------------------
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${airtableBaseId}/${selectedTableId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [
            {
              fields
            }
          ],
          typecast: true
        })
      }
    );

    if (!airtableResponse.ok) {
      const text = await airtableResponse.text();
      console.error('AIRTABLE ERROR:', text);
      return res.status(502).json({
        error: 'Airtable request failed',
        details: text
      });
    }

    const airtableData = await airtableResponse.json();

    return res.status(200).json({
      success: true,
      recordId: airtableData.records?.[0]?.id || null
    });

  } catch (error) {
    console.error('Intake submission error:', error);

    return res.status(500).json({
      error: 'Failed to submit intake'
    });
  }
}
