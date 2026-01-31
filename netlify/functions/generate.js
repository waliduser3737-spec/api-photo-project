export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    const response = await fetch(
      'https://api.replicate.com/v1/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${body.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'lucataco/sdxl-ip-adapter',
          input: {
            prompt: body.prompt,
            image: body.product,
            reference_image: body.template,
            ip_adapter_scale: body.strength,
            num_outputs: body.outputs,
            seed: body.seed ?? undefined,
            guidance_scale: 7.5,
            num_inference_steps: 30
          }
        })
      }
    );

    let prediction = await response.json();

    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed'
    ) {
      await new Promise(r => setTimeout(r, 1500));
      const poll = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${body.apiKey}` }
      });
      prediction = await poll.json();
    }

    if (prediction.status === 'failed') {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Generation failed' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: prediction.output })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
