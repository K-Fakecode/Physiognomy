export default async function handler(req, res) {
    // 오직 POST 방식의 요청만 허용합니다.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    }

    const { image } = req.body;
    
    // Vercel Environment Variables(환경변수)에 저장된 API 키를 가져옵니다.
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다. Vercel 설정을 확인해주세요.' });
    }

    try {
        // 최신 Gemini 모델 주소 (안정적인 2.0 모델 사용)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        // AI에게 지시할 팩트폭행 관상 프롬프트
        const prompt = `당신은 오랜 경험을 가진 전통 관상학 전문가입니다. 
주어진 얼굴 사진을 보고 다음 3가지 주요 부위와 종합 풀이에 대한 관상 결과를 분석해주세요.
사진의 얼굴에서 보이는 관상학적 특징을 가감 없이 객관적이고 냉철하게 분석해주세요. 
좋은 점(길상)뿐만 아니라, 안 좋은 점(흉상), 주의해야 할 성격적 단점, 인간관계의 문제, 재물운의 취약점 등 부정적인 내용도 절대 피하지 말고 반드시 포함해서 상세히 적어주세요.

반드시 아래에 정의된 JSON 스키마 형식에 맞춰 정확한 JSON 데이터만 응답해야 합니다.`;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: image } }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        forehead: { type: "STRING" },
                        eyes: { type: "STRING" },
                        lowerFace: { type: "STRING" },
                        summary: { type: "STRING" }
                    },
                    required: ["forehead", "eyes", "lowerFace", "summary"]
                }
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json(); 

        if (!response.ok) {
            console.error("Gemini API Error:", responseData);
            return res.status(response.status).json({ 
                error: `Gemini API 거절 (코드 ${response.status})`, 
                details: responseData.error?.message || JSON.stringify(responseData)
            });
        }
        
        // AI가 정상적으로 답변을 만들었는지 확인 후 프론트엔드로 전달
        if (responseData.candidates && responseData.candidates.length > 0) {
            const jsonText = responseData.candidates[0].content.parts[0].text;
            return res.status(200).json(JSON.parse(jsonText));
        } else {
            return res.status(500).json({ error: "AI가 응답을 생성하지 못했습니다." });
        }
    } catch (error) {
        // 서버 내부의 치명적인 에러 처리
        console.error('백엔드 치명적 에러:', error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.', details: error.message });
    }
}
