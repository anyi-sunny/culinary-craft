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
                        <h2>The brown bananas that started it all...</h2>
                                <p>
                                    That's me! I just graduated college and am now starting my big person career in
                                    NYC!
                                </p>
                                <p>
                                    My senior year of college, I snagged one of the best housing options our campus
                                    provides. With it, came an awesome kitchen with amazing appliances. I couldn't 
                                    wait to start whipping things up for my roommates and also practice the skills I would 
                                    need when we no longer had our amazing meal plan&mdash;shoutout Bowdoin dining!
                                </p>
                                <p>
                                    Around late fall, is when I asked AI to help me figure out what to do with 5 the browning bananas 
                                    we had on our kitchen counter. From what I found, banana bread recipes don't ever really use more
                                    than 2. (With the help of some adjustments, I learned that banana bread is way better with more bananas because it provides
                                    more moisture and flavor!) Our dining hall kept an endless supply of bananas and fresh fruits
                                    begging to be devoured. I then realized I had an infinite banana bread 
                                    glitch. Provided I get a bag of flour, sugar, and butter from the grocery store, I could use my
                                    polar points allowance (basically free money from our school!) to get more eggs and make endless amounts of banana bread. I wanted each
                                    batch to be better than the last, so I used Google Gemini to iterate on better and better versions. The chat
                                    grew longer as I asked for more improvements and learned how aluminum foil over the pan allows the baking of the 
                                    bread to come out more evenly or that brown sugar improves a deeper flavor than just white sugar alone. 
                                </p>
                                <p>
                                    It had taken me at least three batches of banana bread to realize that I should make a website from this idea. It was
                                    getting tiring trying to find the right recipe as my chats with gemini accumulated. I was searching within chats about career 
                                    advice and how best to communicate with this intimidating manager, 
                                    studying for my cybersecurity exams, and all sorts of things you might imagine a college student would 
                                    need help with. Coming off of my internship with Audible, I had learned all about AI-driven development 
                                    so I knew putting this together wouldn't be too difficult. Over the one week of winter break I had at home (because 
                                    I had my commitments as a member of the women's ice hockey team), I put together the first prototype of Culinary Craft. 
                                </p>
                                <p>
                                    The release of Fable 5 brought me an insane opportunity to really improve this app at the speed of light
                                    and accomplish everything I had always dreamed of putting together. My goal now, is that this website 
                                    makes cooking and baking easy for college students and young adults who are more constrained by their pantry
                                    and willing to work with what they've got! If this ends up helping more people than just me, then I can 
                                    be happy that this AI solution can be a beacon of light for those who want to make the most of their ingredients and have fun doing it!
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
                                behind. However, if I wanted to use AI, I wanted to use it with integrity. That 
                                meant that it was merely a learning tool not a cheating tool. I also understood the 
                                environmental impact that AI infrastructure has so if I was going to make an AI solution
                                in order to keep up with the times, I wanted to make sure it was something worth it. It 
                                has to contribute to the world in a positive way and with this solution, it reduces 
                                food waste and make cooking and baking more accessible for people who are constrained 
                                by their pantry. Not everyone needs to be a master chef with all the time and knowledge 
                                in the world to study and perfect a meal worth eating. Everyone deserves to enjoy the food
                                they make and this tool make that possible. 
                            </p>
                    </section>
                </div>
            </div>
        </SplashTransition>
    );
}

export default About;
