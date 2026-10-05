// Vercel Serverless Function: POST /api/chat-bot
const WORK_SAFE_GIFS = [
  "https://raw.githubusercontent.com/ABSphreak/ABSphreak/master/gifs/Hi.gif",
  "https://raw.githubusercontent.com/abhisheknaiidu/abhisheknaiidu/master/code.gif",
  "https://raw.githubusercontent.com/MartinHeinz/MartinHeinz/master/wave.gif",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif"
];

const ROTATING_PROMPTS = [
  "Good morning champion! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?",
  "Beep boop! 🛸 ChuckleBot on daily intelligence duty. What mysteries are you solving today before caffeine wears off?",
  "Rise and grind! 🚀 If your daily tasks were a movie title, what would today be called? Drop your hours & mission!",
  "Wakey wakey! 🥞 Today's masterplan check-in: What tickets are you tackling, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ I detect high productivity in the air. What are your prime targets today and any sneaky blockers?",
  "Code, coffee, conquer! ⚡ What is your main focus today and how many hours of genius are we pouring in?"
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    console.log('📥 Incoming Google Chat Event:', event.type);

    const user = event.user || (event.message && event.message.sender) || {};
    const text = (event.message && event.message.text) ? event.message.text.trim() : '';
    const senderName = user.displayName || 'Champion';
    const senderEmail = user.email ? user.email.toLowerCase() : '';

    // If greeting or empty, reply with standup prompt & animated GIF
    if (!text || ['hi', 'hello', 'hey', 'help', '/standup'].includes(text.toLowerCase())) {
      const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
      const gif = WORK_SAFE_GIFS[Math.floor(Math.random() * WORK_SAFE_GIFS.length)];

      const reply = {
        text: `⏰ *BytePx Daily Standup*\nGood morning ${senderName}!\n\n*${prompt}*\n\n👉 _Reply directly to this chat with your planned tasks, hours, and any blockers!_`,
        cardsV2: [{
          cardId: 'prompt_' + Date.now(),
          card: {
            header: {
              title: '⏰ BytePx Daily Standup',
              subtitle: `Good morning ${senderName}!`,
              imageUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
              imageType: 'CIRCLE'
            },
            sections: [{
              widgets: [
                { textParagraph: { text: `<b>${prompt}</b>` } },
                { image: { imageUrl: gif, altText: 'Morning GIF' } },
                { textParagraph: { text: '<i>👉 Reply directly with your planned tasks, hours, and blockers!</i>' } }
              ]
            }]
          }
        }]
      };

      return res.status(200).json(reply);
    }

    // Parse standup fields
    const hoursMatch = text.match(/(\d+(\.\d+)?)\s*(hrs?|hours?|h\b)/i);
    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 7.5;
    const blockerMatch = text.match(/(blocker|blocked by|blocking)[:\s-]([^\.\n]+)/i);
    const blocker = blockerMatch ? blockerMatch[2].trim() : 'None';
    const projectMatch = text.match(/(project|on|for)[:\s-]([a-zA-Z0-9\s_-]+)/i);
    const project = (projectMatch && projectMatch[2].length < 30) ? projectMatch[2].trim() : 'General Tasks';

    const blockerLine = blocker === 'None' ? '🟢 *No Blockers*' : `⚠️ *Blocker:* ${blocker}`;
    const reply = {
      text: `✅ *Daily Standup Logged for ${senderName}!* \n\n📝 *Tasks:* ${text}\n⏱️ *Hours:* ${hours} hrs  |  📁 *Project:* ${project}\n${blockerLine}\n\n_Have a great and productive day! 🚀_`
    };

    return res.status(200).json(reply);
  } catch (err) {
    console.error('Error handling chat webhook:', err);
    return res.status(200).json({ text: "✅ Standup check-in received!" });
  }
};
