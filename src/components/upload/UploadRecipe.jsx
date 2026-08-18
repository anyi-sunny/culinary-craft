import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { UploadCloud, FileText, Image as ImageIcon, Lock, X, Check, AlertTriangle } from 'lucide-react';

import TopNav from '../nav/TopNav';
import SplashTransition from '../SplashTransition';
import { usePageMeta } from '../../lib/usePageMeta';
import { useAuthModal } from '../auth/authModalContext';
import { invokeAgent } from '../../lib/agentApiClient';
import { saveRecipe } from '../../lib/db';
import { sanitizeObject } from '../../lib/sanitizer';
import { normalizeTags } from '../../lib/categories';
import { normalizeServings } from '../../lib/servings';
import { MAX_PDF_BYTES, encodeAttachment, attachmentContent } from '../../lib/attachments';
import Paywall from '../Paywall';

import './UploadRecipe.css';
import './../explore/Explore.css'; // .gate styles for the login-required screen

const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf';

// Same defensive normalizer the chat save uses: stored flat fields are
// "- " items plus the "For the <component>:" headers of multi-part recipes.
const normalizeFlatLines = (text) =>
    (text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (line.startsWith('- ') || line.endsWith(':') ? line : `- ${line}`))
        .join('\n');

const TRANSCRIBE_PROMPT =
    'Please transcribe the complete recipe from the attached file exactly as written — ' +
    'do not invent ingredients, quantities, or steps that are not in it. If amounts or ' +
    'steps are unreadable, leave them as written rather than guessing. Produce the full ' +
    'structured recipe.';

/**
 * Upload-to-save: pick a photo or PDF of a recipe, the AI transcribes it
 * into the structured format, and it lands directly in My Creations
 * (private, like every new recipe) — no chat conversation involved.
 */
export default function UploadRecipe() {
    const navigate = useNavigate();
    const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
    const { requireLogin } = useAuthModal();
    usePageMeta({
        title: 'Upload a Recipe',
        description: 'Upload a photo or PDF of a recipe and save it straight to your collection.',
    });

    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    // idle → working → done
    const [phase, setPhase] = useState('idle');
    const [saved, setSaved] = useState(null); // {recipeId, title, issues: []}
    const [quotaExceeded, setQuotaExceeded] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const pickFile = (candidate) => {
        if (!candidate) return;
        setError('');
        if (!ACCEPTED.split(',').includes(candidate.type)) {
            setError('That file type is not supported — use a JPEG, PNG, or WebP photo, or a PDF.');
            return;
        }
        if (candidate.type === 'application/pdf' && candidate.size > MAX_PDF_BYTES) {
            setError('That PDF is too large to send (max 3.5MB). Try a version with fewer pages, or a photo of the recipe instead.');
            return;
        }
        setFile(candidate);
    };

    const handleSave = async () => {
        if (!file || phase === 'working') return;
        setPhase('working');
        setError('');
        try {
            const attachment = await encodeAttachment(file);
            const result = await invokeAgent([
                { role: 'user', content: attachmentContent(TRANSCRIBE_PROMPT, attachment) },
            ]);

            if (!result.recipe) {
                // The model chatted instead of producing a recipe — the file
                // didn't contain a complete, readable one.
                setPhase('idle');
                setError(
                    result.output?.trim() ||
                    "Couldn't find a complete recipe in that file. Try a clearer photo, or refine it in Chat with AI instead."
                );
                return;
            }

            const recipe = result.recipe;
            const sanitized = sanitizeObject(recipe, ['title', 'ingredients', 'instructions']);
            const finalItem = {
                title: sanitized.title,
                ingredients: normalizeFlatLines(sanitized.ingredients),
                instructions: normalizeFlatLines(sanitized.instructions),
                tags: normalizeTags(recipe.tags),
                servings: normalizeServings(recipe.servings),
                ownerId: user?.userId,
            };
            // Fresh from the model, never hand-edited — components are current.
            if (recipe.components?.length) finalItem.components = recipe.components;

            const savedRecipe = await saveRecipe(finalItem);
            setSaved({
                recipeId: savedRecipe.recipeId,
                title: finalItem.title,
                issues: result.verify?.issues || [],
            });
            setPhase('done');
        } catch (err) {
            console.error('Upload save error:', err);
            if (err.status === 429) setQuotaExceeded(true);
            setPhase('idle');
            setError(err?.message || 'Failed to process your recipe. Please try again.');
        }
    };

    const reset = () => {
        setFile(null);
        setSaved(null);
        setError('');
        setPhase('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Account gate, mirroring the chat page.
    if (authStatus !== 'authenticated') {
        return (
            <SplashTransition>
                <div className="upload-page">
                    <TopNav />
                    {authStatus === 'unauthenticated' && (
                        <div className="gate">
                            <div className="gate-icon">
                                <Lock size={30} strokeWidth={1.8} />
                            </div>
                            <h2>Log in to upload recipes</h2>
                            <p>Create an account or log in to save recipes from photos and PDFs to your collection.</p>
                            <button className="btn btn-primary" onClick={requireLogin}>
                                Log in or sign up
                            </button>
                        </div>
                    )}
                </div>
            </SplashTransition>
        );
    }

    const FileGlyph = file?.type === 'application/pdf' ? FileText : ImageIcon;

    return (
        <SplashTransition>
            {quotaExceeded && <Paywall />}
            <div className="upload-page">
                <TopNav />
                <div className="upload-body">
                    <header className="upload-header">
                        <h1>Upload a Recipe</h1>
                        <p>
                            Add a photo or PDF of a recipe — a cookbook page, a handwritten card, a
                            screenshot — and it will be transcribed and saved to My Creations.
                        </p>
                    </header>

                    {phase === 'done' && saved ? (
                        <div className="upload-card upload-card--done">
                            <div className="upload-done-icon">
                                <Check size={26} strokeWidth={2.4} />
                            </div>
                            <h2>{saved.title} saved</h2>
                            <p>It is in My Creations as a private recipe — publish it whenever you are ready.</p>
                            {saved.issues.length > 0 && (
                                <div className="upload-issues">
                                    <AlertTriangle size={15} strokeWidth={2.2} />
                                    <div>
                                        <strong>Worth a look:</strong>
                                        <ul>
                                            {saved.issues.map((issue, i) => (
                                                <li key={i}>{issue}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            <div className="upload-actions">
                                <button className="btn btn-primary" onClick={() => navigate(`/recipe/${saved.recipeId}`)}>
                                    View recipe
                                </button>
                                <button className="btn btn-secondary" onClick={reset}>
                                    Upload another
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="upload-card">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept={ACCEPTED}
                                style={{ display: 'none' }}
                                onChange={(e) => pickFile(e.target.files?.[0])}
                            />
                            <button
                                type="button"
                                className={`upload-dropzone${dragOver ? ' drag' : ''}${file ? ' has-file' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    pickFile(e.dataTransfer.files?.[0]);
                                }}
                                disabled={phase === 'working'}
                            >
                                {file ? (
                                    <span className="upload-file">
                                        <FileGlyph size={22} strokeWidth={1.8} />
                                        <span className="upload-file-name">{file.name}</span>
                                        <span
                                            className="upload-file-clear"
                                            role="button"
                                            aria-label="Remove file"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                reset();
                                            }}
                                        >
                                            <X size={15} strokeWidth={2.2} />
                                        </span>
                                    </span>
                                ) : (
                                    <>
                                        <UploadCloud size={30} strokeWidth={1.6} />
                                        <span className="upload-dropzone-label">
                                            Drop a file here, or click to browse
                                        </span>
                                        <span className="upload-dropzone-hint">JPEG, PNG, WebP, or PDF (max 3.5MB)</span>
                                    </>
                                )}
                            </button>

                            {error && <p className="upload-error">{error}</p>}

                            <button
                                className="btn btn-primary upload-save"
                                onClick={handleSave}
                                disabled={!file || phase === 'working'}
                            >
                                {phase === 'working' ? 'Transcribing your recipe…' : 'Save to My Creations'}
                            </button>
                            <p className="upload-footnote">
                                Want to tweak it first? Attach it in Build &amp; Refine instead — or
                                upload now and improve it any time from the recipe page.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </SplashTransition>
    );
}
