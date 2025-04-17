class FakeZeroPostAnalysis {
    constructor() {
        console.debug('[FakeZero] Initializing post analysis UI');
        console.debug('[FakeZero] NOOOOOOOOOOO WHYYYYY DID THEY DO THAT');
        this.analysisData = null;
        this.initializeElements();
        this.setupMessageListener();
        this.setupCloseButton();
        this.initAnalysis(); // Start analysis
    }

    async initAnalysis() {
        try {
            console.debug('[FakeZero] Starting analysis...');
            const content = this.elements.postContent.textContent;
            console.debug('[FakeZero] Post content:', content);

            if (!content || content === 'Loading...') {
                console.warn('[FakeZero] No valid content to analyze');
                return;
            }

            this.showLoadingStates();
            const analysis = await this.getDetailedAnalysis(content);
            console.log('[FakeZero] Analysis response:', analysis);
            this.updateUI(analysis);
        } catch (error) {
            console.error('[FakeZero] Analysis error:', error);
            this.showErrorState();
        }
    }

    async getDetailedAnalysis(content) {
        console.debug('[FakeZero] Sending content to OpenAI for detailed analysis...');
        const prompt = `Analyze this social media post for fake news characteristics. Respond ONLY with JSON format:
        {
            "probability": "percentage",
            "type": ["satire", "false connection", "misleading content", "false context", "impostor content", "manipulated content", "fabricated content"],
            "sentiment": "negative/neutral/positive",
            "reason": "short explanation"
        }

        Post: "${content}"`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a misinformation analysis expert. Provide detailed technical analysis.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 250
            })
        });

        const data = await response.json();
        console.debug('[FakeZero] Raw OpenAI response:', data);

        try {
            return JSON.parse(data.choices[0].message.content);
        } catch (parseError) {
            console.error('[FakeZero] Failed to parse OpenAI JSON response:', parseError);
            throw parseError;
        }
    }

    updateUI(analysis) {
        console.debug('[FakeZero] Updating UI with analysis...');

        this.elements.credibilityStatus.textContent = `${analysis.probability} Fake`;
        this.elements.credibilityStatus.classList.remove('checking-animation');

        this.elements.sentimentScore.innerHTML = `
            <span class="sentiment-label">${analysis.sentiment}</span>
            <div class="sentiment-meter ${analysis.sentiment}"></div>
        `;

        this.elements.sourcesCheck.innerHTML = `
            <h3>Detected Fake News Type:</h3>
            <ul class="source-list">
                ${analysis.type.map(t => `<li>${t}</li>`).join('')}
            </ul>
            <p class="reason-text">${analysis.reason}</p>
        `;

        document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));
        document.querySelectorAll('.loading-border').forEach(el => el.remove());

        console.debug('[FakeZero] UI update complete.');
    }

    showLoadingStates() {
        console.debug('[FakeZero] Showing loading states...');
        this.elements.credibilityStatus.classList.add('checking-animation');
        document.querySelectorAll('.info-card p').forEach(el => el.classList.add('loading'));
    }

    showErrorState() {
        console.warn('[FakeZero] Showing error state in UI');
        this.elements.credibilityStatus.textContent = 'Analysis Failed';
        this.elements.credibilityStatus.classList.remove('checking-animation');
        document.querySelectorAll('.loading').forEach(el => {
            el.classList.remove('loading');
            el.textContent = 'Could not retrieve analysis';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPostAnalysis();
    console.debug('[FakeZero] Post analysis UI initialized');
});
