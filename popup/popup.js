class FakeZeroPopup {
    constructor() {
        console.debug('[FakeZero] Initializing popup');
        this.initializeElements();
        this.initializeState();
        this.setupEventListeners();
        this.setupStorageListener();
    }

    initializeElements() {
        console.debug('[FakeZero] Initializing UI elements');
        this.elements = {
            toggleExtensionBtn: document.getElementById('toggleExtension'),
            fakeNewsCounter: document.getElementById('fakeNewsCounter'),
            statusIndicator: document.getElementById('statusIndicator')
        };
    }

    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.fakeNewsCount) {
                this.state.fakeNewsCount = changes.fakeNewsCount.newValue;
                this.updateUI();
                console.log('[FakeZero] Counter updated from storage');
            }
        });
    }

    async initializeState() {
        console.debug('[FakeZero] Loading initial state');
        const { isActive = true, fakeNewsCount = 0 } = await chrome.storage.local.get([
            'isActive',
            'fakeNewsCount'
        ]);

        this.state = {
            isActive,
            fakeNewsCount
        };
        console.log(`[FakeZero] Loaded state - Active: ${isActive}, Count: ${fakeNewsCount}`);
        this.updateUI();
    }

    setupEventListeners() {
        console.debug('[FakeZero] Setting up event listeners');
        this.elements.toggleExtensionBtn.addEventListener('click', () => this.toggleExtension());
    }

    
    async ensureContentScriptInjected(tabId) {
        try {
            console.debug(`[FakeZero] Injecting content script into tab ${tabId}`);
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
        } catch (error) {
            console.log('[FakeZero] Content script already injected');
        }
    }


    handleScanResponse(response) {
        if (response?.success) {
            const newCount = this.state.fakeNewsCount + response.newDetections;
            console.log(`[FakeZero] Scan successful, new detections: ${response.newDetections}`);
            this.updateFakeNewsCount(newCount);
            this.updateStatus(`Found ${response.newDetections} new items`, 'success');
        } else {
            console.log('[FakeZero] Scan completed with no new findings');
            this.updateStatus('Scan completed - no new findings', 'info');
        }
    }

    handleScanError(error) {
        console.error('[FakeZero] Scan error:', error);
        if (error.message.includes('Receiving end does not exist')) {
            console.warn('[FakeZero] Content script not ready - needs page reload');
            this.updateStatus('Reload page to scan', 'error');
        } else {
            this.updateStatus('Scan failed - try reloading', 'error');
        }
    }

    async toggleExtension() {
        const newState = !this.state.isActive;
        this.state.isActive = newState;
        await chrome.storage.local.set({ isActive: this.state.isActive });
        this.updateUI();
        this.sendStateToContentScripts();

        // Force content script re-injection when activating
        if (newState) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) await this.ensureContentScriptInjected(tab.id);
        }
    }

    updateUI() {
        console.debug('[FakeZero] Updating UI');
        this.elements.fakeNewsCounter.textContent = this.state.fakeNewsCount;
        this.elements.fakeNewsCounter.classList.add('counter-update');
        setTimeout(() => {
            this.elements.fakeNewsCounter.classList.remove('counter-update');
        }, 300);

        this.elements.toggleExtensionBtn.setAttribute('aria-pressed', this.state.isActive);
        this.elements.toggleExtensionBtn.querySelector('.toggle-state').textContent =
            this.state.isActive ? 'Inactive' : 'Active';

        this.elements.statusIndicator.style.backgroundColor = this.state.isActive ? '#4CAF50' : '#FF5722';
    }

    updateStatus(message, statusType = 'info') {
        console.log(`[FakeZero] Status update: ${message} (${statusType})`);
        const statusColors = {
            info: '#2196F3',
            processing: '#FFC107',
            success: '#4CAF50',
            error: '#F44336'
        };

        this.elements.statusIndicator.style.backgroundColor = statusColors[statusType];
    }

    async sendStateToContentScripts() {
        console.debug('[FakeZero] Sending state to content scripts');
        const tabs = await chrome.tabs.query({});
        console.log(`[FakeZero] Sending to ${tabs.length} tabs`);
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_STATE_UPDATE',
                isActive: this.state.isActive
            });
        });
    }
}

console.log('[FakeZero] Initializing popup script');
document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPopup();
});