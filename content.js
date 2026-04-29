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

// ---------- 수집 패널 · 목록 모달 ----------
const GSC_PANEL_ID = "genspark-collector-panel";
const GSC_MODAL_ID = "genspark-collector-modal";

/** @param {unknown} entry */
function gscIsBlankSlot(entry) {
    return entry == null || entry === "";
}

/**
 * @param {unknown[]} images
 * @returns {{ real: number, blanks: number, total: number, nextNum: number }}
 */
function gscSlotStats(images) {
    const arr = Array.isArray(images) ? images : [];
    let real = 0;
    for (let i = 0; i < arr.length; i++) {
        if (!gscIsBlankSlot(arr[i])) real++;
    }
    const total = arr.length;
    const blanks = total - real;
    return { real, blanks, total, nextNum: total + 1 };
}

function gscUpdatePanelStats(images) {
    const { real, blanks, nextNum } = gscSlotStats(images);
    const realEl = document.getElementById("gsc-collect-count-real");
    const blanksEl = document.getElementById("gsc-collect-blanks");
    const nextEl = document.getElementById("gsc-collect-next");
    if (realEl) realEl.textContent = String(real);
    if (blanksEl) blanksEl.textContent = String(blanks);
    if (nextEl) nextEl.textContent = String(nextNum);
}

function gscGetModalElements() {
    return {
        backdrop: document.getElementById("gsc-modal-backdrop"),
        list: document.getElementById("gsc-modal-list")
    };
}

function gscRenderModalList(images) {
    const { list } = gscGetModalElements();
    if (!list) return;
    list.replaceChildren();
    const arr = Array.isArray(images) ? images : [];
    arr.forEach((entry, index) => {
        const isBlank = gscIsBlankSlot(entry);
        const row = document.createElement("div");
        Object.assign(row.style, {
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "8px 10px",
            borderBottom: "1px solid #eee",
            fontSize: "12px",
            lineHeight: "1.4",
            background: isBlank ? "#fafafa" : "transparent"
        });

        const insertBtn = document.createElement("button");
        insertBtn.type = "button";
        insertBtn.className = "gsc-insert-btn";
        insertBtn.dataset.index = String(index);
        insertBtn.setAttribute("aria-label", `${index + 1}번 앞에 빈칸 삽입`);
        insertBtn.title = "이 줄 앞에 빈칸 삽입";
        insertBtn.textContent = "+";
        Object.assign(insertBtn.style, {
            flexShrink: "0",
            width: "28px",
            height: "28px",
            padding: "0",
            border: "none",
            borderRadius: "6px",
            background: "#e8f0fe",
            color: "#1a73e8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "16px",
            lineHeight: "1"
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "gsc-del-btn";
        delBtn.dataset.index = String(index);
        delBtn.setAttribute("aria-label", `${index + 1}번 ${isBlank ? "빈칸 제거" : "항목 삭제"}`);
        Object.assign(delBtn.style, {
            flexShrink: "0",
            width: "28px",
            height: "28px",
            padding: "0",
            border: "none",
            borderRadius: "6px",
            background: "#fce8e6",
            color: "#c5221f",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });
        delBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

        const body = document.createElement("div");
        Object.assign(body.style, { flex: "1", minWidth: "0" });
        const numLine = document.createElement("span");
        numLine.style.fontWeight = "600";
        numLine.style.color = isBlank ? "#9aa0a6" : "#1a73e8";
        numLine.textContent = `${index + 1} : `;
        const urlLine = document.createElement("span");
        Object.assign(urlLine.style, {
            wordBreak: "break-all",
            color: isBlank ? "#9aa0a6" : "#333",
            fontStyle: isBlank ? "italic" : "normal"
        });
        if (isBlank) {
            urlLine.textContent = "(빈칸)";
            urlLine.removeAttribute("title");
        } else {
            urlLine.textContent = entry;
            urlLine.title = entry;
        }
        body.appendChild(numLine);
        body.appendChild(urlLine);

        row.appendChild(insertBtn);
        row.appendChild(delBtn);
        row.appendChild(body);
        list.appendChild(row);
    });
}

function gscOpenModal() {
    const backdrop = document.getElementById("gsc-modal-backdrop");
    if (!backdrop) return;
    chrome.storage.local.get({ collectedImages: [] }, (data) => {
        gscRenderModalList(data.collectedImages);
        backdrop.style.display = "flex";
    });
}

function gscCloseModal() {
    const backdrop = document.getElementById("gsc-modal-backdrop");
    if (backdrop) backdrop.style.display = "none";
}

function gscEnsureCollectorUI() {
    if (document.getElementById("gsc-modal-backdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "gsc-modal-backdrop";
    Object.assign(backdrop.style, {
        display: "none",
        position: "fixed",
        inset: "0",
        zIndex: "10003",
        background: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
    });

    const dialog = document.createElement("div");
    dialog.id = GSC_MODAL_ID;
    Object.assign(dialog.style, {
        background: "#fff",
        borderRadius: "12px",
        maxWidth: "min(560px, 100%)",
        width: "100%",
        maxHeight: "min(70vh, 520px)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        overflow: "hidden"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        padding: "12px 16px",
        borderBottom: "1px solid #e8eaed",
        fontWeight: "600",
        fontSize: "15px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px"
    });
    const title = document.createElement("span");
    title.textContent = "수집된 이미지 목록";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
        border: "none",
        background: "transparent",
        fontSize: "18px",
        lineHeight: "1",
        cursor: "pointer",
        color: "#5f6368",
        padding: "4px 8px"
    });
    closeBtn.addEventListener("click", () => gscCloseModal());
    header.appendChild(title);
    header.appendChild(closeBtn);

    const listWrap = document.createElement("div");
    listWrap.id = "gsc-modal-list";
    Object.assign(listWrap.style, {
        overflowY: "auto",
        flex: "1",
        minHeight: "0"
    });

    const modalFooter = document.createElement("div");
    modalFooter.id = "gsc-modal-footer";
    Object.assign(modalFooter.style, {
        padding: "10px 16px",
        borderTop: "1px solid #e8eaed",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: "#3c4043",
        background: "#f8f9fa"
    });
    const appendLabel = document.createElement("span");
    appendLabel.textContent = "끝에 빈칸";
    const appendInput = document.createElement("input");
    appendInput.type = "number";
    appendInput.id = "gsc-append-blanks-input";
    appendInput.min = "1";
    appendInput.step = "1";
    appendInput.value = "1";
    appendInput.title = "목록 끝에 추가할 빈 슬롯 개수 (다음 수집 번호가 맞도록)";
    Object.assign(appendInput.style, {
        width: "56px",
        padding: "6px 8px",
        border: "1px solid #dadce0",
        borderRadius: "6px",
        fontSize: "13px"
    });
    const appendBtn = document.createElement("button");
    appendBtn.type = "button";
    appendBtn.id = "gsc-append-blanks-btn";
    appendBtn.textContent = "추가";
    Object.assign(appendBtn.style, {
        padding: "6px 12px",
        border: "none",
        borderRadius: "6px",
        background: "#1a73e8",
        color: "#fff",
        fontWeight: "600",
        fontSize: "12px",
        cursor: "pointer"
    });
    appendBtn.addEventListener("mouseenter", () => {
        appendBtn.style.background = "#1557b0";
    });
    appendBtn.addEventListener("mouseleave", () => {
        appendBtn.style.background = "#1a73e8";
    });
    const appendHint = document.createElement("span");
    appendHint.style.color = "#5f6368";
    appendHint.style.flex = "1";
    appendHint.style.minWidth = "140px";
    appendHint.textContent = "예: 74장 수집 후 다음이 85번이면 10개 추가";
    modalFooter.appendChild(appendLabel);
    modalFooter.appendChild(appendInput);
    modalFooter.appendChild(appendBtn);
    modalFooter.appendChild(appendHint);

    appendBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let n = parseInt(appendInput.value, 10);
        if (!Number.isFinite(n) || n < 1) n = 1;
        chrome.storage.local.get({ collectedImages: [] }, (data) => {
            const images = [...(Array.isArray(data.collectedImages) ? data.collectedImages : [])];
            for (let k = 0; k < n; k++) images.push(null);
            chrome.storage.local.set({ collectedImages: images }, () => {
                gscRenderModalList(images);
                gscUpdatePanelStats(images);
            });
        });
    });

    dialog.appendChild(header);
    dialog.appendChild(listWrap);
    dialog.appendChild(modalFooter);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) gscCloseModal();
    });

    listWrap.addEventListener("click", (e) => {
        const ins = e.target.closest(".gsc-insert-btn");
        if (ins && listWrap.contains(ins)) {
            const idx = parseInt(ins.dataset.index, 10);
            if (Number.isNaN(idx)) return;
            chrome.storage.local.get({ collectedImages: [] }, (data) => {
                const images = [...(Array.isArray(data.collectedImages) ? data.collectedImages : [])];
                if (idx < 0 || idx > images.length) return;
                images.splice(idx, 0, null);
                chrome.storage.local.set({ collectedImages: images }, () => {
                    gscRenderModalList(images);
                    gscUpdatePanelStats(images);
                });
            });
            return;
        }
        const btn = e.target.closest(".gsc-del-btn");
        if (!btn || !listWrap.contains(btn)) return;
        const idx = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(idx)) return;
        chrome.storage.local.get({ collectedImages: [] }, (data) => {
            const images = [...(Array.isArray(data.collectedImages) ? data.collectedImages : [])];
            if (idx < 0 || idx >= images.length) return;
            images.splice(idx, 1);
            chrome.storage.local.set({ collectedImages: images }, () => {
                gscRenderModalList(images);
                gscUpdatePanelStats(images);
            });
        });
    });

    chrome.storage.local.get({ collectedImages: [] }, (data) => {
        gscUpdatePanelStats(data.collectedImages);
    });
}

gscEnsureCollectorUI();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.collectedImages) return;
    const next = changes.collectedImages.newValue;
    const list = Array.isArray(next) ? next : [];
    gscUpdatePanelStats(list);
    const backdrop = document.getElementById("gsc-modal-backdrop");
    if (backdrop && backdrop.style.display === "flex") {
        gscRenderModalList(list);
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "gsc-open-list-modal") return;
    gscEnsureCollectorUI();
    gscOpenModal();
});