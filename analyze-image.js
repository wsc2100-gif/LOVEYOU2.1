exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { image, mimeType } = body;

        if (!image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing image data' })
            };
        }

        const prompt = `
            Analyze the provided image and determine if it is AI-generated or Real.
            
            Key distinction:
            - **Real**: Natural imperfections, film grain, complex physics, standard digital photography noise. INCLUDES photos with beauty filters or color correction.
            - **AI-Generated**: Structural logic errors, impossible physics, hyper-realistic "plastic" skin texture without pores, merging objects.

            Output Requirement:
            - Be objective. Do not be overly skeptical.
            - If it looks like a standard social media photo (even with filters), it is likely Real.
            
            Return ONLY a valid JSON object (Language: Traditional Chinese):
            {
                "isSafe": (boolean, TRUE = Real/Filtered, FALSE = AI-Generated),
                "riskScore": (integer 0-100. 0-40=Real, 41-70=Suspicious, 71-100=AI),
                "riskLevel": (string, "低風險", "中風險", "高風險"),
                "summary": (string, A natural, professional explanation of the finding. "這張照片看起來是真實的..." or "檢測到AI生成的特徵..."),
                "faceAnalysis": (string, specific details about eyes/skin/mouth),
                "lightingAnalysis": (string, comments on light/shadow consistency),
                "artifactAnalysis": (string, strictly identifying AI artifacts if any)
            }
        `;

        // 1. Try standard models first (Fastest path)
        // Prioritize Pro for better reasoning, then Flash for backup
        const primaryModels = ['gemini-1.5-pro', 'gemini-1.5-pro-001', 'gemini-1.5-flash', 'gemini-1.5-flash-001'];
        let successfulResponse = null;
        let errors = [];

        // Helper function for sending request
        const generateContent = async (modelName) => {
            return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType || "image/jpeg",
                                    data: image
                                }
                            }
                        ]
                    }]
                })
            });
        };

        // Try primary models
        for (const model of primaryModels) {
            try {
                // console.log(`Attempting model: ${model}`); 
                const response = await generateContent(model);
                if (response.ok) {
                    successfulResponse = response;
                    break;
                } else {
                    const errorIdx = await response.json();
                    errors.push(`${model}: ${errorIdx.error?.message || response.statusText}`);
                }
            } catch (e) { errors.push(`${model}: ${e.message}`); }
        }

        // 2. If all primary failed, perform Dynamic Model Discovery (Diagnostic path)
        if (!successfulResponse) {
            console.log("Primary models failed. Listing available models...");
            try {
                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
                if (listResp.ok) {
                    const listData = await listResp.json();

                    // Filter for Gemini models that likely support generation
                    const availableModels = (listData.models || [])
                        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => m.name.replace('models/', '')); // Remove prefix

                    // Try found models that weren't already tested
                    for (const model of availableModels) {
                        if (primaryModels.includes(model)) continue; // Skip already tried

                        // console.log(`Trying discovered model: ${model}`);
                        try {
                            const response = await generateContent(model);
                            if (response.ok) {
                                successfulResponse = response;
                                break;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    if (!successfulResponse) {
                        // If still failing, return the list of available models to the user for debugging
                        throw new Error(`Auto-discovery failed. Available models for your key: ${availableModels.join(', ')}`);
                    }
                } else {
                    throw new Error(`ListModels failed (${listResp.status}). Check API Key permissions.`);
                }
            } catch (discoveryError) {
                throw new Error(`Diagnosis failed: ${discoveryError.message}. Previous errors: ${errors.join('|')}`);
            }
        }

        if (!successfulResponse) {
            throw new Error('All attempts failed.');
        }

        const data = await successfulResponse.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates returned from AI');
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(jsonString);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedResult)
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
