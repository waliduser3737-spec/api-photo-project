export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Convert base64 to buffer for binary upload
    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Build URL with query parameters (this is the key fix!)
    const url = new URL('https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0');
    url.searchParams.append('prompt', body.prompt);
    url.searchParams.append('strength', body.strength || 0.5);
    url.searchParams.append('guidance_scale', '7.5');
    url.searchParams.append('num_inference_steps', '30');
    if (body.seed) url.searchParams.append('seed', body.seed);
    url.searchParams.append('negative_prompt', 'low quality, blurry, distorted');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'image/png',  // Send as binary image, not JSON
        'Accept': 'image/png'
      },
      body: imageBuffer  // Send raw binary, not base64 JSON
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `HF API error: ${errorText}` })
      };
    }

    // Get generated image as blob/binary
    const resultBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(resultBuffer).toString('base64');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        images: [`data:image/png;base64,${base64Image}`]
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
