/**
 * Try Everything 歌词学习卡片
 * 交互逻辑和歌词数据 — 带音频播放 + 移动端适配版本
 */

// 分阶段歌词数据 — 基于 QQ 音乐 LRC 歌词精确时间戳切割
const stagesData = {
    1: {
        title: "第1阶段：开场哼唱",
        tip: "🎧 跟着节奏哼唱 Oh~，感受欢快的旋律！",
        cards: [
            {
                lyrics: "Oh oh oh oh oooh\nOh oh oh oh oooh",
                phonetic: "/oʊ/ - /oʊ/ - /oʊ/ - /oʊ/ - /uː/ × 2",
                translation: "（欢快的开场哼唱，连续两遍）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4],
                audio: "audio/stage1_card1.mp3"
            },
            {
                lyrics: "Oh oh oh oh oooh\nOh oh oh oh oooh",
                phonetic: "/oʊ/ - /oʊ/ - /oʊ/ - /oʊ/ - /uː/ × 2",
                translation: "（再来两遍，建立节奏感）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4],
                audio: "audio/stage1_card2.mp3"
            }
        ]
    },
    2: {
        title: "第2阶段：主歌第一段",
        tip: "🎧 讲述不怕失败、重新开始的故事，听听 Shakira 怎么唱~",
        cards: [
            {
                lyrics: "I messed up tonight\nI lost another fight",
                phonetic: "/aɪ/ MESSED /ʌp/ to·NIGHT, /aɪ/ LOST an·OTH·er /faɪt/",
                translation: "今晚我又搞砸了\n我又输了一场",
                rhythm: ["I", "messed", "up", "to-night", "I", "lost", "a-no-ther", "fight"],
                strongBeats: [1, 3, 5, 7],
                audio: "audio/stage2_card1.mp3"
            },
            {
                lyrics: "I still mess up\nbut I'll just start again",
                phonetic: "/aɪ/ STILL MESS /ʌp/, /bʌt/ /aɪl/ JUST START a·GAIN",
                translation: "我还是会搞砸\n但我会重新开始",
                rhythm: ["I", "still", "mess", "up", "but", "I'll", "just", "start", "a-gain"],
                strongBeats: [1, 3, 7, 8],
                audio: "audio/stage2_card2.mp3"
            },
            {
                lyrics: "I keep falling down\nI keep on hitting the ground",
                phonetic: "/aɪ/ KEEP FALL·ing /daʊn/, /aɪ/ KEEP /ɒn/ HIT·ting the /graʊnd/",
                translation: "我不断跌倒\n我不断撞到地面",
                rhythm: ["I", "keep", "fall-ing", "down", "I", "keep", "on", "hit-ting", "the", "ground"],
                strongBeats: [1, 3, 5, 7, 9],
                audio: "audio/stage2_card3.mp3"
            },
            {
                lyrics: "But I always get up now\nto see what's next",
                phonetic: "/bʌt/ /aɪ/ AL·ways GET /ʌp/ /naʊ/, to /siː/ /wɒts/ NEXT",
                translation: "但我总是重新站起来\n去看看接下来会发生什么",
                rhythm: ["But", "I", "al-ways", "get", "up", "now", "to", "see", "what's", "next"],
                strongBeats: [2, 3, 5, 7, 9],
                audio: "audio/stage2_card4.mp3"
            }
        ]
    },
    3: {
        title: "第3阶段：励志桥段",
        tip: "🎧 最有力量的部分！像小鸟一样勇敢，听原曲感受！",
        cards: [
            {
                lyrics: "Birds don't just fly\nthey fall down and get up",
                phonetic: "/bɜːdz/ DON'T JUST /flaɪ/, /ðeɪ/ FALL /daʊn/ and GET /ʌp/",
                translation: "鸟儿不只是飞翔\n它们也会跌落再站起",
                rhythm: ["Birds", "don't", "just", "fly", "they", "fall", "down", "and", "get", "up"],
                strongBeats: [0, 3, 5, 8],
                audio: "audio/stage3_card1.mp3"
            },
            {
                lyrics: "Nobody learns\nwithout getting it wrong",
                phonetic: "NO·bo·dy /lɜːnz/, with·OUT GET·ting /ɪt/ /rɒŋ/",
                translation: "没有人能学会\n如果不先犯错的话",
                rhythm: ["No-bo-dy", "learns", "with-out", "get-ting", "it", "wrong"],
                strongBeats: [0, 1, 2, 5],
                audio: "audio/stage3_card2.mp3"
            }
        ]
    },
    4: {
        title: "第4阶段：副歌（核心）",
        tip: "🎧 这是整首歌最重要的部分！跟着原曲一起唱！",
        cards: [
            {
                lyrics: "I won't give up\nno I won't give in",
                phonetic: "/aɪ/ WON'T GIVE /ʌp/, /noʊ/ /aɪ/ WON'T GIVE /ɪn/",
                translation: "我不会放弃\n不，我不会屈服",
                rhythm: ["I", "won't", "give", "up", "no", "I", "won't", "give", "in"],
                strongBeats: [0, 2, 4, 6, 8],
                audio: "audio/stage4_card1.mp3"
            },
            {
                lyrics: "Till I reach the end\nand then I'll start again",
                phonetic: "/tɪl/ /aɪ/ REACH the END, and /ðen/ /aɪl/ START a·GAIN",
                translation: "直到我到达终点\n然后我会重新开始",
                rhythm: ["Till", "I", "reach", "the", "end", "and", "then", "I'll", "start", "a-gain"],
                strongBeats: [0, 2, 4, 8, 9],
                audio: "audio/stage4_card2.mp3"
            },
            {
                lyrics: "No I won't leave\nI wanna try everything",
                phonetic: "/noʊ/ /aɪ/ WON'T /liːv/, /aɪ/ WAN·na /traɪ/ EV·ry·thing",
                translation: "不，我不会离开\n我想要尝试一切",
                rhythm: ["No", "I", "won't", "leave", "I", "wan-na", "try", "ev-ery-thing"],
                strongBeats: [0, 2, 3, 4, 6, 7],
                audio: "audio/stage4_card3.mp3"
            },
            {
                lyrics: "I wanna try\neven though I could fail",
                phonetic: "/aɪ/ WAN·na /traɪ/, EE·ven /ðoʊ/ /aɪ/ /kʊd/ /feɪl/",
                translation: "我想要尝试\n即使我可能会失败",
                rhythm: ["I", "wan-na", "try", "e-ven", "though", "I", "could", "fail"],
                strongBeats: [0, 2, 3, 7],
                audio: "audio/stage4_card4.mp3"
            }
        ]
    },
    5: {
        title: "第5阶段：第二段主歌",
        tip: "🎧 温暖鼓励的一段：你已经走了很远了！",
        cards: [
            {
                lyrics: "Look how far you've come\nyou filled your heart with love",
                phonetic: "/lʊk/ /haʊ/ FAR /juːv/ COME, /juː/ FILLED /jɔːr/ HEART with /lʌv/",
                translation: "看看你已经走了多远\n你的心充满了爱",
                rhythm: ["Look", "how", "far", "you've", "come", "you", "filled", "your", "heart", "with", "love"],
                strongBeats: [0, 2, 4, 6, 8, 10],
                audio: "audio/stage5_card1.mp3"
            },
            {
                lyrics: "Baby you've done enough\ntake a deep breath",
                phonetic: "BAY·bee /juːv/ DONE e·NOUGH, /teɪk/ a /diːp/ /breθ/",
                translation: "宝贝你已经做得够多了\n深呼吸一下",
                rhythm: ["Ba-by", "you've", "done", "e-nough", "take", "a", "deep", "breath"],
                strongBeats: [0, 2, 3, 4, 6, 7],
                audio: "audio/stage5_card2.mp3"
            },
            {
                lyrics: "Don't beat yourself up\ndon't need to run so fast",
                phonetic: "DON'T /biːt/ your·SELF /ʌp/, DON'T /niːd/ to /rʌn/ /soʊ/ FAST",
                translation: "别太自责了\n不需要跑那么快",
                rhythm: ["Don't", "beat", "your-self", "up", "don't", "need", "to", "run", "so", "fast"],
                strongBeats: [0, 1, 3, 4, 7, 9],
                audio: "audio/stage5_card3.mp3"
            },
            {
                lyrics: "Sometimes we come last\nbut we did our best",
                phonetic: "SOME·times /wiː/ COME /lɑːst/, /bʌt/ /wiː/ DID /aʊr/ BEST",
                translation: "有时候我们会落在最后\n但我们已经尽力了",
                rhythm: ["Some-times", "we", "come", "last", "but", "we", "did", "our", "best"],
                strongBeats: [0, 2, 3, 4, 6, 8],
                audio: "audio/stage5_card4.mp3"
            }
        ]
    },
    6: {
        title: "第6阶段：高潮尾声",
        tip: "🎧 最感人的尾声！拥抱错误，每天都在进步！",
        cards: [
            {
                lyrics: "I'll keep on making\nthose new mistakes",
                phonetic: "/aɪl/ KEEP /ɒn/ MAK·ing /ðoʊz/ /njuː/ mis·TAKES",
                translation: "我会继续犯\n那些新的错误",
                rhythm: ["I'll", "keep", "on", "mak-ing", "those", "new", "mis-takes"],
                strongBeats: [0, 1, 3, 5, 6],
                audio: "audio/stage6_card1.mp3"
            },
            {
                lyrics: "I'll keep on making them\nevery day",
                phonetic: "/aɪl/ KEEP /ɒn/ MAK·ing /ðem/ EV·ry /deɪ/",
                translation: "我会每天都继续犯\n新的错误",
                rhythm: ["I'll", "keep", "on", "mak-ing", "them", "ev-ery", "day"],
                strongBeats: [0, 1, 3, 5, 6],
                audio: "audio/stage6_card2.mp3"
            },
            {
                lyrics: "Those new mistakes",
                phonetic: "/ðoʊz/ /njuː/ mis·TAKES",
                translation: "那些新的错误\n（拥抱每一次尝试！）",
                rhythm: ["Those", "new", "mis-takes"],
                strongBeats: [0, 1, 2],
                audio: "audio/stage6_card3.mp3"
            }
        ]
    }
};

// 学习提示语
const tips = [
    "点击卡片可以翻转查看中文意思哦！",
    "跟着节奏拍手，强拍用力拍！",
    "先慢慢读，熟悉后再加快速度~",
    "可以配合动作一起记忆歌词！",
    "点击 ▶ 播放原曲片段，跟着唱~",
    "大声唱出来，不要害羞！",
    "和爸爸妈妈一起练习更有趣！",
    "👈👉 左右滑动可以切换阶段哦！"
];

// 当前状态
let currentStage = 1;
let currentCardIndex = 0;
let completedStages = new Set();
let currentAudio = null;
let isAutoPlaying = false;
let autoPlayQueue = [];

// 触控滑动状态
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 50;
const SWIPE_VERTICAL_LIMIT = 100;

// DOM元素
const cardsWrapper = document.getElementById('cardsWrapper');
const progressFill = document.getElementById('progressFill');
const tipText = document.getElementById('tipText');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const flipAllBtn = document.getElementById('flipAllBtn');
const stageBtns = document.querySelectorAll('.stage-btn');
const stageNav = document.getElementById('stageNav');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderStage(currentStage);
    updateProgress();
    setupEventListeners();
    setupTouchGestures();
    showRandomTip();
    adjustCardHeights();

    // 监听窗口变化重新计算高度
    window.addEventListener('resize', debounce(adjustCardHeights, 200));
    window.addEventListener('orientationchange', () => {
        setTimeout(adjustCardHeights, 300);
    });
});

// 防抖函数
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 停止当前播放
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    isAutoPlaying = false;
    autoPlayQueue = [];
    document.querySelectorAll('.audio-play-btn').forEach(btn => {
        btn.classList.remove('playing');
        const icon = btn.querySelector('.play-icon');
        if (icon) icon.textContent = '▶';
    });
    document.querySelectorAll('.audio-progress-fill').forEach(bar => {
        bar.style.width = '0%';
    });
}

// 播放指定音频
function playAudio(audioSrc, btnElement) {
    stopCurrentAudio();

    currentAudio = new Audio(audioSrc);
    
    if (btnElement) {
        btnElement.classList.add('playing');
        const icon = btnElement.querySelector('.play-icon');
        if (icon) icon.textContent = '⏸';
    }

    const card = btnElement ? btnElement.closest('.flip-card') : null;
    const progressBar = card ? card.querySelector('.audio-progress-fill') : null;

    currentAudio.addEventListener('timeupdate', () => {
        if (progressBar && currentAudio.duration) {
            const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
            progressBar.style.width = pct + '%';
        }
    });

    currentAudio.addEventListener('ended', () => {
        if (btnElement) {
            btnElement.classList.remove('playing');
            const icon = btnElement.querySelector('.play-icon');
            if (icon) icon.textContent = '▶';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        currentAudio = null;

        if (isAutoPlaying && autoPlayQueue.length > 0) {
            const next = autoPlayQueue.shift();
            setTimeout(() => {
                highlightCard(next.index);
                playAudio(next.src, next.btn);
            }, 500);
        } else {
            isAutoPlaying = false;
            const autoPlayBtn = document.getElementById('autoPlayBtn');
            if (autoPlayBtn) {
                autoPlayBtn.querySelector('.btn-icon').textContent = '🎵';
                autoPlayBtn.querySelector('span:last-child').textContent = '连续播放';
            }
        }
    });

    currentAudio.play().catch(e => {
        console.log('播放失败:', e);
        if (btnElement) {
            btnElement.classList.remove('playing');
            const icon = btnElement.querySelector('.play-icon');
            if (icon) icon.textContent = '▶';
        }
    });
}

// 高亮当前播放的卡片
function highlightCard(index) {
    document.querySelectorAll('.flip-card').forEach((card, i) => {
        card.classList.toggle('active', i === index);
    });
}

// 自动播放整个阶段
function autoPlayStage() {
    const stage = stagesData[currentStage];
    if (!stage) return;

    stopCurrentAudio();
    isAutoPlaying = true;
    autoPlayQueue = [];

    const cards = document.querySelectorAll('.flip-card');
    
    stage.cards.forEach((cardData, index) => {
        if (index === 0) return;
        const btn = cards[index] ? cards[index].querySelector('.audio-play-btn') : null;
        autoPlayQueue.push({
            src: cardData.audio,
            btn: btn,
            index: index
        });
    });

    const firstBtn = cards[0] ? cards[0].querySelector('.audio-play-btn') : null;
    highlightCard(0);
    playAudio(stage.cards[0].audio, firstBtn);
}

// 渲染当前阶段的卡片
function renderStage(stageNum) {
    const stage = stagesData[stageNum];
    if (!stage) return;

    stopCurrentAudio();
    cardsWrapper.innerHTML = '';
    
    stage.cards.forEach((card, index) => {
        const cardEl = createCardElement(card, index + 1);
        cardsWrapper.appendChild(cardEl);
    });

    tipText.textContent = stage.tip;
    updateStageBtns();
    
    // 渲染后调整高度
    requestAnimationFrame(() => {
        adjustCardHeights();
    });
}

// 创建卡片元素
function createCardElement(cardData, cardNum) {
    const card = document.createElement('div');
    card.className = 'flip-card';
    card.dataset.index = cardNum - 1;

    const rhythmHtml = cardData.rhythm.map((beat, idx) => {
        const isStrong = cardData.strongBeats.includes(idx);
        return `<span class="rhythm-beat ${isStrong ? 'strong' : ''}">${beat}</span>`;
    }).join('');

    card.innerHTML = `
        <div class="flip-card-inner">
            <div class="flip-card-front">
                <span class="card-number">#${cardNum}</span>
                <div class="card-lyrics">${cardData.lyrics}</div>
                <div class="card-phonetic">🔤 ${cardData.phonetic}</div>
                <div class="card-rhythm">${rhythmHtml}</div>
                <div class="audio-player-inline">
                    <button class="audio-play-btn" data-audio="${cardData.audio}" title="播放这句">
                        <span class="play-icon">▶</span>
                    </button>
                    <div class="audio-progress">
                        <div class="audio-progress-fill"></div>
                    </div>
                    <span class="audio-label">听原曲</span>
                </div>
                <span class="flip-hint">点击卡片翻转</span>
            </div>
            <div class="flip-card-back">
                <div class="card-translation">${cardData.translation}</div>
                <div class="card-tip">🌟 ${getEncouragement()}</div>
                <div class="audio-player-inline back-player">
                    <button class="audio-play-btn" data-audio="${cardData.audio}" title="再听一遍">
                        <span class="play-icon">▶</span>
                    </button>
                    <span class="audio-label">再听一遍</span>
                </div>
            </div>
        </div>
    `;

    // 播放按钮事件
    card.querySelectorAll('.audio-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const audioSrc = btn.dataset.audio;
            
            if (currentAudio && !currentAudio.paused && btn.classList.contains('playing')) {
                stopCurrentAudio();
                return;
            }
            
            playAudio(audioSrc, btn);
        });
    });

    // 点击卡片翻转
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.audio-play-btn') && !e.target.closest('.audio-player-inline')) {
            card.classList.toggle('flipped');
        }
    });

    return card;
}

// 动态调整卡片高度，使翻转时不会跳动
function adjustCardHeights() {
    const cards = document.querySelectorAll('.flip-card');
    cards.forEach(card => {
        const inner = card.querySelector('.flip-card-inner');
        const front = card.querySelector('.flip-card-front');
        const back = card.querySelector('.flip-card-back');
        
        if (!inner || !front || !back) return;

        // 先重置高度以获得自然高度
        card.style.height = 'auto';
        inner.style.height = 'auto';
        front.style.position = 'relative';
        back.style.position = 'relative';
        front.style.height = 'auto';
        back.style.height = 'auto';

        // 获取两面的自然高度
        const frontH = front.scrollHeight;
        const backH = back.scrollHeight;
        const maxH = Math.max(frontH, backH, 180);

        // 设置统一高度
        card.style.height = maxH + 'px';
        inner.style.height = maxH + 'px';
        front.style.position = 'absolute';
        back.style.position = 'absolute';
        front.style.height = maxH + 'px';
        back.style.height = maxH + 'px';
        front.style.minHeight = 'unset';
        back.style.minHeight = 'unset';
    });
}

// 获取随机鼓励语
function getEncouragement() {
    const encouragements = [
        "你做得很棒！",
        "继续加油！",
        "太厉害了！",
        "就是这样！",
        "真棒！",
        "你学得真快！"
    ];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
}

// 设置事件监听
function setupEventListeners() {
    // 阶段切换按钮
    stageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const stage = parseInt(btn.dataset.stage);
            switchStage(stage);
        });
    });

    // 上一阶段
    prevBtn.addEventListener('click', () => {
        if (currentStage > 1) {
            switchStage(currentStage - 1);
        }
    });

    // 下一阶段
    nextBtn.addEventListener('click', () => {
        completedStages.add(currentStage);
        
        if (currentStage < 6) {
            switchStage(currentStage + 1);
        } else {
            celebrateCompletion();
        }
        updateProgress();
    });

    // 翻转所有卡片
    flipAllBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.flip-card');
        cards.forEach(card => {
            card.classList.toggle('flipped');
        });
    });

    // 自动播放按钮
    const autoPlayBtn = document.getElementById('autoPlayBtn');
    if (autoPlayBtn) {
        autoPlayBtn.addEventListener('click', () => {
            if (isAutoPlaying) {
                stopCurrentAudio();
                autoPlayBtn.querySelector('.btn-icon').textContent = '🎵';
                autoPlayBtn.querySelector('span:last-child').textContent = '连续播放';
            } else {
                autoPlayStage();
                autoPlayBtn.querySelector('.btn-icon').textContent = '⏹';
                autoPlayBtn.querySelector('span:last-child').textContent = '停止播放';
            }
        });
    }
}

// 触控手势 — 左右滑动切换阶段
function setupTouchGestures() {
    const container = document.querySelector('.container');
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    // 只处理水平滑动，忽略垂直滑动
    if (Math.abs(diffX) < SWIPE_THRESHOLD || diffY > SWIPE_VERTICAL_LIMIT) return;

    // 不在输入框或按钮区域时才处理
    if (diffX < 0) {
        // 向左滑 → 下一阶段
        if (currentStage < 6) {
            completedStages.add(currentStage);
            switchStage(currentStage + 1);
            updateProgress();
        }
    } else {
        // 向右滑 → 上一阶段
        if (currentStage > 1) {
            switchStage(currentStage - 1);
        }
    }
}

// 切换阶段
function switchStage(stageNum) {
    currentStage = stageNum;
    renderStage(stageNum);
    updateStageBtns();
    updateProgress();
    scrollStageNavToActive();
    
    // 滚动到卡片区域
    cardsWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 阶段导航按钮自动滚动到当前激活的位置
function scrollStageNavToActive() {
    if (!stageNav) return;
    const activeBtn = stageNav.querySelector('.stage-btn.active');
    if (!activeBtn) return;

    const navRect = stageNav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const scrollLeft = activeBtn.offsetLeft - (navRect.width / 2) + (btnRect.width / 2);
    
    stageNav.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

// 更新阶段按钮状态
function updateStageBtns() {
    stageBtns.forEach(btn => {
        const stage = parseInt(btn.dataset.stage);
        btn.classList.remove('active', 'completed');
        
        if (stage === currentStage) {
            btn.classList.add('active');
        }
        if (completedStages.has(stage)) {
            btn.classList.add('completed');
        }
    });
}

// 更新进度条
function updateProgress() {
    const progress = (completedStages.size / 6) * 100;
    progressFill.style.width = `${Math.max(progress, 16)}%`;
}

// 显示随机提示
function showRandomTip() {
    setInterval(() => {
        if (Math.random() > 0.7) {
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            tipText.textContent = randomTip;
        }
    }, 10000);
}

// 完成庆祝
function celebrateCompletion() {
    const cards = document.querySelectorAll('.flip-card');
    cards.forEach(card => {
        card.classList.add('completed');
    });
    
    tipText.textContent = "🎉 太棒了！你已经学完所有阶段！可以完整唱这首歌了！";
    createConfetti();
}

// 创建彩带效果
function createConfetti() {
    const colors = ['#FF6B35', '#4ECDC4', '#95E1D3', '#FFE66D'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -10px;
                left: ${Math.random() * 100}vw;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                pointer-events: none;
                z-index: 1000;
                animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
    }
    
    if (!document.querySelector('#confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes confettiFall {
                to {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            if (currentStage > 1) switchStage(currentStage - 1);
            break;
        case 'ArrowRight':
            if (currentStage < 6) {
                completedStages.add(currentStage);
                switchStage(currentStage + 1);
                updateProgress();
            }
            break;
        case ' ':
            e.preventDefault();
            flipAllBtn.click();
            break;
        case 'p':
        case 'P':
            const autoPlayBtn = document.getElementById('autoPlayBtn');
            if (autoPlayBtn) autoPlayBtn.click();
            break;
    }
});
