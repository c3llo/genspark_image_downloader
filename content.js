window.addEventListener("mousedown", function(e) {
    if (!e.altKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    const path = e.composedPath();
    let imgSrc = "";

    for (const el of path) {
        if (!el.tagName) continue;
        const candidate = el.currentSrc || el.src || el.dataset?.src || el.querySelector('img')?.src;
        if (candidate && (candidate.startsWith('http') || candidate.startsWith('data:image'))) {
            imgSrc = candidate;
            break;
        }
    }

    if (imgSrc) {
        chrome.storage.local.get({collectedImages: []}, (data) => {
            let images = data.collectedImages;
            if (!images.includes(imgSrc)) {
                images.push(imgSrc);
                chrome.storage.local.set({ collectedImages: images });
                // 시각적 피드백
                const target = e.target;
                const originalOutline = target.style.outline;
                target.style.outline = "5px solid #4285f4";
                setTimeout(() => { target.style.outline = originalOutline; }, 500);
            }
        });
    }
}, true);

window.addEventListener("click", (e) => {
    if (e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
}, true);