export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    console.log('Received generation request');

    // Validate required fields
    if (!body.apiKey || !body.prompt || !body.product || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: apiKey, prompt, product, or template' 
        })
      };
    }

    // Using a simpler, more reliable approach: stability-ai/sdxl with img2img
    console.log('Calling Replicate API...');
    const response = await fetch(
      'https://api.replicate.com/v1/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${body.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
          input: {
            prompt: body.prompt,
            image: body.template,
            strength: parseFloat(body.strength) || 0.5,
            num_outputs: parseInt(body.outputs) || 1,
            seed: body.seed ? parseInt(body.seed) : undefined,
            negative_prompt: 'low quality, blurry, distorted, watermark',
            num_inference_steps: 30,
            guidance_scale: 7.5
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `API error: ${errorText}` })
      };
    }

    let prediction = await response.json();
    console.log('Prediction created:', prediction.id);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;

    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { 
            'Authorization': `Token ${body.apiKey}`
          }
        }
      );

      if (!pollResponse.ok) {
        console.error('Poll error');
        break;
      }

      prediction = await pollResponse.json();
      attempts++;
    }

    if (prediction.status === 'failed') {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: prediction.error || 'Generation failed' 
        })
      };
    }

    if (attempts >= maxAttempts) {
      return {
        statusCode: 408,
        body: JSON.stringify({ error: 'Timeout' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: prediction.output })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
