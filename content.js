class FakeNewsDetector {
    constructor() {
        this.observer = null;
        this.extensionEnabled = true;
        this.processedPosts = new WeakSet();
        this.platformConfig = this.detectPlatform();
        this.initialize();
    }

    async initialize() {
        console.log('Initializing detector...');
        await this.loadExtensionState();
        this.setupObservers();
        this.setupMessageListener();
        this.scanInitialPosts();
    }

    detectPlatform() {
        const hostname = window.location.hostname;
        const config = {
            selectors: {
                post: '',
                adMarker: '',
                content: ''
            },
            isInstagram: false,
            isFacebook: false
        };

        if (hostname.includes('facebook.com')) {
            config.selectors = {
                post: 'div[data-ad-comet-preview="message"]',
                adMarker: '[aria-label="Sponsored"]',
                content: 'div.xdj266r'
            };
            config.isFacebook = true;
        } else if (hostname.includes('instagram.com')) {
            config.selectors = {
                post: 'article._aatb',
                adMarker: 'div._aaaw',
                content: 'div._a9zs'
            };
            config.isInstagram = true;
        }

        console.log(`Detected platform: ${config.isFacebook ? 'Facebook' : 'Instagram'}`);
        return config;
    }

    async loadExtensionState() {
        const { isActive } = await chrome.storage.local.get('isActive');
        this.extensionEnabled = isActive !== false;
        console.log('Extension state loaded:', this.extensionEnabled);
    }

    teardownObservers() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        this.processedPosts = new WeakSet();
        console.log('Observers torn down');
    }

    setupObservers() {
        console.log('Setting up observers...');
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.extensionEnabled) {
                    console.log('Processing post:', entry.target);
                    this.processPost(entry.target);
                }
            });
        }, { rootMargin: '0px 0px 200px 0px' });

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                this.handleMutation(mutation);
            });
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleMutation(mutation) {
        if (!this.extensionEnabled) {
            return;
        }

        const posts = this.getPostsFromMutation(mutation);
        if (!posts) {
            console.error('[FakeZero] getPostsFromMutation returned undefined or null');
            return;
        }

        posts.forEach(post => {
            if (!this.processedPosts.has(post)) {
                this.intersectionObserver.observe(post);
            }
        });
    }

    getPostsFromMutation(mutation) {
        const posts = [];
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Platform-specific node detection
                if (this.platformConfig.isFacebook) {
                    const fbPost = node.matches(this.platformConfig.selectors.post)
                        ? node
                        : node.querySelector(this.platformConfig.selectors.post);
                    if (fbPost) posts.push(fbPost);
                } else if (this.platformConfig.isInstagram) {
                    const igPost = node.closest(this.platformConfig.selectors.post);
                    if (igPost) posts.push(igPost);
                }
            }
        });
        return posts;
    }

    scanInitialPosts() {
        const posts = document.querySelectorAll(this.platformConfig.selectors.post);
        posts.forEach(post => this.intersectionObserver.observe(post));
    }

    setupMessageListener() {
        console.log('Setting up message listener...');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Message received:', request);
            switch (request.type) {
                case 'EXTENSION_STATE_UPDATE':
                    this.handleExtensionStateUpdate(request);
                    break;
            }
        });
    }

    extractFullTextFromPost(postElement) {
        let extractedText = new Set(); // Use a Set to avoid duplicate lines

        // Select all elements inside the post
        const elements = postElement.querySelectorAll('*');

        elements.forEach(element => {
            // Exclude images and interactive elements like buttons
            if (element.tagName.toLowerCase() !== 'img' && element.getAttribute('role') !== 'button') {
                const textContent = element.textContent.trim();
                if (textContent && !extractedText.has(textContent)) {
                    extractedText.add(textContent); // Store only unique text
                }
            }
        });

        return Array.from(extractedText).join("\n"); // Convert Set back to a string
    }


    async processPost(post) {
        if (this.processedPosts.has(post)) return;

        let content = this.extractFullTextFromPost(post);

        if (content) {
            console.log('[FakeZero] Extracted post content:\n', content);
        }

        if (content && content.length > 100) {
            const isAd = this.isAdPost(post);
            if (!isAd) {
                const isFake = await this.checkFakeNews(content);
                if (isFake) this.addWarningIcon(post);
            }
        }

        this.processedPosts.add(post);
    }


    addWarningIcon(post) {
        const icon = document.createElement('div');
        icon.className = 'fakezero-warning-icon';

        if (this.platformConfig.isFacebook) {
            icon.style.top = '10px';
            icon.style.right = '10px';
        } else if (this.platformConfig.isInstagram) {
            icon.style.top = '15px';
            icon.style.right = '15px';
        }

        post.style.position = 'relative';
        post.appendChild(icon);
    }

    

    handleExtensionStateUpdate(request) {
        console.log('Handling extension state update:', request.isActive);
        this.extensionEnabled = request.isActive;
        if (this.extensionEnabled) {
            console.log('Enabling extension, initializing...');
            this.setupObservers();
            this.scanInitialPosts();
        } else {
            console.log('Disabling extension, removing all icons...');
            this.teardownObservers();
            this.removeAllIcons();
        }
    }

    removeAllIcons() {
        document.querySelectorAll('.fakezero-warning-icon').forEach(icon => icon.remove());
    }

    async checkFakeNews(content) {
        // Existing fake news checking logic
        // Return boolean
    }
}

new FakeNewsDetector();
