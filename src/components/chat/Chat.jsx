import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Paperclip } from 'lucide-react';

import { saveRecipe } from '../../lib/db';
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
import SplashTransition from '../SplashTransition';

const AWS_REGION = awsConfig.region;

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

    const [showTutorial, setShowTutorial] = useState(false);

    const { authStatus, user } = useAuthenticator(context => [context.authStatus, context.user]);
    const { requireLogin } = useAuthModal();

    const [sessionId] = useState(() => `session-${crypto.randomUUID()}`);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeRecipeId, setActiveRecipeId] = useState(null);
    const [quotaExceeded, setQuotaExceeded] = useState(false);

    // Ingredient selector state
    const [showIngredientSelector, setShowIngredientSelector] = useState(false);
    const ingredientContextRef = useRef(null);

    const messagesEndRef = useRef(null);
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

    useEffect(() => {
        if (!location.state?.recipeToImprove) {
            // Only show tutorial if user is explicitly NOT authenticated (not just loading)
            if (authStatus === 'unauthenticated') {
                setShowTutorial(true);
            } else {
                setShowTutorial(false);
            }
        }
    }, [location.state, authStatus]);

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
            } else {
                // Show ingredient selector for new recipe generation
                if (authStatus === 'authenticated') {
                    setShowIngredientSelector(true);
                } else {
                    setMessages([{ role: 'assistant', content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to refine or save.' }]);
                }
            }
        };

        loadContext();
    }, [location.state, authStatus, callAgent]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
        // Saving requires an account; prompt login for guests.
        if (authStatus !== 'authenticated') {
            requireLogin();
            return;
        }

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

            // Navigate to recipe detail page instead of explore
            navigate(`/recipe/${savedRecipe.recipeId}`);
        } catch (err) {
            console.error("Commit Save Error:", err);
            alert("Final save failed.");
        }
    };

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
                            content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to create or refine!',
                        },
                    ]);
                }}
            />

            <div className="chat-container">
                <TopNav title="Culinary Craft AI" />

                {showTutorial && (
                    <div className="modal-overlay">
                        <div className="modal-content tutorial-modal">
                            <h2 style={{margin: '0 0 10px 0'}}>Welcome to Culinary Craft!</h2>
                            <p style={{fontSize: '1.1rem'}}>Chat with us to generate a recipe from scratch!</p>
                            <hr style={{width: '100%', border: '0', borderTop: '1px solid var(--border)', margin: '10px 0'}}/>
                            <p>You can also upload a recipe you already have using this button:</p>

                            <div className="fake-btn-display">
                                <button className="icon-button" style={{pointerEvents: 'none'}}>
                                    <span className='btn-text'>Upload Recipe</span>
                                    <span className="btn-icon"><Paperclip size={15} /></span>
                                </button>
                            </div>

                            <p>Once you're done, click the save button to save this recipe:</p>

                            <div className="fake-btn-display">
                                <button className="save-btn" style={{pointerEvents: 'none'}}>
                                    Save
                                </button>
                            </div>

                            <button className="got-it-btn" onClick={() => setShowTutorial(false)}>
                                Got it, let's cook!
                            </button>
                        </div>
                    </div>
                )}

                <div className="messages-area" data-lenis-prevent>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <div className="message-bubble">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && <div className="message assistant"><div className="typing-indicator">Thinking...</div></div>}
                    <div ref={messagesEndRef} />
                </div>

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

                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder={selectedFile ? `File: ${selectedFile.name}` : "Type instructions..."} />
                    <button className="send-btn" onClick={sendMessage} disabled={loading}>Send</button>
                </div>
            </div>

            {isConfirmingSave && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{padding: '5px', margin: '0px', fontSize: '28px'}}>Review &amp; Name Your Recipe</h2>
                        <input
                            className="edit-input-title"
                            style={{ marginTop: '16px' }}
                            value={stagingRecipe.title || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, title: e.target.value})}
                        />
                        <textarea
                            className="edit-textarea"
                            value={stagingRecipe.ingredients || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, ingredients: e.target.value})}
                        />
                        <textarea
                            className="edit-textarea"
                            value={stagingRecipe.instructions || ''}
                            onChange={(e) => setStagingRecipe({...stagingRecipe, instructions: e.target.value})}
                        />
                        <div style={{display: 'flex', gap: '10px', marginTop: '24px'}}>
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
