import React, { useState, useRef, useEffect } from 'react';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';

import { saveRecipe, deleteRecipe } from '../../lib/db';
import TopNav from '../nav/TopNav';
import { useAuthModal } from '../auth/authModalContext';

// Styling Imports
import './Chat.css';
import './../explore/modal/RecipeModal.css';
import SplashTransition from '../SplashTransition';

const AWS_REGION = import.meta.env.VITE_AWS_REGION;
const RAW_AGENT_ID = (import.meta.env.VITE_AGENT_ID || '').trim();
const RAW_AGENT_ALIAS_ID = (import.meta.env.VITE_AGENT_ALIAS_ID || '').trim();

const getIdFromArn = (value, resourceType) => {
    if (!value) return '';
    if (!value.startsWith('arn:')) return value;

    const marker = `:${resourceType}/`;
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) return value;

    const afterMarker = value.slice(markerIndex + marker.length);
    return (afterMarker.split('/')[0] || '').trim();
};

const AGENT_ID = getIdFromArn(RAW_AGENT_ID, 'agent');
const AGENT_ALIAS_ID = getIdFromArn(RAW_AGENT_ALIAS_ID, 'agent-alias');

const validateBedrockConfig = () => {
    const missing = [];
    if (!AWS_REGION) missing.push('VITE_AWS_REGION');
    if (!AGENT_ID) missing.push('VITE_AGENT_ID');
    if (!AGENT_ALIAS_ID) missing.push('VITE_AGENT_ALIAS_ID');

    if (missing.length > 0) {
        throw new Error(`Missing Bedrock config: ${missing.join(', ')}`);
    }
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
    const message = error?.message || 'Unknown Bedrock Agent error.';
    const requestId = error?.$metadata?.requestId;
    const normalizedMessage = message.toLowerCase();
    const isMarketplaceAccessIssue =
        normalizedMessage.includes('aws-marketplace:viewsubscriptions') ||
        normalizedMessage.includes('aws-marketplace:subscribe') ||
        normalizedMessage.includes('marketplace subscription') ||
        normalizedMessage.includes('model access is denied');
    const isAccessDenied =
        name.toLowerCase().includes('accessdenied') ||
        normalizedMessage.includes('access denied') ||
        normalizedMessage.includes('not authorized');

    const details = [
        `Bedrock request failed (${name}).`,
        message,
        `Region: ${AWS_REGION || 'not set'}`,
        `Agent ID: ${AGENT_ID || 'not set'}`,
        `Alias ID: ${AGENT_ALIAS_ID || 'not set'}`,
    ];

    if (requestId) {
        details.push(`Request ID: ${requestId}`);
    }

    if (isMarketplaceAccessIssue) {
        details.push('The Bedrock model behind this agent is blocked by AWS Marketplace access.');
        details.push('The calling identity or service role needs Marketplace permissions to enable the model subscription.');
        details.push('Check aws-marketplace:ViewSubscriptions and aws-marketplace:Subscribe, then verify model access in Bedrock.');
    } else if (isAccessDenied) {
        details.push('Access appears to be denied by IAM policy.');
        details.push('Required action is usually: bedrock:InvokeAgent.');
        details.push('Attach permission to the exact IAM principal represented by your frontend credentials.');
        details.push('Also allow access to this agent alias resource in us-east-1.');
    } else {
        details.push('Verify that the agent and alias are in the same region and currently active.');
        details.push('If you used ARN values in env vars, ensure they point to this exact agent and alias.');
    }

    return details.join(' ');
};

// Bedrock agent runtime client (chat only; DynamoDB lives in lib/db.js).
const client = new BedrockAgentRuntimeClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
});

function Chat() {
    const location = useLocation();
    const navigate = useNavigate();

    const [showTutorial, setShowTutorial] = useState(false);

    const { authStatus, user } = useAuthenticator(context => [context.authStatus, context.user]);
    const { requireLogin } = useAuthModal();

    const [sessionId] = useState(() => `session-${Math.random().toString(36).substr(2, 9)}`);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeRecipeId, setActiveRecipeId] = useState(null);

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
            setShowTutorial(true);
        }
    }, [location.state]);

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
                setMessages([{ role: 'assistant', content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to refine or save.' }]);
            }
        };

        loadContext();
    }, [location.state]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const readFileAsBytes = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
    };

    const callAgent = async (textToSend, file = null) => {
        validateBedrockConfig();

        const payload = {
            agentId: AGENT_ID,
            agentAliasId: AGENT_ALIAS_ID,
            sessionId: sessionId,
            inputText: textToSend,
        };

        if (file) {
            const fileBytes = await readFileAsBytes(file);
            payload.sessionState = {
                files: [{
                    name: file.name,
                    source: { sourceType: 'BYTE_CONTENT', byteContent: fileBytes },
                    useCase: 'CHAT'
                }]
            };
        }

        const command = new InvokeAgentCommand(payload);
        const response = await client.send(command);

        let fullResponse = "";
        if (response.completion) {
            for await (const chunk of response.completion) {
                if (chunk.chunk?.bytes) {
                    fullResponse += new TextDecoder().decode(chunk.chunk.bytes);
                }
            }
        }
        return fullResponse;
    };

    const sendMessage = async () => {
        if (!input.trim() && !selectedFile) return;

        const displayInput = input;
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

            if (recipeContextRef.current) {
                const r = recipeContextRef.current;
                agentInput = `The user is working on this recipe:
                Name: ${r.title}
                Ingredients: ${r.ingredients}
                Instructions: ${r.instructions}

                User's Request: ${agentInput}`;
                recipeContextRef.current = null;
            }

            const botResponse = await callAgent(agentInput, displayFile);
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
                "Crucially, use vertical bars '|' to separate the recipe, the emoji, and your closing remarks. " +
                "Format exactly like this:\n" +
                "TITLE: Buffalo Chicken Dip\n" +
                "INGREDIENTS:\n- 2 cans chicken\n- 8 oz cream cheese\n" +
                "INSTRUCTIONS:\n- Preheat oven to 350F\n- Mix and bake\n" +
                "| [Insert 1 Emoji Here] | [Closing remarks]"
            );

            const parts = botResponse.split('|');
            // Strip markdown BEFORE regex so wrapped tags like "**TITLE:**" still parse.
            const cleanRecipeData = stripMarkdown(parts[0]);
            let rawEmoji = (parts.length > 1) ? parts[1] : null;
            const aiEmoji = rawEmoji ? rawEmoji.trim() : '🥘';

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
                    emoji: aiEmoji,
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
            const newId = finalRecipe.recipeId || `recipe-${Date.now()}`;
            const isUpdate = Boolean(activeRecipeId) && activeRecipeId === newId;
            // Updates preserve the original record (ownerId, heartedBy); new
            // recipes are owned by the logged-in creator.
            const base = isUpdate ? (editingOriginalRef.current || {}) : {};

            const finalItem = {
                ...base,
                title: finalRecipe.title,
                emoji: finalRecipe.emoji || '🥘',
                ingredients: finalRecipe.ingredients,
                instructions: finalRecipe.instructions,
                recipeId: newId,
            };
            if (!isUpdate) {
                finalItem.ownerId = user?.userId;
            }

            await saveRecipe(finalItem);

            if (activeRecipeId && activeRecipeId !== newId) {
                await deleteRecipe(activeRecipeId);
            }

            navigate('/explore');
        } catch (err) {
            console.error("Commit Save Error:", err);
            alert("Final save failed.");
        }
    };

    return (
        <SplashTransition>
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
                                    <span className="btn-icon">📎</span>
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

                <div className="messages-area">
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
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.txt,.csv" />
                    <button className={`icon-button ${selectedFile ? 'active' : ''}`} onClick={() => fileInputRef.current.click()}>
                        <span className='btn-text'>Upload Recipe</span>
                        <span className="btn-icon">📎</span>
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
                            <button className="btn btn-primary" onClick={() => commitSave(stagingRecipe)}>🚀 Save &amp; Go to Explore</button>
                            <button className="btn btn-secondary" onClick={() => setIsConfirmingSave(false)}>Keep Chatting</button>
                        </div>
                    </div>
                </div>
            )}
        </SplashTransition>
    );
}

export default Chat;
