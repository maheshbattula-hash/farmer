
const SF_LANGUAGE_META = {
    en: { speech: "en-IN", input: "en-IN", prefixes: ["en-in", "en"], names: ["english"], rate: 0.67 },
    te: { speech: "te-IN", input: "te-IN", prefixes: ["te-in", "te"], names: ["telugu"], rate: 0.62 },
    ta: { speech: "ta-IN", input: "ta-IN", prefixes: ["ta-in", "ta"], names: ["tamil"], rate: 0.62 },
    hi: { speech: "hi-IN", input: "hi-IN", prefixes: ["hi-in", "hi"], names: ["hindi", "devanagari"], rate: 0.62 },
    kn: { speech: "kn-IN", input: "kn-IN", prefixes: ["kn-in", "kn"], names: ["kannada"], rate: 0.62 },
    ml: { speech: "ml-IN", input: "ml-IN", prefixes: ["ml-in", "ml"], names: ["malayalam"], rate: 0.62 }
};
const SF_RUNTIME_TRANSLATION_LANGUAGES = new Set(["te", "ta", "hi", "kn", "ml"]);
const SF_RUNTIME_TRANSLATION_STORAGE_KEY_PREFIX = "sf_runtime_translations_v2:";
const SF_RUNTIME_TRANSLATION_ATTRIBUTE_NAMES = [
    "placeholder",
    "title",
    "aria-label",
    "data-a11y-read-unsupported",
    "data-a11y-read-empty",
    "data-a11y-read-started",
    "data-a11y-read-error",
    "data-a11y-read-active",
    "data-a11y-read-inactive",
    "data-a11y-speak-unsupported",
    "data-a11y-speak-unavailable",
    "data-a11y-speak-listening",
    "data-a11y-speak-error",
    "data-a11y-speak-empty",
    "data-a11y-speak-success",
    "data-a11y-select-field",
    "data-a11y-selection-started"
];
const sfRuntimeTranslationMemory = {};
let sfRuntimePageTranslationPromise = null;
let sfRuntimeTranslationObserver = null;
let sfRuntimeTranslationObserverTimer = null;
let sfRuntimeTranslationInFlight = false;

function getSfLanguageConfig(languageCode) {
    const normalizedLanguage = (languageCode || "en").toLowerCase();
    return SF_LANGUAGE_META[normalizedLanguage] || SF_LANGUAGE_META.en;
}

function getRuntimeTranslationLanguage() {
    return (document.documentElement.lang || "en").trim().toLowerCase();
}

function decodeRuntimeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}

function normalizeRuntimeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function shouldTranslateRuntimeText(value) {
    const normalizedValue = normalizeRuntimeText(value);
    if (!normalizedValue || normalizedValue.length < 2) {
        return false;
    }
    if (!/[A-Za-z]/.test(normalizedValue)) {
        return false;
    }
    if (/^[A-Z]{1,4}$/.test(normalizedValue)) {
        return false;
    }
    if (/^[\d\s.,:%()+\-\\/]+$/.test(normalizedValue)) {
        return false;
    }
    if (/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(normalizedValue)) {
        return false;
    }
    if (/^(https?:\/\/|\/|mailto:)/i.test(normalizedValue)) {
        return false;
    }
    if (/(example\.com|localhost|127\.0\.0\.1)/i.test(normalizedValue)) {
        return false;
    }
    return true;
}

function getRuntimeTranslationCache(language) {
    if (sfRuntimeTranslationMemory[language]) {
        return sfRuntimeTranslationMemory[language];
    }

    let cache = {};
    try {
        const stored = window.localStorage.getItem(`${SF_RUNTIME_TRANSLATION_STORAGE_KEY_PREFIX}${language}`);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === "object") {
                cache = parsed;
            }
        }
    } catch (error) {
        cache = {};
    }

    sfRuntimeTranslationMemory[language] = cache;
    return cache;
}

function persistRuntimeTranslationCache(language) {
    try {
        const cache = sfRuntimeTranslationMemory[language] || {};
        const entries = Object.entries(cache);
        const trimmedEntries = entries.length > 2500 ? entries.slice(entries.length - 2000) : entries;
        const trimmedCache = Object.fromEntries(trimmedEntries);
        sfRuntimeTranslationMemory[language] = trimmedCache;
        window.localStorage.setItem(
            `${SF_RUNTIME_TRANSLATION_STORAGE_KEY_PREFIX}${language}`,
            JSON.stringify(trimmedCache),
        );
    } catch (error) {
        // Ignore localStorage write issues.
    }
}

function chunkRuntimeTexts(texts, maxItems = 24, maxChars = 3600) {
    const chunks = [];
    let currentChunk = [];
    let currentChars = 0;

    texts.forEach((text) => {
        if (
            currentChunk.length >= maxItems
            || (currentChunk.length && currentChars + text.length > maxChars)
        ) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentChars = 0;
        }
        currentChunk.push(text);
        currentChars += text.length;
    });

    if (currentChunk.length) {
        chunks.push(currentChunk);
    }
    return chunks;
}

async function requestRuntimeTranslations(texts, language) {
    if (!texts.length) {
        return [];
    }

    const translatedTexts = [];
    for (const chunk of chunkRuntimeTexts(texts)) {
        const response = await fetch("/i18n/translate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                language,
                texts: chunk
            })
        });

        if (!response.ok) {
            throw new Error(`translation_request_failed:${response.status}`);
        }

        const payload = await response.json();
        const translations = Array.isArray(payload.translations) ? payload.translations : [];
        if (translations.length !== chunk.length) {
            throw new Error("translation_payload_mismatch");
        }

        translatedTexts.push(...translations.map((value, index) => {
            const translatedValue = decodeRuntimeHtmlEntities(String(value || "")).trim();
            return translatedValue || chunk[index];
        }));
    }

    return translatedTexts;
}

async function translateRuntimeStrings(strings) {
    const language = getRuntimeTranslationLanguage();
    if (!SF_RUNTIME_TRANSLATION_LANGUAGES.has(language)) {
        return strings.slice();
    }

    const cache = getRuntimeTranslationCache(language);
    const results = strings.slice();
    const missingTexts = [];

    strings.forEach((value, index) => {
        const normalizedValue = normalizeRuntimeText(value);
        if (!shouldTranslateRuntimeText(normalizedValue)) {
            results[index] = value;
            return;
        }

        if (Object.prototype.hasOwnProperty.call(cache, normalizedValue)) {
            results[index] = cache[normalizedValue];
            return;
        }

        missingTexts.push(normalizedValue);
    });

    if (missingTexts.length) {
        const uniqueTexts = Array.from(new Set(missingTexts));
        const translatedMissingTexts = await requestRuntimeTranslations(uniqueTexts, language);
        uniqueTexts.forEach((sourceText, index) => {
            cache[sourceText] = translatedMissingTexts[index] || sourceText;
        });
        persistRuntimeTranslationCache(language);

        strings.forEach((value, index) => {
            const normalizedValue = normalizeRuntimeText(value);
            if (Object.prototype.hasOwnProperty.call(cache, normalizedValue)) {
                results[index] = cache[normalizedValue];
            }
        });
    }

    return results;
}

function scheduleRuntimePageTranslation(force = true) {
    const language = getRuntimeTranslationLanguage();
    if (!SF_RUNTIME_TRANSLATION_LANGUAGES.has(language)) {
        return;
    }
    if (sfRuntimeTranslationInFlight) {
        return;
    }
    if (sfRuntimeTranslationObserverTimer) {
        window.clearTimeout(sfRuntimeTranslationObserverTimer);
    }
    sfRuntimeTranslationObserverTimer = window.setTimeout(() => {
        sfRuntimeTranslationObserverTimer = null;
        ensureRuntimePageTranslation(force).catch(() => undefined);
    }, 120);
}

function observeRuntimePageTranslation() {
    const language = getRuntimeTranslationLanguage();
    if (!SF_RUNTIME_TRANSLATION_LANGUAGES.has(language)) {
        return;
    }
    if (typeof window.MutationObserver !== "function" || sfRuntimeTranslationObserver || !document.body) {
        return;
    }

    sfRuntimeTranslationObserver = new MutationObserver((mutations) => {
        if (sfRuntimeTranslationInFlight) {
            return;
        }

        const hasRelevantMutation = mutations.some((mutation) => {
            if (mutation.type === "characterData") {
                return shouldTranslateRuntimeText(normalizeRuntimeText(mutation.target.nodeValue || ""));
            }

            if (mutation.type === "childList" && mutation.addedNodes.length) {
                return Array.from(mutation.addedNodes).some((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return shouldTranslateRuntimeText(normalizeRuntimeText(node.nodeValue || ""));
                    }
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return !node.closest("script, style, [translate='no'], .notranslate, [data-no-translate]");
                    }
                    return false;
                });
            }

            return false;
        });

        if (hasRelevantMutation) {
            scheduleRuntimePageTranslation(true);
        }
    });

    sfRuntimeTranslationObserver.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
    });
}

function collectRuntimeTranslationTargets() {
    const targets = [];
    const body = document.body;
    if (!body) {
        return targets;
    }

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parentElement = node.parentElement;
            if (!parentElement) {
                return NodeFilter.FILTER_REJECT;
            }
            if (parentElement.closest("script, style, textarea, code, pre, [translate='no'], .notranslate, [data-no-translate]")) {
                return NodeFilter.FILTER_REJECT;
            }
            const rawValue = node.nodeValue || "";
            const normalizedValue = normalizeRuntimeText(rawValue);
            return shouldTranslateRuntimeText(normalizedValue)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
    });

    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        const rawValue = currentNode.nodeValue || "";
        const leadingWhitespace = rawValue.match(/^\s*/)?.[0] || "";
        const trailingWhitespace = rawValue.match(/\s*$/)?.[0] || "";
        const normalizedValue = normalizeRuntimeText(rawValue);
        if (!shouldTranslateRuntimeText(normalizedValue)) {
            continue;
        }
        targets.push({
            text: normalizedValue,
            apply(translatedValue) {
                currentNode.nodeValue = `${leadingWhitespace}${translatedValue}${trailingWhitespace}`;
            }
        });
    }

    const attributeSelector = SF_RUNTIME_TRANSLATION_ATTRIBUTE_NAMES
        .map((attributeName) => `[${attributeName}]`)
        .join(",");
    if (attributeSelector) {
        document.querySelectorAll(attributeSelector).forEach((element) => {
            if (element.closest("[translate='no'], .notranslate, [data-no-translate]")) {
                return;
            }
            SF_RUNTIME_TRANSLATION_ATTRIBUTE_NAMES.forEach((attributeName) => {
                const attributeValue = element.getAttribute(attributeName);
                const normalizedValue = normalizeRuntimeText(attributeValue || "");
                if (!shouldTranslateRuntimeText(normalizedValue)) {
                    return;
                }
                targets.push({
                    text: normalizedValue,
                    apply(translatedValue) {
                        element.setAttribute(attributeName, translatedValue);
                    }
                });
            });
        });
    }

    document.querySelectorAll('input[type="button"], input[type="submit"], input[type="reset"]').forEach((input) => {
        const value = normalizeRuntimeText(input.value || "");
        if (!shouldTranslateRuntimeText(value)) {
            return;
        }
        targets.push({
            text: value,
            apply(translatedValue) {
                input.value = translatedValue;
            }
        });
    });

    return targets;
}

async function ensureRuntimePageTranslation(force = false) {
    const language = getRuntimeTranslationLanguage();
    if (!SF_RUNTIME_TRANSLATION_LANGUAGES.has(language)) {
        return false;
    }
    if (!force && sfRuntimePageTranslationPromise) {
        return sfRuntimePageTranslationPromise;
    }

    sfRuntimePageTranslationPromise = (async () => {
        sfRuntimeTranslationInFlight = true;
        try {
            const targets = collectRuntimeTranslationTargets();
            if (!targets.length) {
                return true;
            }

            const translatedValues = await translateRuntimeStrings(targets.map((target) => target.text));
            targets.forEach((target, index) => {
                const translatedValue = translatedValues[index];
                if (!translatedValue || translatedValue === target.text) {
                    return;
                }
                target.apply(translatedValue);
            });

            document.documentElement.setAttribute("data-sf-runtime-translated", "true");
            return true;
        } catch (error) {
            console.warn("Smart Farmer runtime translation failed", error);
            return false;
        } finally {
            sfRuntimeTranslationInFlight = false;
        }
    })();

    return sfRuntimePageTranslationPromise;
}

window.sfLanguageConfig = SF_LANGUAGE_META;
window.sfTranslateRuntimeStrings = translateRuntimeStrings;
window.sfScheduleRuntimePageTranslation = scheduleRuntimePageTranslation;
window.sfTranslateRuntimeObject = async (targetObject) => {
    if (!targetObject || typeof targetObject !== "object") {
        return targetObject;
    }

    const translatableKeys = Object.keys(targetObject).filter((key) => {
        const value = targetObject[key];
        return typeof value === "string"
            && !/[<>]/.test(value)
            && shouldTranslateRuntimeText(value);
    });

    if (!translatableKeys.length) {
        return targetObject;
    }

    const translatedValues = await translateRuntimeStrings(translatableKeys.map((key) => targetObject[key]));
    translatableKeys.forEach((key, index) => {
        targetObject[key] = translatedValues[index];
    });
    return targetObject;
};
window.sfEnsureRuntimePageTranslation = ensureRuntimePageTranslation;

document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("endpoint-register")) {
        const registerAside = document.querySelector("main aside .relative.flex.h-full.flex-col");
        const asideIntro = registerAside?.querySelector(":scope > div:first-child");
        const asideMetrics = registerAside?.querySelector(":scope > div:last-child");

        if (registerAside && asideIntro && asideMetrics && !registerAside.querySelector(".auth-visual-carousel")) {
            const carousel = document.createElement("div");
            carousel.className = "auth-visual-carousel";
            carousel.setAttribute("aria-label", "Farmer and customer stories");
            carousel.innerHTML = `
                <div class="auth-carousel-track">
                    <article class="auth-carousel-slide auth-carousel-slide-farmer">
                        <div class="auth-carousel-copy">
                            <p class="auth-carousel-eyebrow">Farmer spotlight</p>
                            <h3>List harvests with proof, stock, and location clarity.</h3>
                            <p>Designed for growers who need trust signals, faster discovery, and direct order flow.</p>
                        </div>
                        <div class="auth-carousel-illustration" aria-hidden="true">
                            <svg viewBox="0 0 320 220" role="presentation">
                                <defs>
                                    <linearGradient id="farmerSkyLive" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#f8ebc8"></stop>
                                        <stop offset="100%" stop-color="#d8ecd8"></stop>
                                    </linearGradient>
                                    <linearGradient id="farmerGroundLive" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#97c38d"></stop>
                                        <stop offset="100%" stop-color="#4f8753"></stop>
                                    </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="320" height="220" rx="24" fill="url(#farmerSkyLive)"></rect>
                                <circle cx="255" cy="52" r="24" fill="#f2c768" opacity="0.9"></circle>
                                <rect x="0" y="148" width="320" height="72" fill="url(#farmerGroundLive)"></rect>
                                <path d="M0 160 C60 130 120 132 180 160 S270 190 320 156 L320 220 L0 220 Z" fill="#6ea96b" opacity="0.8"></path>
                                <path d="M46 168 C66 150 90 146 112 164" stroke="#e8f4e4" stroke-width="4" stroke-linecap="round" fill="none"></path>
                                <path d="M70 172 L70 145" stroke="#3f7d48" stroke-width="4" stroke-linecap="round"></path>
                                <path d="M70 156 C82 146 88 139 92 128" stroke="#3f7d48" stroke-width="4" stroke-linecap="round" fill="none"></path>
                                <path d="M70 158 C58 147 54 141 49 132" stroke="#3f7d48" stroke-width="4" stroke-linecap="round" fill="none"></path>
                                <ellipse cx="166" cy="102" rx="34" ry="36" fill="#f0c690"></ellipse>
                                <rect x="142" y="135" width="48" height="34" rx="16" fill="#d18853"></rect>
                                <path d="M128 101 C132 70 154 52 183 57 C203 60 217 76 219 98" fill="#6f4d2c"></path>
                                <path d="M131 96 C147 84 172 80 201 92" fill="#7c5733"></path>
                                <rect x="126" y="96" width="83" height="15" rx="7.5" fill="#d7a44a"></rect>
                                <rect x="153" y="108" width="30" height="14" rx="7" fill="#d7a44a"></rect>
                                <rect x="126" y="150" width="84" height="42" rx="18" fill="#2f6b3a"></rect>
                                <rect x="141" y="192" width="17" height="25" rx="8" fill="#29412d"></rect>
                                <rect x="178" y="192" width="17" height="25" rx="8" fill="#29412d"></rect>
                                <path d="M128 149 L107 184" stroke="#f0c690" stroke-width="12" stroke-linecap="round"></path>
                                <path d="M207 149 L230 181" stroke="#f0c690" stroke-width="12" stroke-linecap="round"></path>
                                <rect x="96" y="180" width="30" height="13" rx="6.5" fill="#825732"></rect>
                                <path d="M222 176 C242 163 265 161 283 175" stroke="#3f7d48" stroke-width="5" stroke-linecap="round" fill="none"></path>
                            </svg>
                        </div>
                    </article>
                    <article class="auth-carousel-slide auth-carousel-slide-customer">
                        <div class="auth-carousel-copy">
                            <p class="auth-carousel-eyebrow">Customer view</p>
                            <h3>Browse reliable produce and place cleaner local orders.</h3>
                            <p>Built for buyers who want transparent sourcing, verified growers, and confident checkout.</p>
                        </div>
                        <div class="auth-carousel-illustration" aria-hidden="true">
                            <svg viewBox="0 0 320 220" role="presentation">
                                <defs>
                                    <linearGradient id="customerSkyLive" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#edf5ff"></stop>
                                        <stop offset="100%" stop-color="#f6ead7"></stop>
                                    </linearGradient>
                                    <linearGradient id="customerCardLive" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#ffffff"></stop>
                                        <stop offset="100%" stop-color="#eef2ea"></stop>
                                    </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="320" height="220" rx="24" fill="url(#customerSkyLive)"></rect>
                                <rect x="36" y="40" width="248" height="142" rx="22" fill="url(#customerCardLive)" stroke="#d8e3d6"></rect>
                                <rect x="56" y="58" width="74" height="74" rx="18" fill="#dbead8"></rect>
                                <circle cx="93" cy="92" r="22" fill="#84b074"></circle>
                                <path d="M92 78 C98 71 107 67 117 66" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none"></path>
                                <path d="M85 94 C92 88 101 84 111 83" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none"></path>
                                <rect x="146" y="63" width="108" height="13" rx="6.5" fill="#c8d7c6"></rect>
                                <rect x="146" y="84" width="88" height="11" rx="5.5" fill="#dbe5d8"></rect>
                                <rect x="56" y="146" width="198" height="18" rx="9" fill="#eff4ed"></rect>
                                <rect x="60" y="149" width="116" height="12" rx="6" fill="#7faa74"></rect>
                                <circle cx="238" cy="155" r="16" fill="#2f6f3b"></circle>
                                <path d="M232 155 L236 159 L245 150" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
                                <ellipse cx="273" cy="183" rx="22" ry="8" fill="#d6e2d3" opacity="0.8"></ellipse>
                                <ellipse cx="257" cy="186" rx="15" ry="6" fill="#e5c16f" opacity="0.95"></ellipse>
                                <ellipse cx="285" cy="186" rx="14" ry="6" fill="#d86f4e" opacity="0.95"></ellipse>
                            </svg>
                        </div>
                    </article>
                </div>
                <div class="auth-carousel-dots" aria-hidden="true">
                    <span></span>
                    <span></span>
                </div>
            `;
            registerAside.insertBefore(carousel, asideMetrics);
        }
    }

    const customSelects = [];
    const closeCustomSelect = (customSelect) => {
        if (!customSelect || !customSelect.menu || !customSelect.trigger) {
            return;
        }
        customSelect.root.classList.remove("is-open");
        customSelect.menu.hidden = true;
        customSelect.trigger.setAttribute("aria-expanded", "false");
    };
    const closeAllCustomSelects = (exceptRoot = null) => {
        customSelects.forEach((customSelect) => {
            if (exceptRoot && customSelect.root === exceptRoot) {
                return;
            }
            closeCustomSelect(customSelect);
        });
    };
    const syncCustomSelectValue = (customSelect) => {
        const selectedOption = customSelect.select.options[customSelect.select.selectedIndex];
        customSelect.value.textContent = selectedOption ? selectedOption.textContent : "";
        customSelect.options.forEach((optionButton) => {
            const isSelected = optionButton.dataset.value === customSelect.select.value;
            optionButton.classList.toggle("is-selected", isSelected);
            optionButton.setAttribute("aria-selected", isSelected ? "true" : "false");
        });
    };
    document.querySelectorAll("select.select-shell").forEach((select, index) => {
        if (select.multiple || select.dataset.customSelectReady === "true") {
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "custom-select";
        wrapper.dataset.customSelect = "true";

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        select.classList.add("is-customized");
        select.dataset.customSelectReady = "true";
        const selectId = select.id || `sf-custom-select-${index + 1}`;
        if (!select.id) {
            select.id = selectId;
        }

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "custom-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", `${selectId}-menu`);
        trigger.innerHTML = `
            <span class="custom-select-value"></span>
            <span class="custom-select-icon" aria-hidden="true">
                <i class="fa-solid fa-angle-down"></i>
            </span>
        `;

        const menu = document.createElement("div");
        menu.className = "custom-select-menu";
        menu.id = `${selectId}-menu`;
        menu.setAttribute("role", "listbox");
        menu.hidden = true;

        const optionButtons = Array.from(select.options).map((option, optionIndex) => {
            const optionButton = document.createElement("button");
            optionButton.type = "button";
            optionButton.className = "custom-select-option";
            optionButton.setAttribute("role", "option");
            optionButton.dataset.value = option.value;
            optionButton.dataset.index = String(optionIndex);
            optionButton.disabled = option.disabled;
            optionButton.innerHTML = `
                <span>${option.textContent || ""}</span>
                <span class="custom-select-option-check" aria-hidden="true">
                    <i class="fa-solid fa-check"></i>
                </span>
            `;
            menu.appendChild(optionButton);
            return optionButton;
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);

        const customSelect = {
            root: wrapper,
            select,
            trigger,
            menu,
            value: trigger.querySelector(".custom-select-value"),
            options: optionButtons
        };
        customSelects.push(customSelect);
        syncCustomSelectValue(customSelect);

        trigger.addEventListener("click", () => {
            const willOpen = menu.hidden;
            closeAllCustomSelects(willOpen ? wrapper : null);
            wrapper.classList.toggle("is-open", willOpen);
            menu.hidden = !willOpen;
            trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });

        optionButtons.forEach((optionButton) => {
            optionButton.addEventListener("click", () => {
                if (optionButton.disabled) {
                    return;
                }
                if (select.value !== optionButton.dataset.value) {
                    select.value = optionButton.dataset.value;
                    select.dispatchEvent(new Event("input", { bubbles: true }));
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                }
                syncCustomSelectValue(customSelect);
                closeCustomSelect(customSelect);
                trigger.focus();
            });
        });

        select.addEventListener("change", () => {
            syncCustomSelectValue(customSelect);
        });

        trigger.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (menu.hidden) {
                    closeAllCustomSelects(wrapper);
                    wrapper.classList.add("is-open");
                    menu.hidden = false;
                    trigger.setAttribute("aria-expanded", "true");
                }
                const selectedButton = optionButtons.find((optionButton) => optionButton.dataset.value === select.value && !optionButton.disabled)
                    || optionButtons.find((optionButton) => !optionButton.disabled);
                selectedButton?.focus();
            }
        });

        menu.addEventListener("keydown", (event) => {
            const activeIndex = optionButtons.indexOf(document.activeElement);
            if (event.key === "Escape") {
                event.preventDefault();
                closeCustomSelect(customSelect);
                trigger.focus();
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextButton = optionButtons.slice(activeIndex + 1).find((optionButton) => !optionButton.disabled)
                    || optionButtons.find((optionButton) => !optionButton.disabled);
                nextButton?.focus();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                const previousButtons = optionButtons.slice(0, Math.max(activeIndex, 0)).reverse();
                const previousButton = previousButtons.find((optionButton) => !optionButton.disabled)
                    || [...optionButtons].reverse().find((optionButton) => !optionButton.disabled);
                previousButton?.focus();
            } else if (event.key === "Tab") {
                closeCustomSelect(customSelect);
            }
        });
    });

    document.addEventListener("click", (event) => {
        const clickedSelect = event.target.closest("[data-custom-select]");
        closeAllCustomSelects(clickedSelect);
    });

    const mobileToggles = document.querySelectorAll("[data-mobile-toggle]");
    const closeMobileMenu = (button, target, backdrop) => {
        target.classList.add("hidden");
        button.setAttribute("aria-expanded", "false");
        if (backdrop) {
            backdrop.classList.add("hidden");
        }
        document.body.classList.remove("mobile-menu-open");
    };

    mobileToggles.forEach((button) => {
        const target = document.getElementById(button.dataset.target);
        const backdrop = button.dataset.backdrop ? document.getElementById(button.dataset.backdrop) : null;
        if (!target) {
            return;
        }

        button.addEventListener("click", () => {
            const willOpen = target.classList.contains("hidden");
            target.classList.toggle("hidden", !willOpen);
            button.setAttribute("aria-expanded", willOpen ? "true" : "false");
            if (backdrop) {
                backdrop.classList.toggle("hidden", !willOpen);
            }
            document.body.classList.toggle("mobile-menu-open", willOpen);
        });

        if (backdrop) {
            backdrop.addEventListener("click", () => closeMobileMenu(button, target, backdrop));
        }

        target.querySelectorAll("a, button").forEach((item) => {
            item.addEventListener("click", () => {
                if (window.innerWidth < 1024 && !target.classList.contains("hidden")) {
                    closeMobileMenu(button, target, backdrop);
                }
            });
        });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 1024) {
            mobileToggles.forEach((button) => {
                const target = document.getElementById(button.dataset.target);
                const backdrop = button.dataset.backdrop ? document.getElementById(button.dataset.backdrop) : null;
                if (!target) {
                    return;
                }
                target.classList.remove("hidden");
                button.setAttribute("aria-expanded", "false");
                if (backdrop) {
                    backdrop.classList.add("hidden");
                }
            });
            document.body.classList.remove("mobile-menu-open");
        }
    });

    document.querySelectorAll("[data-dismiss-flash]").forEach((button) => {
        button.addEventListener("click", () => {
            const flash = button.closest("[data-flash]");
            if (!flash) {
                return;
            }

            flash.style.opacity = "0";
            flash.style.transform = "translateY(-10px)";
            setTimeout(() => flash.remove(), 200);
        });
    });

    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordToggle);
            if (!input) {
                return;
            }

            const icon = button.querySelector("i");
            const isPassword = input.getAttribute("type") === "password";
            input.setAttribute("type", isPassword ? "text" : "password");
            button.setAttribute("aria-pressed", isPassword ? "true" : "false");

            if (icon) {
                icon.classList.toggle("fa-eye");
                icon.classList.toggle("fa-eye-slash");
            }
        });
    });

    if (typeof window.sfEnsureRuntimePageTranslation === "function") {
        window.sfEnsureRuntimePageTranslation().catch(() => undefined);
    }
    observeRuntimePageTranslation();

    const accessibilityForm = document.querySelector("[data-auth-a11y-form]");
    const accessibilityTrigger = document.querySelector("[data-auth-a11y-trigger]");
    const accessibilityPopover = document.querySelector("[data-auth-a11y-popover]");
    const accessibilityReadButton = document.querySelector("[data-auth-a11y-read]");
    const accessibilitySpeakButton = document.querySelector("[data-auth-a11y-speak]");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supportsSpeechRecognition = typeof SpeechRecognition === "function";
    const supportsSpeechSynthesis = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

    if (accessibilityForm && accessibilityTrigger && accessibilityPopover) {
        const accessibilityFields = Array.from(accessibilityForm.querySelectorAll("[data-auth-a11y-field]"));
        const accessibilityStatus = accessibilityPopover.querySelector("[data-auth-a11y-status]");
        const accessibilityCopy = {
            readUnsupported: accessibilityForm.dataset.a11yReadUnsupported || "Read aloud is not supported in this browser.",
            readEmpty: accessibilityForm.dataset.a11yReadEmpty || "No field guidance is available to read aloud.",
            readStarted: accessibilityForm.dataset.a11yReadStarted || "Reading field help aloud.",
            readError: accessibilityForm.dataset.a11yReadError || "Unable to read this field aloud right now.",
            readActive: accessibilityForm.dataset.a11yReadActive || "Read aloud is active.",
            readInactive: accessibilityForm.dataset.a11yReadInactive || "Read aloud is turned off.",
            speakUnsupported: accessibilityForm.dataset.a11ySpeakUnsupported || "Speech input is not supported in this browser.",
            speakUnavailable: accessibilityForm.dataset.a11ySpeakUnavailable || "Speech input is unavailable for this field.",
            speakListening: accessibilityForm.dataset.a11ySpeakListening || "Listening. Speak now.",
            speakError: accessibilityForm.dataset.a11ySpeakError || "Speech input could not be completed.",
            speakEmpty: accessibilityForm.dataset.a11ySpeakEmpty || "No speech was detected.",
            speakSuccess: accessibilityForm.dataset.a11ySpeakSuccess || "Speech added to the field.",
            selectField: accessibilityForm.dataset.a11ySelectField || "Select a field first.",
            selectionStarted: accessibilityForm.dataset.a11ySelectionStarted || "Reading selected text."
        };
        if (typeof window.sfTranslateRuntimeObject === "function") {
            window.sfTranslateRuntimeObject(accessibilityCopy).catch(() => undefined);
        }
        const pageLanguage = (document.documentElement.lang || "en").toLowerCase();
        const languageConfig = window.sfLanguageConfig && window.sfLanguageConfig[pageLanguage]
            ? window.sfLanguageConfig[pageLanguage]
            : (window.sfLanguageConfig ? window.sfLanguageConfig.en : { speech: "en-IN", input: "en-IN", prefixes: ["en-in", "en"], names: ["english"], rate: 0.67 });
        const speechLocale = languageConfig.speech || "en-IN";
        const inputSpeechLocale = languageConfig.input || languageConfig.speech || "en-IN";
        const speechRate = typeof languageConfig.rate === "number" ? languageConfig.rate : 0.67;
        const preferredVoicePrefixes = Array.isArray(languageConfig.prefixes) && languageConfig.prefixes.length
            ? languageConfig.prefixes
            : ["en-in", "en"];
        const preferredVoiceNames = Array.isArray(languageConfig.names) ? languageConfig.names : [];
        let focusedAccessibilityInput = accessibilityFields.find((field) => field === document.activeElement) || null;
        let recognition = null;
        let speechSessionField = null;
        let availableVoices = [];
        let readAloudMode = false;
        let lastSpokenText = "";
        let selectionReadTimer = null;
        let activeUtterance = null;
        const normalizeLocale = (value) => (value || "").toLowerCase().replace(/_/g, "-");

        const updateAccessibilityStatus = (message) => {
            if (accessibilityStatus) {
                accessibilityStatus.textContent = message || "";
            }
        };

        const syncReadAloudState = () => {
            accessibilityTrigger.classList.toggle("is-read-active", readAloudMode);
            accessibilityReadButton?.classList.toggle("is-active", readAloudMode);
            accessibilityReadButton?.setAttribute("aria-pressed", readAloudMode ? "true" : "false");
        };

        const syncSpeechVoices = () => {
            if (!supportsSpeechSynthesis) {
                return;
            }
            availableVoices = window.speechSynthesis.getVoices();
        };

        const getPreferredVoice = () => {
            const voices = availableVoices.length ? availableVoices : (supportsSpeechSynthesis ? window.speechSynthesis.getVoices() : []);
            for (const prefix of preferredVoicePrefixes) {
                const match = voices.find((voice) => normalizeLocale(voice.lang).startsWith(prefix));
                if (match) {
                    return match;
                }
            }

            for (const voiceName of preferredVoiceNames) {
                const nameMatch = voices.find((voice) => (voice.name || "").toLowerCase().includes(voiceName));
                if (nameMatch) {
                    return nameMatch;
                }
            }

            return voices.find((voice) => voice.default) || voices[0] || null;
        };

        const getSelectedText = () => {
            const selection = window.getSelection();
            const selectedPageText = selection ? selection.toString().trim() : "";
            if (selectedPageText) {
                return selectedPageText;
            }

            const activeElement = document.activeElement;
            if (!activeElement || !["INPUT", "TEXTAREA"].includes(activeElement.tagName)) {
                return "";
            }

            const start = typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : 0;
            const end = typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : 0;
            if (end <= start) {
                return "";
            }

            return (activeElement.value || "").slice(start, end).trim();
        };

        const closeAccessibilityPopover = () => {
            accessibilityPopover.classList.add("hidden");
            accessibilityTrigger.setAttribute("aria-expanded", "false");
            updateAccessibilityStatus("");
        };

        const openAccessibilityPopover = () => {
            accessibilityPopover.classList.remove("hidden");
            accessibilityTrigger.setAttribute("aria-expanded", "true");
            if (!focusedAccessibilityInput) {
                updateAccessibilityStatus(accessibilityCopy.selectField);
            }
        };

        const getFieldContext = (input) => {
            if (!input) {
                return "";
            }

            const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
            const textParts = [];

            if (label?.textContent) {
                textParts.push(label.textContent.trim());
            }
            if (input.placeholder) {
                textParts.push(input.placeholder.trim());
            } else if (input.readOnly && input.value && input.type !== "password") {
                textParts.push(input.value.trim());
            }

            return textParts.filter(Boolean).join(". ");
        };

        const speakText = (message, startedLabel = accessibilityCopy.readStarted) => {
            if (!supportsSpeechSynthesis) {
                updateAccessibilityStatus(accessibilityCopy.readUnsupported);
                return false;
            }

            const normalizedMessage = (message || "").trim();
            if (!normalizedMessage) {
                updateAccessibilityStatus(accessibilityCopy.readEmpty);
                return false;
            }

            syncSpeechVoices();
            window.speechSynthesis.cancel();
            if (typeof window.speechSynthesis.resume === "function") {
                window.speechSynthesis.resume();
            }
            const utterance = new window.SpeechSynthesisUtterance(normalizedMessage);
            const preferredVoice = getPreferredVoice();
            utterance.lang = speechLocale;
            if (preferredVoice) {
                utterance.voice = preferredVoice;
                utterance.lang = preferredVoice.lang || speechLocale;
            }
            utterance.rate = speechRate;
            utterance.pitch = 1;
            utterance.volume = 1;
            utterance.onstart = () => {
                activeUtterance = utterance;
                lastSpokenText = normalizedMessage;
                updateAccessibilityStatus(startedLabel);
            };
            utterance.onend = () => {
                activeUtterance = null;
                updateAccessibilityStatus("");
            };
            utterance.onerror = () => {
                activeUtterance = null;
                updateAccessibilityStatus(accessibilityCopy.readError);
            };
            window.speechSynthesis.speak(utterance);
            return true;
        };

        const readCurrentField = (field, startedLabel = accessibilityCopy.readStarted) => {
            if (!field || !readAloudMode) {
                return;
            }

            const message = getFieldContext(field);
            if (!message) {
                updateAccessibilityStatus(accessibilityCopy.readEmpty);
                return;
            }

            speakText(message, startedLabel);
        };

        const applyTranscript = (input, transcript) => {
            if (!input || input.readOnly || input.disabled) {
                return;
            }

            const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
            const end = typeof input.selectionEnd === "number" ? input.selectionEnd : input.value.length;
            const nextValue = `${input.value.slice(0, start)}${transcript}${input.value.slice(end)}`;

            input.value = nextValue;
            const caret = start + transcript.length;
            if (typeof input.setSelectionRange === "function") {
                input.setSelectionRange(caret, caret);
            }
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.focus();
        };

        accessibilityFields.forEach((field) => {
            field.addEventListener("focus", () => {
                focusedAccessibilityInput = field;
                if (!readAloudMode) {
                    updateAccessibilityStatus("");
                    return;
                }

                window.setTimeout(() => readCurrentField(field), 0);
            });

            field.addEventListener("click", () => {
                focusedAccessibilityInput = field;
                if (!readAloudMode) {
                    return;
                }

                readCurrentField(field);
            });

            field.addEventListener("pointerup", () => {
                focusedAccessibilityInput = field;
                if (!readAloudMode) {
                    return;
                }

                const selectedText = getSelectedText();
                if (selectedText) {
                    speakText(selectedText, accessibilityCopy.selectionStarted);
                    return;
                }

                readCurrentField(field);
            });
        });

        if (supportsSpeechSynthesis) {
            syncSpeechVoices();
            if (typeof window.speechSynthesis.addEventListener === "function") {
                window.speechSynthesis.addEventListener("voiceschanged", syncSpeechVoices);
            }
        }

        accessibilityTrigger.addEventListener("click", () => {
            const willOpen = accessibilityPopover.classList.contains("hidden");
            if (!willOpen) {
                closeAccessibilityPopover();
                accessibilityTrigger.focus();
                return;
            }
            openAccessibilityPopover();
        });

        accessibilityTrigger.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                openAccessibilityPopover();
                accessibilityPopover.querySelector("button:not([disabled])")?.focus();
            }
        });

        accessibilityReadButton?.addEventListener("click", () => {
            if (!supportsSpeechSynthesis) {
                updateAccessibilityStatus(accessibilityCopy.readUnsupported);
                return;
            }

            readAloudMode = !readAloudMode;
            syncReadAloudState();

            if (!readAloudMode) {
                window.speechSynthesis.cancel();
                activeUtterance = null;
                updateAccessibilityStatus(accessibilityCopy.readInactive);
                return;
            }

            if (!focusedAccessibilityInput) {
                updateAccessibilityStatus(accessibilityCopy.selectField);
                return;
            }

            readCurrentField(focusedAccessibilityInput, accessibilityCopy.readActive);
        });

        accessibilitySpeakButton?.addEventListener("click", () => {
            if (!focusedAccessibilityInput) {
                updateAccessibilityStatus(accessibilityCopy.selectField);
                return;
            }
            if (!supportsSpeechRecognition) {
                updateAccessibilityStatus(accessibilityCopy.speakUnsupported);
                return;
            }
            if (focusedAccessibilityInput.readOnly || focusedAccessibilityInput.disabled) {
                updateAccessibilityStatus(accessibilityCopy.speakUnavailable);
                return;
            }

            if (recognition) {
                recognition.abort();
            }

            speechSessionField = focusedAccessibilityInput;
            recognition = new SpeechRecognition();
            recognition.lang = inputSpeechLocale;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => updateAccessibilityStatus(accessibilityCopy.speakListening);
            recognition.onerror = () => updateAccessibilityStatus(accessibilityCopy.speakError);
            recognition.onend = () => {
                recognition = null;
                speechSessionField = null;
            };
            recognition.onresult = (event) => {
                const transcript = event.results?.[0]?.[0]?.transcript?.trim();
                if (!transcript) {
                    updateAccessibilityStatus(accessibilityCopy.speakEmpty);
                    return;
                }

                applyTranscript(speechSessionField || focusedAccessibilityInput, transcript);
                updateAccessibilityStatus(accessibilityCopy.speakSuccess);
            };

            recognition.start();
        });

        document.addEventListener("click", (event) => {
            if (accessibilityPopover.classList.contains("hidden")) {
                return;
            }

            if (accessibilityPopover.contains(event.target) || accessibilityTrigger.contains(event.target)) {
                return;
            }

            closeAccessibilityPopover();
        });

        document.addEventListener("selectionchange", () => {
            if (!readAloudMode) {
                return;
            }

            if (selectionReadTimer) {
                clearTimeout(selectionReadTimer);
            }

            selectionReadTimer = window.setTimeout(() => {
                const selectedText = getSelectedText();
                if (!selectedText || selectedText === lastSpokenText) {
                    return;
                }

                speakText(selectedText, accessibilityCopy.selectionStarted);
            }, 180);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (recognition) {
                recognition.abort();
            }
            if (activeUtterance && typeof window.speechSynthesis.cancel === "function") {
                window.speechSynthesis.cancel();
                activeUtterance = null;
            }

            if (!accessibilityPopover.classList.contains("hidden")) {
                closeAccessibilityPopover();
                accessibilityTrigger.focus();
            }
        });

        syncReadAloudState();
    }

    const revealItems = document.querySelectorAll(".reveal, [data-reveal]");
    if ("IntersectionObserver" in window && revealItems.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealItems.forEach((item, index) => {
            item.style.transitionDelay = `${Math.min(index * 40, 240)}ms`;
            observer.observe(item);
        });
    } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }
});
