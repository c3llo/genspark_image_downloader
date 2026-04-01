function updateCount() {
    chrome.storage.local.get({collectedImages: []}, (data) => {
        document.getElementById("count").innerText = data.collectedImages.length;
    });
}

document.addEventListener('DOMContentLoaded', updateCount);

document.getElementById("downloadBtn").addEventListener("click", async () => {
    chrome.storage.local.get({collectedImages: []}, async (data) => {
        const images = data.collectedImages;
        if (images.length === 0) return alert("수집된 이미지가 없습니다.");

        const selectValue = document.getElementById("imagesPerClip").value;
        const status = document.getElementById("status");

        for (let i = 0; i < images.length; i++) {
            let fileName = "";
            if (selectValue.startsWith("skip_")) {
                const skipStep = parseInt(selectValue.split("_")[1]);
                fileName = `${(i * skipStep) + 1}.jpg`;
            } else {
                const perClip = parseInt(selectValue);
                if (perClip === 1) {
                    fileName = `${i + 1}.jpg`;
                } else {
                    const clipNum = Math.floor(i / perClip) + 1;
                    const imageNumInClip = (i % perClip) + 1;
                    fileName = `${clipNum}-${imageNumInClip}.jpg`;
                }
            }

            chrome.downloads.download({ url: images[i], filename: fileName });
            await new Promise(resolve => setTimeout(resolve, 400));
        }
        status.innerText = "완료!";
    });
});

document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.storage.local.set({collectedImages: []}, () => {
        updateCount();
    });
});