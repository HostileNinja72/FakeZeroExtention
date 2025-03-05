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
        const posts = this.getPostsFromMutation(mutation);
        if (!posts) {
            console.error('getPostsFromMutation returned undefined or null');
            return;
        }
        posts.forEach(post => {
            if (!this.processedPosts.has(post)) {
                console.log('Observing new post:', post);
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
                case 'FORCE_RESCAN':
                    this.handleForceRescan(request, sendResponse);
                    return true;
                case 'EXTENSION_STATE_UPDATE':
                    this.handleExtensionStateUpdate(request);
                    break;
            }
        });
    }

    async processPost(post) {
        if (this.processedPosts.has(post)) return;

        let content = '';
        if (this.platformConfig.isFacebook) {
            content = post.querySelector(this.platformConfig.selectors.content)?.innerText;
            console.log("extract content: ", content);
        } else if (this.platformConfig.isInstagram) {
            content = post.querySelector(this.platformConfig.selectors.content)?.innerText;
        }

        
        if (content) {
            console.log('Extracted post content:', content);
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

    isAdPost(post) {
        if (this.platformConfig.isFacebook) {
            return !!post.closest(this.platformConfig.selectors.adMarker);
        } else if (this.platformConfig.isInstagram) {
            return !!post.querySelector(this.platformConfig.selectors.adMarker);
        }
        return false;
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

    async handleForceRescan(request, sendResponse) {
        console.log('Handling force rescan...');
        try {
            const newDetections = await this.rescanPage();
            console.log('Rescan completed, new detections:', newDetections);
            sendResponse({ success: true, newDetections: newDetections });
        } catch (error) {
            console.error('Rescan failed:', error);
            sendResponse({ success: false });
        }
    }

    handleExtensionStateUpdate(request) {
        console.log('Handling extension state update:', request.isActive);
        this.extensionEnabled = request.isActive;
        if (!this.extensionEnabled) {
            console.log('Disabling extension, removing all icons...');
            this.removeAllIcons();
        }
    }
}

new FakeNewsDetector();
