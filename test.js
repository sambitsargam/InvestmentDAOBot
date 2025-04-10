import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testInsert() {
  const testData = {
    topic: "Test Topic",
    submitter_id: 1,
    submitter_username: "testuser",
    research_summary: "Test summary",
    thesis: "Test thesis",
    risk_assessment: "Test risk assessment",
    status: "pending",
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('investment_ideas')
    .insert([testData], { returning: "representation" })
    // fetch the current data in investment_ideas
   
    .single();
    // Check if the data was inserted successfully


  if (error) {
    console.error("Test insertion failed:", error);
  } else {
    console.log("Test insertion succeeded. Data:", data);
  }
}

testInsert();
