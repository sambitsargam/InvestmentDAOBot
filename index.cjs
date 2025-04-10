#!/usr/bin/env node
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Configuration, OpenAIApi } = require("openai");
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME; // e.g. "shakti0675"
const GROUP_CHAT_IDS = process.env.GROUP_CHAT_IDS
  ? process.env.GROUP_CHAT_IDS.split(",").map(id => id.trim())
  : []; // e.g.: " -123456789, -987654321 "

// Initialize Telegram Bot (polling mode)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize OpenAI
const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- IN-MEMORY CHAT DATA ---
// This will store temporary data (like the current idea being processed) by chat ID.
const chatData = {};

// --- SUPABASE HELPER FUNCTIONS ---
// These functions interact with the Supabase tables. Make sure you’ve created these tables:
// 1. investment_ideas
// 2. feedback
// 3. members

async function addInvestmentIdea(topic, submitterId, submitterUsername, researchSummary, thesis, riskAssessment, evaluationScore) {
  const data = {
    topic,
    submitter_id: submitterId,
    submitter_username: submitterUsername,
    research_summary: researchSummary,
    thesis,
    risk_assessment: riskAssessment,
    evaluation_score: evaluationScore,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  const { data: result, error } = await supabase
    .from('investment_ideas')
    .insert(data)
    .select('*')
    .single();
  if (error) {
    console.error("Error adding investment idea:", error);
    throw error;
  }
  return result.id;
}

async function addFeedback(ideaId, memberId, memberUsername, vote) {
  const data = {
    idea_id: ideaId,
    member_id: memberId,
    member_username: memberUsername,
    vote,
    timestamp: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('feedback')
    .insert(data);
  if (error) console.error("Error adding feedback:", error);
}

async function updateMemberPoints(memberId, username, additionalPoints) {
  const { data, error } = await supabase
    .from('members')
    .select('points')
    .eq('member_id', memberId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error("Error checking member:", error);
  }
  if (data) {
    const newPoints = data.points + additionalPoints;
    await supabase.from('members')
      .update({ points: newPoints })
      .eq('member_id', memberId);
  } else {
    await supabase.from('members')
      .insert([{ member_id: memberId, username, points: additionalPoints }]);
  }
}

async function getFeedbackCounts(ideaId) {
  const { data, error } = await supabase
    .from('feedback')
    .select('vote, idea_id');
  if (error) {
    console.error("Error retrieving feedback:", error);
    return { yes: 0, no: 0 };
  }
  const feedbackForIdea = data.filter(item => item.idea_id === ideaId);
  const yesCount = feedbackForIdea.filter(item => item.vote.toLowerCase() === "yes").length;
  const noCount = feedbackForIdea.filter(item => item.vote.toLowerCase() === "no").length;
  return { yes: yesCount, no: noCount };
}

async function setInvestmentIdeaStatus(ideaId, status) {
  const { error } = await supabase
    .from('investment_ideas')
    .update({ status })
    .eq('id', ideaId);
  if (error) console.error("Error updating idea status:", error);
}

async function getMemberPoints() {
  const { data, error } = await supabase
    .from('members')
    .select('username, points')
    .order('points', { ascending: false });
  if (error) {
    console.error("Error getting member points:", error);
    return [];
  }
  return data;
}

// --- AGENT FUNCTIONS ---
// These functions simulate the various stages of processing a pitch.

// 1. Research Agent (simulated)
function researchAgent(topic) {
  const summary = `Preliminary research on "${topic}": aggregated market data, trends, and news.`;
  console.log("ResearchAgent:", summary);
  return summary;
}

// 2. Investment Thesis Agent (simulated)
function investmentThesisAgent(researchSummary) {
  const thesis = `Investment Thesis: Based on the research, this opportunity looks promising. Details: ${researchSummary}`;
  console.log("InvestmentThesisAgent:", thesis);
  return thesis;
}

// 3. OpenAI-Powered Summarization Agent
async function openAISummarizationAgent(text) {
  const prompt = `Summarize the following research details into a concise paragraph:\n\n${text}\n\nSummary:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.5,
    });
    const summary = response.data.choices[0].message.content.trim();
    console.log("OpenAISummarizationAgent generated summary.");
    return summary;
  } catch (error) {
    console.error("OpenAI summarization error:", error);
    return text;
  }
}

// 4. Risk Assessment Agent
async function riskAssessmentAgent(thesis) {
  const prompt = `Evaluate the following investment thesis and provide a risk assessment including key risk factors, mitigation strategies, and a risk score (1=low, 10=high):\n\n${thesis}\n\nRisk Assessment:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.6,
    });
    const assessment = response.data.choices[0].message.content.trim();
    console.log("RiskAssessmentAgent generated assessment.");
    return assessment;
  } catch (error) {
    console.error("OpenAI risk assessment error:", error);
    return "Risk assessment not available.";
  }
}

// 5. Recommendation Agent
async function recommendationAgent(thesis, riskAssessment) {
  const prompt = `Based on the following investment thesis and risk assessment, provide recommendations for next steps (such as due diligence areas, questions for founders, or follow-up actions):\n\nThesis: ${thesis}\nRisk Assessment: ${riskAssessment}\n\nRecommendations:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });
    const recommendations = response.data.choices[0].message.content.trim();
    console.log("RecommendationAgent generated recommendations.");
    return recommendations;
  } catch (error) {
    console.error("OpenAI recommendation error:", error);
    return "No recommendations available.";
  }
}

// 6. Evaluation Agent – scores the idea on a scale of 1-10.
async function evaluateIdea(text) {
  const prompt = `Evaluate the following investment idea and provide a single numeric score between 1 (poor) and 10 (excellent) that represents its potential:\n\n"${text}"\n\nScore:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
      temperature: 0.3,
    });
    const scoreStr = response.data.choices[0].message.content.trim();
    // Extract a number from the response
    const score = parseFloat(scoreStr);
    console.log("EvaluateIdea score:", score);
    return isNaN(score) ? 0 : score;
  } catch (error) {
    console.error("Error evaluating idea:", error);
    return 0;
  }
}

// 7. Intent Recognition Agent – used for free-form questions.
async function intentRecognitionAgent(message) {
  const prompt = `You are an intelligent assistant integrated into a DAO's Telegram channel. Analyze the following message and return a JSON object with two keys: "intent" and "query". Valid intents include:
- "investment_query" (questions about investment ideas, risk, or due diligence),
- "general_info" (questions about DAO operations or membership),
- "search_query" (questions needing live info),
- "other" (if not clear).

Message: "${message}"

JSON:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.3,
    });
    const jsonStr = response.data.choices[0].message.content.trim();
    const intentData = JSON.parse(jsonStr);
    console.log("IntentRecognitionAgent output:", intentData);
    return intentData;
  } catch (error) {
    console.error("Intent recognition error:", error);
    return { intent: "other", query: message };
  }
}

// --- TELEGRAM BOT HANDLERS ---

// Only admin (@shakti0675) has full personal chat access.
// Other users (founders) may pitch ideas which will be evaluated, and if scoring high, forwarded to the groups.

// /start command – available to everyone.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `Welcome to the Investment DAO Bot!
  
For Admin ([@${ADMIN_USERNAME}]):
• Full commands are available via personal chat.

For Founders:
• Use /submit_investment <topic> to pitch your idea. Your pitch will be evaluated, and if approved, forwarded to our groups.

Use /help to view commands.`;
  bot.sendMessage(chatId, welcomeText);
});

// /help command to list available commands
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  let helpText = "";
  if (msg.chat.type === "private" && msg.from.username === ADMIN_USERNAME) {
    helpText = `Admin Commands:
• /submit_investment <topic> - Submit an investment idea.
• /finalize_investment - Finalize the current idea and tally votes.
• /member_points - Display member incentive points.
• /details <idea_id> - Get full details of a specific idea.
  
For Founders (in private chat):
• /submit_investment <topic> - Submit your pitch. It will be evaluated and, if good, forwarded to the groups.`;
  } else {
    helpText = `Available Commands:
• /submit_investment <topic> - Submit an investment idea.
• /member_points - View the member points leaderboard.`;
  }
  bot.sendMessage(chatId, helpText);
});

// /submit_investment command handler
bot.onText(/\/submit_investment (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const topic = match[1].trim();
  const userId = msg.from.id;
  const username = msg.from.username || "anonymous";

  // Check if this is an admin or a founder pitch.
  const isAdmin = (msg.from.username === ADMIN_USERNAME);

  bot.sendMessage(chatId, `Pitch received: "${topic}"`);

  // Process the idea through research, summarization, thesis, risk, recommendations.
  const rawResearch = researchAgent(topic);
  const enhancedResearch = await openAISummarizationAgent(rawResearch);
  const thesis = investmentThesisAgent(enhancedResearch);
  const riskAssessment = await riskAssessmentAgent(thesis);
  const recommendations = await recommendationAgent(thesis, riskAssessment);
  const evaluationScore = await evaluateIdea(topic); // score from 1 to 10

  console.log(`Idea evaluation score: ${evaluationScore}`);

  // Define a threshold score (e.g., 7) for approval.
  const SCORE_THRESHOLD = 7;

  if (!isAdmin) {
    // Founder pitch: Check the score.
    if (evaluationScore < SCORE_THRESHOLD) {
      bot.sendMessage(chatId, `Thank you for your pitch. Unfortunately, your idea scored ${evaluationScore} (threshold is ${SCORE_THRESHOLD}). Please review and try again later.`);
      return;
    }
  }
  
  // If admin or idea passed evaluation, then store the idea.
  try {
    const ideaId = await addInvestmentIdea(topic, userId, username, enhancedResearch, thesis, riskAssessment, evaluationScore);
    // Save current idea id in memory for further processing (like voting).
    chatData[chatId] = { currentIdeaId: ideaId };

    // If this pitch came from a founder (non-admin) in private chat, forward it to each group.
    if (!isAdmin && msg.chat.type === "private") {
      // Notify the founder.
      bot.sendMessage(chatId, `Your pitch scored ${evaluationScore} and has been approved. It will now be forwarded to our groups for votes.`);
      // Forward to each linked group.
      GROUP_CHAT_IDS.forEach(groupId => {
        bot.sendMessage(groupId, `New Investment Pitch from @${username}:\nTopic: "${topic}"\n\nResearch Summary: ${enhancedResearch}\nThesis: ${thesis}\nRisk: ${riskAssessment}\nRecommendations: ${recommendations}\n\nVote below:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Yes", callback_data: "yes" },
                  { text: "No", callback_data: "no" }
                ]
              ]
            }
          }
        );
      });
    } else {
      // For admin (or if pitch was already in a group), start an inline poll in the current chat.
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Yes", callback_data: "yes" },
              { text: "No", callback_data: "no" }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, `Idea approved with score ${evaluationScore}. Do you approve this investment idea?`, opts);
    }
  } catch (error) {
    bot.sendMessage(chatId, "Failed to store the investment idea. Please try again later.");
  }
});

// Callback query handler for poll votes
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const vote = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username || "anonymous";

  // Retrieve the current idea id from chatData (if available)
  const currentData = chatData[chatId];
  if (!currentData || !currentData.currentIdeaId) {
    bot.answerCallbackQuery(callbackQuery.id, { text: "No active investment idea." });
    return;
  }
  const ideaId = currentData.currentIdeaId;
  await addFeedback(ideaId, userId, username, vote);
  await updateMemberPoints(userId, username, 1);
  bot.editMessageText(`Your vote "${vote}" has been recorded. Thank you for your participation!`, { chat_id: chatId, message_id: msg.message_id });
  bot.answerCallbackQuery(callbackQuery.id);
});

// /finalize_investment command – only available in admin personal chat.
bot.onText(/\/finalize_investment/, async (msg) => {
  if (msg.chat.type !== "private" || msg.from.username !== ADMIN_USERNAME) {
    bot.sendMessage(msg.chat.id, "You are not authorized to finalize ideas.");
    return;
  }
  const chatId = msg.chat.id;
  const currentData = chatData[chatId];
  if (!currentData || !currentData.currentIdeaId) {
    bot.sendMessage(chatId, "No active investment idea to finalize.");
    return;
  }
  const ideaId = currentData.currentIdeaId;
  const { yes, no } = await getFeedbackCounts(ideaId);
  const outcome = (yes > no) ? "approved" : "rejected";
  await setInvestmentIdeaStatus(ideaId, outcome);

  // Award bonus points (example: submitter gets extra 5 points if approved)
  const ideaResp = await supabase
    .from('investment_ideas')
    .select('submitter_id, submitter_username')
    .eq('id', ideaId)
    .single();
  if (ideaResp.data) {
    const { submitter_id, submitter_username } = ideaResp.data;
    if (outcome === "approved") {
      await updateMemberPoints(submitter_id, submitter_username, 5);
    }
  }
  
  // Award bonus points to voters (example: 2 points each for those voting with the outcome)
  const voteValue = (outcome === "approved") ? "yes" : "no";
  const { data: voters } = await supabase
    .from('feedback')
    .select('member_id, member_username')
    .eq('idea_id', ideaId)
    .eq('vote', voteValue);
  if (voters) {
    for (const voter of voters) {
      await updateMemberPoints(voter.member_id, voter.member_username, 2);
    }
  }
  bot.sendMessage(chatId, `Finalized Investment Idea (ID: ${ideaId}):
Yes votes: ${yes} | No votes: ${no}
Outcome: ${outcome.toUpperCase()}
Bonus points awarded.`);
  // Clear current idea in memory for admin chat.
  delete chatData[chatId];
});

// /member_points command – available to all.
bot.onText(/\/member_points/, async (msg) => {
  const chatId = msg.chat.id;
  const members = await getMemberPoints();
  if (members.length === 0) {
    bot.sendMessage(chatId, "No member points recorded yet.");
    return;
  }
  let message = "Member Incentive Points:\n";
  members.forEach(member => {
    message += `${member.username}: ${member.points} points\n`;
  });
  bot.sendMessage(chatId, message);
});

// /details <idea_id> command – admin only, returns full details for a given idea.
bot.onText(/\/details (.+)/, async (msg, match) => {
  if (msg.chat.type !== "private" || msg.from.username !== ADMIN_USERNAME) {
    bot.sendMessage(msg.chat.id, "You are not authorized to access idea details.");
    return;
  }
  const ideaId = match[1].trim();
  const { data, error } = await supabase
    .from('investment_ideas')
    .select('*')
    .eq('id', ideaId)
    .single();
  if (error || !data) {
    bot.sendMessage(msg.chat.id, "Idea not found.");
    return;
  }
  const detailMessage = `Idea ID: ${data.id}
Topic: ${data.topic}
Submitted by: @${data.submitter_username} (ID: ${data.submitter_id})
Research Summary: ${data.research_summary}
Thesis: ${data.thesis}
Risk Assessment: ${data.risk_assessment}
Evaluation Score: ${data.evaluation_score}
Status: ${data.status}
Submitted At: ${data.created_at}`;
  bot.sendMessage(msg.chat.id, detailMessage);
});

bot.on('text', async (msg) => {
  const text = msg.text;
  if (text.startsWith('/')) return; // ignore commands
  console.log("Received message:", text);

  const entities = msg.entities || [];
  const botMention = entities.find(e => e.type === 'mention');

  // Get the bot's username (from BotInfo)
  const me = await bot.getMe();
  const botUsername = `@${me.username}`;

  // Only proceed if the bot was mentioned
  if (!botMention || !text.includes(botUsername)) return;

  const chatId = msg.chat.id;
  console.log("Received direct query:", text);

  // Process the natural language query
  const intentData = await intentRecognitionAgent(text);
  const intent = intentData.intent || "other";
  const queryText = intentData.query || text;
  let responseText = "";

  if (intent === "search_query") {
    responseText = `I recognized a search query. Here are the simulated top results for "${queryText}".`;
  } else if (intent === "investment_query") {
    const prompt = `Answer this investment-related question: ${queryText}`;
    try {
      const aiResp = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.5,
      });
      responseText = aiResp.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Investment query error:", error);
      responseText = "I encountered an issue processing your query.";
    }
  } else if (intent === "general_info") {
    responseText = `General info: ${queryText}`;
  } else {
    responseText = `Let me look that up for you: ${queryText}`;
  }

  bot.sendMessage(chatId, responseText);
});


// --- End of Bot Handlers ---
// Log that the bot has started.
console.log("Investment DAO Bot is running...");
