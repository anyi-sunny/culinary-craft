import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Paperclip } from 'lucide-react';

import { saveRecipe } from '../../lib/db';
import { invokeAgent } from '../../lib/agentApiClient';
import { sanitizeInput, sanitizeObject } from '../../lib/sanitizer';
import { MAX_PDF_BYTES, attachmentContent } from '../../lib/attachments';
import { normalizeTags } from '../../lib/categories';
import { normalizeServings } from '../../lib/servings';
import { recipePath } from '../../lib/recipeUtils';
import { CategoryChecklist } from '../tags/CategoryTags';
import TopNav from '../nav/TopNav';
import { usePageMeta } from '../../lib/usePageMeta';
import { useAuthModal } from '../auth/authModalContext';
import IngredientSelector from './IngredientSelector';
import Paywall from '../Paywall';
import RecipeSavedModal from '../ads/RecipeSavedModal';
import PreviewBanner from '../previews/PreviewBanner';
import { DEMO_CHAT_MESSAGES } from '../../lib/demoData';

// Styling Imports
import './Chat.css';
import './../explore/modal/RecipeModal.css';
import SplashTransition from '../SplashTransition';

// Chat context cache — survives sleep/refresh. The backend is stateless (the
// full conversation is sent with every turn), so restoring the cache restores
// everything; there is no server-side session to lose.
const CHAT_CACHE_KEY = 'culinary_craft_chat_cache';
const CHAT_INPUT_MAX_HEIGHT = 140; // px (~5 lines) before the textarea scrolls
// How many prior turns travel with each request (the backend caps at 40).
const HISTORY_SEND_LIMIT = 30;

const readChatCache = () => {
    try {
        const raw = localStorage.getItem(CHAT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.messages) || parsed.messages.length === 0) return null;
        return parsed;
    } catch {
        return null;
    }
};

const clearChatCache = () => {
    try { localStorage.removeItem(CHAT_CACHE_KEY); } catch { /* ignore */ }
};

// The backend now returns clean, user-safe error strings; surface them as-is.
const formatAgentError = (error) =>
    error?.message || 'Failed to process your request. Please try again.';

// Defensive save-time normalizer: every non-empty line in the stored flat
// fields should be a "- " item, except the "For the <component>:" section
// headers a multi-part recipe carries.
const normalizeFlatLines = (text) =>
    (text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (line.startsWith('- ') || line.endsWith(':') ? line : `- ${line}`))
        .join('\n');

// Kitchen verbs typed out one letter at a time while the assistant thinks.
const THINKING_VERBS = [
    'Tasting', 'Mixing', 'Kneading', 'Whisking', 'Baking',
    'Simmering', 'Steaming', 'Mincing', 'Chopping', 'Dicing',
    'Searing', 'Stirring', 'Tossing', 'Shaking', 'Combining',
];

const TYPE_MS = 65;        // per typed letter
const ERASE_MS = 28;       // per erased letter
const HOLD_MS = 1600;      // fully-typed word lingers
const BETWEEN_WORDS_MS = 220;

function ThinkingVerb() {
    const [text, setText] = useState('');

    useEffect(() => {
        // Fresh shuffle per thinking spell, so the order feels random but
        // never repeats a verb until the whole deck has been dealt.
        const deck = [...THINKING_VERBS];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        let wordIdx = 0;
        let charIdx = 0;
        let erasing = false;
        let timer;

        const tick = () => {
            const word = deck[wordIdx % deck.length];
            if (!erasing) {
                charIdx += 1;
                setText(word.slice(0, charIdx));
                if (charIdx < word.length) {
                    timer = setTimeout(tick, TYPE_MS);
                } else {
                    erasing = true;
                    timer = setTimeout(tick, HOLD_MS);
                }
            } else {
                charIdx -= 1;
                setText(word.slice(0, charIdx));
                if (charIdx > 0) {
                    timer = setTimeout(tick, ERASE_MS);
                } else {
                    erasing = false;
                    wordIdx += 1;
                    timer = setTimeout(tick, BETWEEN_WORDS_MS);
                }
            }
        };

        timer = setTimeout(tick, BETWEEN_WORDS_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <span className="thinking-verb">
            {text}
            <span className="thinking-caret" aria-hidden="true" />
        </span>
    );
}

function Chat() {
  usePageMeta({
    title: 'Create a Recipe',
    description:
      'Describe a craving or the ingredients you have on hand, and refine a recipe step by step with an AI chef.',
  });
    const location = useLocation();
    const navigate = useNavigate();

    const { authStatus, user } = useAuthenticator(context => [context.authStatus, context.user]);
    const { requireLogin } = useAuthModal();

    // Snapshot the cache once on mount. Entering with a recipe to improve or
    // with ingredients pre-picked (from the Inventory page's Build a Recipe)
    // always starts a fresh session and ignores any cached conversation.
    const initialCacheRef = useRef(undefined);
    if (initialCacheRef.current === undefined) {
        initialCacheRef.current =
            location.state?.recipeToImprove || location.state?.ingredientContext
                ? null
                : readChatCache();
    }

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeRecipeId, setActiveRecipeId] = useState(null);
    const [quotaExceeded, setQuotaExceeded] = useState(false);
    // Set after a successful save: shows the "Recipe Saved!" ad interstitial,
    // and its Continue button carries this id to the detail page.
    const [savedRecipePath, setSavedRecipePath] = useState(null);

    // Ingredient selector state
    const [showIngredientSelector, setShowIngredientSelector] = useState(false);
    const ingredientContextRef = useRef(null);

    const messagesAreaRef = useRef(null);
    const chatInputRef = useRef(null);
    const restoredFromCacheRef = useRef(false);
    const fileInputRef = useRef(null);
    const recipeContextRef = useRef(null);
    // Original recipe being edited (UPDATE mode) so we can preserve ownerId / heartedBy.
    const editingOriginalRef = useRef(null);
    // The actual API conversation (augmented user turns + assistant replies).
    // Differs from `messages` (the display transcript): user turns here carry
    // the injected ingredient/recipe context the agent actually received.
    const historyRef = useRef([]);
    // Latest structured recipe the assistant produced ({title, servings, tags,
    // components, ingredients, instructions}) — the review modal opens from
    // this, no reformat round-trip needed.
    const latestRecipeRef = useRef(null);
    // Latest category tags / serving estimate, pre-filled in the review modal.
    const agentTagsRef = useRef([]);
    const agentServingsRef = useRef(null);
    // Issues the verify pass flagged on the latest recipe (advisory only).
    const [verifyIssues, setVerifyIssues] = useState([]);
    const [issuesDismissed, setIssuesDismissed] = useState(false);

    const [stagingRecipe, setStagingRecipe] = useState({
        title: '',
        ingredients: '',
        instructions: '',
        tags: [],
        servings: null,
        recipeId: null
    });
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);

    // Opening greeting once ingredient constraints are settled — from the
    // selector here, or pre-picked on the Inventory page's Build a Recipe.
    const greetWithIngredients = useCallback((mode, selectedItems = []) => {
        let ingredientMessage = '';
        if (mode === 'none') {
            ingredientMessage = "No ingredient constraints. I'll help you create any recipe!";
        } else if (mode === 'some') {
            ingredientMessage = `I'll help you create recipes using some of these ingredients: ${selectedItems.map((i) => i.name).join(', ')}.`;
        } else if (mode === 'solely') {
            ingredientMessage = `I'll create recipes using ONLY these ingredients: ${selectedItems.map((i) => i.name).join(', ')}.`;
        }

        setMessages([
            {
                role: 'assistant',
                content: `Hello! I am your Culinary Architect.\n\n${ingredientMessage}\n\nTell me about a recipe you want to create — or attach a photo or PDF of one with the paperclip and we'll refine it together!`,
            },
        ]);
    }, []);

    const callAgent = useCallback(async (textToSend, attachment = null) => {
        try {
            // Stateless backend: the recent conversation travels with every
            // turn. On success the exchange is appended to the history.
            const userContent = attachment
                ? attachmentContent(textToSend, attachment)
                : textToSend;
            const request = [
                ...historyRef.current.slice(-(HISTORY_SEND_LIMIT - 1)),
                { role: 'user', content: userContent },
            ];
            const result = await invokeAgent(request);

            // History stays text-only: re-sending base64 attachments with
            // every turn would balloon payloads and overflow the localStorage
            // cache. The assistant's reply (e.g. the transcribed recipe)
            // carries the attachment's content forward in the conversation.
            historyRef.current = [
                ...historyRef.current,
                {
                    role: 'user',
                    content: attachment
                        ? `[The user attached ${attachment.kind === 'document' ? 'a PDF' : 'an image'}] ${textToSend}`
                        : textToSend,
                },
                { role: 'assistant', content: result.output },
            ];

            // Structured recipe (if this turn produced one): cache it for the
            // review modal, along with the verify pass's findings.
            if (result.recipe) {
                latestRecipeRef.current = result.recipe;
                agentTagsRef.current = normalizeTags(result.recipe.tags);
                agentServingsRef.current = normalizeServings(result.recipe.servings);
                setVerifyIssues(result.verify?.issues || []);
                setIssuesDismissed(false);
            }
            return result;
        } catch (error) {
            console.error("Error calling agent:", error);
            // Check if error is rate limit (429)
            if (error.status === 429) {
                setQuotaExceeded(true);
            }
            throw error;
        }
    }, []);

    useEffect(() => {
        const loadContext = async () => {
            // The chat is account-gated; nothing to set up until login completes.
            if (authStatus !== 'authenticated') return;

            if (location.state?.recipeToImprove) {
                const { recipeToImprove, saveMode } = location.state;
                const name = recipeToImprove.title || "Recipe";

                if (saveMode === 'UPDATE') {
                    setActiveRecipeId(recipeToImprove.recipeId);
                    editingOriginalRef.current = recipeToImprove;
                }

                // Start from the recipe's existing tags/servings; the agent's
                // own picks will replace these as the recipe evolves in chat.
                agentTagsRef.current = normalizeTags(recipeToImprove.tags);
                agentServingsRef.current = normalizeServings(recipeToImprove.servings);

                recipeContextRef.current = recipeToImprove;

                setLoading(true);
                try {
                    const introMessage = `The user wants to ${saveMode === 'UPDATE' ? 'edit' : 'make a copy of'} this recipe:
                    Title: ${recipeToImprove.title}
                    Ingredients: ${recipeToImprove.ingredients}
                    Instructions: ${recipeToImprove.instructions}

                    Please display this full recipe in Markdown now so the user can review it. Then ask what changes they would like to make.`;

                    const result = await callAgent(introMessage);
                    setMessages([{ role: 'assistant', content: result.output }]);
                } catch (error) {
                    console.error("Error loading recipe context:", error);
                    setMessages([{ role: 'assistant', content: `I've loaded **${name}**, but had trouble displaying it. What would you like to change?` }]);
                } finally {
                    setLoading(false);
                }
            } else if (location.state?.ingredientContext) {
                // Arrived from the Inventory page's Build a Recipe flow with
                // ingredients already picked — skip the selector entirely.
                const { mode, selectedItems } = location.state.ingredientContext;
                ingredientContextRef.current = { mode, selectedItems };
                greetWithIngredients(mode, selectedItems);
            } else if (initialCacheRef.current) {
                // A previous conversation is cached (e.g. the tab sat idle or
                // the computer slept). The backend is stateless — the history
                // travels with every request — so restoring the cache restores
                // everything. No memory probe, no transcript replay.
                if (restoredFromCacheRef.current) return;
                restoredFromCacheRef.current = true;

                const cached = initialCacheRef.current;
                setMessages(cached.messages);
                if (cached.activeRecipeId) setActiveRecipeId(cached.activeRecipeId);
                if (cached.ingredientContext) ingredientContextRef.current = cached.ingredientContext;
                if (cached.agentTags) agentTagsRef.current = normalizeTags(cached.agentTags);
                if (cached.agentServings) agentServingsRef.current = normalizeServings(cached.agentServings);
                if (cached.latestRecipe) latestRecipeRef.current = cached.latestRecipe;
                if (Array.isArray(cached.history)) {
                    historyRef.current = cached.history;
                } else {
                    // Cache written before the migration: rebuild the API
                    // history from the display transcript.
                    historyRef.current = cached.messages
                        .filter((m) => m.role === 'user' || m.role === 'assistant')
                        .map(({ role, content }) => ({ role, content }));
                }
            } else {
                // New recipe generation: open the selector right away. It
                // defaults to "start from scratch" and only loads the
                // inventory if the user picks an inventory-based mode, so
                // there is no fetch to wait on here.
                setShowIngredientSelector(true);
            }
        };

        loadContext();
    }, [location.state, authStatus, callAgent, greetWithIngredients]);

    // Persist the conversation so a refresh/sleep can restore it seamlessly.
    // Pure greetings are not worth caching.
    useEffect(() => {
        if (!messages.some((m) => m.role === 'user')) return;
        try {
            localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify({
                messages,
                history: historyRef.current,
                latestRecipe: latestRecipeRef.current,
                activeRecipeId,
                ingredientContext: ingredientContextRef.current,
                agentTags: agentTagsRef.current,
                agentServings: agentServingsRef.current,
                savedAt: Date.now(),
            }));
        } catch { /* storage full / unavailable */ }
    }, [messages, activeRecipeId]);

    // Warn before the tab closes/refreshes while an unsaved conversation exists.
    useEffect(() => {
        if (!messages.some((m) => m.role === 'user')) return;
        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [messages]);

    // Enter the page at the top — scrollIntoView-style helpers must never
    // drag the whole document down to the footer.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Auto-scroll to the newest message, but only inside the chat log itself.
    useEffect(() => {
        const area = messagesAreaRef.current;
        if (!area) return;
        area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    // Auto-grow the prompt box as the text wraps; past the cap it scrolls.
    useEffect(() => {
        const el = chatInputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT)}px`;
    }, [input]);

    const handleFileSelect = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.type === 'application/pdf' && file.size > MAX_PDF_BYTES) {
            setMessages(prev => [...prev, {
                role: 'error',
                content: 'That PDF is too large to send (max 3.5MB). Try a version with fewer pages, or a photo of the recipe instead.',
            }]);
            e.target.value = '';
            return;
        }
        setSelectedFile(file);
    };

    const fileToBase64 = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                const base64 = result.split(',')[1]; // Remove data:image/type;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const getMimeType = (file) => {
        const type = file.type.toLowerCase();
        if (type === 'image/jpeg') return 'image/jpeg';
        if (type === 'image/png') return 'image/png';
        if (type === 'image/webp') return 'image/webp';
        if (type === 'image/gif') return 'image/gif';
        return 'image/jpeg';
    };

    // Claude reads images best at ≤1568px on the long side, and phone photos
    // base64-encoded can blow past the backend's request size cap — so
    // downscale/re-encode on the client before sending.
    const MAX_IMAGE_DIM = 1568;
    const encodeImageForChat = async (file) => {
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // flatten any transparency to white
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
        } catch {
            // Decode/canvas failed — fall back to sending the original file.
            const base64 = await fileToBase64(file);
            return { base64, mimeType: getMimeType(file) };
        }
    };

    // PDFs ride as Claude "document" blocks (read natively, scanned pages
    // included — no parser needed); images as "image" blocks.
    const encodeAttachment = async (file) => {
        if (file.type === 'application/pdf') {
            const base64 = await fileToBase64(file);
            return { kind: 'document', base64, mimeType: 'application/pdf' };
        }
        const image = await encodeImageForChat(file);
        return { kind: 'image', ...image };
    };

    const handleIngredientConfirm = (mode, selectedItems) => {
        ingredientContextRef.current = { mode, selectedItems };
        setShowIngredientSelector(false);
        greetWithIngredients(mode, selectedItems);
    };

    const sendMessage = async () => {
        if (!input.trim() && !selectedFile) return;
        if (quotaExceeded) return;

        // Sanitize user input to prevent injection attacks
        const sanitizedInput = sanitizeInput(input);
        const displayInput = sanitizedInput;
        const displayFile = selectedFile;

        setMessages(prev => [...prev, {
            role: 'user',
            content: displayFile ? `[Attached: ${displayFile.name}] ${displayInput}` : displayInput
        }]);

        setInput('');
        setSelectedFile(null);
        setLoading(true);

        try {
            const isPdf = displayFile?.type === 'application/pdf';
            let agentInput = displayInput ||
                (displayFile ? `Please read the recipe in this ${isPdf ? 'PDF' : 'image'} and display it in full.` : "");

            // Encode the attachment so Claude can actually read it.
            let attachment = null;
            if (displayFile) {
                attachment = await encodeAttachment(displayFile);
            }

            // Add ingredient context if available
            if (ingredientContextRef.current) {
                const { mode, selectedItems } = ingredientContextRef.current;
                let ingredientContext = '';

                if (mode === 'solely') {
                    const itemNames = selectedItems.map((i) => i.name).join(', ');
                    ingredientContext = `\n\n[INGREDIENT CONSTRAINT - STRICTLY USE ONLY THESE ITEMS]: ${itemNames}\nMust use ONLY ingredients from this list. You may use any other ingredients that exist in the user's inventory.`;
                } else if (mode === 'some') {
                    const itemNames = selectedItems.map((i) => i.name).join(', ');
                    ingredientContext = `\n\n[SUGGESTED INGREDIENTS]: ${itemNames}\nTry to incorporate some of these ingredients, but you're not limited to them.`;
                }

                agentInput += ingredientContext;
            }

            if (recipeContextRef.current) {
                const r = recipeContextRef.current;
                agentInput = `The user is working on this recipe:
                Name: ${r.title}
                Ingredients: ${r.ingredients}
                Instructions: ${r.instructions}

                User's Request: ${agentInput}`;
                recipeContextRef.current = null;
            }

            const result = await callAgent(agentInput, attachment);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.output,
                // Verify findings ride on the message that carried the recipe
                // so the warning renders right where the recipe appeared.
                ...(result.recipe && result.verify?.issues?.length
                    ? { issues: result.verify.issues }
                    : {}),
            }]);
        } catch (error) {
            console.error("Error:", error);
            setMessages(prev => [...prev, { role: 'error', content: formatAgentError(error) }]);
        } finally {
            setLoading(false);
        }
    };

    const openReviewModal = (recipe) => {
        setStagingRecipe({
            title: recipe.title,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            // Agent-selected categories come pre-checked and the serving
            // estimate pre-filled; the user can adjust both before saving.
            tags: agentTagsRef.current,
            servings: agentServingsRef.current,
            recipeId: activeRecipeId
        });
        setIssuesDismissed(false);
        setIsConfirmingSave(true);
    };

    const handleSaveCommand = async () => {
        // The structured recipe was captured (and verified) the moment it was
        // generated — no reformat round-trip. The fallback only fires when no
        // recipe has been produced yet this conversation.
        if (latestRecipeRef.current) {
            openReviewModal(latestRecipeRef.current);
            return;
        }

        setLoading(true);
        try {
            const result = await callAgent(
                "Please produce the final version of the recipe we settled on."
            );
            if (result.recipe) {
                openReviewModal(result.recipe);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: result.output }]);
            }
        } catch (error) {
            console.error("Save error:", error);
            setMessages(prev => [...prev, { role: 'error', content: formatAgentError(error) }]);
        } finally {
            setLoading(false);
        }
    };

    const commitSave = async (finalRecipe) => {
        try {
            const isUpdate = Boolean(activeRecipeId);
            // Updates preserve the original record (ownerId, heartedBy); new
            // recipes are owned by the logged-in creator.
            const base = isUpdate ? (editingOriginalRef.current || {}) : {};

            // Sanitize recipe fields to prevent injection attacks
            const sanitizedRecipe = sanitizeObject(finalRecipe, ['title', 'ingredients', 'instructions']);

            const finalItem = {
                ...base,
                title: sanitizedRecipe.title,
                ingredients: normalizeFlatLines(sanitizedRecipe.ingredients),
                instructions: normalizeFlatLines(sanitizedRecipe.instructions),
                tags: normalizeTags(finalRecipe.tags),
                servings: normalizeServings(finalRecipe.servings),
            };
            // Recipes no longer carry a decorative emoji field.
            delete finalItem.emoji;

            // Structured components are saved only while they still match the
            // flat text — a hand edit in the review modal makes them stale.
            const structured = latestRecipeRef.current;
            if (
                structured?.components?.length &&
                finalRecipe.ingredients === structured.ingredients &&
                finalRecipe.instructions === structured.instructions
            ) {
                finalItem.components = structured.components;
            } else {
                delete finalItem.components;
            }

            // Only include recipeId for updates; backend will generate ID for new recipes
            if (isUpdate) {
                finalItem.recipeId = activeRecipeId;
            }

            if (!isUpdate) {
                finalItem.ownerId = user?.userId;
            }

            const savedRecipe = await saveRecipe(finalItem);

            // The conversation reached its goal — drop the cached transcript.
            clearChatCache();

            // Show the saved confirmation (with ad) first; its Continue button
            // navigates to the recipe detail page.
            setIsConfirmingSave(false);
            setSavedRecipePath(recipePath(savedRecipe));
        } catch (err) {
            console.error("Commit Save Error:", err);
            alert("Final save failed.");
        }
    };

    // Account gate: guests get a read-only preview — an example conversation
    // showing the describe-then-refine loop — with every input routed to the
    // login modal instead of the agent.
    if (authStatus !== 'authenticated') {
        return (
            <SplashTransition>
                <div className="chat-container">
                    <TopNav title="Culinary Craft AI" />
                    {authStatus === 'unauthenticated' && (
                        <>
                            <PreviewBanner message="This is an example conversation. Log in to chat with the Culinary Architect and save your own recipes." />
                            <div className="messages-area" data-lenis-prevent>
                                {DEMO_CHAT_MESSAGES.map((msg, idx) => (
                                    <div key={idx} className={`message ${msg.role}`}>
                                        <div className="message-bubble">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="input-bar">
                                <div className="input-area">
                                    <textarea
                                        className="chat-input"
                                        rows={1}
                                        value=""
                                        placeholder="Log in to start crafting..."
                                        readOnly
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            requireLogin();
                                        }}
                                        onFocus={requireLogin}
                                    />
                                    <button className="send-btn" onClick={requireLogin}>Send</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </SplashTransition>
        );
    }

    return (
        <SplashTransition>
            {quotaExceeded && <Paywall />}

            <IngredientSelector
                userId={user?.userId}
                isOpen={showIngredientSelector}
                onConfirm={handleIngredientConfirm}
                onCancel={() => {
                    setShowIngredientSelector(false);
                    setMessages([
                        {
                            role: 'assistant',
                            content: "Hello! I am your Culinary Architect. Tell me about a recipe you want to create — or attach a photo or PDF of one with the paperclip and we'll refine it together!",
                        },
                    ]);
                }}
            />

            <div className="chat-container">
                <TopNav title="Culinary Craft AI" />

                <div className="messages-area" ref={messagesAreaRef} data-lenis-prevent>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <div className="message-bubble">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.issues?.length > 0 && (
                                <div className="verify-warning" role="note">
                                    <strong>A quick double-check flagged:</strong>
                                    <ul>
                                        {msg.issues.map((issue, i) => (
                                            <li key={i}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="message assistant">
                            <div className="thinking-indicator" aria-label="Assistant is thinking">
                                <img src="/logo.png" alt="" className="thinking-logo" />
                                <ThinkingVerb />
                            </div>
                        </div>
                    )}
                </div>

                <div className="input-bar">
                    <div className="input-area">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/jpeg,image/png,image/webp,application/pdf" />
                        <button className={`icon-button ${selectedFile ? 'active' : ''}`} onClick={() => fileInputRef.current.click()}>
                            <span className='btn-text'>Upload Recipe</span>
                            <span className="btn-icon"><Paperclip size={15} /></span>
                        </button>
                        {messages.length > 0 && (
                            <button className="save-btn" onClick={handleSaveCommand} disabled={loading}>
                                Save
                            </button>
                        )}

                        <textarea
                            ref={chatInputRef}
                            className="chat-input"
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder={selectedFile ? `File: ${selectedFile.name}` : "Type instructions..."}
                            data-lenis-prevent
                        />
                        <button className="send-btn" onClick={sendMessage} disabled={loading}>Send</button>
                    </div>
                </div>
            </div>

            {isConfirmingSave && (
                <div className="modal-overlay">
                    <div className="modal-content review-modal" data-lenis-prevent>
                        <h2>Review &amp; Name Your Recipe</h2>
                        {verifyIssues.length > 0 && !issuesDismissed && (
                            <div className="verify-warning verify-warning--modal" role="note">
                                <div className="verify-warning-head">
                                    <strong>Worth a look before saving:</strong>
                                    <button
                                        type="button"
                                        className="verify-warning-dismiss"
                                        onClick={() => setIssuesDismissed(true)}
                                        aria-label="Dismiss warnings"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <ul>
                                    {verifyIssues.map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <label className="review-label" htmlFor="review-title">Title</label>
                        <input
                            id="review-title"
                            className="edit-input-title"
                            value={stagingRecipe.title || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, title: e.target.value})}
                        />
                        <label className="review-label" htmlFor="review-ingredients">Ingredients</label>
                        <textarea
                            id="review-ingredients"
                            className="edit-textarea"
                            value={stagingRecipe.ingredients || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, ingredients: e.target.value})}
                        />
                        <label className="review-label" htmlFor="review-instructions">Instructions</label>
                        <textarea
                            id="review-instructions"
                            className="edit-textarea review-instructions"
                            value={stagingRecipe.instructions || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, instructions: e.target.value})}
                        />
                        <label className="review-label" htmlFor="review-servings">Serving Size (approx.)</label>
                        <input
                            id="review-servings"
                            className="edit-input-servings"
                            type="number"
                            min="1"
                            max="999"
                            value={stagingRecipe.servings ?? ''}
                            onChange={(e) =>
                                setStagingRecipe({
                                    ...stagingRecipe,
                                    servings: e.target.value === '' ? null : Number(e.target.value),
                                })
                            }
                        />
                        <label className="review-label">Categories</label>
                        <CategoryChecklist
                            selected={stagingRecipe.tags || []}
                            onToggle={(tag) =>
                                setStagingRecipe((prev) => ({
                                    ...prev,
                                    tags: (prev.tags || []).includes(tag)
                                        ? prev.tags.filter((t) => t !== tag)
                                        : [...(prev.tags || []), tag],
                                }))
                            }
                        />
                        <p className="review-privacy-note">
                            Saved recipes stay private to your account. You can publish it to Explore
                            from the recipe page whenever you're ready.
                        </p>
                        <div className="review-actions">
                            <button className="btn btn-primary" onClick={() => commitSave(stagingRecipe)}>Save &amp; Continue</button>
                            <button className="btn btn-secondary" onClick={() => setIsConfirmingSave(false)}>Keep Chatting</button>
                        </div>
                    </div>
                </div>
            )}

            {savedRecipePath && (
                <RecipeSavedModal
                    onContinue={() => navigate(savedRecipePath)}
                />
            )}
        </SplashTransition>
    );
}

export default Chat;
