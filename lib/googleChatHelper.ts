export interface ChatActionResponseOptions {
  isCardAction?: boolean; // true if triggered by button click (CARD_CLICKED)
  isAddOn?: boolean; // true for Google Workspace Add-on HTTP endpoints
}

const BOT_ICON_URL = "https://ssl.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

/**
 * Formats responses to strictly comply with Google Workspace Add-on (Z Mode) specifications.
 */
export function formatChatResponse(
  payload: { cardsV2?: any[]; text?: string; title?: string },
  options: ChatActionResponseOptions = {}
) {
  const isCardAction = options.isCardAction ?? false;
  const { cardsV2, text } = payload;

  const message = cardsV2 && cardsV2.length > 0
    ? { cardsV2 }
    : { text: text ?? (isCardAction ? 'Action completed.' : 'Message received.') };

  return {
    hostAppDataAction: {
      chatDataAction: isCardAction
        ? { updateMessageAction: { message } }
        : { createMessageAction: { message } },
    },
  };
}

export function getBotEndpointUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const base = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    return base.endsWith('/api/chat/google') ? base : `${base}/api/chat/google`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/chat/google`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/chat/google`;
  }
  return "https://chuckle-pulse.vercel.app/api/chat/google";
}

export function formatLocalTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour12: true
  });
}

export function formatLocalDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getLocalHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  }).format(date);
  return parseInt(hourStr, 10);
}

export function getLocalMinute(date: Date = new Date()): number {
  const minStr = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    minute: 'numeric'
  }).format(date);
  return parseInt(minStr, 10);
}

export const POSITIVE_MORNING_GREETINGS = [
  "Good morning champion! 🚀 A fresh day full of possibilities awaits. What great goals are we crushing today?",
  "Rise and shine! ☀️ Fresh energy, clear focus. What mission-critical tasks are taking center stage today?",
  "Top of the morning! ⚡ Let’s make today count with purpose and precision. What are you building or solving today?",
  "Good morning team! 🌟 Every big breakthrough begins with focused steps. What are your high-impact priorities today?",
  "Hello rockstar! 🎯 Another day to innovate, excel, and make an impact. What are your planned targets for today?",
  "Rise and conquer! 🏔️ Great work isn't an accident—it's daily dedication. What are your planned projects and hours today?",
  "Good morning! ☕ Fuel up and let’s build excellence together. What milestones are you unlocking today?",
  "Happy morning! 💡 Big ideas turn into reality one sprint at a time. What’s your focus and hours for today?",
  "Morning greetings! 🌈 Bringing positive vibes and sharp execution into today. Drop your planned tasks, hours, and blockers!",
  "Good morning everyone! 🔥 Ready to turn complex challenges into clean victories? Share your roadmap for today!",
  "Rise and thrive! 🌿 High focus, zero clutter. What are your key deliverables for today?",
  "Good morning! 🏆 Small daily improvements over time lead to stunning results. What are you tackling today?",
  "Up and at 'em! 🚀 New morning, new bugs to conquer and features to ship. Let’s hear your plan for today!",
  "Bright morning! 🌻 Bringing creative energy and sharp execution to the team today. What are you working on?",
  "Good morning team! 🛠️ Crafting quality code and impactful work. What hours and tasks are you dedicating today?",
  "Salute to the builders! 🏗️ Laying another solid brick of progress today. What tickets or features are in your scope?",
  "Good morning champions! 💫 Momentum is our superpower. Share your planned hours, projects, and any blockers!",
  "Rise and elevate! 🧗‍♂️ Aiming high and delivering with precision. What’s on your plate for today?",
  "Morning vibes! 🎵 Smooth workflow and sharp focus ahead. Let us know what you'll be diving into today!",
  "Good morning! 🌟 Let's own the day with great teamwork and stellar focus. What tasks are you tackling today?",
  "Good morning champion! 🎯 Big goals, steady steps. What are your prime objectives for today?"
];

export function getPositiveMorningGreeting(userName?: string): string {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = Math.abs(dayOfYear) % POSITIVE_MORNING_GREETINGS.length;
  const base = POSITIVE_MORNING_GREETINGS[index];
  if (userName && userName !== "Team" && userName !== "Champion" && userName.length > 1) {
    return base.replace(/Good morning champion!|Good morning team!|Hello rockstar!|Good morning everyone!|Good morning champions!|Good morning!/i, `Good morning ${userName}!`);
  }
  return base;
}

/**
 * Builds an interactive Standup Prompt Card v2
 */
export function buildStandupPromptCard(params: {
  userName: string;
  prompt: string;
}) {
  return {
    cardsV2: [
      {
        cardId: `prompt-${Date.now()}`,
        card: {
          header: {
            title: "⏰ BytePx Daily Standup",
            subtitle: `Good morning ${params.userName}! Time to share today's mission.`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `<b>${params.prompt}</b>`
                  }
                },
                {
                  textParagraph: {
                    text: "<i>👉 Reply directly with your project, planned tasks, hours, and blockers!</i>"
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive Hours Prompt Card when an employee submitted tasks without hours
 */
export function buildHoursRequestCard(params: {
  userName: string;
  tasks: string;
  project: string;
}) {
  const endpointUrl = getBotEndpointUrl();

  return {
    cardsV2: [
      {
        cardId: `hours-prompt-${Date.now()}`,
        card: {
          header: {
            title: "⏱️ Hours Required",
            subtitle: `Thanks for the update, ${params.userName}! How many hours will this take?`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `📝 <b>Planned Tasks:</b> ${params.tasks}`
                  }
                },
                {
                  textParagraph: {
                    text: `📁 <b>Project:</b> ${params.project}`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>Tap your planned hours below or reply in chat with the number of hours</b> (e.g. <i>"8 hours"</i>, <i>"7h"</i>, <i>"6h"</i>):`
                  }
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "8 hrs (Full Day)",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "8.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "7 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "7.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "6 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "6.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "5 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "5.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "4 hrs (Half Day)",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "4.0" }
                            ]
                          }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds a clean Capacity Check Card when an employee logs fewer than 8 hours, prompting manual entry for the rest
 */
export function buildRemainingHoursCard(params: {
  userName: string;
  project?: string;
  tasks?: string;
  loggedHours: number;
  remainingHours: number;
  availableHours?: number;
}) {
  const logged = params.loggedHours;
  const avail = params.availableHours || 0;
  const totalAccounted = +(logged + avail).toFixed(1);
  const rem = params.remainingHours;

  const hasSpecificProject = Boolean(
    params.project &&
    params.project.trim() !== '' &&
    params.project.toLowerCase() !== 'general tasks' &&
    params.project.toLowerCase() !== 'general'
  );

  const cleanProject = hasSpecificProject ? params.project!.trim() : '';
  const cleanTasks = (params.tasks && params.tasks.toLowerCase() !== 'general tasks' && params.tasks.toLowerCase() !== 'general') ? params.tasks.trim() : '';

  const headerSubtitle = avail > 0
    ? `Logged ${logged} hrs work + ${avail} hrs available (${totalAccounted} / 8.0 hrs)`
    : (cleanProject ? `Logged ${logged} hrs on ${cleanProject}` : `${logged} hours logged so far`);

  const loggedText = avail > 0
    ? `📝 <b>Logged so far:</b> ${logged} hrs work${cleanProject ? ` on <b>${cleanProject}</b>` : ''}${cleanTasks && cleanTasks !== cleanProject ? ` (${cleanTasks})` : ''} + <b>${avail} hrs available</b> (Standby).`
    : (cleanProject
      ? `📝 <b>Logged so far:</b> ${logged} hrs on <b>${cleanProject}</b>${cleanTasks && cleanTasks !== cleanProject ? ` (${cleanTasks})` : ''}`
      : `📝 <b>Logged so far:</b> ${logged} hrs${cleanTasks ? ` (${cleanTasks})` : ''}`);

  const endpointUrl = process.env.GOOGLE_CHAT_ENDPOINT_URL || "https://chuckle-pulse.vercel.app/api/chat/google";

  return {
    cardsV2: [
      {
        cardId: `capacity-${Date.now()}`,
        card: {
          header: {
            title: `⏰ What about the remaining ${rem} hr${rem === 1 ? '' : 's'}?`,
            subtitle: `Logged ${logged} hrs so far (${totalAccounted} / 8.0 hrs workday shift)`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: loggedText
                  }
                },
                {
                  textParagraph: {
                    text: `💡 <i>Our workday shift is 8.0 hrs. How would you like to allocate the remaining <b>${rem} hr${rem === 1 ? '' : 's'}</b>?</i>`
                  }
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: `+${rem}h Same Project (8.0h)`,
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitRemaining" },
                              { key: "type", value: "same_project" },
                              { key: "hours", value: String(rem) }
                            ]
                          }
                        }
                      },
                      {
                        text: `Standby / Bench (${rem}h)`,
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitRemaining" },
                              { key: "type", value: "awaiting" },
                              { key: "hours", value: String(rem) }
                            ]
                          }
                        }
                      },
                      {
                        text: `Half-Day Shift (${logged}h)`,
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitRemaining" },
                              { key: "type", value: "half_day" },
                              { key: "hours", value: String(rem) }
                            ]
                          }
                        }
                      }
                    ]
                  }
                },
                {
                  textParagraph: {
                    text: `💬 <b>Or simply reply in chat</b> with what you're doing for the remaining ${rem} hr${rem === 1 ? '' : 's'} (e.g. <i>"${rem}h on documentation"</i> or <i>"free / bench"</i>)!`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an Invalid Task Entry / Non-Work Activity Notice Card
 */
export function buildNonWorkActivityCard(params: {
  userName: string;
  inputPhrase: string;
}) {
  return {
    text: `⚠️ *Invalid Task Entry: "${params.inputPhrase}"*\n❌ Personal activities cannot be logged as company work tasks.\n\n👉 *If you worked on company tasks:* Please reply with your actual project & tasks (e.g. "3h on feature development" or "3h on testing").\n🏖️ *If you took time off or left early:* Reply with "half day leave" or "personal leave".\n⏳ *If you had no tasks assigned:* Reply with "awaiting tasks".`,
    cardsV2: [
      {
        cardId: `nonwork-${Date.now()}`,
        card: {
          header: {
            title: `⚠️ Invalid Task Entry: "${params.inputPhrase}"`,
            subtitle: `Personal activities cannot be logged as company work tasks`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `❌ <b>"${params.inputPhrase}"</b> is not recognized as an active company project task or initiative.`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>If you worked on company tasks:</b> Please reply with your actual project & tasks (e.g. <i>"1h on bug fixes"</i> or <i>"1h on documentation"</i>).`
                  }
                },
                {
                  textParagraph: {
                    text: `🏖️ <b>If you took time off or left early:</b> Reply with <i>"half day leave"</i> or <i>"personal leave"</i>.`
                  }
                },
                {
                  textParagraph: {
                    text: `⏳ <b>If you had no tasks assigned:</b> Reply with <i>"awaiting tasks"</i>.`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive Standup Confirmation Card v2
 */
export function buildStandupConfirmationCard(params: {
  employeeName: string;
  project: string;
  tasks: string;
  hours: number;
  blocker: string;
  time: string;
  date?: string;
  isUpdate?: boolean;
}) {
  const blockerBadge = params.blocker === "None"
    ? "🟢 <b>Blockers:</b> None"
    : `🚨 <b>Blocker Alert:</b> ${params.blocker}`;

  const hoursText = params.hours > 0
    ? `${params.hours} hrs`
    : (params.project.includes("Awaiting") ? "0 hrs (Standby / Awaiting Tasks)" : (params.project.includes("Leave") ? "0 hrs (On Leave)" : "0 hrs (Unspecified)"));

  const cardTitle = params.isUpdate
    ? `🔄 Standup Updated: ${params.project}`
    : `✅ Standup Logged: ${params.project}`;

  const displayDate = params.date || formatLocalDate(new Date());

  const subtitle = params.isUpdate
    ? `Updated for ${params.employeeName.split(' ')[0]} on ${displayDate} at ${params.time}`
    : `Recorded for ${params.employeeName.split(' ')[0]} on ${displayDate} at ${params.time}`;

  return {
    cardsV2: [
      {
        cardId: `confirm-${Date.now()}`,
        card: {
          header: {
            title: cardTitle,
            subtitle: subtitle,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `📁 <b>Project:</b> ${params.project}`
                  }
                },
                {
                  textParagraph: {
                    text: `📝 <b>Tasks:</b> ${params.tasks}`
                  }
                },
                {
                  textParagraph: {
                    text: `⏱️ <b>Hours:</b> ${hoursText}`
                  }
                },
                {
                  textParagraph: {
                    text: blockerBadge
                  }
                },
                {
                  textParagraph: {
                    text: `📅 <b>Recorded:</b> ${displayDate} &nbsp;•&nbsp; ⏱️ <b>Time:</b> ${params.time}`
                  }
                },
                {
                  textParagraph: {
                    text: `💡 <i>Need to adjust? Simply reply with updated tasks & hours anytime today to override!</i>`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive task review card with action buttons
 */
export function buildInteractiveCard(params: {
  title: string;
  subtitle?: string;
  items: Array<{ id: string; title: string; description: string }>;
}) {
  const endpointUrl = getBotEndpointUrl();

  return {
    cardsV2: [
      {
        cardId: `card-${Date.now()}`,
        card: {
          header: {
            title: params.title,
            subtitle: params.subtitle ?? 'Interactive Bot Card',
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: params.items.map((item) => ({
            header: item.title,
            widgets: [
              {
                textParagraph: {
                  text: item.description,
                },
              },
              {
                textInput: {
                  name: `input_${item.id}`,
                  label: 'Enter your response / hours',
                  type: 'SINGLE_LINE',
                },
              },
              {
                buttonList: {
                  buttons: [
                    {
                      text: 'Submit Update',
                      onClick: {
                        action: {
                          function: endpointUrl,
                          parameters: [
                            { key: 'actionName', value: 'handleFormSubmit' },
                            { key: 'itemId', value: item.id },
                            { key: 'inputFieldName', value: `input_${item.id}` },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          })),
        },
      },
    ],
  };
}

/**
 * Confirmation success card returned in-place after button submission.
 */
export function buildSuccessCard(message: string) {
  return {
    cardsV2: [
      {
        cardId: `success-${Date.now()}`,
        card: {
          header: {
            title: '✅ Update Received',
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: message,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
