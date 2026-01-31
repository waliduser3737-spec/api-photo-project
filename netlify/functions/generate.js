export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    const apiKey = body.apiKey;
    const prompt = body.prompt;
    
    if (!apiKey || !prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing apiKey or prompt' })
      };
    }

    // Step 1: Upload template image to get initImageId
    let uploadInitImageId = null;
    if (body.template) {
      // Get upload URL from Leonardo
      const initUploadRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ extension: 'jpg' }) // or 'png'
      });

      if (!initUploadRes.ok) {
        const err = await initUploadRes.text();
        throw new Error(`Upload init failed: ${err}`);
      }

      const { uploadInitImageId: imgId, uploadUrl } = await initUploadRes.json();
      uploadInitImageId = imgId;

      // Step 2: Upload the actual image data to S3 presigned URL
      let base64Data = body.template;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const s3Upload = await fetch(uploadUrl, {
        method: 'PUT',
        body: imageBuffer,
        headers: { 'Content-Type': 'image/jpeg' }
      });

      if (!s3Upload.ok) {
        throw new Error('Failed to upload image to storage');
      }
    }

    // Step 3: Create generation
    const genPayload = {
      modelId: "7b592283-e8a7-4c5a-9ba6-d18c31f258b9", // Leonardo Diffusion XL
      prompt: prompt,
      num_images: 1,
      width: 1024,
      height: 1024,
      alchemy: true,
      photoReal: false,
      contrast: 3.5
    };

    // Add seed if provided
    if (body.seed) {
      genPayload.seed = body.seed;
    }

    // Add image-to-image if template provided
    if (uploadInitImageId) {
      genPayload.controlnets = [
        {
          initImageId: uploadInitImageId,
          initImageType: "UPLOADED",
          preprocessorId: "NONE", // No preprocessing, direct img2img
          weight: 0.6 // Influence of original image (0.0 to 1.0)
        }
      ];
    }

    const genRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(genPayload)
    });

    if (!genRes.ok) {
      const err = await genRes.json();
      return {
        statusCode: genRes.status,
        body: JSON.stringify({ error: `Leonardo API: ${err.error || err.message || 'Unknown error'}` })
      };
    }

    const { generationId } = await genRes.json();

    // Step 4: Poll for results
    let images = [];
    let attempts = 0;
    const maxAttempts = 40; // 40 seconds timeout
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      
      const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (!pollRes.ok) {
        attempts++;
        continue;
      }
      
      const pollData = await pollRes.json();
      const generation = pollData.generations_by_pk || pollData;
      
      if (generation.status === 'COMPLETE' && generation.generated_images?.length > 0) {
        images = generation.generated_images.map(img => img.url);
        break;
      }
      
      if (generation.status === 'FAILED') {
        throw new Error('Generation failed on Leonardo servers');
      }
      
      attempts++;
    }

    if (images.length === 0) {
      throw new Error('Timeout: Generation took too long');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        images: images,
        generationId: generationId
      })
    };

  } catch (error) {
    console.error('Leonardo Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
