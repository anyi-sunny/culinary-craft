import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Paperclip, Lock } from 'lucide-react';

import { saveRecipe } from '../../lib/db';
import { fetchUserInventory } from '../../lib/inventoryDb';
import { invokeAgent } from '../../lib/agentApiClient';
import { sanitizeInput, sanitizeObject } from '../../lib/sanitizer';
import awsConfig from '../../lib/awsConfig';
import TopNav from '../nav/TopNav';
import { useAuthModal } from '../auth/authModalContext';
import IngredientSelector from './IngredientSelector';
import Paywall from '../Paywall';

// Styling Imports
import './Chat.css';
import './../explore/modal/RecipeModal.css';
import './../explore/Explore.css'; // .gate styles for the login-required screen
import SplashTransition from '../SplashTransition';

const AWS_REGION = awsConfig.region;

// Chat context cache — survives sleep/refresh so a conversation can be
// restored even after the Bedrock agent's server-side session has expired.
const CHAT_CACHE_KEY = 'culinary_craft_chat_cache';
const CHAT_INPUT_MAX_HEIGHT = 140; // px (~5 lines) before the textarea scrolls

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

// Strips markdown formatting that the agent sometimes adds (e.g. **bold**, #
// headings, `code`). The review modal uses plain <input>/<textarea> fields and
// the saved record is plain text, so any leftover markdown shows up literally
// (e.g. a title that reads "**"). This guarantees clean text regardless of how
// strictly the model follows the formatting contract.
const stripMarkdown = (text = '') =>
    String(text)
        .replace(/\*\*/g, '')          // bold markers
        .replace(/__/g, '')            // alt bold / underline
        .replace(/`/g, '')             // inline code ticks
        .replace(/^\s*#{1,6}\s*/gm, '') // ATX headings
        .split('\n')
        .map((line) => line.replace(/\s+$/, '')) // trailing whitespace per line
        // collapse runs of blank lines down to a single blank line
        .filter((line, idx, arr) => !(line.trim() === '' && (arr[idx - 1]?.trim() ?? '') === ''))
        .join('\n')
        .trim();

const formatBedrockError = (error) => {
    const name = error?.name || 'UnknownError';
    const normalizedMessage = (error?.message || '').toLowerCase();

    console.error('Bedrock error:', { name, message: error?.message, metadata: error?.$metadata });

    // Generic user-facing message (detailed errors go to console/logs)
    const isMarketplaceAccessIssue =
        normalizedMessage.includes('aws-marketplace') ||
        normalizedMessage.includes('marketplace subscription') ||
        normalizedMessage.includes('model access is denied');
    const isAccessDenied =
        name.toLowerCase().includes('accessdenied') ||
        normalizedMessage.includes('access denied') ||
        normalizedMessage.includes('not authorized');

    let userMessage = 'Failed to process your request. Please try again.';

    if (isMarketplaceAccessIssue) {
        userMessage = 'The AI service is currently unavailable. Please contact support.';
    } else if (isAccessDenied) {
        userMessage = 'You do not have permission to access this service. Please contact support.';
    }

    return userMessage;
};

function Chat() {
    const location = useLocation();
    const navigate = useNavigate();

    const { authStatus, user } = useAuthenticator(context => [context.authStatus, context.user]);
    const { requireLogin } = useAuthModal();

    // Snapshot the cache once on mount. Entering with a recipe to improve
    // always starts a fresh session and ignores any cached conversation.
    const initialCacheRef = useRef(undefined);
    if (initialCacheRef.current === undefined) {
        initialCacheRef.current = location.state?.recipeToImprove ? null : readChatCache();
    }

    const [sessionId] = useState(() =>
        initialCacheRef.current?.sessionId || `session-${crypto.randomUUID()}`
    );
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeRecipeId, setActiveRecipeId] = useState(null);
    const [quotaExceeded, setQuotaExceeded] = useState(false);

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

    const [stagingRecipe, setStagingRecipe] = useState({
        title: '',
        ingredients: '',
        instructions: '',
        recipeId: null
    });
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);

    // Tracks whether the user's inventory has any items; the ingredient
    // selector modal is only worth showing when there is something to pick.
    const [inventoryEmpty, setInventoryEmpty] = useState(null);

    // Chat requires an account: prompt login immediately on entry.
    useEffect(() => {
        if (authStatus === 'unauthenticated') requireLogin();
    }, [authStatus, requireLogin]);

    const callAgent = useCallback(async (textToSend) => {
        try {
            // File handling is not yet supported through the API
            // TODO: Add file upload support to backend API
            const response = await invokeAgent(sessionId, textToSend, []);
            return response;
        } catch (error) {
            console.error("Error calling agent:", error);
            // Check if error is rate limit (429)
            if (error.status === 429) {
                setQuotaExceeded(true);
            }
            throw error;
        }
    }, [sessionId]);

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

                recipeContextRef.current = recipeToImprove;

                setLoading(true);
                try {
                    const introMessage = `The user wants to ${saveMode === 'UPDATE' ? 'edit' : 'make a copy of'} this recipe:
                    Title: ${recipeToImprove.title}
                    Ingredients: ${recipeToImprove.ingredients}
                    Instructions: ${recipeToImprove.instructions}

                    Please display this full recipe in Markdown now so the user can review it. Then ask what changes they would like to make.`;

                    const botResponse = await callAgent(introMessage);
                    setMessages([{ role: 'assistant', content: botResponse }]);
                } catch (error) {
                    console.error("Error loading recipe context:", error);
                    setMessages([{ role: 'assistant', content: `I've loaded **${name}**, but had trouble displaying it. What would you like to change?` }]);
                } finally {
                    setLoading(false);
                }
            } else if (initialCacheRef.current) {
                // A previous conversation is cached (e.g. the tab sat idle or the
                // computer slept). Restore it, then check whether the agent still
                // remembers the session; if not, replay the transcript so the
                // agent regains context.
                if (restoredFromCacheRef.current) return;
                restoredFromCacheRef.current = true;

                const cached = initialCacheRef.current;
                setMessages(cached.messages);
                if (cached.activeRecipeId) setActiveRecipeId(cached.activeRecipeId);
                if (cached.ingredientContext) ingredientContextRef.current = cached.ingredientContext;

                setLoading(true);
                try {
                    const probe = await callAgent(
                        'SYSTEM MEMORY CHECK: Do you currently remember the recipe conversation we have been having in this session? ' +
                        'Reply with only the single word YES or NO. Do not add anything else.'
                    );
                    const remembers = /\bYES\b/i.test(probe) && !/\bNO\b/i.test(probe);

                    if (!remembers) {
                        const transcript = cached.messages
                            .filter((m) => m.role !== 'error')
                            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                            .join('\n\n');

                        const reply = await callAgent(
                            'Our session was interrupted and you have lost context. Here is the full transcript of the conversation so far:\n\n' +
                            `${transcript}\n\n` +
                            'Absorb this context so we can continue where we left off. Reply with one short, friendly sentence letting the user know you are caught up and ready to continue.'
                        );
                        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
                    }
                } catch (error) {
                    console.error('Error verifying agent memory:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                // New recipe generation: only offer the ingredient selector when
                // the user actually has inventory items to choose from.
                let empty = true;
                try {
                    const items = await fetchUserInventory(user?.userId);
                    empty = !items || items.length === 0;
                } catch (err) {
                    console.error('Error checking inventory:', err);
                }
                setInventoryEmpty(empty);

                if (empty) {
                    setMessages([{ role: 'assistant', content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to create or refine!' }]);
                } else {
                    setShowIngredientSelector(true);
                }
            }
        };

        loadContext();
    }, [location.state, authStatus, callAgent, user?.userId]);

    // Persist the conversation so it can be restored if the agent's session
    // expires while the page sits idle. Pure greetings are not worth caching.
    useEffect(() => {
        if (!messages.some((m) => m.role === 'user')) return;
        try {
            localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify({
                sessionId,
                messages,
                activeRecipeId,
                ingredientContext: ingredientContextRef.current,
                savedAt: Date.now(),
            }));
        } catch { /* storage full / unavailable */ }
    }, [messages, sessionId, activeRecipeId]);

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
        if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
    };

    const handleIngredientConfirm = (mode, selectedItems) => {
        ingredientContextRef.current = { mode, selectedItems };
        setShowIngredientSelector(false);

        // Prepare greeting message acknowledging ingredient selection
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
                content: `Hello! I am your Culinary Architect.\n\n${ingredientMessage}\n\nTell me about a recipe you want to create or refine!`,
            },
        ]);
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
            let agentInput = displayInput || "Please analyze the attached file.";

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

            const botResponse = await callAgent(agentInput);
            setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
        } catch (error) {
            console.error("Error:", error);
            setMessages(prev => [...prev, { role: 'error', content: formatBedrockError(error) }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCommand = async () => {
        setLoading(true);
        try {
            const botResponse = await callAgent(
                "Please prepare the final version of this recipe for the review modal. " +
                "Output PLAIN TEXT ONLY. Do NOT use any markdown formatting: " +
                "no asterisks (*), no bold (**), no underscores (_), no backticks, and no '#' headings. " +
                "Put the dish name on the same line as TITLE: (do not put it on a separate line). " +
                "Use the tags TITLE:, INGREDIENTS:, and INSTRUCTIONS: exactly, each starting a new line. " +
                "Separate each ingredient within the section using a dash at the beginning of each and a new line in between. " +
                "Crucially, use a vertical bar '|' to separate the recipe from your closing remarks. " +
                "Format exactly like this:\n" +
                "TITLE: Buffalo Chicken Dip\n" +
                "INGREDIENTS:\n- 2 cans chicken\n- 8 oz cream cheese\n" +
                "INSTRUCTIONS:\n- Preheat oven to 350F\n- Mix and bake\n" +
                "| [Closing remarks]"
            );

            const parts = botResponse.split('|');
            // Strip markdown BEFORE regex so wrapped tags like "**TITLE:**" still parse.
            const cleanRecipeData = stripMarkdown(parts[0]);

            const nameMatch = cleanRecipeData.match(/(?:TITLE|RECIPE_NAME):\s*(.*)/i);
            const ingMatch = cleanRecipeData.match(/(?:INGREDIENTS|RECIPE_INGREDIENTS):\s*([\s\S]*?)(?=INSTRUCTIONS|RECIPE_INSTRUCTIONS|$)/i);
            const insMatch = cleanRecipeData.match(/(?:INSTRUCTIONS|RECIPE_INSTRUCTIONS):\s*([\s\S]*)/i);

            if (nameMatch && ingMatch && insMatch) {
                // Defense-in-depth: sanitize each field again in case markdown
                // survived inside a captured group.
                setStagingRecipe({
                    title: stripMarkdown(nameMatch[1]),
                    ingredients: stripMarkdown(ingMatch[1]),
                    instructions: stripMarkdown(insMatch[1]),
                    recipeId: activeRecipeId
                });
                setIsConfirmingSave(true);
            } else {
                console.warn("⚠️ Regex parsing failed on Part 0");
                setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
            }
        } catch (error) {
            console.error("❌ Save Error:", error);
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
                ingredients: sanitizedRecipe.ingredients,
                instructions: sanitizedRecipe.instructions,
            };
            // Recipes no longer carry a decorative emoji field.
            delete finalItem.emoji;

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

            // Navigate to recipe detail page instead of explore
            navigate(`/recipe/${savedRecipe.recipeId}`);
        } catch (err) {
            console.error("Commit Save Error:", err);
            alert("Final save failed.");
        }
    };

    // Account gate: the chat (and saving recipes) requires being logged in.
    // The login modal opens automatically; this screen backs it so there is
    // no usable chat behind it if the modal is dismissed.
    if (authStatus !== 'authenticated') {
        return (
            <SplashTransition>
                <div className="chat-container">
                    <TopNav title="Culinary Craft AI" />
                    {authStatus === 'unauthenticated' && (
                        <div className="gate">
                            <div className="gate-icon">
                                <Lock size={30} strokeWidth={1.8} />
                            </div>
                            <h2>Log in to start crafting</h2>
                            <p>Create an account or log in to chat with the Culinary Architect and save your recipes.</p>
                            <button className="btn btn-primary" onClick={requireLogin}>
                                Log in or sign up
                            </button>
                        </div>
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
                isOpen={showIngredientSelector && inventoryEmpty === false}
                onConfirm={handleIngredientConfirm}
                onCancel={() => {
                    setShowIngredientSelector(false);
                    setMessages([
                        {
                            role: 'assistant',
                            content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to create or refine!',
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
                        </div>
                    ))}
                    {loading && (
                        <div className="message assistant">
                            <div className="thinking-indicator" aria-label="Assistant is thinking">
                                <img src="/logo.png" alt="" className="thinking-logo" />
                                <span className="thinking-dots">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="input-bar">
                    <div className="input-area">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/jpeg,image/png,image/webp" />
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
                        <div className="review-actions">
                            <button className="btn btn-primary" onClick={() => commitSave(stagingRecipe)}>Save &amp; Continue</button>
                            <button className="btn btn-secondary" onClick={() => setIsConfirmingSave(false)}>Keep Chatting</button>
                        </div>
                    </div>
                </div>
            )}
        </SplashTransition>
    );
}

export default Chat;
