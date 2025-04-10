#!/usr/bin/env node
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import openaiPkg from 'openai';
const { Configuration, OpenAIApi } = openaiPkg;
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Initialize Telegram Bot (polling mode)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize OpenAI
const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);



// --- IN-MEMORY CHAT DATA ---
// Use a simple in-memory map to hold temporary data per chat (e.g. current investment idea)
const chatData = {};

// --- DATABASE HELPER FUNCTIONS ---
// These functions use Supabase to insert or query data from your tables.
// Ensure your Supabase project has these tables: investment_ideas, feedback, and members.

async function addInvestmentIdea(topic, submitterId, submitterUsername, researchSummary, thesis, riskAssessment) {
  const { data, error } = await supabase
    .from('investment_ideas')
    .insert([
      {
        topic,
        submitter_id: submitterId,
        submitter_username: submitterUsername,
        research_summary: researchSummary,
        thesis,
        risk_assessment: riskAssessment,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ])
    .single();
  if (error) {
    console.error("Error inserting investment idea:", error);
    throw error;
  }
  return data.id;
}

async function addFeedback(ideaId, memberId, memberUsername, vote) {
  const { error } = await supabase
    .from('feedback')
    .insert([
      {
        idea_id: ideaId,
        member_id: memberId,
        member_username: memberUsername,
        vote,
        timestamp: new Date().toISOString(),
      },
    ]);
  if (error) {
    console.error("Error inserting feedback:", error);
  }
}

async function updateMemberPoints(memberId, username, additionalPoints) {
  // Check if member exists
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
    await supabase
      .from('members')
      .update({ points: newPoints })
      .eq('member_id', memberId);
  } else {
    await supabase
      .from('members')
      .insert([{ member_id: memberId, username, points: additionalPoints }]);
  }
}

async function getFeedbackCounts(ideaId) {
  const { data, error } = await supabase
    .from('feedback')
    .select('vote');
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
  if (error) {
    console.error("Error updating idea status:", error);
  }
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
// Simulated Research Agent
function researchAgent(topic) {
  const summary = `Preliminary research on "${topic}": aggregated market data, trends, and news.`;
  console.log("ResearchAgent:", summary);
  return summary;
}

// Investment Thesis Agent
function investmentThesisAgent(researchSummary) {
  const thesis = `Investment Thesis: Based on the research, the opportunity appears promising. Details: ${researchSummary}`;
  console.log("InvestmentThesisAgent:", thesis);
  return thesis;
}

// OpenAI-powered Summarization Agent
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
    console.error("OpenAI error in summarization:", error);
    return text;
  }
}

// Risk Assessment Agent
async function riskAssessmentAgent(thesis) {
  const prompt = `Evaluate the following investment thesis and provide a risk assessment including key risk factors, mitigation strategies, and a risk score (1=low, 10=high):\n\n${thesis}\n\nRisk Assessment:`;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.6,
    });
    const riskAssessment = response.data.choices[0].message.content.trim();
    console.log("RiskAssessmentAgent generated assessment.");
    return riskAssessment;
  } catch (error) {
    console.error("OpenAI error in risk assessment:", error);
    return "Risk assessment not available at the moment.";
  }
}

// Recommendation Agent
async function recommendationAgent(thesis, riskAssessment) {
  const prompt = `Based on the following investment thesis and risk assessment, provide recommendations for next steps (e.g., due diligence areas, questions for founders, follow-up actions):\n\nThesis: ${thesis}\nRisk Assessment: ${riskAssessment}\n\nRecommendations:`;
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
    console.error("OpenAI error in recommendation:", error);
    return "No recommendations available at the moment.";
  }
}

// Intent Recognition Agent
async function intentRecognitionAgent(message) {
  const prompt = `You are a smart assistant integrated into a DAO's Telegram channel. Analyze the following message and return a JSON object indicating the intent type and, if applicable, the related query. Valid intent types include:
- "investment_query" (questions about investment ideas, risk, or due diligence),
- "general_info" (questions about DAO operations, process, or membership),
- "search_query" (questions that need live information),
- "other" (if no specific intent is recognized).

Return your answer as a JSON object with keys "intent" and "query".

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
    console.log("IntentRecognitionAgent recognized:", intentData);
    return intentData;
  } catch (error) {
    console.error("Error in intent recognition:", error);
    return { intent: "other", query: message };
  }
}

// --- TELEGRAM COMMAND & MESSAGE HANDLERS ---

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `Welcome to the Investment DAO Bot!
Commands:
/submit_investment <topic> - Propose an investment idea.
/finalize_investment - Finalize the current investment idea.
/member_points - Display member incentive points.
Or tag me in your message with any query.`;
  bot.sendMessage(chatId, welcomeText);
});

// /submit_investment command
bot.onText(/\/submit_investment (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const topic = match[1];
  const userId = msg.from.id;
  const username = msg.from.username || "anonymous";

  bot.sendMessage(chatId, `Investment idea submitted: "${topic}"`);

  // Research phase
  const rawResearch = researchAgent(topic);
  const enhancedResearch = await openAISummarizationAgent(rawResearch);
  bot.sendMessage(chatId, `Enhanced Research Summary:\n${enhancedResearch}`);

  // Build investment thesis
  const thesis = investmentThesisAgent(enhancedResearch);
  bot.sendMessage(chatId, `Thesis:\n${thesis}`);

  // Risk assessment
  const riskAssessment = await riskAssessmentAgent(thesis);
  bot.sendMessage(chatId, `Risk Assessment:\n${riskAssessment}`);

  // Recommendations
  const recommendations = await recommendationAgent(thesis, riskAssessment);
  bot.sendMessage(chatId, `Recommendations:\n${recommendations}`);

  // Store idea in Supabase
  try {
    const ideaId = await addInvestmentIdea(topic, userId, username, enhancedResearch, thesis, riskAssessment);
    // Save current idea per chat in memory
    chatData[chatId] = { currentIdeaId: ideaId };
    // Launch inline poll
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Yes', callback_data: 'yes' },
            { text: 'No', callback_data: 'no' }
          ]
        ]
      }
    };
    bot.sendMessage(chatId, "Do you approve this investment idea?", opts);
  } catch (error) {
    bot.sendMessage(chatId, "Failed to store investment idea.");
  }
});

// Callback query handler for poll votes
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const vote = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username || "anonymous";

  // Retrieve current idea id from in-memory map
  const currentData = chatData[chatId];
  if (!currentData || !currentData.currentIdeaId) {
    bot.answerCallbackQuery(callbackQuery.id, { text: "No active investment idea." });
    return;
  }
  const ideaId = currentData.currentIdeaId;
  await addFeedback(ideaId, userId, username, vote);
  await updateMemberPoints(userId, username, 1);
  bot.editMessageText(`Your vote "${vote}" has been recorded. Thank you for participating!`, { chat_id: chatId, message_id: msg.message_id });
  bot.answerCallbackQuery(callbackQuery.id);
});

// /finalize_investment command
bot.onText(/\/finalize_investment/, async (msg) => {
  const chatId = msg.chat.id;
  const currentData = chatData[chatId];
  if (!currentData || !currentData.currentIdeaId) {
    bot.sendMessage(chatId, "No active investment idea to finalize.");
    return;
  }
  const ideaId = currentData.currentIdeaId;
  const { yes, no } = await getFeedbackCounts(ideaId);
  const outcome = yes > no ? "approved" : "rejected";
  await setInvestmentIdeaStatus(ideaId, outcome);

  // Award bonus points: For example, award extra 5 points to the submitter if approved
  const ideaResp = await supabase.from('investment_ideas').select('submitter_id, submitter_username').eq('id', ideaId).single();
  if (ideaResp.data) {
    const { submitter_id, submitter_username } = ideaResp.data;
    if (outcome === "approved") {
      await updateMemberPoints(submitter_id, submitter_username, 5);
    }
  }
  // Award bonus points to voters aligned with outcome (simple example: 2 points each)
  const voteValue = outcome === "approved" ? "yes" : "no";
  const { data: voters } = await supabase.from('feedback').select('member_id, member_username').eq('idea_id', ideaId).eq('vote', voteValue);
  if (voters) {
    for (const voter of voters) {
      await updateMemberPoints(voter.member_id, voter.member_username, 2);
    }
  }
  bot.sendMessage(chatId, `Finalized Investment Idea (ID: ${ideaId}):
Yes votes: ${yes} | No votes: ${no}
Outcome: ${outcome.toUpperCase()}
Bonus points awarded.`);
  // Clear the current idea from memory for the chat
  delete chatData[chatId];
});

// /member_points command
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

// Handle free-form messages that mention the bot (direct query)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  // Only process messages that are not commands
  if (msg.text.startsWith("/")) return;

  // Check if the bot is mentioned in the message entities
  const entities = msg.entities || [];
  const isMentioned = entities.some(entity => entity.type === 'mention');
  if (!isMentioned) return;

  const messageText = msg.text;
  console.log("Received direct query:", messageText);
  const intentData = await intentRecognitionAgent(messageText);
  const intent = intentData.intent || "other";
  const queryText = intentData.query || messageText;
  let responseText = "";
  if (intent === "search_query") {
    responseText = `I recognized a search query. Simulated Search Result: Top results for "${queryText}"`;
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
      console.error("Error processing investment query:", error);
      responseText = "I encountered an issue processing your query.";
    }
  } else if (intent === "general_info") {
    responseText = `General info response: ${queryText}`;
  } else {
    responseText = `Let me look that up for you: ${queryText}`;
  }
  bot.sendMessage(chatId, responseText);
});
