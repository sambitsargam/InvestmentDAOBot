# Investment DAO Bot

The **Investment DAO Bot** is a Node.js Telegram bot designed to automate the process of evaluating and pitching investment ideas for a decentralized autonomous organization (DAO). The bot leverages OpenAI for enhanced summarization, risk assessment, and recommendations, and uses Supabase (PostgreSQL) for data storage. It also features an easy-to-use UX with distinct functionalities for admins and founders.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Setup and Configuration](#setup-and-configuration)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Supabase Database Setup](#supabase-database-setup)
  - [Installation](#installation)
- [Commands and Usage](#commands-and-usage)
  - [Admin Commands (Personal Chat)](#admin-commands-personal-chat)
  - [Founder Commands (Private Chat)](#founder-commands-private-chat)
  - [Group Voting and Direct Queries](#group-voting-and-direct-queries)
- [Demo and Pitch Instructions](#demo-and-pitch-instructions)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The Investment DAO Bot automates the following steps:
1. **Pitch Submission:** Founders can submit a pitch by sending the `/submit_investment <topic>` command in a private chat with the bot.
2. **Automated Evaluation:** The bot gathers research, summarizes the idea, generates an investment thesis, assesses risks, and provides recommendations using OpenAI.
3. **Idea Evaluation:** An evaluation score is generated. Only ideas scoring above a defined threshold (for example, 7 out of 10) are approved.
4. **Forwarding Approved Pitches:** Approved pitches are automatically forwarded to specified group chats for community voting.
5. **Voting and Finalization:** Group members vote using inline buttons, and the admin can later finalize the vote, view detailed results, and award incentive points.

## Features

- **Admin-Only Full Access:** Only the admin (specified by your Telegram username, e.g., `@shakti0675`) can access full functionality in personal chat.
- **Founder-Friendly Pitching:** Non-admin users (founders) can submit their ideas privately. The bot evaluates the pitches and, if they score high, forwards them to relevant groups.
- **Automated Processing:** Leverages OpenAI to perform summarization, risk assessment, and generate recommendations.
- **Voting System:** Uses inline buttons for community voting in group chats.
- **Data Storage:** Stores ideas, feedback, and member points in Supabase.
- **Detailed Reporting:** Admins can request full details of any idea using commands like `/details <idea_id>`.
- **Direct Query Handling in Groups:** The bot listens for free-form text messages when mentioned in group chats and responds based on recognized intent.

## Architecture

The project is built with the following major components:

- **Node.js & Telegram Bot API:**  
  The bot is implemented using the [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) library for handling Telegram interactions.

- **OpenAI Integration:**  
  Uses OpenAI’s GPT-3.5-turbo model for:
  - Summarizing research data.
  - Generating investment theses.
  - Assessing risks.
  - Providing recommendations.
  - Recognizing the intent of free-form queries.

- **Supabase for Storage:**  
  Data such as investment ideas, user feedback, and member point records are stored in Supabase. The required tables are:
  - **investment_ideas:** Contains columns like `topic`, `submitter_id`, `submitter_username`, `research_summary`, `thesis`, `risk_assessment`, `evaluation_score`, `status`, and `created_at`.
  - **feedback:** Contains `idea_id`, `member_id`, `member_username`, `vote`, and `timestamp`.
  - **members:** Contains `member_id`, `username`, and `points`.

- **Environment Variables:**  
  Sensitive keys and configuration parameters are loaded from a `.env` file.

## Setup and Configuration

### Prerequisites

- **Node.js:** Ensure Node.js (version 14 or later) is installed.
- **Supabase Account:** Create a Supabase account and project.
- **Telegram Bot Token:** Create a bot with [BotFather](https://core.telegram.org/bots#6-botfather) on Telegram.
- **OpenAI API Key:** Obtain your OpenAI API key from the [OpenAI Dashboard](https://platform.openai.com/overview).

### Environment Variables

Create a file named `.env` in your project root (or copy from `.env.example`) and fill in the values:

```
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_KEY=YOUR_SUPABASE_KEY
ADMIN_USERNAME=shakti0675
GROUP_CHAT_IDS=-123456789,-987654321
```

- **TELEGRAM_BOT_TOKEN:** Your Telegram bot token.
- **OPENAI_API_KEY:** Your OpenAI API key.
- **SUPABASE_URL:** The URL of your Supabase instance.
- **SUPABASE_KEY:** The Supabase service key.
- **ADMIN_USERNAME:** Your Telegram username (admin).
- **GROUP_CHAT_IDS:** A comma-separated list of Telegram group chat IDs where approved pitches will be forwarded.


### Installation

1. **Clone the Repository or Create Project Folder:**  
   Place your `index.cjs`, `package.json`, `.env`, and `README.md` files in the folder.

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Start the Bot:**

   ```bash
   node index.cjs
   ```

## Commands and Usage

### Admin Commands (Personal Chat with `@shakti0675`)

- **/start:**  
  Displays the welcome message and overview of available commands.
  
- **/help:**  
  Shows a list of admin-specific commands (submit, finalize, view details, etc.).

- **/submit_investment <topic>:**  
  Submit an investment idea directly. The full evaluation process will run and the admin can then initiate group voting.

- **/finalize_investment:**  
  Finalizes the current investment idea in the admin’s personal chat by tallying votes, updating the status, and awarding bonus points.

- **/details <idea_id>:**  
  Retrieves and displays full details of a specific investment idea.

- **/member_points:**  
  Displays the leaderboard with current incentive points for all members.

### Founder Commands (Private Chat)

- **/submit_investment <topic>:**  
  Founders send their pitch via this command. The bot evaluates the pitch; if it scores above the threshold (e.g., 7), the idea is stored and forwarded to the configured groups for voting. If not, the founder is notified to review and resubmit later.

### Group Voting and Direct Queries

- **Group Voting:**  
  When an idea is forwarded to a group, members can vote by clicking the inline buttons ("Yes" or "No"). Votes are recorded and later tallied by the admin.

- **Direct Queries in Groups:**  
  The bot listens to free-form text messages in group chats only if it is explicitly mentioned (e.g., `@YourBotName`). It processes the question using an intent recognition agent and responds accordingly.

## Troubleshooting

- **Message Handling Errors:**  
  If the bot is not responding to free-form messages in group chats, ensure you are using the `"text"` event and that the messages actually mention your bot's username.
  
- **Supabase Schema Issues:**  
  If you see errors related to missing columns (e.g., `evaluation_score`), make sure to update your Supabase schema accordingly as shown above.

- **Environment Variables:**  
  Verify your `.env` file contains correct tokens and keys.

## License

This project is provided as-is without any warranty. You are free to modify and extend it as needed for your DAO's requirements.

---

Happy Building!
```
