import React, { useState } from "react";
import { ImagePlus } from "lucide-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import "./About.css";

// Drop your photo into public/about/ with this filename and it will replace
// the placeholder frame automatically.
const PORTRAIT_SRC = "/about/portrait.jpg";

/**
 * The story behind the app. Two cards: the origin story sits beside the
 * portrait (stacking under it on mobile), and the software-engineer story
 * runs full-width below. Both cards grow with however much text they hold.
 */
function About() {
    const [portraitLoaded, setPortraitLoaded] = useState(false);
    const [portraitFailed, setPortraitFailed] = useState(false);

    return (
        <SplashTransition>
            <div className="page about-page">
                <TopNav />

                <div className="page-head">
                    <h1>The Story Behind Culinary Craft</h1>
                    <p className="page-sub">
                        Why a (graduated!) college student's fridge turned into an app
                    </p>
                </div>

                <div className="about-content">
                    {/* Origin story, with the portrait floated inside the
                        card so the text wraps around it */}
                    <section className="about-card">
                        <div className="about-portrait">
                            {!portraitFailed && (
                                <img
                                    src={PORTRAIT_SRC}
                                    alt="Anyi Sun"
                                    className={`about-portrait-img${portraitLoaded ? " loaded" : ""}`}
                                    onLoad={() => setPortraitLoaded(true)}
                                    onError={() => setPortraitFailed(true)}
                                />
                            )}
                            {!portraitLoaded && (
                                <div className="about-portrait-placeholder">
                                    <ImagePlus size={30} strokeWidth={1.6} />
                                </div>
                            )}
                        </div>

                        <p className="about-eyebrow">The origin story</p>
                        <h2>A couple brown bananas that started it all...</h2>
                                <p>
                                    That's me! I just graduated and am now starting my big person career in
                                    the big apple!
                                </p>
                                <p>
                                    My senior year of college, I snagged one of the best housing options our campus
                                    provides, and with it, came an awesome kitchen with amazing appliances. I couldn't 
                                    wait to start cooking and baking for my roommates and also practice the skills I would 
                                    need when we no longer had our amazing meal plan-shoutout Bowdoin dining!
                                </p>
                                <p>
                                    Around then, is when I decided to use AI to help me figure out how to use all 5 of 
                                    the browning bananas we had on our kitchen counter when most banana bread recipes don't use more
                                    than 2. (Turns out, banana bread is way better the more bananas you use because it provides
                                    more moisture and flavor!) Because our dining hall kept an endless supply of bananas and fresh fruits
                                    just sitting near the entrance begging to be devoured, I realized I had an infinite banana bread 
                                    glitch. Provided, I get a bag of flour, sugar, and butter from the grocery store, I could use my
                                    polar points allowance to get more eggs and make endless amounts of banana bread. I wanted each
                                    batch to be better than the one before it, so I used Google Gemini to express that the last batch was too dry, 
                                    or the outsides was getting overcooked while the inside was still raw. I learned to cover the loaf with foil, 
                                    add more butter, reduce the flour, change the oven temperature. 
                                </p>
                                <p>
                                    It had taken me at least three batches of banana bread to realize that I could make a website. It was
                                    getting tiring, trying to find the right recipe as my chats with gemini accumulated. I was trying to 
                                    find a banana bread recipe within chats about career advice and how best to communicate with this intimidating manager, 
                                    studying for my cybersecurity exams, and all sorts of things you might imagine a college student would 
                                    need help with. Coming off of my internship with Audible, I had learned all about AI-driven development 
                                    so I knew making this would be a breeze. So over the one week of winter break I had at home before I had 
                                    to go back on campus for my ice hockey team, I put together the first prototype of Culinary Craft. 
                                </p>
                                <p>
                                    The release of Fable 5 brought me an insane opportunity to really improve this app at the speed of light
                                    and accomplish everything I had always dreamed of putting together. My goal now, is that this website 
                                    makes cooking and baking easy for college students and young adults who are more constrained by their pantry
                                    and willing to work with what they've got! If this ends up helping more people than just me, then I can 
                                    be happy that in a world of AI slop, hopefully this app can be a beacon of light for those who want to make the most of their ingredients and have fun doing it!
                                </p>
                    </section>

                    {/* Engineering story */}
                    <section className="about-card about-engineer">
                        <p className="about-eyebrow">Behind the code</p>
                        <h2>My Story as a Software Engineer</h2>
                            <p>
                                When AI started to really become a big thing, I was honestly pretty annoyed
                                at how reliant people were becoming on it. However, especially as a college student
                                majoring in Compsci, I realized that if I didn't board the train, I'd soon be left 
                                behind. 
                            </p>
                    </section>
                </div>
            </div>
        </SplashTransition>
    );
}

export default About;
