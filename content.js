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
            isFacebook: false,
            isInstagram: false,
            isTwitter: false
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
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            config.selectors = {
                post: 'article[data-testid="tweet"]',
                adMarker: 'div[data-testid="badge"]',
                content: 'div[data-testid="tweetText"]'
            };
            config.isTwitter = true;
        }

        console.log(`Detected platform: ${config.isFacebook ? 'Facebook' : config.isInstagram ? 'Instagram' : config.isTwitter ? 'Twitter' : 'Unknown'}`);
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
                
                if (this.platformConfig.isFacebook) {
                    const fbPost = node.matches(this.platformConfig.selectors.post)
                        ? node
                        : node.querySelector(this.platformConfig.selectors.post);
                    if (fbPost) posts.push(fbPost);
                } else if (this.platformConfig.isInstagram) {
                    const igPost = node.closest(this.platformConfig.selectors.post);
                    if (igPost) posts.push(igPost);
                } else if (this.platformConfig.isTwitter) {
                    const twitterPost = node.closest(this.platformConfig.selectors.post);
                    if (twitterPost) posts.push(twitterPost);
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
        let extractedText = new Set(); 
        let textElements;
        if (this.platformConfig.isTwitter) {

            textElements = postElement.querySelectorAll(this.platformConfig.selectors.content);
        } else {
            
            textElements = postElement.querySelectorAll('*');
        }

        textElements.forEach(element => {
        
            if (element.tagName.toLowerCase() !== 'img' && element.getAttribute('role') !== 'button') {
                const textContent = element.textContent.trim();
                if (textContent && !extractedText.has(textContent)) {
                    extractedText.add(textContent); 
                }
            }
        });

        return Array.from(extractedText).join("\n");
    }

    async processPost(post) {
        if (this.processedPosts.has(post)) return;

        let content = this.extractFullTextFromPost(post);

        if (content) {
            console.log('[FakeZero] Extracted post content:\n', content);
        }

        // if (content && content.length > 100) {
        //     const isAd = this.isAdPost(post);
        //     if (!isAd) {
        //         const isFake = await this.checkFakeNews(content);
        //         if (isFake) this.addWarningIcon(post);
        //     }
        // }

        this.addWarningIcon(post);
        this.processedPosts.add(post);

       
        await chrome.storage.local.get('fakeNewsCount', (result) => {
            const newCount = (result.fakeNewsCount || 0) + 1;
            chrome.storage.local.set({ fakeNewsCount: newCount });
        });

        this.processedPosts.add(post);
    }

    addWarningIcon(post) {
        try {
            const icon = document.createElement('div');
            icon.id = 'debug-warning-icon';
            icon.style.width = '30px';
            icon.style.height = '30px';
            icon.style.backgroundColor = 'red';
            icon.style.position = 'absolute';
            icon.style.zIndex = '9999';

            icon.style.top = '0px';
            icon.style.right = '10px';

            icon.style.cursor = 'pointer';
            icon.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

            icon.innerText = '!';
            icon.style.color = 'white';
            icon.style.display = 'flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
            icon.style.fontWeight = 'bold';

            // Add click event to open the extension popup
            icon.addEventListener('click', (event) => {
                event.stopPropagation(); 
                try {
                    // Send a message to the background script to open the extension popup
                    chrome.runtime.sendMessage({ action: 'openPopup' });

                    
                    icon.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        icon.style.transform = 'scale(1)';
                    }, 200);
                } catch (error) {
                    console.error('Error opening extension:', error);
                }
            });

          
            post.style.position = 'relative';

        
            post.appendChild(icon);
            console.log('Clickable warning icon added successfully');
        } catch (error) {
            console.error('Error adding warning icon:', error);
        }
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
       
    }
}

new FakeNewsDetector();