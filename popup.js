function updateCount() {
    chrome.storage.local.get({collectedImages: []}, (data) => {
        document.getElementById("count").innerText = data.collectedImages.length;
    });
}

document.addEventListener('DOMContentLoaded', updateCount);

function getFileNameByRule(index, selectValue) {
    if (selectValue.startsWith("skip_")) {
        const skipStep = parseInt(selectValue.split("_")[1], 10);
        return `${(index * skipStep) + 1}.jpg`;
    }

    const perClip = parseInt(selectValue, 10);
    if (perClip === 1) {
        return `${index + 1}.jpg`;
    }

    const clipNum = Math.floor(index / perClip) + 1;
    const imageNumInClip = (index % perClip) + 1;
    return `${clipNum}-${imageNumInClip}.jpg`;
}

function extensionFromUrl(url) {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const extMatch = cleanUrl.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (!extMatch) return "";
    return extMatch[1].toLowerCase();
}

function extensionFromMime(mimeType) {
    if (!mimeType) return "jpg";
    const normalized = mimeType.toLowerCase();
    if (normalized.includes("jpeg")) return "jpg";
    if (normalized.includes("png")) return "png";
    if (normalized.includes("webp")) return "webp";
    if (normalized.includes("gif")) return "gif";
    if (normalized.includes("bmp")) return "bmp";
    if (normalized.includes("svg")) return "svg";
    return "jpg";
}

function setFileExtension(fileName, extension) {
    return fileName.replace(/\.[^.]+$/, `.${extension}`);
}

function createCrc32Table() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        const idx = (crc ^ data[i]) & 0xFF;
        crc = (crc >>> 8) ^ CRC32_TABLE[idx];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16(view, offset, value) {
    view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
    view.setUint32(offset, value, true);
}

function createZipBlob(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const data = entry.data;
        const crc = crc32(data);
        const size = data.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);
        const localView = new DataView(localHeader.buffer);
        writeUint32(localView, 0, 0x04034B50);
        writeUint16(localView, 4, 20);
        writeUint16(localView, 6, 0);
        writeUint16(localView, 8, 0);
        writeUint16(localView, 10, 0);
        writeUint16(localView, 12, 0);
        writeUint32(localView, 14, crc);
        writeUint32(localView, 18, size);
        writeUint32(localView, 22, size);
        writeUint16(localView, 26, nameBytes.length);
        writeUint16(localView, 28, 0);
        localHeader.set(nameBytes, 30);

        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(centralHeader.buffer);
        writeUint32(centralView, 0, 0x02014B50);
        writeUint16(centralView, 4, 20);
        writeUint16(centralView, 6, 20);
        writeUint16(centralView, 8, 0);
        writeUint16(centralView, 10, 0);
        writeUint16(centralView, 12, 0);
        writeUint16(centralView, 14, 0);
        writeUint32(centralView, 16, crc);
        writeUint32(centralView, 20, size);
        writeUint32(centralView, 24, size);
        writeUint16(centralView, 28, nameBytes.length);
        writeUint16(centralView, 30, 0);
        writeUint16(centralView, 32, 0);
        writeUint16(centralView, 34, 0);
        writeUint16(centralView, 36, 0);
        writeUint32(centralView, 38, 0);
        writeUint32(centralView, 42, localOffset);
        centralHeader.set(nameBytes, 46);

        localParts.push(localHeader, data);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    writeUint32(endView, 0, 0x06054B50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, entries.length);
    writeUint16(endView, 10, entries.length);
    writeUint32(endView, 12, centralSize);
    writeUint32(endView, 16, localOffset);
    writeUint16(endView, 20, 0);

    return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

document.getElementById("downloadBtn").addEventListener("click", async () => {
    chrome.storage.local.get({collectedImages: []}, async (data) => {
        const images = data.collectedImages;
        if (images.length === 0) return alert("수집된 이미지가 없습니다.");

        const selectValue = document.getElementById("imagesPerClip").value;
        const status = document.getElementById("status");
        status.innerText = "ZIP 준비 중...";

        try {
            const zipEntries = [];

            for (let i = 0; i < images.length; i++) {
                status.innerText = `이미지 수집 중... (${i + 1}/${images.length})`;
                const response = await fetch(images[i]);
                if (!response.ok) {
                    throw new Error(`이미지 다운로드 실패: ${response.status}`);
                }

                const buffer = await response.arrayBuffer();
                const dataBytes = new Uint8Array(buffer);
                let fileName = getFileNameByRule(i, selectValue);

                const extByMime = extensionFromMime(response.headers.get("content-type"));
                const extByUrl = extensionFromUrl(images[i]);
                const finalExt = extByUrl || extByMime;
                fileName = setFileExtension(fileName, finalExt);

                zipEntries.push({ name: fileName, data: dataBytes });
            }

            status.innerText = "ZIP 생성 중...";
            const zipBlob = createZipBlob(zipEntries);
            const zipUrl = URL.createObjectURL(zipBlob);
            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

            chrome.downloads.download(
                { url: zipUrl, filename: `genspark_images_${stamp}.zip`, saveAs: false },
                () => {
                    URL.revokeObjectURL(zipUrl);
                }
            );
            status.innerText = "완료! (ZIP 1개)";
        } catch (error) {
            status.innerText = "실패: 일부 이미지를 가져오지 못했습니다.";
            console.error(error);
        }
    });
});

document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.storage.local.set({collectedImages: []}, () => {
        updateCount();
    });
});