document.addEventListener('DOMContentLoaded', () => {
    // Navigation handling
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    function switchView(viewId) {
        // Hide all views
        views.forEach(view => {
            view.style.display = 'none';
        });

        // Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
        }

        // Update nav active state
        navItems.forEach(item => {
            if (item.dataset.target === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.dataset.target;
            if (target) {
                switchView(target);
            }
        });
    });

    // Dashboard "Start Scan" button -> Switches to Deepfake View
    const dashboardScanBtn = document.getElementById('scan-btn-dashboard');
    if (dashboardScanBtn) {
        dashboardScanBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('deepfake-view');
        });
    }

    // Dashboard "Chat Analysis" button -> Switches to Chat View
    const dashboardChatBtn = document.getElementById('chat-btn-dashboard');
    if (dashboardChatBtn) {
        dashboardChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('chat-view');
        });
    }

    // ==========================================
    // Deepfake Analysis Logic
    // ==========================================
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const analysisBox = document.querySelector('.analysis-box');

    if (dropArea && fileInput && analysisBox) {
        // Click to upload
        dropArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File Selection
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            fileInput.value = ''; // Reset
        });

        // Drag and Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            dropArea.style.borderColor = '#60a5fa';
            dropArea.style.backgroundColor = 'rgba(30, 41, 59, 0.9)';
        }

        function unhighlight(e) {
            dropArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            dropArea.style.backgroundColor = '';
        }

        dropArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];

            // Show Preview
            const reader = new FileReader();
            reader.onload = function (e) {
                if (dropArea) {
                    dropArea.innerHTML = `
                        <div class="preview-container">
                            <img src="${e.target.result}" class="uploaded-image" alt="Uploaded Image">
                            <button class="remove-btn" id="remove-img-btn"><i class="fa-solid fa-xmark"></i></button>
                            <button class="re-scan-btn" id="rescan-btn"><i class="fa-solid fa-expand"></i> 立即偵測</button>
                        </div>
                    `;

                    // Re-bind remove event
                    const removeBtn = document.getElementById('remove-img-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', (ev) => {
                            ev.stopPropagation(); // Prevent triggering dropArea click
                            resetUpload();
                        });
                    }

                    // Bind "Scan Now" (Rescan) button
                    const rescanBtn = document.getElementById('rescan-btn');
                    if (rescanBtn) {
                        rescanBtn.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            startAnalysis(file);
                        });
                    }
                }
            }
            reader.readAsDataURL(file);

            startAnalysis(file);
        }
    }

    function resetUpload() {
        if (analysisBox) analysisBox.classList.remove('results-mode'); // Reset layout
        if (dropArea) {
            dropArea.innerHTML = `
                <div class="upload-content">
                    <div class="icon-circle">
                        <i class="fa-solid fa-upload"></i>
                    </div>
                    <h3>點擊上傳或拖放檔案</h3>
                    <p>支援 JPG, PNG, WEBP</p>
                    <input type="file" id="file-input" hidden accept="image/*">
                </div>
            `;

            // Re-attach file input listener since we overwrote the HTML
            const newFileInput = dropArea.querySelector('#file-input');
            if (newFileInput) {
                newFileInput.addEventListener('change', (e) => {
                    handleFiles(e.target.files);
                });
            }
        }

        // Reset Analysis Box
        if (analysisBox) {
            analysisBox.innerHTML = `
                 <div class="placeholder-content">
                    <div class="icon-circle dim">
                        <i class="fa-solid fa-expand"></i>
                    </div>
                    <h3>準備進行 AI 鑑識</h3>
                    <p>支援名人搜尋比對與特徵物理分析。</p>
                </div>
            `;
        }
    }

    // Mock Analysis for Demo (Fallback)
    function startMockAnalysis(file, errorMsg) {
        if (analysisBox) {
            analysisBox.classList.remove('results-mode');
            analysisBox.innerHTML = `
                <div class="result-content">
                    <div class="loading-spinner"></div>
                    <h3>正在切換至模擬模式...</h3>
                    <p style="color: #ef4444;">連線異常: ${errorMsg || '伺服器無回應'}</p>
                </div>
            `;
        }

        // Simulate delay
        setTimeout(() => {
            // Deterministic mock result (Safe for most, Risky if file size is odd, just for variety)
            const isSafe = file.size % 2 === 0;

            const mockData = isSafe ? {
                isSafe: true,
                riskScore: 15,
                riskLevel: "低風險",
                summary: `【系統提示：目前為模擬展示模式】<br>原因：${errorMsg || '無法連接至 AI 伺服器'}<br><br>系統自動產生展示結果，並非真實分析。`,
                faceAnalysis: "瞳孔反射自然，五官對稱。",
                lightingAnalysis: "光源方向一致，無異常陰影。",
                artifactAnalysis: "未檢測到明顯的生成偽影。"
            } : {
                isSafe: false,
                riskScore: 88,
                riskLevel: "高風險",
                summary: `【系統提示：目前為模擬展示模式】<br>原因：${errorMsg || '無法連接至 AI 伺服器'}<br><br>系統自動產生展示結果，並非真實分析。`,
                faceAnalysis: "眼部細節模糊，表情僵硬。",
                lightingAnalysis: "臉部光影與背景不符。",
                artifactAnalysis: "臉頰邊緣發現數位合成痕跡。"
            };

            showResults(mockData);
        }, 2000);
    }

    function startAnalysis(file) {
        if (analysisBox) {
            analysisBox.classList.remove('results-mode'); // Ensure centered for loading
            analysisBox.innerHTML = `
                <div class="result-content">
                    <div class="loading-spinner"></div>
                    <h3>正在分析影像...</h3>
                    <p>正在結合 Google Gemini Vision 與光影物理模型比對中</p>
                </div>
            `;
        }

        GeminiService.analyzeImage(file)
            .then(result => {
                showResults(result);
            })
            .catch(error => {
                console.warn("Image analysis failed, switching to mock:", error);

                let friendlyError = "伺服器連線失敗";
                if (error.message.includes("404")) friendlyError = "找不到雲端函數 (404) - 請確認已部署至 Netlify";
                else if (error.message.includes("500")) friendlyError = "伺服器內部錯誤 (500) - 請檢查 API Key 設定";
                else friendlyError = error.message;

                // Fallback to mock analysis
                startMockAnalysis(file, friendlyError);
            });
    }

    function showResults(data) {
        const isSafe = data.isSafe;

        let resultHTML = '';

        // Define colors and icons based on risk
        const scoreColor = isSafe ? '#10b981' : (data.riskScore > 80 ? '#ef4444' : '#f59e0b');
        const iconClass = isSafe ? 'fa-circle-check' : 'fa-triangle-exclamation';
        const bgStyle = isSafe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
        const borderStyle = isSafe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

        if (analysisBox) analysisBox.classList.add('results-mode');

        resultHTML = `
            <div class="result-content" style="padding: 24px; text-align: left;">
                
                <div class="score-card" style="background: ${bgStyle}; border-color: ${borderStyle};">
                    <div class="score-info">
                        <i class="fa-solid ${iconClass} score-icon" style="color: ${scoreColor};"></i>
                        <div class="score-text">
                            <h3 style="color: ${scoreColor};">${isSafe ? '影像真實性高' : '檢測到潛在風險'}</h3>
                            <p>風險等級：${data.riskLevel}</p>
                        </div>
                    </div>
                    <div class="score-value">
                        <div class="score-number" style="color: ${scoreColor};">${data.riskScore}<span style="font-size:14px; color:#94a3b8; font-weight:400;">/100</span></div>
                        <div class="score-label">威脅評分</div>
                    </div>
                </div>

                <div class="analysis-summary">
                    <h4><i class="fa-regular fa-clock"></i> 分析摘要</h4>
                    <p class="summary-text">${data.summary}</p>

                    <h4><i class="fa-solid fa-face-viewfinder"></i> 臉部生理特徵</h4>
                     <p class="summary-text">${data.faceAnalysis || '無法檢測到臉部特徵'}</p>

                    <h4><i class="fa-regular fa-sun"></i> 環境與物理光影</h4>
                    <p class="summary-text">${data.lightingAnalysis || '無法分析光影'}</p>

                     <h4><i class="fa-solid fa-fingerprint"></i> 數位偽影檢測</h4>
                    <p class="summary-text">${data.artifactAnalysis || '未發現明顯偽影'}</p>
                </div>
            </div>
        `;

        if (analysisBox) analysisBox.innerHTML = resultHTML;
    }

    // ==========================================
    // Chat Analysis Logic
    // ==========================================
    const GEMINI_API_KEY = 'SECURE_BACKEND_MODE';

    const chatInput = document.getElementById('chat-input');
    const analyzeChatBtn = document.getElementById('analyze-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const chatAnalysisResult = document.getElementById('chat-analysis-result');

    if (analyzeChatBtn && chatAnalysisResult) {
        clearChatBtn.addEventListener('click', () => {
            if (chatInput) {
                chatInput.value = '';
                chatInput.focus();
            }
            resetChatAnalysis();
        });

        analyzeChatBtn.addEventListener('click', async () => {
            const text = chatInput ? chatInput.value.trim() : '';
            if (!text) {
                alert('請先輸入對話內容');
                return;
            }

            await startChatAnalysis(text, GEMINI_API_KEY);
        });

        function resetChatAnalysis() {
            chatAnalysisResult.classList.remove('results-mode');
            chatAnalysisResult.innerHTML = `
                <div class="placeholder-content">
                    <div class="icon-circle dim">
                        <i class="fa-solid fa-radar"></i>
                    </div>
                    <h3>AI 語意風險偵測</h3>
                    <p>偵測情緒勒索、誘導匯款、假冒身份等詐騙特徵。</p>
                </div>
            `;
        }

        // Mock Analysis for Demo (Only runs if backend fails or explicitly invoked)
        async function startMockChatAnalysis(text) {
            chatAnalysisResult.classList.remove('results-mode');
            chatAnalysisResult.innerHTML = `
                <div class="result-content">
                    <div class="loading-spinner"></div>
                    <h3>正在進行語意分析 (模擬模式)...</h3>
                    <p>正在分析對話脈絡與潛在威脅</p>
                </div>
            `;

            // Simulate delay
            await new Promise(r => setTimeout(r, 2000));

            // Generate deterministic mock result based on text length or content keywords
            const isSuspicious = text.includes('匯款') || text.includes('帳戶') || text.includes('凍結') || text.length > 20;

            const mockData = isSuspicious ? {
                riskScore: 85,
                riskLevel: "High",
                category: "Financial Scam",
                summary: "此對話包含典型詐騙關鍵字，疑似涉及假冒機構誘導匯款或凍結帳戶的詐騙手法。",
                anomalies: ["提及「帳戶凍結」", "要求「盡快聯繫」製造緊迫感"],
                recommendations: ["切勿依照指示匯款", "直接撥打官方機構電話查證"]
            } : {
                riskScore: 15,
                riskLevel: "Low",
                category: "Safe",
                summary: "對話內容尚屬正常，未發現明顯詐騙特徵。",
                anomalies: [],
                recommendations: ["保持警覺即可"]
            };

            showChatResults(mockData);
        }

        async function startChatAnalysis(text, apiKey) {
            chatAnalysisResult.classList.remove('results-mode');
            chatAnalysisResult.innerHTML = `
                <div class="result-content">
                    <div class="loading-spinner"></div>
                    <h3>正在進行語意分析...</h3>
                    <p>Google Gemini AI 正在剖析對話脈絡與潛在威脅</p>
                </div>
            `;

            try {
                const result = await GeminiService.analyzeChat(text, apiKey);
                showChatResults(result);
            } catch (error) {
                console.error("Analysis Error:", error);
                // Fallback to mock if API/Function fails (optional, good for demo resilience)
                console.log("Switching to Mock Analysis due to error.");
                await startMockChatAnalysis(text);
            }
        }

        function showChatResults(data) {
            chatAnalysisResult.classList.add('results-mode');

            const isHighRisk = data.riskScore > 50;
            const scoreColor = isHighRisk ? '#ef4444' : '#10b981';
            const scoreBg = isHighRisk ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)';
            const scoreBorder = isHighRisk ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
            const iconClass = isHighRisk ? 'fa-triangle-exclamation' : 'fa-circle-check';

            const statsHTML = data.anomalies.length > 0 ? `
                 <div class="stat-box danger">
                    <div class="stat-value">${data.anomalies.length} 項</div>
                    <div class="stat-label">偵測異常數量</div>
                </div>
            ` : `
                 <div class="stat-box">
                    <div class="stat-value">0 項</div>
                    <div class="stat-label">偵測異常數量</div>
                </div>
            `;

            const anomaliesHTML = data.anomalies.map(anomaly => `
                <li style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary); line-height: 1.5; display: flex; align-items: start; gap: 8px;">
                    <span style="color: #ef4444; margin-top: 4px;">●</span>
                    <span>${anomaly}</span>
                </li>
            `).join('');

            const recommendationsHTML = (data.recommendations || []).map(rec => `
                <li style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary); line-height: 1.5; display: flex; align-items: start; gap: 8px;">
                    <span style="color: #10b981; margin-top: 4px;">●</span>
                    <span>${rec}</span>
                </li>
            `).join('');

            const resultHTML = `
                <div class="result-content" style="padding: 24px; text-align: left;">
                    <div class="score-card" style="background: ${scoreBg}; border-color: ${scoreBorder};">
                        <div class="score-info">
                            <i class="fa-solid ${iconClass} score-icon" style="color: ${scoreColor};"></i>
                            <div class="score-text">
                                <h3 style="color: ${scoreColor};">${data.category || (isHighRisk ? '偵測到潛在風險' : '未發現明顯風險')}</h3>
                                <p>風險等級：${data.riskLevel}</p>
                            </div>
                        </div>
                        <div class="score-value">
                            <div class="score-number" style="color: ${scoreColor};">${data.riskScore}<span style="font-size:14px; color:#94a3b8; font-weight:400;">/100</span></div>
                            <div class="score-label">威脅評分</div>
                        </div>
                    </div>

                    <div class="stats-container">
                        ${statsHTML}
                        <div class="stat-box">
                            <div class="stat-value">${data.category || '一般'}</div>
                            <div class="stat-label">風險類別</div>
                        </div>
                    </div>

                    <div class="report-section">
                        <div class="section-title"><i class="fa-solid fa-file-contract"></i> 分析摘要</div>
                        <p class="summary-text">${data.summary}</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        ${data.anomalies.length > 0 ? `
                        <div>
                             <div class="section-title" style="color:#ef4444;"><i class="fa-solid fa-bug"></i> 偵測到的異常特徵</div>
                            <ul style="list-style: none; padding: 0;">
                                ${anomaliesHTML}
                            </ul>
                        </div>
                        ` : ''}
                        
                        <div>
                             <div class="section-title" style="color:#10b981;"><i class="fa-solid fa-shield-halved"></i> 建議採取行動</div>
                            <ul style="list-style: none; padding: 0;">
                                ${recommendationsHTML}
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            chatAnalysisResult.innerHTML = resultHTML;
        }
    }
});

class GeminiService {
    // Chat Analysis
    static async analyzeChat(text, apiKey) {
        try {
            const response = await fetch('/.netlify/functions/analyze-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (response.ok) return await response.json();
            throw new Error(`Server returned ${response.status}`);
        } catch (error) {
            console.warn("Chat Function call failed:", error);
            throw error;
        }
    }

    // Image Analysis
    static async analyzeImage(file) {
        try {
            // Compress/Resize image before sending
            const compressedBase64 = await this.resizeAndConvert(file);

            const response = await fetch('/.netlify/functions/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: compressedBase64.split(',')[1], // Remove data:image/xxx;base64,
                    mimeType: file.type
                })
            });

            if (response.ok) return await response.json();
            // If error, try to parse JSON error message, else generic
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned ${response.status}`);
        } catch (error) {
            console.warn("Image Function call failed:", error);
            throw error;
        }
    }

    static resizeAndConvert(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize to max 1536px to allow for better detail analysis (Pro model input)
                    const MAX_SIZE = 1536;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 0.7 quality
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }
}
