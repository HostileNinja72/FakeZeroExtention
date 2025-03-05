class FakeZeroPopup {
    constructor() {
        console.debug('[FakeZero] Initializing popup');
        this.initializeElements();
        this.initializeState();
        this.setupEventListeners();
    }

    initializeElements() {
        console.debug('[FakeZero] Initializing UI elements');
        this.elements = {
            checkNowBtn: document.getElementById('checkNow'),
            toggleExtensionBtn: document.getElementById('toggleExtension'),
            fakeNewsCounter: document.getElementById('fakeNewsCounter'),
            statusIndicator: document.getElementById('statusIndicator')
        };
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
        this.elements.checkNowBtn.addEventListener('click', () => this.handleCheckNow());
        this.elements.toggleExtensionBtn.addEventListener('click', () => this.toggleExtension());
    }

    async handleCheckNow() {
        console.log('[FakeZero] Check Now button clicked');
        if (!this.state.isActive) {
            console.warn('[FakeZero] Extension paused - aborting check');
            this.updateStatus('Extension is paused', 'error');
            return;
        }

        try {
            console.debug('[FakeZero] Querying active tab');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                console.error('[FakeZero] No active tab found');
                return;
            }

            console.log(`[FakeZero] Starting scan on tab: ${tab.url}`);
            this.updateStatus('Scanning page...', 'processing');
            this.toggleButtonState(true);

            console.debug('[FakeZero] Ensuring content script is injected');
            await this.ensureContentScriptInjected(tab.id);

            console.debug('[FakeZero] Sending FORCE_RESCAN message');
            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'FORCE_RESCAN',
                force: true
            });

            console.log('[FakeZero] Received scan response:', response);
            this.handleScanResponse(response);
        } catch (error) {
            console.error('[FakeZero] Scan failed:', error);
            this.handleScanError(error);
        } finally {
            console.debug('[FakeZero] Resetting button state');
            this.toggleButtonState(false);
        }
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

    toggleButtonState(isLoading) {
        console.debug(`[FakeZero] Setting button loading state: ${isLoading}`);
        this.elements.checkNowBtn.disabled = isLoading;
        this.elements.checkNowBtn.innerHTML = isLoading
            ? '<div class="spinner"></div> Scanning...'
            : 'Check Now';
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
        console.log(`[FakeZero] Toggling extension state from ${this.state.isActive} to ${newState}`);
        this.state.isActive = newState;
        await chrome.storage.local.set({ isActive: this.state.isActive });
        console.log('[FakeZero] New state saved to storage');
        this.updateUI();
        this.sendStateToContentScripts();
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
            this.state.isActive ? 'Active' : 'Inactive';

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