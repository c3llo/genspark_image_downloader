// [초기화] 마우스를 따라다닐 카운터 엘리먼트 생성
let cursorCounter = document.createElement("div");
cursorCounter.id = "asset-cursor-counter";
Object.assign(cursorCounter.style, {
    position: "fixed", // 뷰포트 고정
    width: "24px",
    height: "24px",
    backgroundColor: "rgba(66, 133, 244, 0.9)", // 구글 블루, 약간 투명하게
    color: "white",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "bold",
    zIndex: "10002", // 최상위 레벨
    pointerEvents: "none", // 마우스 이벤트를 방해하지 않음
    opacity: "0", // 평소에는 숨김
    transition: "opacity 0.3s ease, transform 0.1s ease", // 부드러운 효과
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
});
document.body.appendChild(cursorCounter);

// [커서 추적] 마우스 이동 시 카운터 위치 업데이트
window.addEventListener("mousemove", (e) => {
    // 커서의 오른쪽 하단에 위치하도록 오프셋(15px)을 줍니다.
    cursorCounter.style.left = `${e.clientX + 15}px`;
    cursorCounter.style.top = `${e.clientY + 15}px`;
});

// [mousedown 이벤트] 수집 로직 내부 수정
window.addEventListener("mousedown", function(e) {
    if (!e.altKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    const path = e.composedPath();
    let imgSrc = "";
    let targetElement = e.target;

    for (const el of path) {
        if (!el.tagName) continue;
        const candidate = el.currentSrc || el.src || el.dataset?.src || el.querySelector('img')?.src;
        if (candidate && (candidate.startsWith('http') || candidate.startsWith('data:image'))) {
            imgSrc = candidate;
            targetElement = el;
            break;
        }
    }

    if (imgSrc) {
        chrome.storage.local.get({collectedImages: []}, (data) => {
            let images = data.collectedImages;
            if (!images.includes(imgSrc)) {
                images.push(imgSrc);
                chrome.storage.local.set({ collectedImages: images }, () => {
                    // [피드백 1] 테두리 강조 (초록색)
                    const originalOutline = targetElement.style.outline;
                    targetElement.style.outline = "5px solid #00FF00";
                    targetElement.style.outlineOffset = "-5px";
                    setTimeout(() => { targetElement.style.outline = originalOutline; }, 500);

                    // [피드백 2] 마우스 커서 카운터 업데이트
                    cursorCounter.innerText = images.length; // 숫자 업데이트
                    cursorCounter.style.opacity = "1"; // 보이게 함
                    cursorCounter.style.transform = "scale(1.2)"; // 약간 키우는 효과
                    
                    // 1.5초 후에 자동으로 숨김
                    if (window.cursorCounterTimeout) clearTimeout(window.cursorCounterTimeout);
                    window.cursorCounterTimeout = setTimeout(() => {
                        cursorCounter.style.opacity = "0";
                        cursorCounter.style.transform = "scale(1)";
                    }, 500);
                });
            } else {
                // 이미 수집된 경우, 노란색으로 테두리 표시 및 카운터 깜빡임
                const originalOutline = targetElement.style.outline;
                targetElement.style.outline = "5px solid #FFD700";
                setTimeout(() => { targetElement.style.outline = originalOutline; }, 500);

                cursorCounter.style.backgroundColor = "rgba(255, 215, 0, 0.9)"; // 노란색으로 변경
                cursorCounter.style.opacity = "1";
                setTimeout(() => { 
                    cursorCounter.style.opacity = "0"; 
                    cursorCounter.style.backgroundColor = "rgba(66, 133, 244, 0.9)"; // 원래색으로 복원
                }, 800);
            }
        });
    } else {
        // 이미지를 찾지 못한 경우, 빨간색으로 테두리 표시 및 카운터 깜빡임
        const originalOutline = targetElement.style.outline;
        targetElement.style.outline = "5px solid #FF4444";
        setTimeout(() => { targetElement.style.outline = originalOutline; }, 500);

        cursorCounter.style.backgroundColor = "rgba(255, 68, 68, 0.9)"; // 빨간색으로 변경
        cursorCounter.innerText = "!"; // 숫자가 아닌 느낌표 표시
        cursorCounter.style.opacity = "1";
        setTimeout(() => { 
            cursorCounter.style.opacity = "0"; 
            cursorCounter.style.backgroundColor = "rgba(66, 133, 244, 0.9)"; // 원래색으로 복원
        }, 800);
    }
}, true);

// [click 이벤트] 브라우저 기본 동작 방지 유지
window.addEventListener("click", (e) => {
    if (e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
}, true);