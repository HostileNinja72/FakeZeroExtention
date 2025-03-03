// popup.js
class FakeZeroPopup {
    constructor() {
        this.initializeElements();
        this.initializeState();
        this.setupEventListeners();
    }

    initializeElements() {
        this.elements = {
            checkNowBtn: document.getElementById('checkNow'),
            toggleExtensionBtn: document.getElementById('toggleExtension'),
            fakeNewsCounter: document.getElementById('fakeNewsCounter'),
            statusIndicator: document.getElementById('statusIndicator')
        };
    }

    async initializeState() {
        const { isActive = true, fakeNewsCount = 0 } = await chrome.storage.local.get([
            'isActive',
            'fakeNewsCount'
        ]);
        
        this.state = {
            isActive,
            fakeNewsCount
        };

        this.updateUI();
    }

    setupEventListeners() {
        this.elements.checkNowBtn.addEventListener('click', () => this.handleCheckNow());
        this.elements.toggleExtensionBtn.addEventListener('click', () => this.toggleExtension());
    }

    async handleCheckNow() {
        if (!this.state.isActive) return;
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                console.error('No active tab found');
                return;
            }

            const response = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['contentScript.js']
            });

            this.updateStatus('Scanning current page...', 'processing');
        } catch (error) {
            console.error('Error during content script injection:', error);
            this.updateStatus('Error during scanning', 'error');
        }
    }

    async toggleExtension() {
        this.state.isActive = !this.state.isActive;
        await chrome.storage.local.set({ isActive: this.state.isActive });
        this.updateUI();
        this.sendStateToContentScripts();
    }

    updateUI() {
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
        const statusColors = {
            info: '#2196F3',
            processing: '#FFC107',
            success: '#4CAF50',
            error: '#F44336'
        };
        
        this.elements.statusIndicator.style.backgroundColor = statusColors[statusType];
    }

    async sendStateToContentScripts() {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_STATE_UPDATE',
                isActive: this.state.isActive
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPopup();
});