class FakeZeroPostAnalysis {
    constructor() {
        console.debug('[FakeZero] Initializing post analysis listener');
        this.initializeElements();
        this.setupMessageListener();
        this.setupCloseButton();
    }

    initializeElements() {
        console.debug('[FakeZero] Initializing UI elements');
        this.elements = {
            postContent: document.getElementById('post-content'),
            platform: document.getElementById('platform'),
            sentimentScore: document.getElementById('sentiment-score'),
            sourcesCheck: document.getElementById('sources-check'),
            fakeScore: document.getElementById('fakeScore'),
            closeBtn: document.querySelector('.close-btn')
        };
    }

    setupMessageListener() {
        console.debug('[FakeZero] Setting up message listener');

        window.addEventListener('message', (event) => {
            if (!event.data || event.data.type !== 'POST_DATA') {
                return;
            }

            console.debug('[FakeZero] Received post data:', event.data);

            // Update DOM elements
            this.elements.postContent.textContent = event.data.content || 'No content available';
            this.elements.platform.textContent = event.data.platform || 'Unknown platform';

            // Simulate fake score probability calculation
            this.updateFakeScore();

            // Placeholder analysis updates
            this.elements.sentimentScore.textContent = 'Analysis pending...';
            this.elements.sourcesCheck.innerHTML = '<li>Source verification in progress</li>';
        });
    }

    updateFakeScore() {
        // Generate a random probability for fake news (between 10% - 90%)
        const probability = Math.floor(Math.random() * 81) + 10;
        this.elements.fakeScore.textContent = `${probability}%`;

        // Change color based on risk level
        if (probability > 70) {
            this.elements.fakeScore.style.color = 'red';
        } else if (probability > 40) {
            this.elements.fakeScore.style.color = 'orange';
        } else {
            this.elements.fakeScore.style.color = 'green';
        }
    }

    setupCloseButton() {
        console.debug('[FakeZero] Setting up close button');

        this.elements.closeBtn.addEventListener('click', () => {
            console.debug('[FakeZero] Closing post analysis popup');
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
        });
    }
}

console.log('[FakeZero] Initializing post-analysis script');
document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPostAnalysis();
});
    