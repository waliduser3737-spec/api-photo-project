export async function handler(event, context) {
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    
    console.log('Received generation request:', {
      hasApiKey: !!body.apiKey,
      hasPrompt: !!body.prompt,
      hasProduct: !!body.product,
      hasTemplate: !!body.template
    });

    // Validate required fields
    if (!body.apiKey || !body.prompt || !body.product || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: apiKey, prompt, product, or template' 
        })
      };
    }

    // Create prediction
    console.log('Calling Replicate API to create prediction...');
    const createResponse = await fetch(
      'https://api.replicate.com/v1/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${body.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          version: '2fec59ca1be9f79ea9240fde80cb6e3c34e8e6c27d0c3be1d09e1a24f0b9e07b',
          input: {
            prompt: body.prompt,
            image: body.product,
            ip_adapter_image: body.template,
            ip_adapter_scale: parseFloat(body.strength) || 0.5,
            num_outputs: parseInt(body.outputs) || 1,
            seed: body.seed ? parseInt(body.seed) : undefined,
            guidance_scale: 7.5,
            num_inference_steps: 30
          }
        })
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Replicate API error:', errorText);
      return {
        statusCode: createResponse.status,
        body: JSON.stringify({ 
          error: `Replicate API error: ${errorText}` 
        })
      };
    }

    let prediction = await createResponse.json();
    console.log('Initial prediction:', prediction.id, prediction.status);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 90 seconds max (60 * 1.5s)

    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`);
      
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { 
            'Authorization': `Token ${body.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!pollResponse.ok) {
        console.error('Polling error:', await pollResponse.text());
        break;
      }

      prediction = await pollResponse.json();
      console.log('Prediction status:', prediction.status);
      attempts++;
    }

    // Check final status
    if (prediction.status === 'failed') {
      console.error('Generation failed:', prediction.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: prediction.error || 'Generation failed' 
        })
      };
    }

    if (prediction.status === 'canceled') {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Generation was canceled' })
      };
    }

    if (attempts >= maxAttempts) {
      return {
        statusCode: 408,
        body: JSON.stringify({ 
          error: 'Generation timeout - please try again' 
        })
      };
    }

    // Return successful result
    console.log('Generation succeeded:', prediction.output);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        images: prediction.output 
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
}
